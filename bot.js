require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log("🚀 Bot running...");

// ================= FETCH MARKET ================= //
async function fetchMarket(symbol) {
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/search?q=${symbol}`);
    const pair = res.data.pairs?.[0];
    if (!pair) return null;

    return {
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      priceUsd: parseFloat(pair.priceUsd || 0),
      change24h: parseFloat(pair.priceChange?.h24 || 0),
      liquidity: parseFloat(pair.liquidity?.usd || 0),
      volume24h: parseFloat(pair.volume?.h24 || 0),
    };
  } catch (err) {
    console.log("DEX error:", err.message);
    return null;
  }
}

// ================= START ================= //
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🔥 SOLMATRIX BOT v2

Perintah:
/check <token>
/trend <token>
/settarget <token> <harga>
/monitor <token> <buyPrice>`
  );
});

// ================= CHECK TOKEN ================= //
bot.onText(/\/check (.+)/, async (msg, match) => {
  const token = match[1];
  const data = await fetchMarket(token);

  if (!data) return bot.sendMessage(msg.chat.id, "❌ Token tidak ditemukan");

  bot.sendMessage(
    msg.chat.id,
`📊 ${data.name} (${data.symbol})
💰 Harga: $${data.priceUsd}
📈 24H: ${data.change24h}%
💧 Likuiditas: $${data.liquidity.toLocaleString()}
📊 Volume: $${data.volume24h.toLocaleString()}`
  );
});

// ================= TREND ================= //
bot.onText(/\/trend (.+)/, async (msg, match) => {
  const token = match[1];
  const data = await fetchMarket(token);
  if (!data) return bot.sendMessage(msg.chat.id, "❌ Token tidak ditemukan");

  let status = "⚖ Stabil";
  if (data.change24h > 15) status = "🚀 Strong Uptrend";
  if (data.change24h < -20) status = "⚠ Crash / Dump";

  bot.sendMessage(
    msg.chat.id,
`📊 TREND ${data.symbol}
Harga: $${data.priceUsd}
24H: ${data.change24h}%
Status: ${status}`
  );
});

// ================= TARGET ALERT ================= //
let targets = [];

bot.onText(/\/settarget (.+) ([\d.]+)/, (msg, match) => {
  const token = match[1].toUpperCase();
  const price = parseFloat(match[2]);

  targets.push({ token, price, chatId: msg.chat.id });

  bot.sendMessage(msg.chat.id, `🎯 Target diset ${token} → $${price}`);
});

// ================= MONITOR ================= //
let monitors = [];

bot.onText(/\/monitor (.+) ([\d.]+)/, (msg, match) => {
  const token = match[1].toUpperCase();
  const buyPrice = parseFloat(match[2]);

  monitors.push({ token, buyPrice, chatId: msg.chat.id });

  bot.sendMessage(msg.chat.id, `🚀 Monitoring ${token} dari harga $${buyPrice}`);
});

// ================= AUTO CHECK ================= //
setInterval(async () => {
  for (let m of monitors) {
    const data = await fetchMarket(m.token);
    if (!data) continue;

    const change = ((data.priceUsd - m.buyPrice) / m.buyPrice) * 100;

    if (Math.abs(change) >= 5) {
      bot.sendMessage(
        m.chatId,
`📊 UPDATE ${m.token}
Harga: $${data.priceUsd}
Perubahan: ${change.toFixed(2)}%`
      );
      m.buyPrice = data.priceUsd;
    }

    // target alert
    targets.forEach(t => {
      if (t.token === m.token && data.priceUsd >= t.price) {
        bot.sendMessage(
          t.chatId,
`🎯 TARGET TERCAPAI
${t.token} → $${data.priceUsd}`
        );
      }
    });
  }
}, 60000);
