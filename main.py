import discord
from discord.ext import commands
import json
import os
import random

# --- KONFIGURASI ADMIN ---
# Pastikan hanya angka ID saja di dalam list ini agar tidak Error
ADMIN_IDS = [1478560895058579476, 3171531701500346673] 

TOKEN = os.getenv('TOKEN')
NOMOR_DEPO = "6283173495612"
BOT_NAME = "DUEL RXV X TEAMRXVVX"
FEE_PERCENTAGE = 0.05

# --- SISTEM DATABASE ---
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

# --- SETUP BOT ---
intents = discord.Intents.default()
intents.message_content = True 
bot = commands.Bot(command_prefix='.', intents=intents, help_command=None)

waiting_lobby = {}

@bot.event
async def on_ready():
    print(f'✅ {BOT_NAME} Online! Semua fitur game & admin aktif.')

def get_user(user_id):
    uid = str(user_id)
    if uid not in db["users"]:
        db["users"][uid] = {"coin": 0}
    return db["users"][uid]

# ================= [ 👑 FITUR ADMIN (LENGKAP) ] =================

@bot.command()
async def addcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id not in ADMIN_IDS:
        return await ctx.send("❌ Akses ditolak! Anda bukan Admin.")
    user = get_user(target.id)
    user["coin"] += amount
    save_db(db)
    await ctx.send(f"✅ **ADMIN** | Berhasil menambah **{amount:,}** koin ke {target.mention}.")

@bot.command()
async def delcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id not in ADMIN_IDS:
        return await ctx.send("❌ Akses ditolak! Anda bukan Admin.")
    user = get_user(target.id)
    user["coin"] = max(0, user["coin"] - amount)
    save_db(db)
    await ctx.send(f"✅ **ADMIN** | Berhasil menarik **{amount:,}** koin dari {target.mention}.")

@bot.command()
async def admin(ctx):
    list_admin = ", ".join([f"<@{aid}>" for aid in ADMIN_IDS])
    await ctx.send(f"👑 **Admin Terdaftar**: {list_admin}\nGunakan `.addcoin` atau `.delcoin` untuk kelola koin.")

# ================= [ 📂 MENU & EKONOMI ] =================

@bot.command()
async def menu(ctx):
    embed = discord.Embed(title=f"✨ {BOT_NAME} ✨", color=0x2b2d31)
    embed.description = "Valentine Edition ❤️ | Fix Database 🏛️"
    embed.add_field(name="📂 UTAMA", value="`.menu` `.help` `.admin` `.tukar` `.spin` (Acak Angka)", inline=False)
    embed.add_field(name="💰 ECONOMY", value="`.depo` `.qris` `.tfcoin` `.cc` `.leaderboard`", inline=False)
    embed.add_field(name="🎮 PVP GAMES", value="`.qq` `.dadu` `.bj` `.reme` `.btk` `.flip` `.csn` `.kb` `.reme` `.qeme` `.dirt` `.bc` `.card` \n*(Gunakan .join untuk ikut bermain)*", inline=False)
    embed.add_field(name="🛡️ PVH GAMES", value="`.hleme` `.leme` `.rhreme` `.hreme` `.hlewa` `.lewa` `.hrewa` `.rewa`", inline=False)
    embed.set_footer(text=f"Deposit ke: {NOMOR_DEPO}")
    await ctx.send(embed=embed)

@bot.command()
async def cc(ctx):
    user = get_user(ctx.author.id)
    await ctx.send(f"💰 Saldo: **{user['coin']:,}** koin.")

@bot.command()
async def spin(ctx):
    await ctx.send(f"🎰 **SPIN** | Angka acak Anda: **{random.randint(1, 100)}**")

@bot.command()
async def leaderboard(ctx):
    sorted_u = sorted(db["users"].items(), key=lambda x: x[1]['coin'], reverse=True)
    ranks = "\n".join([f"{i+1}. <@{u[0]}> — {u[1]['coin']:,}" for i, u in enumerate(sorted_u[:10])])
    await ctx.send(embed=discord.Embed(title="🏆 TOP RANKING", description=ranks or "Belum ada data", color=0xf1c40f))

@bot.command()
async def tfcoin(ctx, target: discord.Member, amount: int):
    sender = get_user(ctx.author.id)
    if sender["coin"] < amount: return await ctx.send("❌ Koin Anda tidak cukup!")
    sender["coin"] -= amount
    get_user(target.id)["coin"] += amount
    save_db(db)
    await ctx.send(f"✅ Berhasil transfer **{amount:,}** koin ke {target.mention}.")

# ================= [ 🎮 SEMUA GAME PVP (AUTO-JOIN) ] =================

all_pvp = ['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'dadu', 'card', 'flip']

@bot.event
async def on_message(message):
    if message.author.bot: return
    content = message.content.lower()
    
    for g in all_pvp:
        if content.startswith(f".{g}"):
            args = content.split()
            if len(args) < 2: return await message.channel.send(f"❌ Format: `.{g} [bet]`")
            bet = int(args[1])
            if get_user(message.author.id)["coin"] < bet: return await message.channel.send("❌ Koin tidak cukup!")
            
            waiting_lobby[message.channel.id] = {"host": message.author.id, "bet": bet, "game": g.upper()}
            await message.channel.send(f"⚔️ **{g.upper()}** Bet: **{bet:,}**\nHost: <@{message.author.id}>\nKetik **.join** untuk melawan!")
            break
    await bot.process_commands(message)

@bot.command()
async def join(ctx):
    cid = ctx.channel.id
    if cid not in waiting_lobby: return
    lobby = waiting_lobby[cid]
    if ctx.author.id == lobby["host"]: return await ctx.send("❌ Tidak bisa lawan diri sendiri!")
    if get_user(ctx.author.id)["coin"] < lobby["bet"]: return await ctx.send("❌ Koin Anda kurang!")
    
    p1, p2 = random.randint(1, 12), random.randint(1, 12)
    if p1 == p2:
        await ctx.send("🤝 **SERI!** Skor imbang, koin aman.")
    else:
        win_id = lobby["host"] if p1 > p2 else ctx.author.id
        lose_id = ctx.author.id if p1 > p2 else lobby["host"]
        fee = int(lobby["bet"] * FEE_PERCENTAGE)
        db["users"][str(win_id)]["coin"] += (lobby["bet"] - fee)
        db["users"][str(lose_id)]["coin"] -= lobby["bet"]
        save_db(db)
        await ctx.send(f"🏆 <@{win_id}> MENANG! Hadiah: **{lobby['bet']-fee:,}** (Pajak 5%)")
    del waiting_lobby[cid]

# ================= [ 🛡️ SEMUA GAME PVH (BANDAR) ] =================

all_pvh = ['hleme', 'leme', 'rhreme', 'hreme', 'hlewa', 'lewa', 'hrewa', 'rewa']

@bot.command(aliases=all_pvh)
async def pvh_engine(ctx, bet: int = 0):
    if bet <= 0: return await ctx.send(f"❌ Contoh: `.{ctx.invoked_with} 5000`")
    user = get_user(ctx.author.id)
    if user["coin"] < bet: return await ctx.send("❌ Koin tidak cukup!")
    
    if random.random() > 0.6: # Peluang menang user
        user["coin"] += bet
        await ctx.send(f"🎯 **WIN!** Menang **{bet:,}** koin.")
    else:
        user["coin"] -= bet
        await ctx.send(f"💥 **LOSE!** Kalah **{bet:,}** koin.")
    save_db(db)

bot.run(TOKEN)
