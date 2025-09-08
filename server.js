
// CORS برای درخواست‌های فرانت‌اند از دامنه‌ی سایت شما
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // اگر خواستی دامنه‌ات را بگذار
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-webhook-secret');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// توکن و chat_id رو از Environment بگیر
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SHARED_SECRET = process.env.SHARED_SECRET; // اختیاری

// ارسال پیام به تلگرام
async function sendToTelegram(text, extra = {}, chatId = CHAT_ID) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = new URLSearchParams({ chat_id: chatId, text, ...extra });
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram API error:", err);
    throw new Error(err);
  }
}

app.get("/", (_req, res) => res.send("OK"));

app.post("/hook", async (req, res) => {
  try {
    // بررسی سکرت (اگر تعریف کردی)
    const incomingSecret =
      req.headers["x-webhook-secret"] ||
      req.query.secret ||
      (req.body && req.body.secret);

    if (SHARED_SECRET && incomingSecret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const p = req.body || {};
    let name  = p.name  || "";
    let phone = p.phone || "";
    let note  = p.note  || "";
    let slot  = p.slot  || "";

    // اگر در المنتور ID لاتین نذاشتی و فقط لیبل فارسیه
    if (!name  && p["نام و نام خانوادگی"])  name  = p["نام و نام خانوادگی"];
    if (!phone && p["شماره تماس"])           phone = p["شماره تماس"];
    if (!note  && p["توضیحات (اختیاری)"])    note  = p["توضیحات (اختیاری)"];
    if (!slot  && p["زمان انتخابی"])         slot  = p["زمان انتخابی"];

    // ساخت پیام (با Markdown برای زیباتر شدن)
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

