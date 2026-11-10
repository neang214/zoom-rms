import crypto from "crypto";
import jwt from "jsonwebtoken";
import { BakongKHQR, khqrData, IndividualInfo } from "bakong-khqr";
import prisma from "../../utils/db.js";
import { getIO } from "../../sockets/index.js";

const KHR_RATE = 4100;
const KHQR_TTL_MS = 10 * 60 * 1000;
const KHQR_CHECK_GRACE_MS = 60 * 1000;
const DEFAULT_ABA_P2P_TAG = "40600006abaP2P011237977D9FDA2D020960057996403095005369110404Dual";
const DEFAULT_REAKSMEY_UPI_ACCOUNT = "1974011600520446BONG10002312081";

// Tracks server-issued dynamic KHQR sessions keyed by normalized lowercase MD5
const khqrSessions = new Map();

function pruneExpiredSessions(now = Date.now()) {
  for (const [key, session] of khqrSessions.entries()) {
    if (now > session.expires_at + KHQR_CHECK_GRACE_MS) {
      khqrSessions.delete(key);
    }
  }
}

function getKhqrSessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }
  return secret;
}

function computeOrderTotalUSD(order) {
  return order.order_items.reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price),
    0
  );
}

function normalizeBakongCurrency(cur) {
  if (cur == null) return null;
  const val = String(cur).trim().toUpperCase();
  if (val === "840" || val === "USD") return "USD";
  if (val === "116" || val === "KHR") return "KHR";
  return val;
}

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

function buildIndividualOptionalData({ bakongId, currencyMode, amount, expiresAt }) {
  const isUsd = currencyMode === "USD";
  const isStatic = currencyMode === "STATIC";
  const isAba = bakongId.endsWith("@abaa");

  const envAccount = process.env[isUsd ? "KHQR_BAKONG_ID_USD" : "KHQR_BAKONG_ID_KHR"]?.trim();
  const accountInformation = isAba
    ? envAccount || (isUsd ? "500536911" : "600579964")
    : envAccount && envAccount !== bakongId
      ? envAccount
      : undefined;

  const envAcquiringBank = process.env.KHQR_ACQUIRING_BANK?.trim();
  const acquiringBank = isAba
    ? envAcquiringBank || "ABA Bank"
    : accountInformation && envAcquiringBank
      ? envAcquiringBank
      : undefined;

  // bakong-khqr only allows Tag 15 (UPI) with KHR (116), never with USD (840)
  const upiDefault = bakongId === "reaksmey_rin@bkrt" ? DEFAULT_REAKSMEY_UPI_ACCOUNT : "";
  const upiMerchantAccount = !isUsd
    ? (process.env.KHQR_UPI_MERCHANT ?? upiDefault).trim() || undefined
    : undefined;

  return {
    currency: isUsd ? khqrData.currency.usd : khqrData.currency.khr,
    ...(isStatic ? {} : { amount, expirationTimestamp: expiresAt }),
    ...(accountInformation ? { accountInformation } : {}),
    ...(acquiringBank ? { acquiringBank } : {}),
    ...(upiMerchantAccount ? { upiMerchantAccount } : {}),
  };
}

function resolveKhqrSession(normalizedMd5, parsedOrderId, rawToken) {
  pruneExpiredSessions();
  const memSession = khqrSessions.get(normalizedMd5);

  let tokenSession = null;
  if (rawToken) {
    try {
      const decoded = jwt.verify(String(rawToken), getKhqrSessionSecret());
      if (decoded?.type === "khqr_session") {
        tokenSession = decoded;
      }
    } catch {
      return { errorStatus: 400, message: "KHQR session token is invalid or expired. Please generate a new QR code." };
    }
  }

  const session = tokenSession || memSession;
  if (!session) {
    return { errorStatus: 400, message: "KHQR session not found or expired. Please generate a new QR code." };
  }

  if (memSession && tokenSession && (memSession.order_id !== tokenSession.order_id || memSession.md5 !== tokenSession.md5)) {
    return { errorStatus: 400, message: "KHQR session mismatch. Please generate a new QR code." };
  }

  if (Number(session.order_id) !== parsedOrderId || String(session.md5).toLowerCase() !== normalizedMd5) {
    return { errorStatus: 403, message: "This KHQR code does not belong to the requested order." };
  }

  if (!session.expires_at || Date.now() > Number(session.expires_at) + KHQR_CHECK_GRACE_MS) {
    khqrSessions.delete(normalizedMd5);
    return { errorStatus: 400, message: "KHQR code expired. Please generate a new QR code." };
  }

  return { session };
}

export const generateKHQR = async (req, res) => {
  const { order_id, currency = "KHR" } = req.body;
  const parsedOrderId = parseInt(order_id, 10);
  const currencyMode = String(currency || "KHR").trim().toUpperCase();

  console.log(`[KHQR] generateKHQR — order_id=${order_id} currency=${currencyMode}`);

  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0)
    return res.status(400).json({ message: "Valid order_id is required" });

  if (!["USD", "KHR", "STATIC"].includes(currencyMode))
    return res.status(400).json({ message: "currency must be USD, KHR, or STATIC" });

  try {
    const order = await prisma.order.findUnique({
      where: { order_id: parsedOrderId },
      include: {
        order_items: true,
        payments: { where: { status: "Completed" } },
      },
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.payments.length > 0 || order.status === "Paid")
      return res.status(409).json({ message: "This order has already been paid", already_paid: true });
    if (order.confirmed === false)
      return res.status(400).json({ message: "Order must be confirmed before it can be paid" });

    const totalUSD = computeOrderTotalUSD(order);
    if (totalUSD <= 0)
      return res.status(400).json({ message: "Order total must be greater than zero" });

    const totalKHR = Math.max(100, Math.round(totalUSD * KHR_RATE));
    const bakongId = (process.env.BAKONG_ACCOUNT_ID || "abaakhppxxx@abaa").trim();
    const merchantName = (process.env.KHQR_MERCHANT_NAME || "NEANG NEN").trim();
    const merchantCity = (process.env.KHQR_MERCHANT_CITY || "Phnom Penh").trim();

    if (currencyMode === "STATIC") {
      const envStaticQr = process.env.KHQR_STATIC_QR?.trim();
      let staticQr = envStaticQr;

      if (!staticQr) {
        const optionalData = buildIndividualOptionalData({
          bakongId,
          currencyMode: "STATIC",
        });
        const info = new IndividualInfo(bakongId, merchantName, merchantCity, optionalData);
        const result = new BakongKHQR().generateIndividual(info);
        if (result.status.code !== 0)
          return res.status(500).json({ message: "Failed to generate Static KHQR", detail: result.status.message });
        staticQr = result.data.qr;
      }

      return res.json({
        qr: staticQr,
        md5: null,
        amount: totalKHR,
        currency: "KHR",
        mode: "STATIC",
        is_static: true,
        order_id: parsedOrderId,
        merchant_name: merchantName,
        bakong_id: bakongId,
        expires_at: Date.now() + KHQR_TTL_MS,
      });
    }

    const isUsd = currencyMode === "USD";
    const amount = isUsd ? parseFloat(totalUSD.toFixed(2)) : totalKHR;
    const expiresAt = Date.now() + KHQR_TTL_MS;

    const optionalData = buildIndividualOptionalData({
      bakongId,
      currencyMode,
      amount,
      expiresAt,
    });

    const info = new IndividualInfo(bakongId, merchantName, merchantCity, optionalData);
    const result = new BakongKHQR().generateIndividual(info);

    if (result.status.code !== 0)
      return res.status(500).json({ message: "Failed to generate KHQR", detail: result.status.message });

    let finalQr = result.data.qr;
    let finalMd5 = String(result.data.md5).toLowerCase();

    // Inject ABA Tag 40 (abaP2P) required by ABA Mobile for personal dual-currency accounts
    const abaP2PTag = (process.env.KHQR_ABA_P2P_TAG ?? DEFAULT_ABA_P2P_TAG).trim();
    if (bakongId === "abaakhppxxx@abaa" && abaP2PTag && finalQr.includes("52045999")) {
      const qrWithoutCrcValue = finalQr.slice(0, -4).replace("52045999", `${abaP2PTag}52045999`);
      finalQr = qrWithoutCrcValue + computeCRC16(qrWithoutCrcValue);
      finalMd5 = crypto.createHash("md5").update(finalQr).digest("hex").toLowerCase();
    }

    const sessionPayload = {
      order_id: parsedOrderId,
      md5: finalMd5,
      amount,
      total_usd: parseFloat(totalUSD.toFixed(2)),
      currency: currencyMode,
      bakong_id: bakongId,
      expires_at: expiresAt,
    };

    pruneExpiredSessions();
    khqrSessions.set(finalMd5, sessionPayload);

    const khqrToken = jwt.sign(
      { type: "khqr_session", ...sessionPayload },
      getKhqrSessionSecret(),
      { expiresIn: "15m" }
    );

    console.log(`[KHQR] bakongId=${bakongId} amount=${amount} ${currencyMode} md5=${finalMd5}`);

    res.json({
      qr: finalQr,
      md5: finalMd5,
      amount,
      currency: currencyMode,
      mode: currencyMode,
      is_static: false,
      order_id: parsedOrderId,
      merchant_name: merchantName,
      bakong_id: bakongId,
      expires_at: expiresAt,
      khqr_token: khqrToken,
    });
  } catch (error) {
    console.error("[KHQR] generateKHQR error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkKHQR = async (req, res) => {
  const normalizedMd5 = String(req.params.md5 || "").trim().toLowerCase();
  const parsedOrderId = parseInt(req.query.order_id, 10);
  const rawToken = req.query.token || req.headers["x-khqr-token"];

  if (!/^[a-f0-9]{32}$/.test(normalizedMd5) || !Number.isInteger(parsedOrderId) || parsedOrderId <= 0)
    return res.status(400).json({ message: "Valid md5 and order_id are required" });

  const { session, errorStatus, message } = resolveKhqrSession(normalizedMd5, parsedOrderId, rawToken);
  if (errorStatus) {
    return res.status(errorStatus).json({ paid: false, message });
  }

  const token = process.env.BAKONG_TOKEN;
  if (!token)
    return res.json({ paid: false, token_missing: true, reason: "BAKONG_TOKEN not configured on server — use manual confirm" });

  try {
    // Short-circuit before calling Bakong if this MD5 or order is already settled
    const [existingRef, preOrder] = await Promise.all([
      prisma.payment.findUnique({ where: { external_ref: normalizedMd5 } }),
      prisma.order.findUnique({
        where: { order_id: parsedOrderId },
        include: {
          order_items: true,
          payments: { where: { status: "Completed" } },
        },
      }),
    ]);

    if (existingRef) {
      if (existingRef.order_id === parsedOrderId) {
        return res.json({ paid: true, already_processed: true });
      }
      return res.status(409).json({
        paid: false,
        message: "This KHQR transaction reference has already been used for another order.",
      });
    }

    if (!preOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (preOrder.payments.length > 0 || preOrder.status === "Paid") {
      return res.json({ paid: true, already_processed: true });
    }

    const currentTotalUSD = parseFloat(computeOrderTotalUSD(preOrder).toFixed(2));
    if (Math.abs(currentTotalUSD - Number(session.total_usd)) > 0.01) {
      return res.status(409).json({
        paid: false,
        qr_stale: true,
        message: "Order items changed after QR generation. Please generate a new QR code.",
      });
    }

    const bakongRes = await checkBakongMD5(normalizedMd5, token);
    if (!bakongRes.paid) {
      return res.json({
        paid: false,
        ...(bakongRes.reason ? { reason: bakongRes.reason } : {}),
        ...(bakongRes.rateLimited ? { rate_limited: true } : {}),
        ...(bakongRes.blocked ? { ip_blocked: true } : {}),
        ...(bakongRes.authError ? { auth_error: true } : {}),
      });
    }

    // Validate Bakong's reported transaction details against the generated KHQR session
    const bakongData = bakongRes.data;
    if (bakongData) {
      const paidCurrency = normalizeBakongCurrency(bakongData.currency);
      if (paidCurrency && paidCurrency !== session.currency) {
        return res.status(409).json({
          paid: false,
          message: `KHQR currency mismatch: expected ${session.currency}, got ${paidCurrency}.`,
        });
      }

      if (bakongData.amount !== undefined && bakongData.amount !== null) {
        const paidAmount = Number(bakongData.amount);
        const tolerance = session.currency === "USD" ? 0.011 : 1;
        if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(session.amount)) > tolerance) {
          return res.status(409).json({
            paid: false,
            message: `KHQR amount mismatch: expected ${session.amount} ${session.currency}, got ${bakongData.amount}.`,
          });
        }
      }

      // ABA personal accounts may be reported by Bakong in a different format (e.g. account number),
      // so only enforce the destination check for non-ABA Bakong IDs.
      if (bakongData.toAccountId && session.bakong_id && !String(session.bakong_id).toLowerCase().endsWith("@abaa")) {
        if (String(bakongData.toAccountId).trim().toLowerCase() !== String(session.bakong_id).toLowerCase()) {
          return res.status(409).json({
            paid: false,
            message: "KHQR destination account does not match the merchant account.",
          });
        }
      }
    }

    let khqrMethod = await prisma.paymentMethod.findFirst({ where: { method_name: "KHQR" } });
    if (!khqrMethod)
      khqrMethod = await prisma.paymentMethod.create({ data: { method_name: "KHQR" } });

    const cashier = await prisma.user.findFirst({ where: { role: { in: ["cashier", "admin"] } } });

    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent payment attempts for this order
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${parsedOrderId})`;

      const existingInTx = await tx.payment.findUnique({
        where: { external_ref: normalizedMd5 },
      });
      if (existingInTx) {
        if (existingInTx.order_id === parsedOrderId) {
          const paidOrder = await tx.order.findUnique({ where: { order_id: parsedOrderId } });
          return { already_processed: true, order: paidOrder };
        }
        const err = new Error("MD5_ALREADY_USED");
        err.statusCode = 409;
        throw err;
      }

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

      const totalAmount = computeOrderTotalUSD(order);

      const createdPayment = await tx.payment.create({
        data: {
          order_id: parsedOrderId,
          method_id: khqrMethod.method_id,
          user_id: req.user?.userId || cashier?.user_id || 1,
          amount: totalAmount,
          status: "Completed",
          external_ref: normalizedMd5.slice(0, 100),
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
    if (error.statusCode === 409) return res.status(409).json({ paid: false, message: "This KHQR transaction reference has already been used for another order." });
    if (error.code === "P2002") {
      const existingRef = await prisma.payment.findUnique({ where: { external_ref: normalizedMd5 } });
      if (existingRef && existingRef.order_id === parsedOrderId) {
        return res.json({ paid: true, already_processed: true });
      }
      return res.status(409).json({ paid: false, message: "This KHQR transaction reference has already been used for another order." });
    }
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