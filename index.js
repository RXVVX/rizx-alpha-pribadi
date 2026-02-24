require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

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
   COMMANDS
================================ */

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🔥 SOLMATRIX ELITE AI

Ketik:
/scan PAIR_ADDRESS

Contoh:
/scan 7Qv...`
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

  const result =
`🔥 ${data.baseToken.name} (${data.baseToken.symbol})

💰 Price: $${data.priceUsd}
📊 24H Change: ${data.priceChange.h24}%

💧 Liquidity: $${data.liquidity.usd}
📈 Volume 24H: $${data.volume.h24}

📊 Status: ${ai.status}
⚠ Risk Score: ${ai.risk}/100
🚀 Momentum: ${ai.momentum}/100
🤖 AI Confidence: ${ai.confidence}%

⚠ Bukan jaminan profit. DYOR.`;

  bot.sendMessage(chatId, result);
});

console.log("🚀 SolMatrix Railway No-Canvas Version Running...");
