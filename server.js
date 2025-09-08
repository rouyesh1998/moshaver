// server.js  (ESM)
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SHARED_SECRET = process.env.SHARED_SECRET; // اختیاری

// ارسال پیام به تلگرام با امکان ارسال پارامترهای اضافه (مثل parse_mode) و chat_id سفارشی
async function sendToTelegram(text, extra = {}, chatId = CHAT_ID) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = new URLSearchParams({ chat_id: chatId, text, ...extra });
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram error: ${err}`);
  }
}

app.get("/", (_req, res) => res.send("OK"));

app.post("/hook", async (req, res) => {
  try {
    // اگر سکرت تعریف کرده‌ای، باید در هدر x-webhook-secret ارسال شود
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

    // اگر در المنتور هنوز ID لاتین نذاشتی و لیبل‌ها فارسی هستند، این مپ کمک می‌کند:
    if (!name  && p["نام و نام خانوادگی"])  name  = p["نام و نام خانوادگی"];
    if (!phone && p["شماره تماس"])           phone = p["شماره تماس"];
    if (!note  && p["توضیحات (اختیاری)"])    note  = p["توضیحات (اختیاری)"];
    if (!slot  && p["زمان انتخابی"])         slot  = p["زمان انتخابی"];

    // پیام با Markdown
    const text =
      `*ثبت مشاوره جدید* 📞\n` +
      (name  ? `*نام:* ${name}\n`     : "") +
      (phone ? `*شماره:* ${phone}\n` : "") +
      (slot  ? `*زمان:* ${slot}\n`   : "") +
      (note  ? `*توضیح:* ${note}`    : "");

    // ارسال با Markdown
    await sendToTelegram(text, { parse_mode: "Markdown" });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
