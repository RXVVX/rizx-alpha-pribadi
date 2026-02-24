import os
import requests
import asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

# ===== Environment Variables =====
BOT_TOKEN = os.getenv("BOT_TOKEN")
BIRDEYE_API = os.getenv("BIRDEYE_API")
TELEGRAM_CHAT_ID = int(os.getenv("CHAT_ID"))
RPC_URL = "https://api.mainnet-beta.solana.com"

# ===== Fungsi Ambil Data Token =====
def get_token_data(token_address):
    try:
        headers = {"X-API-KEY": BIRDEYE_API}
        url = f"https://public-api.birdeye.so/public/token_overview?address={token_address}"
        r = requests.get(url, headers=headers, timeout=10)
        return r.json()
    except:
        return {}

# ===== Fungsi Cek Authority =====
def check_authority(token_address):
    try:
        payload = {
            "jsonrpc":"2.0",
            "id":1,
            "method":"getAccountInfo",
            "params":[token_address, {"encoding":"jsonParsed"}]
        }
        r = requests.post(RPC_URL, json=payload, timeout=10)
        info = r.json()["result"]["value"]["data"]["parsed"]["info"]
        mint = info.get("mintAuthority")
        freeze = info.get("freezeAuthority")
        if mint: return "🚨 Dev masih bisa CETAK token"
        if freeze: return "⚠ Token bisa dibekukan"
        return "🟢 Supply Aman (Authority dimatikan)"
    except:
        return "❓ Tidak bisa cek authority"

# ===== Fungsi Analisis Token =====
def analyze_token(token_address):
    data = get_token_data(token_address)
    try:
        name = data["data"]["name"]
        liq = float(data["data"]["liquidity"])
        holders = int(data["data"]["holder"])
        vol = float(data["data"]["v24hUSD"])
    except:
        return f"❌ Token {token_address} tidak ditemukan."

    authority = check_authority(token_address)
    whale_alert = ""
    whales = data.get("data", {}).get("top10holders", [])
    if vol > 200000: whale_alert = "🐳 Whale aktif terdeteksi"

    bundle_alert = ""
    if len(whales) > 1 and whales[0]["percent"] > 20 and whales[1]["percent"] > 10:
        bundle_alert = "🐾 Bundle wallet terdeteksi"

    pump = min(int(liq/1000 + holders/50 + vol/50000), 100)
    risk = 10 - pump//10
    rug_alert = ""
    if "CETAK" in authority and liq < 20000:
        rug_alert = "\n🚨 Risiko tinggi! Dev aktif + Liquidity rendah"

    msg = (
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🔎 RIZX ALPHA PRIBADI\n\n"
        f"🪙 Token: {name}\n"
        f"💧 Liquidity: ${liq:,.0f}\n"
        f"👥 Holder: {holders}\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🛡 SUPPLY DEV\n{authority}\n\n"
        f"{whale_alert}\n{bundle_alert}\n\n"
        f"📊 Pump Probability: {pump}%\n"
        f"⚠ Risk Level: {risk}/10\n"
        f"{rug_alert}\n\n"
        f"🧠 Kesimpulan:\nGunakan alat bantu ini untuk pribadi. High risk tetap ada."
    )
    return msg

# ===== Kirim Alert =====
async def send_alert(token_address, chat_id, context):
    try:
        msg = analyze_token(token_address)
        await context.bot.send_message(chat_id=chat_id, text=msg)
    except Exception as e:
        print(f"❌ Gagal kirim alert: {e}")

# ===== Handler Pesan Telegram =====
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    if 40 <= len(text) <= 50:
        await send_alert(text, chat_id, context)
    else:
        await update.message.reply_text("❌ Format token tidak valid. Kirim contract address Solana yang benar.")

# ===== Start Bot =====
def start_bot():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))

    # Test alert saat start
    async def test_alert():
        try:
            await app.bot.send_message(chat_id=TELEGRAM_CHAT_ID, text="🔥 BOT PRIBADI AKTIF – Siap scan token via Telegram")
        except:
            pass
    app.post_init.append(lambda app: asyncio.create_task(test_alert()))

    app.run_polling()

# ===== Main =====
if __name__ == "__main__":
    start_bot()
