import discord
from discord.ext import commands
import os
import json
import random

# ================= CONFIG =================
TOKEN = os.getenv("TOKEN")

if not TOKEN:
    print("❌ TOKEN tidak ditemukan di Railway!")
    exit()

ADMIN_IDS = [1478560895058579476]  # GANTI ID KAMU
ADMIN_FEE_PERCENT = 5
DEPOSIT_NUMBER = "6283173495612"
DATA_FILE = "database.json"

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(
    command_prefix=".",
    intents=intents,
    help_command=None
)

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

def winrate(win, lose):
    total = win + lose
    return (win/total*100) if total > 0 else 0

# ================= READY =================
@bot.event
async def on_ready():
    print(f"✅ GameSpin aktif sebagai {bot.user}")

# ================= REGISTER =================
@bot.command()
async def register(ctx):
    data = load_data()
    uid = str(ctx.author.id)

    if uid in data:
        await ctx.send("❌ Sudah register.")
        return

    data[uid] = {"balance": 0, "win": 0, "lose": 0}
    save_data(data)
    await ctx.send("✅ Register berhasil. Saldo: 0 coin")

# ================= BALANCE =================
@bot.command()
async def balance(ctx):
    data = load_data()
    uid = str(ctx.author.id)

    if uid not in data:
        await ctx.send("Register dulu.")
        return

    user = data[uid]

    embed = discord.Embed(title="💰 Informasi Akun")
    embed.add_field(name="Saldo", value=user["balance"])
    embed.add_field(name="Win", value=user["win"])
    embed.add_field(name="Lose", value=user["lose"])
    embed.add_field(name="Winrate", value=f"{winrate(user['win'], user['lose']):.1f}%")
    await ctx.send(embed=embed)

# ================= DEPOSIT =================
@bot.command()
async def deposit(ctx, amount):
    await ctx.send(
        f"💳 Deposit {amount}\n"
        f"Transfer ke: {DEPOSIT_NUMBER}\n"
        f"Kirim bukti ke admin."
    )

# ================= WITHDRAW =================
@bot.command()
async def withdraw(ctx, amount, nomor, nama, metode):
    await ctx.send(
        f"📤 REQUEST WITHDRAW\n"
        f"User: {ctx.author}\n"
        f"Jumlah: {amount}\n"
        f"Tujuan: {nomor}\n"
        f"Nama: {nama}\n"
        f"Metode: {metode}\n\n"
        f"Menunggu proses admin."
    )

# ================= TRANSFER =================
@bot.command()
async def transfer(ctx, member: discord.Member, amount):
    data = load_data()
    sender = str(ctx.author.id)
    target = str(member.id)

    if sender not in data or target not in data:
        await ctx.send("Kedua user harus register.")
        return

    amount = parse_amount(amount)

    if amount <= 0:
        await ctx.send("Jumlah tidak valid.")
        return

    if data[sender]["balance"] < amount:
        await ctx.send("Saldo tidak cukup.")
        return

    data[sender]["balance"] -= amount
    data[target]["balance"] += amount
    save_data(data)

    await ctx.send(f"✅ Transfer {amount} coin ke {member.name}")

# ================= LEADERBOARD =================
@bot.command(aliases=["leaderboard"])
async def lb(ctx):
    data = load_data()
    sorted_users = sorted(data.items(), key=lambda x: x[1]["balance"], reverse=True)[:10]

    text = ""
    for i, (uid, user) in enumerate(sorted_users, 1):
        text += f"{i}. <@{uid}> - {user['balance']} coin\n"

    embed = discord.Embed(title="🏆 Top 10 Terkaya", description=text)
    await ctx.send(embed=embed)

# ================= REAL MATCH =================
active_matches = {}

@bot.command()
async def match(ctx, member: discord.Member, amount):
    data = load_data()
    challenger = str(ctx.author.id)
    opponent = str(member.id)

    if challenger not in data or opponent not in data:
        await ctx.send("Kedua pemain harus register.")
        return

    amount = parse_amount(amount)

    if data[challenger]["balance"] < amount:
        await ctx.send("Saldo kamu tidak cukup.")
        return

    active_matches[opponent] = {
        "challenger": challenger,
        "amount": amount
    }

    await ctx.send(
        f"🎮 {member.mention}, kamu ditantang {ctx.author.mention}\n"
        f"Bet: {amount} coin\n"
        f"Ketik `.accept` untuk menerima."
    )

@bot.command()
async def accept(ctx):
    data = load_data()
    uid = str(ctx.author.id)

    if uid not in active_matches:
        await ctx.send("Tidak ada challenge.")
        return

    match = active_matches[uid]
    challenger = match["challenger"]
    amount = match["amount"]

    if data[uid]["balance"] < amount:
        await ctx.send("Saldo tidak cukup.")
        return

    roll1 = random.randint(1,100)
    roll2 = random.randint(1,100)

    if roll1 > roll2:
        winner = challenger
        loser = uid
    else:
        winner = uid
        loser = challenger

    fee = int(amount * ADMIN_FEE_PERCENT / 100)
    reward = amount - fee

    data[winner]["balance"] += reward
    data[loser]["balance"] -= amount
    data[winner]["win"] += 1
    data[loser]["lose"] += 1

    save_data(data)
    del active_matches[uid]

    await ctx.send(
        f"🎲 MATCH RESULT\n"
        f"<@{challenger}> roll: {roll1}\n"
        f"<@{uid}> roll: {roll2}\n\n"
        f"🏆 Winner: <@{winner}>\n"
        f"💰 Menang: {reward} coin (fee {fee})"
    )

# ================= GAME VS SYSTEM =================
async def system_game(ctx, amount, title):
    data = load_data()
    uid = str(ctx.author.id)

    if uid not in data:
        await ctx.send("Register dulu.")
        return

    amount = parse_amount(amount)

    if data[uid]["balance"] < amount:
        await ctx.send("Saldo tidak cukup.")
        return

    roll1 = random.randint(1,100)
    roll2 = random.randint(1,100)

    if roll1 > roll2:
        win_amount = int(amount * (100 - ADMIN_FEE_PERCENT) / 100)
        data[uid]["balance"] += win_amount
        data[uid]["win"] += 1
        result = f"🎉 MENANG +{win_amount}"
    elif roll1 < roll2:
        data[uid]["balance"] -= amount
        data[uid]["lose"] += 1
        result = f"💀 KALAH -{amount}"
    else:
        result = "🤝 SERI"

    save_data(data)

    embed = discord.Embed(title=title)
    embed.add_field(name="Roll Kamu", value=roll1)
    embed.add_field(name="Roll Sistem", value=roll2)
    embed.add_field(name="Hasil", value=result)
    await ctx.send(embed=embed)

@bot.command()
async def dice(ctx, amount):
    await system_game(ctx, amount, "🎲 DICE")

@bot.command()
async def reme(ctx, amount):
    await system_game(ctx, amount, "🃏 REME")

@bot.command()
async def qeme(ctx, amount):
    await system_game(ctx, amount, "♠️ QEME")

@bot.command()
async def csn(ctx, amount):
    await system_game(ctx, amount, "🎰 CASINO")

@bot.command()
async def spin(ctx):
    number = random.randint(1,100)
    await ctx.send(f"🎰 Spin keluar angka: {number}")

# ================= ADMIN =================
@bot.command()
async def addcoin(ctx, member: discord.Member, amount):
    if ctx.author.id not in ADMIN_IDS:
        return
    data = load_data()
    uid = str(member.id)
    if uid not in data:
        return
    amount = parse_amount(amount)
    data[uid]["balance"] += amount
    save_data(data)
    await ctx.send("Coin ditambahkan.")

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
    await ctx.send("Coin dikurangi.")

# ================= MENU =================
@bot.command()
async def menu(ctx):
    embed = discord.Embed(title="☘️ GameSpin BOT ☘️")
    embed.add_field(name="User", value="""
.register
.balance
.transfer
.deposit
.withdraw
.lb
.match
.accept
""", inline=False)
    embed.add_field(name="Game", value="""
.dice
.reme
.qeme
.csn
.spin
""", inline=False)
    embed.add_field(name="Admin", value="""
.addcoin
.deletecoin
""", inline=False)
    await ctx.send(embed=embed)

bot.run(TOKEN)
