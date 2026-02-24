# main.py
import os
import requests
import asyncio
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

BOT_TOKEN = os.getenv("BOT_TOKEN")
BIRDEYE_API = os.getenv("BIRDEYE_API")
TELEGRAM_CHAT_ID = int(os.getenv("CHAT_ID"))
RPC_URL = "https://api.mainnet-beta.solana.com"

def get_token_data(token_address: str) -> dict:
    headers = {"X-API-KEY": BIRDEYE_API}
    url = f"https://public-api.birdeye.so/public/token_overview?address={token_address}"
    response = requests.get(url, headers=headers, timeout=10)
    return response.json()

def check_authority(token_address: str) -> str:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [token_address, {"encoding": "jsonParsed"}]
    }
    response = requests.post(RPC_URL, json=payload, timeout=10)
    info = response.json()["result"]["value"]["data"]["parsed"]["info"]
    mint = info.get("mintAuthority")
    freeze = info.get("freezeAuthority")
    if mint:
        return "🚨 Dev masih bisa CETAK token"
    if freeze:
        return "⚠ Token bisa dibekukan"
    return "🟢 Supply Aman (Authority dimatikan)"

def analyze_token(token_address: str) -> str:
    data = get_token_data(token_address)
    name = data["data"]["name"]
    liquidity = float(data["data"]["liquidity"])
    holders = int(data["data"]["holder"])
    volume = float(data["data"]["v24hUSD"])
    top_holders = data.get("data", {}).get("top10holders", [])

    authority = check_authority(token_address)
    whale_alert = "🐳 Whale aktif" if volume > 200000 else ""
    bundle_alert = "🐾 Bundle wallet terdeteksi" if len(top_holders) > 1 and top_holders[0]["percent"] > 20 and top_holders[1]["percent"] > 10 else ""

    pump_probability = min(int(liquidity/1000 + holders/50 + volume/50000), 100)
    risk_level = 10 - pump_probability//10
    rug_alert = "🚨 Risiko tinggi! Dev aktif + Liquidity rendah" if "CETAK" in authority and liquidity < 20000 else ""

    msg = (
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🔎 RIZX ALPHA PRIBADI\n\n"
        f"🪙 Token: {name}\n"
        f"💧 Liquidity: ${liquidity:,.0f}\n"
        f"👥 Holder: {holders}\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🛡 SUPPLY DEV\n{authority}\n\n"
        f"{whale_alert}\n{bundle_alert}\n\n"
        f"📊 Pump Probability: {pump_probability}%\n"
        f"⚠ Risk Level: {risk_level}/10\n"
        f"{rug_alert}\n\n"
        f"🧠 Kesimpulan:\nGunakan alat bantu ini untuk pribadi. High risk tetap ada."
    )
    return msg

async def send_alert(token_address: str, chat_id: int, context: ContextTypes.DEFAULT_TYPE):
    msg = analyze_token(token_address)
    await context.bot.send_message(chat_id=chat_id, text=msg)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    if 40 <= len(text) <= 50:
        await send_alert(text, chat_id, context)
    else:
        await update.message.reply_text("❌ Format token tidak valid. Kirim contract address Solana yang benar.")

def start_bot():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))

    async def test_alert():
        await app.bot.send_message(chat_id=TELEGRAM_CHAT_ID, text="🔥 BOT PRIBADI AKTIF – Siap scan token via Telegram")
    app.post_init.append(lambda app: asyncio.create_task(test_alert()))

    app.run_polling()

if __name__ == "__main__":
    start_bot()
