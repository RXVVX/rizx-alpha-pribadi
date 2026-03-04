import discord
from discord.ext import commands
import json
import os
import random

# --- KONFIGURASI ---
TOKEN = os.getenv('TOKEN')
ADMIN_ID = 1478560895058579476  # GANTI DENGAN ID DISCORD KAMU
NOMOR_DEPO = "6283173495612"   # Sesuai screenshot
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
intents.message_content = True  # Memperbaiki error "intent tidak diizinkan"
bot = commands.Bot(command_prefix='.', intents=intents, help_command=None)

active_duels = {}

@bot.event
async def on_ready():
    print(f'✅ {BOT_NAME} Online dan Lancar!')

def get_user(user_id):
    uid = str(user_id)
    if uid not in db["users"]:
        db["users"][uid] = {"coin": 0}
    return db["users"][uid]

# ================= [ MENU UTAMA ] =================
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

# ================= [ ECONOMY & LEADERBOARD ] =================
@bot.command()
async def cc(ctx):
    user = get_user(ctx.author.id)
    await ctx.send(f"🪙 **Saldo:** {user['coin']:,} koin.")

@bot.command()
async def leaderboard(ctx):
    users_data = []
    for uid, data in db["users"].items():
        try:
            user_obj = await bot.fetch_user(int(uid))
            users_data.append({"name": user_obj.name, "coin": data["coin"]})
        except: continue
    
    sorted_users = sorted(users_data, key=lambda x: x['coin'], reverse=True)
    ranks = "\n".join([f"{i+1}. **{u['name']}** — {u['coin']:,} koin" for i, u in enumerate(sorted_users[:10])])
    
    embed = discord.Embed(title="🏆 TOP RANKING", description=ranks or "Belum ada data.", color=0xf1c40f)
    await ctx.send(embed=embed)

# ================= [ PVP SYSTEM ] =================
pvp_list = ['reme', 'qeme', 'qq', 'csn', 'btk', 'dirt', 'bc', 'bj', 'kb', 'dadu', 'card', 'flip']

@bot.event
async def on_message(message):
    if message.author.bot: return
    content = message.content.lower()
    
    for g in pvp_list:
        if content.startswith(f".{g}"):
            args = content.split()
            if len(args) < 3: return await message.channel.send(f"Format: `.{g} @lawan [bet]`")
            
            target_id = int(args[1].replace("<@!", "").replace("<@", "").replace(">", ""))
            bet = int(args[2])
            if get_user(message.author.id)["coin"] < bet: return await message.channel.send("❌ Koin tidak cukup!")

            active_duels[str(target_id)] = {"challenger": message.author.id, "bet": bet, "game": g.upper()}
            await message.channel.send(f"⚔️ **DUEL {g.upper()}**\n<@{message.author.id}> vs <@{target_id}> | Bet: {bet}\nKetik **.acc** untuk main!")
            break
    await bot.process_commands(message)

@bot.command()
async def acc(ctx):
    uid = str(ctx.author.id)
    if uid not in active_duels: return
    
    duel = active_duels[uid]
    p1, p2 = random.randint(1, 10), random.randint(1, 10)
    winner_id = duel["challenger"] if p1 > p2 else ctx.author.id if p2 > p1 else None
    
    if not winner_id:
        await ctx.send("🤝 **SERI!**")
    else:
        fee = int(duel["bet"] * FEE_PERCENTAGE)
        db["users"][str(winner_id)]["coin"] += (duel["bet"] - fee)
        db["users"][str(duel["challenger"] if winner_id != duel["challenger"] else ctx.author.id)]["coin"] -= duel["bet"]
        save_db(db)
        await ctx.send(f"🏆 <@{winner_id}> MENANG! Hadiah bersih: {duel['bet'] - fee}")
    del active_duels[uid]

# ================= [ PVH SYSTEM ] =================
@bot.command()
async def leme(ctx, bet: int):
    user = get_user(ctx.author.id)
    if user["coin"] < bet: return await ctx.send("❌ Saldo kurang!")
    
    if random.random() > 0.6:
        user["coin"] += bet
        await ctx.send(f"🎯 **WIN!** +{bet} koin.")
    else:
        user["coin"] -= bet
        await ctx.send(f"💥 **LOSE!** -{bet} koin.")
    save_db(db)

bot.run(TOKEN)
