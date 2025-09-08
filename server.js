// server.js  (CommonJS, axios)
const express = require("express");
const axios   = require("axios");

const app = express();

// بدنه‌ها: JSON و فرم
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// اگر از فرانت مستقیم POST می‌زنی، CORS نیاز است
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // در صورت نیاز دامنهٔ خودت را جایگزین کن
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-webhook-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── ENV ها ─────────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT_ID;   // کاربر/گروه/کانال
const SHARED_SECRET = process.env.SHARED_SECRET || ""; // اختیاری

// ── ارسال به تلگرام ───────────────────────────────────────────────
async function sendToTelegram(text, extra = {}, chatId = CHAT_ID) {
  const url    = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const params = new URLSearchParams({ chat_id: chatId, text, ...extra });

  try {
    const resp = await axios.post(url, params.toString(), {
      timeout: 15000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!resp.data || !resp.data.ok) {
      throw new Error(`Telegram responded: ${JSON.stringify(resp.data)}`);
    }
    return resp.data;
  } catch (e) {
    const msg = e.response
      ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}`
      : (e.code ? `${e.code}: ${e.message}` : e.message);
    console.error("Telegram send error:", msg);
    throw new Error(msg);
  }
}

// ── مسیر سلامت
app.get("/", (_req, res) => res.send("OK"));

// ── GET تست مرورگری (اختیاری) → برای اطمینان سریع
app.get("/hook", async (req, res) => {
  try {
    if (SHARED_SECRET && req.query.secret !== SHARED_SECRET)
      return res.status(401).send("Unauthorized");
    await sendToTelegram("*Ping from GET /hook*", { parse_mode: "Markdown" });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// ── مسیر اصلی برای فرم (POST)
app.post("/hook", async (req, res) => {
  try {
    // محافظت با سکرت (اگر تعریف کرده‌ای)
    const incomingSecret =
      req.headers["x-webhook-secret"] || req.query.secret || (req.body && req.body.secret);
    if (SHARED_SECRET && incomingSecret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const p = req.body || {};
    // اگر در المنتور ID لاتین ندادی، نگاشت لیبل‌های فارسی هم پوشش داده شده
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
