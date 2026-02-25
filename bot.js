const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");

// ===== CONFIG (ENV MODE) =====
const TOKEN = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const GOPAY_NUMBER = "083173495612";
const MIN_DEPOSIT = 10000;
const FEE_PERCENT = 5;

if (!TOKEN || !ADMIN_ID) {
  console.error("❌ TOKEN atau ADMIN_ID belum di set di ENV");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const DB_FILE = "database.json";

// ===== AUTO CREATE DATABASE =====
if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, { users: {}, waiting: {} });
  console.log("📁 Database dibuat otomatis");
}

function loadDB() {
  return fs.readJsonSync(DB_FILE);
}

function saveDB(db) {
  fs.writeJsonSync(DB_FILE, db);
}

function getUser(db, id) {
  if (!db.users[id]) {
    db.users[id] = {
      coin: 0,
      win: 0,
      lose: 0
    };
  }
  return db.users[id];
}

// ===== START =====
bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id,
`👋 Selamat datang di DUEL RXVVX

🆔 ID kamu: ${msg.from.id}

Gunakan /menu untuk melihat fitur.`);
});

// ===== CEK ID SENDIRI =====
bot.onText(/\/id/, msg => {
  bot.sendMessage(msg.chat.id, `🆔 ID kamu: ${msg.from.id}`);
});

// ===== MENU =====
bot.onText(/\/menu/, msg => {
  bot.sendMessage(msg.chat.id,
`💖 MENU DUEL RXVVX 💖

🎮 GAME
/reme <coin> - Duel PvP

💰 EKONOMI
/deposit - Isi saldo
/coin - Cek saldo
/id - Cek ID kamu

👑 ADMIN
/addcoin id jumlah`);
});

// ===== CEK COIN =====
bot.onText(/\/coin/, msg => {
  const db = loadDB();
  const user = getUser(db, msg.from.id);
  bot.sendMessage(msg.chat.id, `💰 Coin kamu: ${user.coin}`);
});

// ===== DEPOSIT INFO =====
bot.onText(/\/deposit/, msg => {
  bot.sendMessage(msg.chat.id,
`💰 Deposit GOPAY

Kirim ke nomor:
${GOPAY_NUMBER}

Minimal deposit: ${MIN_DEPOSIT}
Fee sistem: 5%

Setelah transfer, kirim bukti ke admin.`);
});

// ===== ADMIN TAMBAH COIN =====
bot.onText(/\/addcoin (\d+) (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID)
    return bot.sendMessage(msg.chat.id, "❌ Khusus admin");

  const userId = match[1];
  const amount = parseInt(match[2]);

  const db = loadDB();
  getUser(db, userId).coin += amount;
  saveDB(db);

  bot.sendMessage(msg.chat.id, "✅ Coin berhasil ditambahkan");
});

// ===== AUTO MATCH PVP REME =====
bot.onText(/\/reme (\d+)/, (msg, match) => {
  const taruhan = parseInt(match[1]);
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (taruhan <= 0)
    return bot.sendMessage(chatId, "❌ Taruhan tidak valid");

  const db = loadDB();
  const user = getUser(db, userId);

  if (user.coin < taruhan)
    return bot.sendMessage(chatId, "❌ Coin tidak cukup");

  if (db.waiting[taruhan]) {
    const lawanId = db.waiting[taruhan];

    if (lawanId === userId) return;

    const lawan = getUser(db, lawanId);

    const total = taruhan * 2;
    const fee = Math.floor(total * FEE_PERCENT / 100);
    const hadiah = total - fee;

    const pemenang = Math.random() < 0.5 ? userId : lawanId;

    if (pemenang === userId) {
      user.coin += hadiah - taruhan;
      user.win++;
      lawan.coin -= taruhan;
      lawan.lose++;
    } else {
      lawan.coin += hadiah - taruhan;
      lawan.win++;
      user.coin -= taruhan;
      user.lose++;
    }

    delete db.waiting[taruhan];
    saveDB(db);

    bot.sendMessage(chatId,
`⚔️ Duel ditemukan!
${msg.from.first_name} vs pemain lain

🏆 Pemenang: ${pemenang === userId ? msg.from.first_name : "Lawan"}
💰 Hadiah: ${hadiah}`);
  } else {
    db.waiting[taruhan] = userId;
    saveDB(db);
    bot.sendMessage(chatId, `⌛ Menunggu lawan untuk taruhan ${taruhan} coin...`);
  }
});

// ===== ANTI CRASH =====
process.on("uncaughtException", err => console.log("Error:", err));
process.on("unhandledRejection", err => console.log("Promise Error:", err));

console.log("🤖 DUEL RXVVX aktif & siap!");
