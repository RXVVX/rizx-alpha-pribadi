require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const fs = require("fs");
const { Parser } = require("json2csv");
const QuickChart = require("quickchart-js");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ================= FETCH DATA ================= //
async function fetchMarket(pair) {
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`);
    const pairData = res.data.pair;
    return {
      baseToken: pairData.baseToken,
      priceUsd: parseFloat(pairData.priceUsd),
      priceChange: {
        h1: parseFloat(pairData.priceChange.h1),
        h24: parseFloat(pairData.priceChange.h24),
        h7d: parseFloat(pairData.priceChange.h7d)
      },
      liquidity: { usd: parseFloat(pairData.liquidity.usd) },
      volume: {
        h1: parseFloat(pairData.volume.h1),
        h24: parseFloat(pairData.volume.h24),
        h7d: parseFloat(pairData.volume.h7d)
      }
    };
  } catch { return null; }
}

async function fetchContractRisk(pair) {
  try { return (await axios.get(`https://api.gopluslabs.io/contractRisk?address=${pair}&apikey=${process.env.GOPLUS_API_KEY}`)).data; }
  catch { return null; }
}

async function fetchCoinGecko(pair) {
  try { return (await axios.get(`https://api.coingecko.com/api/v3/coins/${pair}`)).data; }
  catch { return null; }
}

// ================= ANALYSIS LOGIC ================= //
function generateVisualStatus(market, contract) {
  let status = "🟢 Aman";
  let warnings = [];

  if (contract) {
    if (contract.ownerPrivileges) warnings.push("Owner masih punya hak admin");
    if (!contract.liquidityLocked) warnings.push("Liquidity tidak terkunci");
    if (contract.sellTax > 20) warnings.push(`Sell tax tinggi: ${contract.sellTax}%`);
  }

  if (market) {
    const priceChange = parseFloat(market.priceChange.h24 || 0);
    const liquidity = parseFloat(market.liquidity.usd || 0);
    if (priceChange > 20 && liquidity > 30000) status = "🚀 Token Sedang Naik";
    if (priceChange < -30) status = "🟡 Token Turun Tajam";
  }

  return { status, warnings };
}

// ================= COMMANDS ================= //
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🔥 SOLMATRIX MEME SUPER BOT FINAL

Perintah:
- /check <token>        -> Info dasar token
- /god <token>          -> Skor aman & risiko
- /fullscan <token>     -> Scan lengkap + visual status
- /autoalert <token>    -> Aktifkan Auto Alert
- /report <token>       -> Download report CSV
- /trojan <token>       -> Cek kontrak mencurigakan
- /flex <token> <profit>-> Flexsing cuan meme Indonesia
- /startmonitor <token> <buyPrice> -> Monitor harga & auto trend/flex/trojan
- /settarget <token> <price> -> Set harga target alert
- /globaltrend          -> Pantau beberapa token populer
`);
});

// ================= BASIC TOOLS ================= //
bot.onText(/\/check (.+)/, async (msg, match) => {
  const market = await fetchMarket(match[1]);
  if (!market) return bot.sendMessage(msg.chat.id, "Token tidak ditemukan ❌");

  bot.sendMessage(msg.chat.id,
`📊 ${market.baseToken.name} (${market.baseToken.symbol})
💰 Harga: $${market.priceUsd}
📊 24H Change: ${market.priceChange.h24}%
💧 Likuiditas: $${market.liquidity.usd}
📈 Volume 24H: ${market.volume.h24}`);
});

// ================= GOD MODE ================= //
// (sama seperti sebelumnya, menghitung score & status token aman/scam/rugpull/uptrend)

// ================= FULLSCAN ================= //
// (sama seperti sebelumnya, menampilkan visual status + warnings + CoinGecko rank)

// ================= TARGET ALERT ================= //
let targetAlerts = []; // {token, targetPrice, user}
bot.onText(/\/settarget (.+) (\d+)/, (msg, match) => {
  targetAlerts.push({token: match[1].toUpperCase(), targetPrice: parseFloat(match[2]), user: msg.from.username || msg.from.first_name});
  bot.sendMessage(msg.chat.id, `🚨 Target alert diset untuk ${match[1]}: $${match[2]}`);
});

// ================= GLOBAL TREND ================= //
const popularTokens = ["SOL", "MANA", "SAMO", "SHIB", "PEPE"];
bot.onText(/\/globaltrend/, async (msg) => {
  let text = "🌎 Global Meme Trend:\n";
  for (let token of popularTokens) {
    const market = await fetchMarket(token);
    if (market) text += `${token}: $${market.priceUsd} | 24h: ${market.priceChange.h24}%\n`;
  }
  bot.sendMessage(msg.chat.id, text);
});

// ================= FLEXSING MEME ================= //
let flexData = [];
bot.onText(/\/flex (.+) (\d+)/, (msg, match) => {
  const token = match[1].toUpperCase();
  const profit = parseInt(match[2]);
  flexData.push({ user: msg.from.username || msg.from.first_name, token, profit });

  const randomTexts = [
    "Mantap Jiwa! 😎",
    "Waktunya gaya-gayaan dikit 🚀",
    "Beli NFT sekalian biar tambah swag 💎",
    "Cuan masuk, stress keluar 💸",
    "Traktir teman pizza 🍕 atau martabak 🥳"
  ];
  const text = randomTexts[Math.floor(Math.random() * randomTexts.length)];

  bot.sendMessage(msg.chat.id,
`🔥 FLEX MEME INDONESIA 🔥
🚀 ${msg.from.first_name} profit Rp${profit.toLocaleString()} dari token ${token}!
${text}`);
});

// ================= MONITORING 1 MENIT ================= //
let monitoredTokens = []; // {token, buyPrice, user}
let tokenHistory = {}; // { token: lastPrice }

bot.onText(/\/startmonitor (.+) (\d+)/, (msg, match) => {
  const token = match[1].toUpperCase();
  const buyPrice = parseFloat(match[2]);
  monitoredTokens.push({ token, buyPrice, user: msg.from.username || msg.from.first_name });
  bot.sendMessage(msg.chat.id, `🚀 Memantau token ${token} mulai dari harga $${buyPrice}`);
});

// Auto check tiap 1 menit
setInterval(async () => {
  for (let data of monitoredTokens) {
    const market = await fetchMarket(data.token);
    if (!market) continue;
    const currentPrice = parseFloat(market.priceUsd || 0);
    const lastPrice = tokenHistory[data.token] || data.buyPrice;

    const changePercent = ((currentPrice - lastPrice) / lastPrice) * 100;
    let trendStatus = "⚖ Stabil / Sideways";
    if (changePercent > 5) trendStatus = "🚀 STRONG UPTREND";
    else if (changePercent < -5) trendStatus = "🟡 Downtrend / Warning";

    bot.sendMessage(process.env.CHAT_ID,
`📊 TREND DETECTOR
Token: ${data.token}
Harga Sekarang: $${currentPrice.toFixed(6)}
Perubahan 1 menit: ${changePercent.toFixed(2)}%
Status: ${trendStatus}
Volume 24H: $${parseFloat(market.volume.h24).toLocaleString()} | Likuiditas: $${parseFloat(market.liquidity.usd).toLocaleString()}`);

    tokenHistory[data.token] = currentPrice;

    // ================= AUTO FLEX ================= //
    let profit = Math.round((currentPrice - data.buyPrice) * 1000);
    if (profit > 0) {
      const randomTexts = [
        "Mantap Jiwa! 😎",
        "Waktunya gaya-gayaan dikit 🚀",
        "Beli NFT sekalian biar tambah swag 💎",
        "Cuan masuk, stress keluar 💸",
        "Traktir teman pizza 🍕 atau martabak 🥳"
      ];
      const text = randomTexts[Math.floor(Math.random() * randomTexts.length)];
      bot.sendMessage(process.env.CHAT_ID,
`🔥 FLEX MEME INDONESIA 🔥
🚀 ${data.user} profit Rp${profit.toLocaleString()} dari token ${data.token}!
${text}`);
      data.buyPrice = currentPrice;
    }

    // ================= TROJAN AUTO ALERT ================= //
    const contract = await fetchContractRisk(data.token);
    if (contract) {
      let issues = [];
      if (contract.mintUnlimited) issues.push("Token bisa mint unlimited");
      if (contract.blacklistAddress) issues.push("Ada blacklist/whitelist address");
      if (contract.suspiciousTransfer) issues.push("Transfer function mencurigakan");
      if (issues.length) {
        bot.sendMessage(process.env.CHAT_ID,
`⚠ TROJAN ALERT ⚠
Token: ${data.token}
Masalah kontrak: ${issues.join(", ")}`);
      }
    }

    // ================= TARGET PRICE ALERT ================= //
    targetAlerts.forEach(alert => {
      if (alert.token === data.token) {
        if (currentPrice >= alert.targetPrice) {
          bot.sendMessage(process.env.CHAT_ID,
`🎯 TARGET ALERT 🎯
Token: ${data.token}
Harga sekarang $${currentPrice.toFixed(6)} >= target $${alert.targetPrice}`);
        }
      }
    });
  }
}, 60000);

console.log("🚀 SolMatrix Meme Super Bot FINAL Running...");