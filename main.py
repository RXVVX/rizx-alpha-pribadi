import discord
from discord.ext import commands
import json
import os
import random

# --- KONFIGURASI ---
TOKEN = os.getenv('TOKEN')
ADMIN_ID = 1478560895058579476  # GANTI DENGAN ID DISCORD KAMU
NOMOR_DEPO = "6283173495612"
BOT_NAME = "DUEL RXV X TEAMRXVVX"
FEE_PERCENTAGE = 0.05

# --- DATABASE PERMANEN ---
DB_PATH = 'database.json'

def load_db():
    if os.path.exists(DB_PATH):
        with open(DB_PATH, 'r') as f:
            try: return json.load(f)
            except: return {"users": {}, "vault": {"total_fee": 0}}
    return {"users": {}, "vault": {"total_fee": 0}}

def save_db(data):
    with open(DB_PATH, 'w') as f:
        json.dump(data, f, indent=4)

db = load_db()

# --- BOT SETUP ---
intents = discord.Intents.default()
intents.message_content = True 
bot = commands.Bot(command_prefix='.', intents=intents, help_command=None)

active_duels = {}

@bot.event
async def on_ready():
    print(f'✅ {BOT_NAME} Online & Lancar!')

def get_user(user_id):
    uid = str(user_id)
    if uid not in db["users"]:
        db["users"][uid] = {"coin": 0}
    return db["users"][uid]

# ================= [ 📂 SEMUA PERINTAH SISTEM ] =================

@bot.command()
async def menu(ctx):
    embed = discord.Embed(title=f"✨ {BOT_NAME} ✨", color=0x2b2d31)
    embed.description = "📜 **Update:** Valentine Edition 💕\nSemua Fitur Aktif 100% 👌"
    embed.add_field(name="📂 MENU UTAMA", value="`.menu` `.help` `.admin` `.tukar` `.spin`", inline=False)
    embed.add_field(name="💰 ECONOMY", value="`.depo` `.qris` `.tfcoin` `.cc` `.leaderboard` `.addcoin` `.delcoin`", inline=False)
    embed.add_field(name="🎮 PVP GAMES", value="`.reme` `.qeme` `.qq` `.csn` `.btk` `.dirt` `.bc` `.bj` `.kb` `.dadu` `.card` `.flip`", inline=False)
    embed.add_field(name="🛡️ PVH GAMES", value="`.hleme` `.leme` `.rhreme` `.hreme` `.hlewa` `.lewa` `.hrewa` `.rewa`", inline=False)
    embed.set_footer(text=f"Deposit: {NOMOR_DEPO}")
    await ctx.send(embed=embed)

@bot.command()
async def cc(ctx):
    user = get_user(ctx.author.id)
    await ctx.send(f"🪙 Saldo: **{user['coin']:,}** koin.")

@bot.command()
async def leaderboard(ctx):
    users_data = sorted([{"id": k, "coin": v["coin"]} for k, v in db["users"].items()], key=lambda x: x['coin'], reverse=True)
    ranks = ""
    for i, u in enumerate(users_data[:10], 1):
        ranks += f"{i}. <@{u['id']}> — {u['coin']:,} koin\n"
    embed = discord.Embed(title="🏆 TOP RANKING", description=ranks or "Kosong", color=0xf1c40f)
    await ctx.send(embed=embed)

@bot.command()
async def spin(ctx):
    user = get_user(ctx.author.id)
    if user["coin"] < 1000: return await ctx.send("❌ Butuh 1.000 koin!")
    user["coin"] -= 1000
    win = random.choice([0, 0, 500, 1000, 2500, 5000])
    user["coin"] += win
    save_db(db)
    await ctx.send(f"🎰 **SPIN** | {'Zonk!' if win == 0 else f'Menang {win:,} koin!'}")

# ================= [ ⚔️ PVP GAMES LOGIC ] =================

pvp_games = ['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'dadu', 'card', 'flip']

@bot.event
async def on_message(message):
    if message.author.bot: return
    content = message.content.lower()
    
    for g in pvp_games:
        if content.startswith(f".{g}"):
            args = content.split()
            if len(args) < 3: return await message.channel.send(f"Format: `.{g} @lawan [bet]`")
            target = message.mentions[0] if message.mentions else None
            if not target: return await message.channel.send("❌ Tag lawannya!")
            bet = int(args[2])
            if get_user(message.author.id)["coin"] < bet: return await message.channel.send("❌ Koin kurang!")
            active_duels[str(target.id)] = {"challenger": message.author.id, "bet": bet, "game": g.upper()}
            await message.channel.send(f"⚔️ **{g.upper()}** | <@{message.author.id}> VS <@{target.id}> | Bet: {bet}\nKetik **.acc** untuk main!")
            break
    await bot.process_commands(message)

@bot.command()
async def acc(ctx):
    uid = str(ctx.author.id)
    if uid not in active_duels: return
    duel = active_duels[uid]
    if get_user(ctx.author.id)["coin"] < duel["bet"]: return await ctx.send("❌ Koin kurang!")
    
    p1, p2 = random.randint(1, 10), random.randint(1, 10)
    if p1 == p2:
        await ctx.send("🤝 **SERI!** Koin dikembalikan.")
    else:
        winner = duel["challenger"] if p1 > p2 else ctx.author.id
        loser = ctx.author.id if p1 > p2 else duel["challenger"]
        fee = int(duel["bet"] * FEE_PERCENTAGE)
        db["users"][str(winner)]["coin"] += (duel["bet"] - fee)
        db["users"][str(loser)]["coin"] -= duel["bet"]
        db["vault"]["total_fee"] += fee
        save_db(db)
        await ctx.send(f"🏆 <@{winner}> MENANG! Hadiah: {duel['bet']-fee:,} (Pajak: {fee})")
    del active_duels[uid]

# ================= [ 🛡️ PVH GAMES LOGIC ] =================

pvh_games = ['hleme', 'leme', 'rhreme', 'hreme', 'hlewa', 'lewa', 'hrewa', 'rewa']

@bot.command(name="pvh_handler", aliases=pvh_games)
async def pvh_handler(ctx, bet: int = 0):
    if bet <= 0: return await ctx.send("❌ Masukkan jumlah bet!")
    user = get_user(ctx.author.id)
    if user["coin"] < bet: return await ctx.send("❌ Saldo kurang!")
    
    if random.random() > 0.6: # Peluang menang 40%
        user["coin"] += bet
        await ctx.send(f"🎯 **WIN!** Kamu menang {bet:,} koin.")
    else:
        user["coin"] -= bet
        await ctx.send(f"💥 **LOSE!** Host menang {bet:,} koin.")
    save_db(db)

# ================= [ 👑 ADMIN ] =================

@bot.command()
async def addcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id != ADMIN_ID: return
    get_user(target.id)["coin"] += amount
    save_db(db)
    await ctx.send(f"✅ Berhasil +{amount:,} koin ke {target.name}")

bot.run(TOKEN)
