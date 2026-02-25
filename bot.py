import json, random, os
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))

DB_FILE = "database.json"
duels = {}

# ================= DATABASE =================
def load_db():
    try:
        with open(DB_FILE) as f:
            return json.load(f)
    except:
        return {}

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f)

def get_user(uid):
    db = load_db()
    if str(uid) not in db:
        db[str(uid)] = {"coin": 1000, "win": 0, "lose": 0}
        save_db(db)
    return db[str(uid)]

def update_coin(uid, amt):
    db = load_db()
    db[str(uid)]["coin"] += amt
    save_db(db)

# ================= MENU =================
MENU = """
💖 MENU DUEL RXVVX 💖

📜 /menu
💳 /cc
🏆 /leaderboard
🔄 /tfcoin

🎮 PvP Games:
reme, qeme, qq, csn, btk, dirt, bc, bj, kb, dadu, card, flip

🛡 PvH Games:
leme, hreme, lewa, rewa
"""

async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(MENU)

# ================= BASIC =================
async def cc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = get_user(update.effective_user.id)
    await update.message.reply_text(f"💰 Coin kamu: {user['coin']}")

async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = load_db()
    top = sorted(db.items(), key=lambda x: x[1]["coin"], reverse=True)[:5]
    text = "🏆 Leaderboard:\n"
    for i, (uid, data) in enumerate(top, 1):
        text += f"{i}. {uid} - {data['coin']} coin\n"
    await update.message.reply_text(text)

async def tfcoin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 2:
        return await update.message.reply_text("Gunakan: /tfcoin id jumlah")

    sender = update.effective_user.id
    target = context.args[0]
    amount = int(context.args[1])

    if get_user(sender)["coin"] < amount:
        return await update.message.reply_text("Coin tidak cukup")

    update_coin(sender, -amount)
    update_coin(target, amount)

    await update.message.reply_text("✅ Transfer berhasil")

# ================= PvP REAL DUEL =================
async def duel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message.reply_to_message:
        return await update.message.reply_text("Reply target untuk duel")

    challenger = update.effective_user.id
    target = update.message.reply_to_message.from_user.id
    bet = int(context.args[0])

    if get_user(challenger)["coin"] < bet:
        return await update.message.reply_text("Coin tidak cukup")

    duels[target] = {"challenger": challenger, "bet": bet}
    await update.message.reply_text("⚔️ Duel dikirim! Target ketik /accept")

async def accept(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id

    if uid not in duels:
        return await update.message.reply_text("Tidak ada duel")

    data = duels.pop(uid)
    challenger = data["challenger"]
    bet = data["bet"]

    if get_user(uid)["coin"] < bet:
        return await update.message.reply_text("Coin kamu tidak cukup")

    winner = random.choice([challenger, uid])
    loser = uid if winner == challenger else challenger

    update_coin(winner, bet)
    update_coin(loser, -bet)

    await update.message.reply_text(f"🏆 Pemenang: {winner}\n💰 Hadiah: {bet}")

# ================= GENERIC GAME ENGINE =================
async def pvp_game(update, context, name):
    if not update.message.reply_to_message:
        return await update.message.reply_text("Reply lawan & masukkan bet")

    p1 = update.effective_user.id
    p2 = update.message.reply_to_message.from_user.id
    bet = int(context.args[0])

    if get_user(p1)["coin"] < bet or get_user(p2)["coin"] < bet:
        return await update.message.reply_text("Coin salah satu pemain tidak cukup")

    winner = random.choice([p1, p2])
    loser = p2 if winner == p1 else p1

    update_coin(winner, bet)
    update_coin(loser, -bet)

    await update.message.reply_text(f"🎮 {name}\n🏆 {winner} menang {bet} coin")

async def host_game(update, context, name):
    uid = update.effective_user.id
    bet = int(context.args[0])

    if get_user(uid)["coin"] < bet:
        return await update.message.reply_text("Coin tidak cukup")

    win = random.random() < 0.45

    if win:
        update_coin(uid, bet)
        result = "🎯 Menang"
    else:
        update_coin(uid, -bet)
        result = "❌ Kalah"

    await update.message.reply_text(f"🛡 {name}\n{result} {bet} coin")

# ================= PvP HANDLERS =================
async def reme(u,c): await pvp_game(u,c,"Reme")
async def qeme(u,c): await pvp_game(u,c,"Qeme")
async def qq(u,c): await pvp_game(u,c,"QQ")
async def csn(u,c): await pvp_game(u,c,"CSN")
async def btk(u,c): await pvp_game(u,c,"BTK")
async def dirt(u,c): await pvp_game(u,c,"Dirt Seed")
async def bc(u,c): await pvp_game(u,c,"Baccarat")
async def bj(u,c): await pvp_game(u,c,"Blackjack")
async def kb(u,c): await pvp_game(u,c,"Kecil Besar")
async def dadu(u,c): await pvp_game(u,c,"Adu Dadu")
async def card(u,c): await pvp_game(u,c,"Adu Kartu")
async def flip(u,c): await pvp_game(u,c,"Coinflip")

# ================= PvH HANDLERS =================
async def leme(u,c): await host_game(u,c,"Leme")
async def hreme(u,c): await host_game(u,c,"Hreme")
async def lewa(u,c): await host_game(u,c,"Lewa")
async def rewa(u,c): await host_game(u,c,"Rewa")

# ================= RUN =================
app = ApplicationBuilder().token(BOT_TOKEN).build()

# Basic
app.add_handler(CommandHandler("menu", menu))
app.add_handler(CommandHandler("cc", cc))
app.add_handler(CommandHandler("leaderboard", leaderboard))
app.add_handler(CommandHandler("tfcoin", tfcoin))

# Duel real
app.add_handler(CommandHandler("duel", duel))
app.add_handler(CommandHandler("accept", accept))

# PvP games
for cmd in ["reme","qeme","qq","csn","btk","dirt","bc","bj","kb","dadu","card","flip"]:
    app.add_handler(CommandHandler(cmd, globals()[cmd]))

# PvH games
for cmd in ["leme","hreme","lewa","rewa"]:
    app.add_handler(CommandHandler(cmd, globals()[cmd]))

print("🚀 DUEL RXVVX FINAL RUNNING")
app.run_polling()
