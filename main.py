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

# --- SETUP BOT & INTENTS ---
intents = discord.Intents.default()
intents.message_content = True 
bot = commands.Bot(command_prefix='.', intents=intents, help_command=None)

# Lobby untuk menampung permainan yang sedang dibuka
waiting_lobby = {}

@bot.event
async def on_ready():
    print(f'✅ {BOT_NAME} Online! Semua fitur game telah diaktifkan.')

def get_user(user_id):
    uid = str(user_id)
    if uid not in db["users"]:
        db["users"][uid] = {"coin": 0}
    return db["users"][uid]

# ================= [ 📂 MENU UTAMA & EKONOMI ] =================

@bot.command()
async def menu(ctx):
    embed = discord.Embed(title=f"✨ {BOT_NAME} ✨", color=0x2b2d31)
    embed.add_field(name="📂 MENU UTAMA", value="`.menu` `.help` `.admin` `.tukar` `.spin` (ACAK)", inline=False)
    embed.add_field(name="💰 ECONOMY", value="`.depo` `.qris` `.tfcoin` `.cc` `.leaderboard` `.addcoin` `.delcoin`", inline=False)
    embed.add_field(name="🎮 PVP GAMES (AUTO-JOIN)", value="`.reme` `.qeme` `.qq` `.csn` `.btk` `.dirt` `.bc` `.bj` `.kb` `.dadu` `.card` `.flip` \n*(Cara: .game [bet] -> Lawan ketik .join)*", inline=False)
    embed.add_field(name="🛡️ PVH GAMES (VS HOST)", value="`.hleme` `.leme` `.rhreme` `.hreme` `.hlewa` `.lewa` `.hrewa` `.rewa` \n*(Cara: .game [bet])*", inline=False)
    embed.set_footer(text=f"Sistem Aktif | Deposit ke: {NOMOR_DEPO}")
    await ctx.send(embed=embed)

@bot.command()
async def cc(ctx):
    user = get_user(ctx.author.id)
    await ctx.send(f"🪙 Saldo anda: **{user['coin']:,}** koin.")

@bot.command()
async def leaderboard(ctx):
    sorted_u = sorted(db["users"].items(), key=lambda x: x[1]['coin'], reverse=True)
    ranks = ""
    for i, u in enumerate(sorted_u[:10], 1):
        ranks += f"{i}. <@{u[0]}> — {u[1]['coin']:,} koin\n"
    await ctx.send(embed=discord.Embed(title="🏆 TOP RANKING", description=ranks or "Belum ada data", color=0xf1c40f))

@bot.command()
async def spin(ctx): 
    # Hanya mengeluarkan angka acak 1-100 untuk seru-seruan
    angka = random.randint(1, 100)
    await ctx.send(f"🎰 **SPIN** | <@{ctx.author.id}> mendapatkan angka: **{angka}**")

# ================= [ ⚔️ PVP GAMES LOGIC (AUTO-JOIN) ] =================

pvp_list = ['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'dadu', 'card', 'flip']

@bot.event
async def on_message(message):
    if message.author.bot: return
    content = message.content.lower()
    
    for g in pvp_list:
        if content.startswith(f".{g}"):
            args = content.split()
            if len(args) < 2: 
                return await message.channel.send(f"❌ Format: `.{g} [jumlah_bet]`")
            
            try:
                bet = int(args[1])
                user = get_user(message.author.id)
                if user["coin"] < bet: 
                    return await message.channel.send("❌ Koin kamu tidak cukup!")
                
                waiting_lobby[message.channel.id] = {
                    "host": message.author.id,
                    "bet": bet,
                    "game": g.upper()
                }
                await message.channel.send(f"🎮 **{g.upper()} OPENED**\nHost: <@{message.author.id}>\nBet: **{bet:,}**\n\nSiapa berani? Ketik **.join** untuk bermain!")
            except: pass
            break
    await bot.process_commands(message)

@bot.command()
async def join(ctx):
    cid = ctx.channel.id
    if cid not in waiting_lobby:
        return await ctx.send("❌ Tidak ada meja terbuka. Ketik `.game [bet]` untuk membuka!")
    
    lobby = waiting_lobby[cid]
    if ctx.author.id == lobby["host"]:
        return await ctx.send("❌ Kamu tidak bisa melawan diri sendiri!")

    user = get_user(ctx.author.id)
    if user["coin"] < lobby["bet"]:
        return await ctx.send(f"❌ Koin kamu tidak cukup!")

    # Mengadu angka acak
    p1, p2 = random.randint(1, 12), random.randint(1, 12)
    
    if p1 == p2:
        await ctx.send(f"🤝 **SERI!** Skor sama ({p1}). Koin aman.")
    else:
        winner_id = lobby["host"] if p1 > p2 else ctx.author.id
        loser_id = ctx.author.id if p1 > p2 else lobby["host"]
        fee = int(lobby["bet"] * FEE_PERCENTAGE)
        
        db["users"][str(winner_id)]["coin"] += (lobby["bet"] - fee)
        db["users"][str(loser_id)]["coin"] -= lobby["bet"]
        save_db(db)
        
        await ctx.send(f"🏆 <@{winner_id}> MENANG! (Skor: {max(p1, p2)})\n💰 Hadiah: **{lobby['bet']-fee:,}** (Pajak 5%: {fee})")

    del waiting_lobby[cid]

# ================= [ 🛡️ PVH GAMES LOGIC (VS HOST) ] =================

pvh_list = ['hleme', 'leme', 'rhreme', 'hreme', 'hlewa', 'lewa', 'hrewa', 'rewa']

@bot.command(aliases=pvh_list)
async def pvh_engine(ctx, bet: int = 0):
    if bet <= 0: return await ctx.send("❌ Masukkan bet! Contoh: `.leme 5000`")
    user = get_user(ctx.author.id)
    if user["coin"] < bet: return await ctx.send("❌ Saldo tidak cukup!")
    
    # Peluang menang user 45%
    if random.random() > 0.55: 
        user["coin"] += bet
        await ctx.send(f"🎯 **WIN!** Kamu menang **{bet:,}** koin vs Host.")
    else:
        user["coin"] -= bet
        await ctx.send(f"💥 **LOSE!** Kamu kalah **{bet:,}** koin vs Host.")
    save_db(db)

# ================= [ 👑 ADMIN COMMANDS ] =================

@bot.command()
async def addcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id != ADMIN_ID: return
    get_user(target.id)["coin"] += amount
    save_db(db)
    await ctx.send(f"✅ Berhasil isi **{amount:,}** koin ke {target.mention}.")

@bot.command()
async def delcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id != ADMIN_ID: return
    user = get_user(target.id)
    user["coin"] = max(0, user["coin"] - amount)
    save_db(db)
    await ctx.send(f"✅ Berhasil tarik **{amount:,}** koin dari {target.mention}.")

bot.run(TOKEN)
