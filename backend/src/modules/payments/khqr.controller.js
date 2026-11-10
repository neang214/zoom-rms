import crypto from "crypto";
import { BakongKHQR, khqrData, IndividualInfo } from "bakong-khqr";
import prisma from "../../utils/db.js";
import { getIO } from "../../sockets/index.js";

const KHR_RATE = 4100;
const DEFAULT_ABA_P2P_TAG = "40600006abaP2P011237977D9FDA2D020960057996403095005369110404Dual";

function computeCRC16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export const generateKHQR = async (req, res) => {
  const { order_id, currency = "USD" } = req.body;

  console.log(`[KHQR] generateKHQR — order_id=${order_id} currency=${currency}`);

  if (!order_id)
    return res.status(400).json({ message: "order_id is required" });

  try {
    const order = await prisma.order.findUnique({
      where: { order_id: parseInt(order_id) },
      include: {
        order_items: true,
        payments: { where: { status: "Completed" } },
      },
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.payments.length > 0)
      return res.status(409).json({ message: "This order has already been paid" });
    if (order.confirmed === false)
      return res.status(400).json({ message: "Order must be confirmed before it can be paid" });

    const totalUSD = order.order_items.reduce(
      (sum, item) => sum + item.quantity * Number(item.unit_price), 0
    );

    const isusd = currency.toUpperCase() === "USD";
    const amount = isusd
      ? parseFloat(totalUSD.toFixed(2))
      : Math.round(totalUSD * KHR_RATE);

    const bakongId = process.env.BAKONG_ACCOUNT_ID || "abaakhppxxx@abaa";
    const accountNumber = process.env[isusd ? "KHQR_BAKONG_ID_USD" : "KHQR_BAKONG_ID_KHR"] || (isusd ? "500536911" : "600579964");

    console.log(`[KHQR] bakongId=${bakongId} accountNumber=${accountNumber} amount=${amount} ${currency}`);

    if (!accountNumber)
      return res.status(500).json({ message: `KHQR_BAKONG_ID_${currency.toUpperCase()} not set in .env` });

    // Personal ABA KHQR must NOT include commercial POS Tag 62 (billNumber/storeLabel/terminalLabel)
    const optionalData = {
      currency: isusd ? khqrData.currency.usd : khqrData.currency.khr,
      amount,
      expirationTimestamp: Date.now() + 10 * 60 * 1000,
      accountInformation: accountNumber,
      acquiringBank: "ABA Bank",
    };

    const info = new IndividualInfo(
      bakongId,
      process.env.KHQR_MERCHANT_NAME || "NEANG NEN",
      process.env.KHQR_MERCHANT_CITY || "Phnom Penh",
      optionalData
    );

    const khqr = new BakongKHQR();
    const result = khqr.generateIndividual(info);

    if (result.status.code !== 0)
      return res.status(500).json({ message: "Failed to generate KHQR", detail: result.status.message });

    let finalQr = result.data.qr;
    let finalMd5 = result.data.md5;

    // Inject ABA Tag 40 (abaP2P) required by ABA Mobile for personal dual-currency accounts
    const abaP2PTag = (process.env.KHQR_ABA_P2P_TAG ?? DEFAULT_ABA_P2P_TAG).trim();
    if (bakongId === "abaakhppxxx@abaa" && abaP2PTag && finalQr.includes("52045999")) {
      const qrWithoutCrcValue = finalQr.slice(0, -4).replace("52045999", `${abaP2PTag}52045999`);
      finalQr = qrWithoutCrcValue + computeCRC16(qrWithoutCrcValue);
      finalMd5 = crypto.createHash("md5").update(finalQr).digest("hex");
    }

    console.log(`[KHQR] result: code=${result.status.code} md5=${finalMd5} qr=${finalQr}`);

    res.json({
      qr: finalQr,
      md5: finalMd5,
      amount,
      currency: currency.toUpperCase(),
      order_id: parseInt(order_id),
      expires_at: Date.now() + 10 * 60 * 1000,
    });
  } catch (error) {
    console.error("[KHQR] generateKHQR error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkKHQR = async (req, res) => {
  const { md5 } = req.params;
  const { order_id } = req.query;

  if (!md5 || !order_id)
    return res.status(400).json({ message: "md5 and order_id are required" });

  const token = process.env.BAKONG_TOKEN;
  if (!token)
    return res.json({ paid: false, token_missing: true, reason: "BAKONG_TOKEN not configured on server — use manual confirm" });

  const parsedOrderId = parseInt(order_id);

  try {
    const bakongRes = await checkBakongMD5(md5, token);
    if (!bakongRes.paid) {
      return res.json({
        paid: false,
        ...(bakongRes.reason ? { reason: bakongRes.reason } : {}),
        ...(bakongRes.rateLimited ? { rate_limited: true } : {}),
        ...(bakongRes.blocked ? { ip_blocked: true } : {}),
        ...(bakongRes.authError ? { auth_error: true } : {}),
      });
    }

    let khqrMethod = await prisma.paymentMethod.findFirst({ where: { method_name: "KHQR" } });
    if (!khqrMethod)
      khqrMethod = await prisma.paymentMethod.create({ data: { method_name: "KHQR" } });

    const cashier = await prisma.user.findFirst({ where: { role: { in: ["cashier", "admin"] } } });

    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent payment attempts for this order
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parsedOrderId})`;

      const order = await tx.order.findUnique({
        where: { order_id: parsedOrderId },
        include: {
          order_items: true,
          payments: { where: { status: "Completed" } },
        },
      });

      if (!order) {
        const err = new Error("ORDER_NOT_FOUND");
        err.statusCode = 404;
        throw err;
      }

      if (order.payments.length > 0 || order.status === "Paid") {
        return { already_processed: true, order };
      }

      const totalAmount = order.order_items.reduce(
        (sum, item) => sum + item.quantity * Number(item.unit_price), 0
      );

      const createdPayment = await tx.payment.create({
        data: {
          order_id: parsedOrderId,
          method_id: khqrMethod.method_id,
          user_id: req.user?.userId || cashier?.user_id || 1,
          amount: totalAmount,
          status: "Completed",
          external_ref: md5 ? String(md5).slice(0, 100) : null,
        },
      });

      await tx.order.update({ where: { order_id: parsedOrderId }, data: { status: "Paid" } });
      if (order.table_id)
        await tx.table.update({ where: { table_id: order.table_id }, data: { is_available: true } });

      return { payment: createdPayment, order };
    });

    if (result.already_processed) {
      return res.json({ paid: true, already_processed: true });
    }

    const io = getIO();
    io.to("role:cashier").to("role:admin")
      .emit("payment:completed", { order_id: parsedOrderId, payment: result.payment });
    io.to("role:cashier").to("role:admin")
      .emit("order:status_changed", { order_id: parsedOrderId, table_id: result.order.table_id, status: "Paid" });
    io.to(`table:${result.order.table_id}`)
      .emit("order:status_changed", { order_id: parsedOrderId, table_id: result.order.table_id, status: "Paid" });

    if (result.order.table_id) {
      io.to("role:admin").to("role:cashier")
        .emit("table:updated", { table_id: result.order.table_id, is_available: true });
    }

    res.json({ paid: true, order_id: parsedOrderId });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ message: "Order not found" });
    if (error.code === "P2002") // duplicate external_ref
      return res.json({ paid: true, already_processed: true });
    console.error("[KHQR] checkKHQR error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

async function checkBakongMD5(md5, token) {
  const { default: https } = await import("https");
  return new Promise((resolve) => {
    const body = JSON.stringify({ md5 });
    const options = {
      hostname: "api-bakong.nbc.gov.kh",
      path: "/v1/check_transaction_by_md5",
      method: "POST",
      family: 4,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "ZOOM-RMS/1.0",
        Authorization: `Bearer ${token}`,
      },
    };
    const req = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        if (response.statusCode === 403) {
          console.warn("[KHQR] Bakong API returned 403 Forbidden (overseas IP restriction). Use manual confirm.");
          return resolve({ paid: false, blocked: true, reason: "Bakong API 403 Forbidden (overseas server IP blocked by NBC)" });
        }
        if (response.statusCode === 401) {
          console.warn("[KHQR] Bakong API returned 401 Unauthorized (token invalid or expired).");
          return resolve({ paid: false, authError: true, reason: "Bakong API 401 Unauthorized — BAKONG_TOKEN invalid or expired" });
        }
        if (response.statusCode === 429) {
          console.warn("[KHQR] Bakong API returned 429 Too Many Requests.");
          return resolve({ paid: false, rateLimited: true, reason: "Bakong API 429 rate limit exceeded" });
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.responseCode === 0) {
            console.log(`[KHQR] Paid confirmed for md5=${md5}`);
            return resolve({ paid: true, data: parsed.data });
          }
          if (parsed.errorCode === 17) {
            console.warn(`[KHQR] Bakong API daily limit reached: ${parsed.responseMessage}`);
            return resolve({ paid: false, rateLimited: true, reason: parsed.responseMessage });
          }
          console.log(`[KHQR] Unpaid check md5=${md5}: code=${parsed.responseCode} msg=${parsed.responseMessage}`);
          resolve({ paid: false, reason: parsed.responseMessage || `Bakong HTTP ${response.statusCode}` });
        } catch {
          console.warn(`[KHQR] Non-JSON Bakong response HTTP ${response.statusCode}: ${data.slice(0, 120)}`);
          resolve({ paid: false, reason: `Bakong returned HTTP ${response.statusCode}` });
        }
      });
    });
    req.setTimeout(8000, () => {
      req.destroy(new Error("Bakong API timeout"));
    });
    req.on("error", (err) => {
      console.error("[KHQR] checkBakongMD5 network error:", err.message);
      resolve({ paid: false, reason: `Network error contacting Bakong: ${err.message}` });
    });
    req.write(body);
    req.end();
  });
}
