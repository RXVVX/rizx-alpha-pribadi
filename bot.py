import requests
import time
import os

# =========================
# CONFIG
# =========================
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

DEX_API = "https://api.dexscreener.com/latest/dex/search?q=usdt"
GOPLUS_API = "https://api.gopluslabs.io/api/v1/token_security"

SCAN_INTERVAL = 45
MIN_LIQUIDITY = 10000
MAX_MARKETCAP = 5000000

blacklist = set()
volume_history = {}

# =========================
# TELEGRAM ALERT
# =========================
def send_telegram(msg):
    if not TELEGRAM_TOKEN or not CHAT_ID:
        print("[WARN] Telegram not configured")
        return
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        requests.post(url, data={"chat_id": CHAT_ID, "text": msg}, timeout=10)
    except Exception as e:
        print("[ERROR] Telegram:", e)

# =========================
# GOPLUS SECURITY CHECK
# =========================
def check_security(chain, token):
    try:
        url = f"{GOPLUS_API}/{chain}?contract_addresses={token}"
        res = requests.get(url, timeout=10).json()
        data = res.get("result", {}).get(token, {})

        honeypot = data.get("is_honeypot") == "1"
        mintable = data.get("is_mintable") == "1"
        owner_percent = float(data.get("owner_percent", 0))

        scam = honeypot or mintable or owner_percent > 20
        return scam, owner_percent

    except Exception as e:
        print("[WARN] GoPlus error:", e)
        return True, 100

# =========================
# DETEKSI RUGPULL
# =========================
def rugpull_risk(liquidity, fdv):
    if liquidity < 5000:
        return True
    if fdv and liquidity / fdv < 0.05:
        return True
    return False

# =========================
# DETEKSI COIN BARU
# =========================
def is_new_pair(created_at):
    age_minutes = (time.time() - created_at / 1000) / 60
    return age_minutes < 60, age_minutes

# =========================
# DETEKSI VOLUME TURUN
# =========================
def volume_drop(token, volume):
    if token in volume_history:
        if volume < volume_history[token] * 0.5:
            return True
    volume_history[token] = volume
    return False

# =========================
# SCAN MARKET
# =========================
def scan_pairs():
    print("\n[SCAN] Scanning market...")

    try:
        res = requests.get(DEX_API, timeout=15)
        data = res.json().get("pairs", [])
    except Exception as e:
        print("[ERROR] Dexscreener:", e)
        return

    if not data:
        print("[WARN] No data received")
        return

    for pair in data[:30]:  # batasi agar ringan
        try:
            name = pair["baseToken"]["name"]
            symbol = pair["baseToken"]["symbol"]
            token = pair["baseToken"]["address"]
            chain = pair["chainId"]
            liquidity = float(pair["liquidity"]["usd"])
            volume = float(pair["volume"]["h24"])
            fdv = float(pair.get("fdv") or 0)
            created = pair.get("pairCreatedAt", time.time())

            if token in blacklist:
                continue

            if liquidity < MIN_LIQUIDITY:
                continue

            new, age = is_new_pair(created)
            scam, owner_percent = check_security(chain, token)

            if scam:
                blacklist.add(token)
                send_telegram(f"❌ SCAM DETECTED\n{name} ({symbol})")
                print(f"[SCAM] {symbol}")
                continue

            rugpull = rugpull_risk(liquidity, fdv)
            vol_drop = volume_drop(token, volume)

            early_gem = new and fdv < MAX_MARKETCAP and liquidity > 20000

            safety_score = 100
            if rugpull:
                safety_score -= 40
            if owner_percent > 10:
                safety_score -= 20

            print(f"[OK] {symbol} | Safety {safety_score}")

            # ===== ALERT =====
            if early_gem:
                send_telegram(
                    f"🚀 EARLY GEM\n"
                    f"{name} ({symbol})\n"
                    f"Age: {int(age)} min\n"
                    f"Liquidity: ${liquidity:,.0f}\n"
                    f"MarketCap: ${fdv:,.0f}\n"
                    f"Safety: {safety_score}"
                )

            if rugpull:
                send_telegram(f"⚠️ RUGPULL RISK\n{name} ({symbol})")

            if vol_drop:
                send_telegram(f"⚠️ VOLUME DROP\n{name} ({symbol})")

        except Exception as e:
            print("[PAIR ERROR]", e)

# =========================
# MAIN LOOP
# =========================
def main():
    print("[START] Bot Memecoin Scanner Running")
    send_telegram("🤖 Bot Scanner Started")

    while True:
        scan_pairs()
        time.sleep(SCAN_INTERVAL)

if __name__ == "__main__":
    main()
