// server.js (CommonJS, robust networking)
const express = require("express");
const axios = require("axios");
const https = require("https");
const dns = require("dns");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (اگر از فرانت POST می‌زنی)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-webhook-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT_ID;
const SHARED_SECRET = process.env.SHARED_SECRET || "";

// Agent با keepAlive و اجبار به IPv4
const agent = new https.Agent({ keepAlive: true, timeout: 15000 });
// lookup سفارشی برای IPv4
function ipv4Lookup (hostname, options, cb) {
  return dns.lookup(hostname, { family: 4 }, cb);
}

// ارسال پیام به تلگرام (با خطای شفاف)
async function sendToTelegram(text, extra = {}, chatId = CHAT_ID) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    const params = new URLSearchParams({ chat_id: chatId, text, ...extra });
    const resp = await axios.post(url, params, {
      timeout: 15000,
      httpsAgent: agent,
      // اجبار IPv4
      transport: {
        request: (options, cb) => {
          options.lookup = ipv4Lookup;
          return https.request(options, cb);
        }
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // دقت داشته باش که axios به طور پیش‌فرض redirect را دنبال می‌کند
      maxRedirects: 0
    });
    if (!resp.data || !resp.data.ok) {
      throw new Error(`Telegram responded with error: ${JSON.stringify(resp.data)}`);
    }
    return resp.data;
  } catch (e) {
    // خطای شبکه یا پاسخ ناموفق
    const msg = e.response
      ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}`
      : (e.code ? `${e.code}: ${e.message}` : e.message);
    console.error("Telegram send error:", msg);
    throw new Error(msg);
  }
}

app.get("/", (_req, res) => res.send("OK"));

// GET تستی (برای مرورگر) — اختیاری
app.get("/hook", async (req, res) => {
  try {
    if (SHARED_SECRET && req.query.secret !== SHARED_SECRET)
      return res.status(401).send("Unauthorized");
    const r = await sendToTelegram("*Ping from GET /hook*", { parse_mode: "Markdown" });
    return res.json({ ok: true, result: r });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

// مسیر اصلی برای فرم (POST)
app.post("/hook", async (req, res) => {
  try {
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

    const r = await sendToTelegram(text, { parse_mode: "Markdown" });
    return res.json({ ok: true, result: r });
  } catch (e) {
    console.error("Handler error:", e.message || e);
    return res.status(500).json({ ok: false, error: e.message || "Internal error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
