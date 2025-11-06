const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const path = require("path");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Telegram Bot Token and Chat ID
const BOT_TOKEN = "7645790126:AAESrTv3u1yjSXIpt8dayGBxeD4Q2R-P-DY";
const CHAT_ID = "5738238570";

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Please set BOT_TOKEN and CHAT_ID in server.js");
  process.exit(1);
}

let botMessages = [];

// Send message to Telegram
async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = { chat_id: CHAT_ID, text };
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (data.ok) botMessages.push({ message_id: data.result.message_id, text });
    return data;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Fetch live messages from Telegram
let lastUpdateId = 0;
async function fetchTelegramUpdates() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.ok) {
      data.result.forEach((update) => {
        if (update.message) {
          const msgId = update.message.message_id;
          const text = update.message.text || "";
          if (!botMessages.find((m) => m.message_id === msgId)) {
            botMessages.push({ message_id: msgId, text });
          }
          if (update.update_id > lastUpdateId) lastUpdateId = update.update_id;
        }
      });
    }
  } catch (err) {
    console.error("getUpdates error:", err.message);
  }
}
setInterval(fetchTelegramUpdates, 1500);

// Routes
app.get("/messages", (req, res) => res.json(botMessages));
app.get("/start", async (req, res) => res.json(await sendToTelegram("/start")));
app.get("/stop", async (req, res) => res.json(await sendToTelegram("/stop")));
app.post("/cmd", async (req, res) => {
  const { command } = req.body;
  if (!command || command.trim() === "")
    return res.status(400).json({ ok: false, description: "Command required" });
  res.json(await sendToTelegram(command));
});

app.post("/delete-message", async (req, res) => {
  const { message_id } = req.body;
  if (!message_id)
    return res
      .status(400)
      .json({ ok: false, description: "message_id required" });
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, message_id }),
    });
    const data = await resp.json();
    if (data.ok)
      botMessages = botMessages.filter((m) => m.message_id !== message_id);
    res.json(data);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Serve panel
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "panel.html"))
);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Panel Running → http://localhost:${PORT}`));
