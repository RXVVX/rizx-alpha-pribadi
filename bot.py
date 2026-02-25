import json, random, os
from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

# ================= ENV (HANYA INI) =================
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))

# ================= CONFIG LOKAL =================
GOPAY_NUMBER = "083173495612"
MIN_DEPOSIT = 10000
TRANSFER_FEE = 0.05
DAILY_TRANSFER_LIMIT = 10

DB_FILE = "database.json"

# ================= DATABASE =================
def load_db():
    return json.load(open(DB_FILE))

def save_db(db):
    json.dump(db, open(DB_FILE, "w"), indent=2)

def get_user(db, uid, username):
    uid = str(uid)
    if uid not in db["users"]:
        db["users"][uid] = {
            "username": username,
            "coin": 0,
            "win": 0,
            "lose": 0,
            "tf_count": 0
        }
    return db["users"][uid]

# ================= MENU =================
async def menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = """
💖 *MENU DUEL RXVVX* 💖

🎮 Game aktif
💰 Ekonomi aktif
🤖 PvP & PvH siap
"""
    await update.message.reply_text(text, parse_mode="Markdown")

# ================= SALDO =================
async def cc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    db = load_db()
    user = get_user(db, update.effective_user.id, update.effective_user.username)
    await update.message.reply_text(f"💰 Coin kamu: {user['coin']}")

# ================= DEPOSIT =================
async def depo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
f"""💰 Deposit GoPay
Nomor: {GOPAY_NUMBER}
Minimal: Rp{MIN_DEPOSIT}

Kirim bukti transfer ke admin."""
)

# ================= TRANSFER =================
async def tfcoin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if len(context.args) < 2:
        return await update.message.reply_text("Format: /tfcoin username jumlah")

    target_name = context.args[0].replace("@","")
    amount = int(context.args[1])

    db = load_db()
    sender = get_user(db, update.effective_user.id, update.effective_user.username)

    if sender["tf_count"] >= DAILY_TRANSFER_LIMIT:
        return await update.message.reply_text("Limit transfer harian tercapai.")

    if sender["coin"] < amount:
        return await update.message.reply_text("Coin tidak cukup.")

    fee = int(amount * TRANSFER_FEE)
    total = amount + fee

    for uid, u in db["users"].items():
        if u["username"] == target_name:
            sender["coin"] -= total
            u["coin"] += amount
            sender["tf_count"] += 1
            save_db(db)
            return await update.message.reply_text(
                f"✅ Transfer berhasil\nFee: {fee}\nTerkirim: {amount}"
            )

    await update.message.reply_text("User tidak ditemukan.")

# ================= GAME COINFLIP =================
async def flip(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        return await update.message.reply_text("Format: /flip jumlah")

    bet = int(context.args[0])
    db = load_db()
    user = get_user(db, update.effective_user.id, update.effective_user.username)

    if bet <= 0 or user["coin"] < bet:
        return await update.message.reply_text("Bet tidak valid.")

    if random.choice([True, False]):
        user["coin"] += bet
        result = "MENANG"
    else:
        user["coin"] -= bet
        result = "KALAH"

    save_db(db)
    await update.message.reply_text(f"Hasil: {result}\nSaldo: {user['coin']}")

# ================= GAME DADU =================
async def dadu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        return await update.message.reply_text("Format: /dadu jumlah")

    bet = int(context.args[0])
    db = load_db()
    user = get_user(db, update.effective_user.id, update.effective_user.username)

    if user["coin"] < bet:
        return await update.message.reply_text("Coin tidak cukup.")

    player = random.randint(1,6)
    bot = random.randint(1,6)

    if player > bot:
        user["coin"] += bet
        hasil = "MENANG"
    elif player < bot:
        user["coin"] -= bet
        hasil = "KALAH"
    else:
        hasil = "SERI"

    save_db(db)
    await update.message.reply_text(f"Kamu: {player}\nBot: {bot}\n{hasil}")

# ================= ADMIN ADDCOIN =================
async def addcoin(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_ID:
        return await update.message.reply_text("Khusus admin.")

    uid = context.args[0]
    amount = int(context.args[1])

    db = load_db()
    user = get_user(db, uid, "user")
    user["coin"] += amount
    save_db(db)

    await update.message.reply_text("Coin berhasil ditambahkan.")

# ================= RUN =================
app = ApplicationBuilder().token(BOT_TOKEN).build()

app.add_handler(CommandHandler("menu", menu))
app.add_handler(CommandHandler("cc", cc))
app.add_handler(CommandHandler("depo", depo))
app.add_handler(CommandHandler("tfcoin", tfcoin))
app.add_handler(CommandHandler("flip", flip))
app.add_handler(CommandHandler("dadu", dadu))
app.add_handler(CommandHandler("addcoin", addcoin))

print("🚀 DUEL RXVVX BOT RUNNING...")
app.run_polling()
