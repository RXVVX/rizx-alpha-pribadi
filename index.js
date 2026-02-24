require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { createCanvas } = require("canvas");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

/* ===============================
   FETCH DATA DARI DEXSCREENER
================================ */
async function fetchToken(pairAddress) {
  try {
    const res = await axios.get(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`
    );
    return res.data.pair;
  } catch (e) {
    return null;
  }
}

/* ===============================
   AI ANALYSIS ENGINE
================================ */
function calculateAI(data) {
  const priceChange = parseFloat(data.priceChange.h24 || 0);
  const volume = parseFloat(data.volume.h24 || 0);
  const liquidity = parseFloat(data.liquidity.usd || 0);

  const risk = liquidity < 50000 ? 75 : liquidity < 100000 ? 50 : 25;
  const momentum = priceChange > 20 ? 90 : priceChange > 10 ? 70 : 40;

  const confidence = Math.floor(
    momentum * 0.4 +
    (100 - risk) * 0.3 +
    (volume > 100000 ? 80 : 40) * 0.2 +
    (liquidity > 100000 ? 80 : 40) * 0.1
  );

  let status = "SIDEWAYS 👀";
  if (confidence > 85) status = "EXTREME BULLISH 🚀";
  else if (confidence > 65) status = "STRONG BULLISH 🔥";
  else if (confidence < 40) status = "HIGH RISK ⚠️";

  return { risk, momentum, confidence, status, volume, liquidity };
}

/* ===============================
   CANVAS ELITE UI
================================ */
function generateCanvas(tokenName, symbol, ai, price) {
  const width = 1000;
  const height = 950;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0f2027");
  bg.addColorStop(1, "#203a43");
  bg.addColorStop(2, "#2c5364");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";

  ctx.font = "bold 60px Sans";
  ctx.fillText("SOLMATRIX ELITE AI", width / 2, 90);

  ctx.font = "38px Sans";
  ctx.fillText(`${tokenName} (${symbol})`, width / 2, 160);

  ctx.font = "30px Sans";
  ctx.fillText(`Price: $${price}`, width / 2, 210);

  ctx.font = "bold 40px Sans";
  ctx.fillText(`Status: ${ai.status}`, width / 2, 270);

  drawStat(ctx, "Risk Score", ai.risk, 350);
  drawStat(ctx, "Momentum", ai.momentum, 450);

  ctx.font = "bold 45px Sans";
  ctx.fillText(`AI Confidence: ${ai.confidence}%`, width / 2, 650);

  drawBar(ctx, 250, 690, 500, 35, ai.confidence);

  ctx.font = "25px Sans";
  ctx.fillText(
    "Analisa berdasarkan data market realtime • Bukan jaminan profit",
    width / 2,
    880
  );

  return canvas.toBuffer();
}

function drawStat(ctx, label, value, y) {
  ctx.font = "32px Sans";
  ctx.fillText(`${label}: ${value}/100`, 500, y);
  drawBar(ctx, 250, y + 30, 500, 25, value);
}

function drawBar(ctx, x, y, width, height, value) {
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(x, y, width, height);

  const g = ctx.createLinearGradient(x, y, x + width, y);
  g.addColorStop(0, "#00f2fe");
  g.addColorStop(1, "#4facfe");

  ctx.fillStyle = g;
  ctx.fillRect(x, y, (value / 100) * width, height);
}

/* ===============================
   COMMAND
================================ */

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🔥 SOLMATRIX ELITE AI\n\nKetik:\n/scan PAIR_ADDRESS\n\nContoh:\n/scan 7Qv..."
  );
});

bot.onText(/\/scan (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const pairAddress = match[1];

  bot.sendMessage(chatId, "🔍 Scanning token...");

  const data = await fetchToken(pairAddress);

  if (!data) {
    return bot.sendMessage(chatId, "❌ Token tidak ditemukan.");
  }

  const ai = calculateAI(data);
  const image = generateCanvas(
    data.baseToken.name,
    data.baseToken.symbol,
    ai,
    data.priceUsd
  );

  bot.sendPhoto(chatId, image);
});

console.log("🚀 SolMatrix Railway Version Running...");