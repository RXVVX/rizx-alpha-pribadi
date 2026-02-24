import os
import requests
import time
from threading import Thread
from telegram import Bot
from telegram.ext import Updater, MessageHandler, Filters

# ===== Environment Variables =====
BOT_TOKEN = os.getenv("BOT_TOKEN")
BIRDEYE_API = os.getenv("BIRDEYE_API")
TELEGRAM_CHAT_ID = os.getenv("CHAT_ID")  # ID Telegram pribadi kamu
RPC_URL = "https://api.mainnet-beta.solana.com"

bot = Bot(BOT_TOKEN)

# ===== Fungsi Ambil Data Token dari Birdeye =====
def get_token_data(ca):
    headers = {"X-API-KEY": BIRDEYE_API}
    url = f"https://public-api.birdeye.so/public/token_overview?address={ca}"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        return r.json()
    except Exception as e:
        print(f"❌ Error ambil data token {ca}: {e}")
        return {}

# ===== Fungsi Cek Authority Dev =====
def check_authority(ca):
    payload = {"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":[ca, {"encoding":"jsonParsed"}]}
    try:
        r = requests.post(RPC_URL, json=payload, timeout=10)
        info = r.json()["result"]["value"]["data"]["parsed"]["info"]
        mint_auth = info.get("mintAuthority")
        freeze_auth = info.get("freezeAuthority")
        if mint_auth: return "🚨 Dev masih bisa CETAK token"
        if freeze_auth: return "⚠ Token bisa dibekukan"
        return "🟢 Supply Aman (Authority dimatikan)"
    except:
        return "❓ Tidak bisa cek authority"

# ===== Fungsi Analisis Token =====
def analyze_token(ca):
    data = get_token_data(ca)
    try:
        liq = float(data["data"]["liquidity"])
        holders = int(data["data"]["holder"])
        vol = float(data["data"]["v24hUSD"])
        name = data["data"]["name"]
    except:
        return f"❌ Token {ca} tidak ditemukan."

    authority = check_authority(ca)
    whale_alert = ""
    whale_list = data.get("data", {}).get("top10holders", [])
    if vol > 200000: whale_alert = "🐳 Volume besar terdeteksi, indikasi whale aktif"

    bundle_alert = ""
    if len(whale_list) > 1 and whale_list[0]["percent"] > 20 and whale_list[1]["percent"] > 10:
        bundle_alert = "🐾 Bundle wallet terdeteksi → manipulasi supply awal"

    pump = min(int(liq/1000 + holders/50 + vol/50000), 100)
    risk = 10 - pump//10

    rug_alert = ""
    if "CETAK" in authority and liq < 20000: rug_alert = "\n🚨 Risiko tinggi! Authority aktif + Liquidity rendah"

    msg = (
        "━━━━━━━━━━━━━━━━━━\n"
        "🔎 RIZX ALPHA PRIBADI\n\n"
        f"🪙 Token: {name}\n"
        f"💧 Liquidity: ${liq:,.0f}\n"
        f"👥 Holder: {holders}\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "🛡 SUPPLY DEV\n"
        f"{authority}\n\n"
        f"{whale_alert}\n"
        f"{bundle_alert}\n\n"
        f"📊 Pump Probability: {pump}%\n"
        f"⚠ Risk Level: {risk}/10\n"
        f"{rug_alert}\n\n"
        "🧠 Kesimpulan:\n"
        "Gunakan alat bantu ini untuk pribadi. High risk tetap ada."
    )
    return msg

# ===== Fungsi Kirim Alert Token =====
def send_token_alert(ca, chat_id):
    try:
        msg = analyze_token(ca)
        bot.send_message(chat_id=chat_id, text=msg)
    except Exception as e:
        print(f"❌ Gagal kirim alert token {ca}: {e}")

# ===== Handler Pesan Telegram =====
def handle_message(update, context):
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    # Cek apakah input kemungkinan contract address Solana (biasanya 43–44 karakter)
    if len(text) >= 40 and len(text) <= 50:
        send_token_alert(text, chat_id)
    else:
        bot.send_message(chat_id=chat_id, text="❌ Format token tidak valid. Pastikan kamu mengirim contract address token Solana.")

# ===== Start Bot =====
def start_bot():
    updater = Updater(BOT_TOKEN, use_context=True)
    dp = updater.dispatcher
    dp.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_message))

    # Test kirim pesan awal ke CHAT_ID
    try:
        bot.send_message(chat_id=TELEGRAM_CHAT_ID, text="🔥 BOT PRIBADI AKTIF – Siap scan token via Telegram")
    except Exception as e:
        print(f"❌ Gagal kirim test alert: {e}")

    updater.start_polling()
    updater.idle()

# ===== Jalankan Bot =====
if __name__ == "__main__":
    start_bot()
