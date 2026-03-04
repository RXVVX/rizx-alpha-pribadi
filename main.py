import discord
from discord.ext import commands
import json
import os
import random

# --- KONFIGURASI ---
TOKEN = os.getenv('TOKEN')
ADMIN_ID = 123456789012345678  # GANTI DENGAN ID DISCORD KAMU (Angka)
NOMOR_DEPO = "6283173495612"
BOT_NAME = "DUEL RXV X TEAMRXVVX"
FEE_PERCENTAGE = 0.05

# --- DATABASE PERMANEN ---
DB_PATH = 'database.json'

def load_db():
    if os.path.exists(DB_PATH):
        with open(DB_PATH, 'r') as f:
            return json.load(f)
    return {"users": {}, "vault": {"total_fee": 0}}

def save_db(data):
    with open(DB_PATH, 'w') as f:
        json.dump(data, f, indent=4)

db = load_db()

# --- BOT SETUP ---
intents = discord.Intents.default()
intents.message_content = True  # Penting untuk Railway agar bisa baca pesan
bot = commands.Bot(command_prefix='.', intents=intents, help_command=None)

active_duels = {}

@bot.event
async def on_ready():
    print(f'✅ {BOT_NAME} (Python) Online!')

def get_user(user_id):
    uid = str(user_id)
    if uid not in db["users"]:
        db["users"][uid] = {"coin": 0}
    return db["users"][uid]

# ================= [ MENU UTAMA (PERSIS FOTO) ] =================
@bot.command()
async def menu(ctx):
    embed = discord.Embed(title=f"✨ {BOT_NAME} ✨", color=0x2b2d31)
    embed.description = (
        "📜 **Update:**\n"
        "• Valentine Edition 💕\n"
        "• PvP & PvH Games (100% Completed) 👌\n"
        "• Fix Database 🏦"
    )
    embed.add_field(name="📂 MENU UTAMA", value="`.menu` `.help` `.admin` `.tukar` `.spin`", inline=False)
    embed.add_field(name="💰 ECONOMY", value="`.depo` `.qris` `.tfcoin` `.cc` `.leaderboard` `.addcoin` `.delcoin`", inline=False)
    embed.add_field(name="🎮 PVP GAMES", value="`.reme` `.qeme` `.qq` `.csn` `.btk` `.dirt` `.bc` `.bj` `.kb` `.dadu` `.card` `.flip`", inline=False)
    embed.add_field(name="🛡️ PVH GAMES", value="`.hleme` `.leme` `.rhreme` `.hreme` `.hlewa` `.lewa` `.hrewa` `.rewa`", inline=False)
    embed.set_footer(text=f"Deposit ke: {NOMOR_DEPO}")
    await ctx.send(embed=embed)

# ================= [ EKONOMI & ADMIN ] =================
@bot.command()
async def cc(ctx):
    user = get_user(ctx.author.id)
    await ctx.send(f"🪙 Saldo: **{user['coin']:,}** koin.")

@bot.command()
async def depo(ctx):
    await ctx.send(f"💳 **DEPOSIT**\nNomor: **{NOMOR_DEPO}** (DANA/GOPAY/OVO)\nKirim bukti ke Admin!")

@bot.command()
async def addcoin(ctx, target: discord.Member, amount: int):
    if ctx.author.id != ADMIN_ID:
        return
    t_user = get_user(target.id)
    t_user["coin"] += amount
    save_db(db)
    await ctx.send(f"✅ Berhasil isi **{amount}** koin ke {target.name}.")

# ================= [ PVP SYSTEM + FEE 5% ] =================
pvp_list = ['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'dadu', 'card', 'flip']

@bot.event
async def on_message(message):
    if message.author.bot: return
    
    content = message.content.lower()
    for g in pvp_list:
        if content.startswith(f".{g}"):
            args = content.split()
            if len(args) < 3:
                return await message.channel.send(f"Format: `.{g} @lawan [bet]`")
            
            try:
                target_id = int(args[1].replace("<@!", "").replace("<@", "").replace(">", ""))
                bet = int(args[2])
            except:
                return await message.channel.send("Format salah!")

            user = get_user(message.author.id)
            if user["coin"] < bet:
                return await message.channel.send("❌ Koin kamu tidak cukup!")

            active_duels[str(target_id)] = {"challenger": message.author.id, "bet": bet, "game": g.upper()}
            await message.channel.send(f"⚔️ **TANTANGAN {g.upper()}**\n<@{message.author.id}> vs <@{target_id}> | Bet: **{bet}**\nKetik **.acc** untuk menerima!")
            break
    await bot.process_commands(message)

@bot.command()
async def acc(ctx):
    uid = str(ctx.author.id)
    if uid not in active_duels: return
    
    duel = active_duels[uid]
    if get_user(ctx.author.id)["coin"] < duel["bet"]:
        return await ctx.send("❌ Koin kamu kurang!")

    p1, p2 = random.randint(1, 10), random.randint(1, 10)
    if p1 > p2:
        win_id, lose_id = duel["challenger"], ctx.author.id
    elif p2 > p1:
        win_id, lose_id = ctx.author.id, duel["challenger"]
    else:
        del active_duels[uid]
        return await ctx.send("🤝 **SERI!**")

    fee = int(duel["bet"] * FEE_PERCENTAGE)
    net = duel["bet"] - fee
    db["users"][str(win_id)]["coin"] += net
    db["users"][str(lose_id)]["coin"] -= duel["bet"]
    db["vault"]["total_fee"] += fee
    save_db(db)
    del active_duels[uid]
    await ctx.send(f"🏆 <@{win_id}> MENANG! Hadiah: **{net}** (Fee 5%: {fee})")

# ================= [ PVH SYSTEM ] =================
@bot.command()
async def leme(ctx, bet: int):
    user = get_user(ctx.author.id)
    if user["coin"] < bet: return
    if random.random() > 0.65:
        user["coin"] += bet
        await ctx.send(f"🎯 **WIN!** +{bet}")
    else:
        user["coin"] -= bet
        await ctx.send(f"💥 **LOSE!** -{bet}")
    save_db(db)

bot.run(TOKEN)
