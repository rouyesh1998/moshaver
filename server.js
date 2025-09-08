// server.js (CommonJS)
const express = require("express");
const fetch = require("node-fetch"); // v2
const app = express();

// بدنه‌ها: JSON و فرم
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (اگر از فرانت POST می‌زنی)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // اگر خواستی دامنه‌ات را بگذار
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-webhook-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ENV ها
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT_ID;   // مقصد: کاربر/گروه/کانال
const SHARED_SECRET = process.env.SHARED_SECRET || ""; // اختیاری

// ارسال به تلگرام با قابلیت Markdown
async function sendToTelegram(text, extra = {}, chatId = CHAT_ID) {
  const url  = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = new URLSearchParams({ chat_id: chatId, text, ...extra });
  const res  = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram API error:", err);
    throw new Error(err);
  }
}

app.get("/", (_req, res) => res.send("OK"));

app.post("/hook", async (req, res) => {
  try {
    // محافظت ساده
    const incomingSecret =
      req.headers["x-webhook-secret"] || req.query.secret || (req.body && req.body.secret);
    if (SHARED_SECRET && incomingSecret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const p = req.body || {};
    let name  = p.name  || p["نام و نام خانوادگی"] || "";
    let phone = p.phone || p["شماره تماس"]          || "";
    let note  = p.note  || p["توضیحات (اختیاری)"]   || "";
    let slot  = p.slot  || p["زمان انتخابی"]        || "";

    const text =
      `*ثبت مشاوره جدید* 📞\n` +
      (name  ? `*نام:* ${name}\n`     : "") +
      (phone ? `*شماره:* ${phone}\n` : "") +
      (slot  ? `*زمان:* ${slot}\n`   : "") +
      (note  ? `*توضیح:* ${note}`    : "");

    await sendToTelegram(text, { parse_mode: "Markdown" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("Handler error:", e.message || e);
    return res.status(500).json({ ok: false, error: e.message || "Internal error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
