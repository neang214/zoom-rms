
import https from "https";

export function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    });

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      family: 4, 
                 
                 
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.ok) {
            console.error("Telegram API error:", parsed.description);
          }
          resolve(parsed);
        } catch {
          resolve(data);
        }
      });
    });

    req.on("error", (err) => {
      console.error("Telegram request error:", err.message);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

export function stockUsedMessage(item, takenQty, role) {
  const roleKh = role === "kitchen" ? "បុគ្គលិកផ្ទះបាយ" : "បារីស្តា"
  return (
    `📦 <b>ការប្រើប្រាស់វត្ថុធាតុដើម</b> — Zoom Garden Café &amp; Wine\n\n` +
    `${roleKh} បានយក <b>${Number(takenQty).toFixed(2)} ${item.unit?.unit_name || ""}</b> នៃ <b>${item.item_name}</b>\n` +
    `នៅសល់៖ <b>${Number(item.quantity).toFixed(2)} ${item.unit?.unit_name || ""}</b>`
  )
}

export function lowStockMessage(item) {
  return (
    `⚠️ <b>ជូនដំណឹងស្តុកទំនិញស្ទើរអស់</b> — Zoom Garden Café &amp; Wine\n\n` +
    `<b>${item.item_name}</b> ស្ទើរតែអស់ហើយ។\n` +
    `បច្ចុប្បន្ន៖ <b>${Number(item.quantity).toFixed(2)} ${item.unit?.unit_name || ""}</b>\n` +
    `កម្រិតអប្បបរមា៖ <b>${Number(item.min_level).toFixed(2)} ${item.unit?.unit_name || ""}</b>\n\n` +
    `សូមបន្ថែមស្តុកទំនិញជាបន្ទាន់។`
  )
}
