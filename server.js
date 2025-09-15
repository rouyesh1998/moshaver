// server.js  (CommonJS, axios)
const express = require("express");
const axios   = require("axios");

const app = express();

// بدنه‌ها: JSON و فرم
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS ساده
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-webhook-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── ENV ها ─────────────────────────────────────────────────────────
const BOT_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID_SINGLE = process.env.TELEGRAM_CHAT_ID || "";     // سازگاری با قبل
const CHAT_IDS_MULTI = (process.env.TELEGRAM_CHAT_IDS || "")   // جدید: چند مقصد
  .split(",").map(s => s.trim()).filter(Boolean);
const SHARED_SECRET  = process.env.SHARED_SECRET || "";

// ── ابزار ─────────────────────────────────────────────────────────
const toArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split(",").map(s=>s.trim()).filter(Boolean);
  return [String(v)];
};

async function sendToTelegram(text, extra = {}, chatId) {
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
    console.error(`[TG ${chatId}]`, msg);
    throw new Error(msg);
  }
}

// ── مسیر سلامت
app.get("/", (_req, res) => res.send("OK"));

// ── GET تست مرورگری
app.get("/hook", async (req, res) => {
  try {
    if (SHARED_SECRET && req.query.secret !== SHARED_SECRET)
      return res.status(401).send("Unauthorized");

    const candidates = [
      ...toArray(req.query.chat_id),
      ...toArray(req.query.chat_ids),
      ...CHAT_IDS_MULTI,
      ...(CHAT_ID_SINGLE ? [CHAT_ID_SINGLE] : []),
    ];
    if (!BOT_TOKEN || candidates.length === 0)
      return res.status(500).json({ ok:false, error:"missing bot token/chat_id(s)" });

    const text = "*Ping from GET /hook*";
    const results = await Promise.allSettled(
      candidates.map(id => sendToTelegram(text, { parse_mode:"Markdown" }, id))
    );
    const ok = results.some(r => r.status==="fulfilled" && r.value?.ok);
    if (!ok) return res.status(502).json({ ok:false, error:"send_failed", results });
    return res.json({ ok:true, sent_to: candidates });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || String(e) });
  }
});

// ── مسیر اصلی (POST)
app.post("/hook", async (req, res) => {
  try {
    // محافظت با سکرت (اگر تعریف کرده‌ای)
    const incomingSecret =
      req.headers["x-webhook-secret"] || req.query.secret || (req.body && req.body.secret);
    if (SHARED_SECRET && incomingSecret !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!BOT_TOKEN) return res.status(500).json({ ok:false, error:"missing bot token" });

    const p = req.body || {};
    // نگاشت‌های فارسی برای سازگاری با فرم‌ها
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

    // تعیین مقصدها: اولویت با payload → سپس TELEGRAM_CHAT_IDS → سپس TELEGRAM_CHAT_ID
    const targets =
      [...toArray(p.chat_id), ...toArray(p.chat_ids)]
      .concat(CHAT_IDS_MULTI)
      .concat(CHAT_ID_SINGLE ? [CHAT_ID_SINGLE] : [])
      .filter(Boolean);

    if (targets.length === 0)
      return res.status(400).json({ ok:false, error:"no chat_id(s) provided or configured" });

    const results = await Promise.allSettled(
      targets.map(id => sendToTelegram(text, { parse_mode:"Markdown" }, id))
    );
    const ok = results.some(r => r.status==="fulfilled" && r.value?.ok);
    if (!ok) return res.status(502).json({ ok:false, error:"send_failed", results });

    return res.json({ ok:true, sent_to: targets });
  } catch (e) {
    console.error("Handler error:", e.message || e);
    return res.status(500).json({ ok:false, error: e.message || "Internal error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
