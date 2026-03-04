import discord
from discord.ext import commands
import os
import json
import random

# ================= CONFIG =================
TOKEN = os.getenv("TOKEN")

if not TOKEN:
    print("❌ TOKEN TIDAK TERBACA!")
    exit()

ADMIN_IDS = [1478560895058579476]  # GANTI DENGAN ID DISCORD KAMU
ADMIN_FEE_PERCENT = 5
DEPOSIT_NUMBER = "6283173495612"

DATA_FILE = "database.json"

# ================= SETUP =================
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=".", intents=intents)

# ================= DATABASE =================
def load_data():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump({}, f)
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def parse_amount(amount):
    amount = amount.lower()
    if "k" in amount:
        return int(float(amount.replace("k","")) * 1000)
    if "m" in amount:
        return int(float(amount.replace("m","")) * 1000000)
    return int(amount)

# ================= READY =================
@bot.event
async def on_ready():
    print(f"✅ Bot aktif sebagai {bot.user}")

# ================= REGISTER =================
@bot.command()
async def register(ctx):
    data = load_data()
    uid = str(ctx.author.id)

    if uid in data:
        await ctx.send("❌ Kamu sudah terdaftar.")
        return

    data[uid] = {
        "balance": 0,
        "win": 0,
        "lose": 0
    }
    save_data(data)
    await ctx.send("✅ Registrasi berhasil! Saldo awal: 0 coin")

# ================= BALANCE =================
@bot.command()
async def balance(ctx):
    data = load_data()
    uid = str(ctx.author.id)

    if uid not in data:
        await ctx.send("❌ Kamu belum register.")
        return

    bal = data[uid]["balance"]
    await ctx.send(f"💰 Saldo kamu: {bal} coin")

# ================= ADMIN ADD COIN =================
@bot.command()
async def addcoin(ctx, member: discord.Member, amount):
    if ctx.author.id not in ADMIN_IDS:
        return

    data = load_data()
    uid = str(member.id)

    if uid not in data:
        await ctx.send("User belum register.")
        return

    amount = parse_amount(amount)
    data[uid]["balance"] += amount
    save_data(data)

    await ctx.send(f"✅ {amount} coin ditambahkan ke {member.name}")

# ================= ADMIN DELETE COIN =================
@bot.command()
async def deletecoin(ctx, member: discord.Member, amount):
    if ctx.author.id not in ADMIN_IDS:
        return

    data = load_data()
    uid = str(member.id)

    if uid not in data:
        return

    amount = parse_amount(amount)
    data[uid]["balance"] -= amount
    if data[uid]["balance"] < 0:
        data[uid]["balance"] = 0

    save_data(data)
    await ctx.send(f"🗑 Coin {member.name} dikurangi {amount}")

# ================= DICE GAME =================
@bot.command()
async def dice(ctx, amount):
    data = load_data()
    uid = str(ctx.author.id)

    if uid not in data:
        await ctx.send("Register dulu.")
        return

    amount = parse_amount(amount)

    if data[uid]["balance"] < amount:
        await ctx.send("Saldo tidak cukup.")
        return

    player_roll = random.randint(1,6)
    bot_roll = random.randint(1,6)

    if player_roll > bot_roll:
        win = int(amount * (100-ADMIN_FEE_PERCENT)/100)
        data[uid]["balance"] += win
        data[uid]["win"] += 1
        result = f"🎉 MENANG +{win}"
    elif player_roll < bot_roll:
        data[uid]["balance"] -= amount
        data[uid]["lose"] += 1
        result = f"💀 KALAH -{amount}"
    else:
        result = "🤝 SERI"

    save_data(data)

    embed = discord.Embed(title="🎲 DICE GAME")
    embed.add_field(name="Roll Kamu", value=player_roll)
    embed.add_field(name="Roll Lawan", value=bot_roll)
    embed.add_field(name="Hasil", value=result)
    await ctx.send(embed=embed)

# ================= SPIN =================
@bot.command()
async def spin(ctx):
    number = random.randint(1,100)
    await ctx.send(f"🎰 Angka keluar: {number}")

# ================= HELP =================
@bot.command()
async def help(ctx):
    await ctx.send("""
☘️ GameSpin BOT ☘️

.register
.balance
.dice <jumlah>
.spin

Admin:
.addcoin @user <jumlah>
.deletecoin @user <jumlah>

Deposit: 6283173495612
""")

# ================= RUN =================
bot.run(TOKEN)
