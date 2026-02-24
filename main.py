import os
import requests
import time
from threading import Thread
from telegram import Bot

# ===== Environment Variables =====
BOT_TOKEN = os.getenv("BOT_TOKEN")
BIRDEYE_API = os.getenv("BIRDEYE_API")
TELEGRAM_CHAT_ID = os.getenv("CHAT_ID")  # ID Telegram kamu
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

    msg = f"""
━━━━━━━━━━━━━━━━━━
🔎 RIZX ALPHA PRIBADI

🪙 Token: {name}
💧 Liquidity: ${liq:,.0f}
👥 Holder: {holders}

━━━━━━━━━━━━━━━━━━
🛡 SUPPLY DEV
{authority}

{whale_alert}
{bundle_alert}

📊 Pump Probability: {pump}%
⚠ Risk Level: {risk}/10
{rug_alert}

🧠 Kesimpulan:
Gunakan alat bantu ini untuk pribadi. High risk tetap ada.
"""
    return msg

# ===== Fungsi Monitor Token List =====
def monitor_tokens(token_list):
    while True:
        for ca in token_list:
            try:
                msg = analyze_token(ca)
                bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg)
            except Exception as e:
                print(f"❌ Gagal kirim alert token {ca}: {e}")
        time.sleep(300)  # scan tiap 5 menit

# ===== Fungsi Start Bot =====
def start_bot():
    token_list = [
        # Contoh token list default, bisa ganti sendiri
        "TOKEN_CONTRACT_ADDRESS_1",
        "TOKEN_CONTRACT_ADDRESS_2",
        "TOKEN_CONTRACT_ADDRESS_3"
    ]

    # Kirim pesan test untuk pastikan Telegram bisa menerima
    try:
        bot.send_message(chat_id=TELEGRAM_CHAT_ID, text="🔥 BOT PRIBADI AKTIF – TEST ALERT")
    except Exception as e:
        print(f"❌ Gagal kirim test alert: {e}")

    # Start thread monitoring
    Thread(target=monitor_tokens, args=(token_list,), daemon=True).start()
    print("BOT PRIBADI AKTIF...")

# ===== Jalankan Bot =====
if __name__ == "__main__":
    start_bot()
    # Loop supaya thread tetap hidup 24 jam
    while True:
        time.sleep(60)    try:
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

    msg = f"""
━━━━━━━━━━━━━━━━━━
🔎 RIZX ALPHA PRIBADI

🪙 Token: {name}
💧 Liquidity: ${liq:,.0f}
👥 Holder: {holders}

━━━━━━━━━━━━━━━━━━
🛡 SUPPLY DEV
{authority}

{whale_alert}
{bundle_alert}

📊 Pump Probability: {pump}%
⚠ Risk Level: {risk}/10
{rug_alert}

🧠 Kesimpulan:
Gunakan alat bantu ini untuk pribadi. High risk tetap ada.
"""
    return msg

def monitor_tokens(token_list):
    while True:
        for ca in token_list:
            msg = analyze_token(ca)
            bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg)
        time.sleep(300)  # tiap 5 menit

def start_bot():
    token_list = [
        # Contoh token list default
        "TOKEN_CONTRACT_ADDRESS_1",
        "TOKEN_CONTRACT_ADDRESS_2",
        "TOKEN_CONTRACT_ADDRESS_3"
    ]
    Thread(target=monitor_tokens, args=(token_list,), daemon=True).start()
    print("BOT PRIBADI AKTIF...")

if __name__ == "__main__":
    start_bot()
    if __name__ == "__main__":
    start_bot()
