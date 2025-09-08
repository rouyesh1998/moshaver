import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SHARED_SECRET = process.env.SHARED_SECRET; // اختیاری

async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = new URLSearchParams({ chat_id: CHAT_ID, text });
  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

app.get("/", (req, res) => res.send("OK"));

app.post("/hook", async (req, res) => {
  try {
    if (SHARED_SECRET && req.headers["x-webhook-secret"] !== SHARED_SECRET) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const p = req.body || {};
    const name = p.name || "";
    const phone = p.phone || "";
    const note = p.note || "";
    const slot = p.slot || "";

    const text = `📩 مشاوره جدید\nنام: ${name}\nشماره: ${phone}\nزمان: ${slot}\nتوضیح: ${note}`;
    await sendToTelegram(text);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
