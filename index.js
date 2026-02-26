const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs-extra");
const config = require("./config");

const bot = new TelegramBot(config.botToken, { polling: true });
const dbFile = "./database.json";
let db = fs.readJsonSync(dbFile);

// ===== DATABASE =====
function saveDB() {
  fs.writeJsonSync(dbFile, db, { spaces: 2 });
}

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = { coin: 1000, bank: 0 };
  }
  return db.users[id];
}

// ===== START =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `🤖 ${config.botName} aktif!\nKetik .menu`);
});

// ===== MENU =====
bot.onText(/\.menu/, (msg) => {
  bot.sendMessage(msg.chat.id, `
╭───〔 BOT DUEL RXVVX 〕
│ 🎮 GAME
│ • .coin <bet> head/tail
│ • .dadu <bet>
│ • .rps <bet> batu/gunting/kertas
│
│ 💰 EKONOMI
│ • .cu
│ • .tf @user jumlah
│ • .top
│ • .bank
│ • .savebank jumlah
│ • .cashout jumlah
│
│ 💳 DEPOSIT
│ • .depo
│ • .topup jumlah
╰────────────────
`);
});

// ===== CEK UANG =====
bot.onText(/\.cu/, (msg) => {
  const user = getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, `💰 Saldo: ${user.coin}`);
});

// ===== TRANSFER =====
bot.onText(/\.tf (.+) (\d+)/, (msg, match) => {
  const sender = getUser(msg.from.id);
  const amount = parseInt(match[2]);

  if (sender.coin < amount)
    return bot.sendMessage(msg.chat.id, "Saldo tidak cukup");

  sender.coin -= amount;
  saveDB();
  bot.sendMessage(msg.chat.id, "Transfer berhasil");
});

// ===== LEADERBOARD =====
bot.onText(/\.top/, (msg) => {
  let list = Object.entries(db.users)
    .map(([id, u]) => ({ id, coin: u.coin }))
    .sort((a, b) => b.coin - a.coin)
    .slice(0, 10);

  let text = "🏆 Leaderboard\n";
  list.forEach((u, i) => (text += `${i + 1}. ${u.coin}\n`));
  bot.sendMessage(msg.chat.id, text);
});

// ===== COIN FLIP =====
bot.onText(/\.coin (\d+) (head|tail)/, (msg, match) => {
  const bet = parseInt(match[1]);
  const choice = match[2];
  const user = getUser(msg.from.id);

  if (user.coin < bet)
    return bot.sendMessage(msg.chat.id, "Saldo kurang");

  const result = Math.random() < 0.5 ? "head" : "tail";

  if (choice === result) {
    user.coin += bet;
    bot.sendMessage(msg.chat.id, `🪙 Menang! hasil: ${result}`);
  } else {
    user.coin -= bet;
    bot.sendMessage(msg.chat.id, `🪙 Kalah! hasil: ${result}`);
  }
  saveDB();
});

// ===== DADU =====
bot.onText(/\.dadu (\d+)/, (msg, match) => {
  const bet = parseInt(match[1]);
  const user = getUser(msg.from.id);

  if (user.coin < bet) return;

  const roll = Math.floor(Math.random() * 6) + 1;

  if (roll > 3) {
    user.coin += bet;
    bot.sendMessage(msg.chat.id, `🎲 ${roll} Menang`);
  } else {
    user.coin -= bet;
    bot.sendMessage(msg.chat.id, `🎲 ${roll} Kalah`);
  }
  saveDB();
});

// ===== RPS =====
bot.onText(/\.rps (\d+) (batu|gunting|kertas)/, (msg, match) => {
  const bet = parseInt(match[1]);
  const choice = match[2];
  const user = getUser(msg.from.id);

  const options = ["batu", "gunting", "kertas"];
  const botPick = options[Math.floor(Math.random() * 3)];

  if (user.coin < bet) return;

  if (choice === botPick) {
    bot.sendMessage(msg.chat.id, "Seri");
  } else if (
    (choice === "batu" && botPick === "gunting") ||
    (choice === "gunting" && botPick === "kertas") ||
    (choice === "kertas" && botPick === "batu")
  ) {
    user.coin += bet;
    bot.sendMessage(msg.chat.id, `Menang lawan ${botPick}`);
  } else {
    user.coin -= bet;
    bot.sendMessage(msg.chat.id, `Kalah lawan ${botPick}`);
  }
  saveDB();
});

// ===== BANK =====
bot.onText(/\.bank/, (msg) => {
  const user = getUser(msg.from.id);
  bot.sendMessage(msg.chat.id, `🏦 Bank: ${user.bank}`);
});

bot.onText(/\.savebank (\d+)/, (msg, match) => {
  const user = getUser(msg.from.id);
  const amount = parseInt(match[1]);
  if (user.coin < amount) return;
  user.coin -= amount;
  user.bank += amount;
  saveDB();
  bot.sendMessage(msg.chat.id, "Disimpan ke bank");
});

bot.onText(/\.cashout (\d+)/, (msg, match) => {
  const user = getUser(msg.from.id);
  const amount = parseInt(match[1]);
  if (user.bank < amount) return;
  user.bank -= amount;
  user.coin += amount;
  saveDB();
  bot.sendMessage(msg.chat.id, "Berhasil tarik dari bank");
});

// ===== DEPOSIT INFO =====
bot.onText(/\.depo/, (msg) => {
  bot.sendMessage(msg.chat.id, `
💳 DEPOSIT KOMUNITAS

DANA/OVO/GOPAY:
${config.depositNumber}

Kirim bukti ke admin.
`);
});

// ===== TOPUP REQUEST =====
bot.onText(/\.topup (\d+)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, `
Topup ${match[1]}
Transfer ke: ${config.depositNumber}
Kirim bukti ke admin.
`);
});

console.log("✅ Bot berjalan...");
