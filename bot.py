import discord
from discord.ext import commands
import random
import json
import os
import sys

# ================= CONFIG =================
TOKEN = os.getenv("TOKEN")

if not TOKEN:
    print("ERROR: TOKEN tidak ditemukan di Environment Variables!")
    sys.exit(1)

ADMIN_IDS = [1478560895058579476]  # GANTI DENGAN ID ADMIN KAMU
ADMIN_FEE_PERCENT = 5
DEPOSIT_NUMBER = "6283173495612"

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=".", intents=intents)

DATA_FILE = "database.json"

# ================= DATABASE =================
def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data():
    with open(DATA_FILE, "w") as f:
        json.dump(data, f)

data = load_data()
matches = {}

def ensure(uid):
    if uid not in data:
        data[uid] = {"balance": 0, "win": 0, "lose": 0}

def parse_amount(amount):
    amount = amount.lower()
    if amount.endswith("k"):
        return int(float(amount[:-1]) * 1000)
    if amount.endswith("m"):
        return int(float(amount[:-1]) * 1000000)
    return int(amount)

def winrate(uid):
    w = data[uid]["win"]
    l = data[uid]["lose"]
    total = w + l
    if total == 0:
        return 0
    return round((w / total) * 100, 2)

# ================= MATCH SYSTEM =================
async def match_system(ctx, bet, game, roll_func, rounds):
    uid = str(ctx.author.id)
    ensure(uid)

    bet = parse_amount(bet)
    rounds = max(1, min(10, rounds))
    total_bet = bet * rounds

    if data[uid]["balance"] < total_bet:
        await ctx.send("Saldo tidak cukup.")
        return

    if game not in matches:
        matches[game] = None

    if matches[game] is None:
        matches[game] = (uid, bet, rounds)
        await ctx.send(f"Menunggu lawan | {game.upper()} | Bet {bet} | Round {rounds}")
        return

    uid2, bet2, rounds2 = matches[game]

    if bet != bet2 or rounds != rounds2:
        await ctx.send("Bet & round harus sama.")
        return

    matches[game] = None
    ensure(uid2)

    if data[uid2]["balance"] < total_bet:
        await ctx.send("Lawan tidak cukup saldo.")
        return

    # Potong saldo awal
    data[uid]["balance"] -= total_bet
    data[uid2]["balance"] -= total_bet

    score1 = 0
    score2 = 0

    for _ in range(rounds):
        r1 = roll_func()
        r2 = roll_func()
        if r1 > r2:
            score1 += 1
        elif r2 > r1:
            score2 += 1

    if score1 > score2:
        winner = uid
        loser = uid2
    else:
        winner = uid2
        loser = uid

    pot = total_bet * 2
    fee = int(pot * ADMIN_FEE_PERCENT / 100)
    win_amount = pot - fee

    data[winner]["balance"] += win_amount
    data[winner]["win"] += 1
    data[loser]["lose"] += 1

    save_data()

    await ctx.send(
        f"{game.upper()} RESULT\n"
        f"Score {score1} vs {score2}\n"
        f"Winner: <@{winner}>\n"
        f"Menang: {win_amount}\n"
        f"Fee Admin: {fee}"
    )

# ================= EVENTS =================
@bot.event
async def on_ready():
    print("GameSpin Online!")

# ================= USER =================
@bot.command()
async def register(ctx):
    uid = str(ctx.author.id)
    if uid in data:
        await ctx.send("Sudah terdaftar.")
        return
    ensure(uid)
    save_data()
    await ctx.send("Registrasi berhasil. Saldo 0.")

@bot.command()
async def balance(ctx):
    uid = str(ctx.author.id)
    ensure(uid)
    await ctx.send(
        f"Saldo: {data[uid]['balance']}\n"
        f"Win: {data[uid]['win']} | Lose: {data[uid]['lose']}\n"
        f"Winrate: {winrate(uid)}%"
    )

@bot.command()
async def deposit(ctx, jumlah):
    await ctx.send(f"Transfer ke {DEPOSIT_NUMBER} (GOPAY/OVO/DANA)\nKirim bukti ke admin.")

# ================= GAME =================
@bot.command()
async def dice(ctx, jumlah, rounds: int = 1):
    await match_system(ctx, jumlah, "dice", lambda: random.randint(1,6), rounds)

@bot.command()
async def reme(ctx, jumlah, rounds: int = 1):
    await match_system(ctx, jumlah, "reme", lambda: random.randint(1,13), rounds)

@bot.command()
async def qeme(ctx, jumlah, rounds: int = 1):
    await match_system(ctx, jumlah, "qeme", lambda: random.randint(1,12), rounds)

@bot.command()
async def csn(ctx, jumlah, rounds: int = 1):
    await match_system(ctx, jumlah, "csn", lambda: random.randint(1,100), rounds)

@bot.command()
async def spin(ctx):
    number = random.randint(1,100)
    await ctx.send(f"SPIN RESULT: {number}")

# ================= ADMIN =================
@bot.command()
async def addcoin(ctx, member: discord.Member, jumlah):
    if ctx.author.id not in ADMIN_IDS:
        return
    uid = str(member.id)
    ensure(uid)
    jumlah = parse_amount(jumlah)
    data[uid]["balance"] += jumlah
    save_data()
    await ctx.send("Coin ditambahkan.")

@bot.command()
async def deletecoin(ctx, member: discord.Member, jumlah):
    if ctx.author.id not in ADMIN_IDS:
        return
    uid = str(member.id)
    ensure(uid)
    jumlah = parse_amount(jumlah)
    data[uid]["balance"] = max(0, data[uid]["balance"] - jumlah)
    save_data()
    await ctx.send("Coin dikurangi.")

bot.run(TOKEN)
