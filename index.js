// DUEL RXV TEAMRXVVX - BOT LENGKAP DENGAN GIFT CODE SALDO
// Simpan sebagai index.js

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// ==================== KONFIGURASI ====================
const config = {
    token: process.env.DISCORD_TOKEN || "YOUR_BOT_TOKEN_HERE",
    prefix: ".",
    ownerIds: (process.env.OWNER_IDS || "YOUR_USER_ID_HERE").split(','),
    botName: "DUEL RXV TEAMRXVVX",
    botEmoji: "🤖",
    coinEmoji: "🪙",
    version: "Valentine Edition - Real Betting",
    
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    gameExpireTime: 120000,
    
    fee: {
        enabled: true,
        percentage: 5,
        minFee: 10,
        maxFee: 5000
    }
};

// ==================== DATABASE LENGKAP ====================
let db = { 
    users: {}, 
    games: [],
    feeWallet: 0,
    feeHistory: [],
    giftCodes: []  // Array untuk menyimpan gift code
};

// Load database
try {
    if (fs.existsSync('./database.json')) {
        db = JSON.parse(fs.readFileSync('./database.json'));
        console.log('✅ Database loaded');
    } else {
        fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
        console.log('✅ Database created');
    }
} catch (err) {
    console.log('Database error:', err);
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

function getUser(userId, username) {
    if (!db.users[userId]) {
        db.users[userId] = {
            userId, username,
            coins: config.startingCoins,
            gamesPlayed: 0, gamesWon: 0,
            gamesVsBot: 0, gamesVsPlayer: 0,
            totalFeePaid: 0,
            registerDate: new Date().toISOString()
        };
        saveDB();
    }
    return db.users[userId];
}

// ==================== FUNGSI FEE ====================
function calculateFee(amount) {
    if (!config.fee.enabled) return 0;
    let fee = Math.floor(amount * (config.fee.percentage / 100));
    if (fee < config.fee.minFee) fee = config.fee.minFee;
    if (fee > config.fee.maxFee) fee = config.fee.maxFee;
    return fee;
}

function applyFee(amount, userId, username, gameType) {
    const fee = calculateFee(amount);
    if (fee > 0) {
        db.feeWallet += fee;
        db.feeHistory.push({ userId, username, amount: fee, gameType, timestamp: new Date().toISOString() });
        if (db.users[userId]) db.users[userId].totalFeePaid += fee;
        saveDB();
    }
    return fee;
}

// ==================== FUNGSI GIFT CODE DENGAN SALDO ====================

// Fungsi untuk generate random code
function generateGiftCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Fungsi untuk membuat gift code dengan saldo terbatas
function createGiftCode(totalBalance, perUserAmount, createdBy, username, customCode = null, expiresInDays = 30) {
    const code = customCode ? customCode.toUpperCase() : generateGiftCode();
    
    // Cek apakah kode sudah ada
    if (db.giftCodes.some(g => g.code === code)) {
        return null;
    }
    
    // Hitung maksimal pengguna berdasarkan saldo
    const maxUses = Math.floor(totalBalance / perUserAmount);
    
    const gift = {
        code: code,
        perUserAmount: perUserAmount,      // Jumlah per orang
        totalBalance: totalBalance,        // Total saldo tersedia
        remainingBalance: totalBalance,     // Sisa saldo
        maxUses: maxUses,                   // Maksimal orang (dari perhitungan)
        currentUses: 0,                      // Sudah dipakai berapa orang
        usedBy: [],                          // Array untuk menyimpan siapa saja yang pakai
        createdBy: createdBy,
        createdByUsername: username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        deactivatedAt: null
    };
    
    db.giftCodes.push(gift);
    saveDB();
    return gift;
}

// Fungsi untuk cek apakah gift masih berlaku
function isGiftValid(gift) {
    if (!gift.isActive) return { valid: false, reason: 'Kode sudah dinonaktifkan' };
    if (gift.remainingBalance < gift.perUserAmount) return { valid: false, reason: 'Saldo sudah habis' };
    if (new Date(gift.expiresAt) < new Date()) return { valid: false, reason: 'Kode sudah kedaluwarsa' };
    return { valid: true };
}

// Fungsi untuk redeem gift
function redeemGift(gift, userId, username) {
    // Cek apakah user sudah pernah pakai kode ini
    if (gift.usedBy.some(u => u.userId === userId)) {
        return { success: false, reason: 'Kamu sudah pernah menggunakan kode ini' };
    }
    
    // Cek apakah saldo cukup
    if (gift.remainingBalance < gift.perUserAmount) {
        return { success: false, reason: 'Saldo kode ini sudah habis' };
    }
    
    const amount = gift.perUserAmount;
    
    // Tambahkan user ke daftar pemakai
    gift.usedBy.push({
        userId: userId,
        username: username,
        amount: amount,
        usedAt: new Date().toISOString()
    });
    
    // Kurangi saldo
    gift.remainingBalance -= amount;
    gift.currentUses = gift.usedBy.length;
    
    // Jika saldo habis, nonaktifkan otomatis
    if (gift.remainingBalance < gift.perUserAmount) {
        gift.isActive = false;
        gift.deactivatedAt = new Date().toISOString();
    }
    
    saveDB();
    return { 
        success: true, 
        amount: amount,
        remainingBalance: gift.remainingBalance,
        remainingUsers: Math.floor(gift.remainingBalance / gift.perUserAmount)
    };
}

// ==================== CLIENT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const activeGames = new Map(); // PVP
const activePVH = new Map();   // VS Bot

// ==================== HELPERS ====================
function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

// ==================== GAME LOGIC ====================

// 1. REME (adu angka 1-1000)
function playReme(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 1000) + 1;
        const p2 = Math.floor(Math.random() * 1000) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 2. QEME (tebak angka 1-50)
function playQeme(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const secret = Math.floor(Math.random() * 50) + 1;
        const p1 = Math.floor(Math.random() * 50) + 1;
        const p2 = Math.floor(Math.random() * 50) + 1;
        const diff1 = Math.abs(secret - p1);
        const diff2 = Math.abs(secret - p2);
        if (diff1 < diff2) playerWins++;
        else if (diff2 < diff1) opponentWins++;
        results.push(`Ronde ${r}: Angka=${secret} | ${p1} vs ${p2} (selisih ${diff1}/${diff2}) ${diff1 < diff2 ? '✅' : diff2 < diff1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 3. QQ (kartu 1-13)
function playQQ(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 13) + 1;
        const p2 = Math.floor(Math.random() * 13) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 4. CSN (casino random)
function playCSN(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 5. BTK (battle)
function playBTK(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 50) + 1;
        const p2 = Math.floor(Math.random() * 50) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: ⚔️ ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 6. DIRT
function playDirt(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🌱 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 7. BC (baccarat)
function playBC(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 10);
        const p2 = Math.floor(Math.random() * 10);
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🎰 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 8. BJ (blackjack)
function playBJ(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 21) + 1;
        const p2 = Math.floor(Math.random() * 21) + 1;
        if (p1 > 21 && p2 > 21) { /* both bust */ }
        else if (p1 > 21) opponentWins++;
        else if (p2 > 21) playerWins++;
        else if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🃏 ${p1} vs ${p2} ${(p1 <= 21 && (p1 > p2 || p2 > 21)) ? '✅' : (p2 <= 21 && (p2 > p1 || p1 > 21)) ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 9. KB (kecil/besar 2 dadu)
function playKB(rounds, hostChoice) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const dice1 = rollDice();
        const dice2 = rollDice();
        const total = dice1 + dice2;
        const hasil = total <= 6 ? 'KECIL' : 'BESAR';
        const joinerChoice = hostChoice === 'KECIL' ? 'BESAR' : 'KECIL';
        if (hostChoice === hasil) playerWins++;
        else if (joinerChoice === hasil) opponentWins++;
        results.push(`Ronde ${r}: 🎲 ${dice1}+${dice2}=${total} (${hasil}) | Host:${hostChoice} vs Joiner:${joinerChoice} ${hostChoice === hasil ? '✅' : '❌'}`);
    }
    return { playerWins, opponentWins, results };
}

// 10. DADU (adu 2 dadu)
function playDadu(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1 = rollDice() + rollDice();
        const p2 = rollDice() + rollDice();
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        results.push(`Ronde ${r}: 🎲 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 11. CARD (adu kartu dengan suit)
function playCard(rounds) {
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    const suits = ['♥️','♦️','♠️','♣️'];
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const p1Card = cards[Math.floor(Math.random() * cards.length)];
        const p1Suit = suits[Math.floor(Math.random() * suits.length)];
        const p1Value = cards.indexOf(p1Card) + 2;
        const p2Card = cards[Math.floor(Math.random() * cards.length)];
        const p2Suit = suits[Math.floor(Math.random() * suits.length)];
        const p2Value = cards.indexOf(p2Card) + 2;
        if (p1Value > p2Value) playerWins++;
        else if (p2Value > p1Value) opponentWins++;
        results.push(`Ronde ${r}: 🎴 ${p1Suit}${p1Card}(${p1Value}) vs ${p2Suit}${p2Card}(${p2Value}) ${p1Value > p2Value ? '✅' : p2Value > p1Value ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// 12. FLIP (3 kali coinflip)
function playFlip(rounds) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        let playerScore = 0, opponentScore = 0;
        for (let f = 1; f <= 3; f++) {
            const flip = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
            const p1 = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
            const p2 = p1 === 'KEPALA' ? 'EKOR' : 'KEPALA';
            if (p1 === flip) playerScore++;
            else opponentScore++;
        }
        if (playerScore > opponentScore) playerWins++;
        else if (opponentScore > playerScore) opponentWins++;
        results.push(`Ronde ${r}: Player ${playerScore} vs Opponent ${opponentScore} ${playerScore > opponentScore ? '✅' : opponentScore > playerScore ? '❌' : '🤝'}`);
    }
    return { playerWins, opponentWins, results };
}

// ==================== READY ====================
client.once('ready', () => {
    console.log(`✅ ${config.botName} ONLINE!`);
    console.log(`📱 Deposit: ${config.deposit.dana}`);
    console.log(`💰 Fee: ${config.fee.percentage}%`);
    console.log(`🎁 Gift codes: ${db.giftCodes.length} tersedia`);
    client.user.setActivity('.menu | Taruhan Sungguhan', { type: 'PLAYING' });

    setInterval(() => {
        const now = Date.now();
        for (const [id, game] of activeGames.entries()) {
            if (game.expiresAt < now) {
                const host = db.users[game.hostId];
                if (host) { host.coins += game.betAmount; saveDB(); }
                activeGames.delete(id);
            }
        }
        for (const [id, game] of activePVH.entries()) {
            if (game.expiresAt < now) {
                const player = db.users[game.playerId];
                if (player) { player.coins += game.betAmount; saveDB(); }
                activePVH.delete(id);
            }
        }
    }, 60000);
});

// ==================== MESSAGE HANDLER ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    try {
        const user = getUser(message.author.id, message.author.username);

        // ==================== MENU ====================
        if (cmd === 'menu') {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🎮 ${config.botName} - MENU UTAMA`)
                .setDescription(`**Update: ${config.version}**\n• Semua Game 5 Ronde!\n• Fee ${config.fee.percentage}%`)
                .addFields(
                    { name: '📋 MENU', value: '`.menu` `.help` `.admin` `.tukar`' },
                    { name: '💰 EKONOMI', value: '`.depo` `.qris` `.tf @user` `.cc` `.lb`' },
                    { name: '🎲 SPIN GRATIS', value: '`.spin` - Lempar 3 dadu gratis' },
                    { name: '🎁 GIFT CODE', value: '`.tukar KODE` - Redeem gift\nContoh: `.tukar HUTRI75`' },
                    { name: '⚔️ PVP (5 RONDE)', value: '`.reme 100` `.qeme 100` `.qq 100` `.csn 100` `.btk 100` `.dirt 100` `.bc 100` `.bj 100` `.kb k 100` `.dadu 100` `.card 100` `.flip 100`' },
                    { name: '🤝 VS BOT', value: '`.hleme 100` `.leme ID` `.hreme 100` `.reme ID` `.hlewa 100` `.lewa ID` `.hr 100` `.rw ID`' },
                    { name: '🔍 ROOM', value: '`.rooms` `.cancel ID`' }
                )
                .setFooter({ text: `Deposit: ${config.deposit.dana}` });
            return message.channel.send({ embeds: [embed] });
        }

        // ==================== HELP ====================
        if (cmd === 'help') {
            return message.reply(
                '📚 **BANTUAN**\n\n' +
                '**FEE:** 5% dari total pot (min 10, max 5000)\n' +
                '**SPIN GRATIS:** `.spin` (tidak pakai coin)\n' +
                '**REDEEM GIFT:** `.tukar KODE`\n' +
                '**PVP:** Host `.reme 500`, Join `.remej ID`\n' +
                '**VS BOT:** Host `.hleme 500`, Join `.leme ID`\n' +
                '**CEK ROOM:** `.rooms`\n' +
                '**BATAL:** `.cancel ID`\n' +
                `**DEPOSIT:** ${config.deposit.dana} (DANA/OVO/GOPAY)`
            );
        }

        // ==================== ADMIN ====================
        if (cmd === 'admin') {
            return message.reply(`👑 **ADMIN**\nOwner: ${config.ownerIds.join(', ')}\n📱 Deposit: ${config.deposit.dana}`);
        }

        // ==================== DEPOSIT ====================
        if (cmd === 'depo') {
            return message.reply(
                '💰 **DEPOSIT COIN**\n' +
                `📱 DANA: \`${config.deposit.dana}\`\n` +
                `📱 OVO: \`${config.deposit.ovo}\`\n` +
                `📱 GOPAY: \`${config.deposit.gopay}\`\n` +
                '💎 Rate: Rp 10.000 = 1000 coin\n' +
                '📋 Kirim bukti ke admin'
            );
        }

        // ==================== QRIS ====================
        if (cmd === 'qris') {
            return message.reply('📱 **QRIS**\nScan QR code untuk deposit (hubungi admin)');
        }

        // ==================== CEK COIN ====================
        if (cmd === 'cc') {
            const target = message.mentions.users.first() || message.author;
            const u = db.users[target.id] || { coins: 0, gamesPlayed: 0, gamesWon: 0, totalFeePaid: 0 };
            return message.reply(
                `💰 **${target.username}**\n` +
                `Coin: ${formatNumber(u.coins)} 🪙\n` +
                `Games: ${u.gamesPlayed} | Menang: ${u.gamesWon}\n` +
                `Total Fee: ${formatNumber(u.totalFeePaid)} 🪙`
            );
        }

        // ==================== LEADERBOARD ====================
        if (cmd === 'lb' || cmd === 'leaderboard') {
            const users = Object.values(db.users).sort((a,b) => b.coins - a.coins).slice(0,10);
            if (users.length === 0) return message.reply('❌ Belum ada data');
            let desc = '🏆 **TOP 10**\n\n';
            for (let i=0; i<users.length; i++) {
                const u = users[i];
                desc += `${i+1}. **${u.username}** - ${formatNumber(u.coins)} 🪙\n`;
            }
            return message.reply(desc);
        }

        // ==================== TRANSFER ====================
        if (cmd === 'tf' || cmd === 'tfcion') {
            if (args.length < 2) return message.reply('❌ Gunakan: `.tf @user jumlah`');
            const target = message.mentions.users.first();
            if (!target) return message.reply('❌ Tag user');
            if (target.id === message.author.id) return message.reply('❌ Tidak bisa transfer ke diri sendiri');
            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid');
            if (user.coins < amount) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            const receiver = db.users[target.id] || { userId: target.id, username: target.username, coins: 0 };
            db.users[target.id] = receiver;
            user.coins -= amount;
            receiver.coins += amount;
            saveDB();
            return message.reply(`💸 **TRANSFER**\n${message.author} → ${target}: ${formatNumber(amount)} coin`);
        }

        // ==================== SPIN GRATIS ====================
        if (cmd === 'spin') {
            const dice1 = rollDice();
            const dice2 = rollDice();
            const dice3 = rollDice();
            const total = dice1 + dice2 + dice3;
            let messageText = '';
            if (total === 18) messageText = '🎉 **JACKPOT!** Semua angka 6!';
            else if (total >= 15) messageText = '⭐ Bagus! Angka besar!';
            else if (total <= 5) messageText = '😅 Wah kecil sekali...';
            else messageText = '👍 Lumayan!';

            return message.reply(
                `🎲 **SPIN GRATIS**\n` +
                `${message.author} melempar 3 dadu!\n\n` +
                `🎲 ${dice1} | ${dice2} | ${dice3} = **${total}**\n` +
                `${messageText}\n\n` +
                `*Spin ini gratis, tidak mempengaruhi coin*`
            );
        }

        // ==================== REDEEM GIFT CODE ====================
        if (cmd === 'tukar' || cmd === 'redeem' || cmd === 'claim') {
            if (!args[0]) {
                return message.reply(
                    '❌ **Gunakan:** `.tukar KODE_GIFT`\n' +
                    'Contoh: `.tukar HUTRI75`\n\n' +
                    '💡 Minta kode gift ke admin!'
                );
            }
            
            const code = args[0].toUpperCase();
            const now = new Date();
            
            const giftIndex = db.giftCodes.findIndex(g => g.code === code);
            
            if (giftIndex === -1) {
                return message.reply('❌ Kode gift **tidak ditemukan**! Periksa kembali kode Anda.');
            }
            
            const gift = db.giftCodes[giftIndex];
            
            // Cek validitas
            if (!gift.isActive) {
                return message.reply('❌ Kode gift sudah **dinonaktifkan** oleh admin!');
            }
            
            if (gift.usedBy.some(u => u.userId === message.author.id)) {
                return message.reply('❌ Kamu sudah pernah menggunakan kode ini!');
            }
            
            if (gift.remainingBalance < gift.perUserAmount) {
                return message.reply('❌ Maaf, saldo kode ini sudah habis!');
            }
            
            if (new Date(gift.expiresAt) < now) {
                return message.reply('❌ Kode gift sudah **kedaluwarsa**!');
            }
            
            // Proses redeem
            const amount = gift.perUserAmount;
            user.coins += amount;
            
            // Update gift
            gift.usedBy.push({
                userId: message.author.id,
                username: message.author.username,
                amount: amount,
                usedAt: now.toISOString()
            });
            
            gift.remainingBalance -= amount;
            gift.currentUses = gift.usedBy.length;
            
            // Cek apakah saldo habis
            const isLastUser = gift.remainingBalance < gift.perUserAmount;
            if (isLastUser) {
                gift.isActive = false;
                gift.deactivatedAt = now.toISOString();
            }
            
            saveDB();
            
            // Buat embed response
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎁 REDEEM GIFT CODE BERHASIL!')
                .setDescription(`Selamat ${message.author.username}!`)
                .addFields(
                    { name: 'Kode Gift', value: `\`${code}\``, inline: true },
                    { name: 'Kamu Mendapat', value: `+${formatNumber(amount)} 🪙`, inline: true },
                    { name: 'Sisa Saldo', value: `${formatNumber(gift.remainingBalance)} / ${formatNumber(gift.totalBalance)} 🪙`, inline: true },
                    { name: 'Sisa Kuota', value: `${Math.floor(gift.remainingBalance / gift.perUserAmount)} orang lagi`, inline: true },
                    { name: 'Total Coinmu', value: `${formatNumber(user.coins)} 🪙`, inline: true },
                    { name: 'Dibuat Oleh', value: gift.createdByUsername, inline: true }
                )
                .setFooter({ text: isLastUser ? '⚠️ Kamu adalah pengguna TERAKHIR! Saldo habis.' : 'Terima kasih telah menggunakan gift code!' });
            
            return message.channel.send({ embeds: [embed] });
        }

        // ==================== CEK ROOM ====================
        if (cmd === 'rooms' || cmd === 'listroom') {
            if (activeGames.size === 0 && activePVH.size === 0) {
                return message.reply('📭 Tidak ada room tersedia.');
            }
            let desc = '**🎮 ROOM TERSEDIA:**\n\n';
            for (const [id, g] of activeGames.entries()) {
                const timeLeft = Math.max(0, Math.ceil((g.expiresAt - Date.now())/1000/60*10)/10);
                desc += `⚔️ **${g.type}** ID: \`${id}\` | Host: ${g.hostName} | ${formatNumber(g.betAmount)} coin | ⏳ ${timeLeft}m\nJoin: \`.${g.joinCmd} ${id}\`\n\n`;
            }
            for (const [id, g] of activePVH.entries()) {
                const timeLeft = Math.max(0, Math.ceil((g.expiresAt - Date.now())/1000/60*10)/10);
                desc += `🤖 **${g.type} (VS BOT)** ID: \`${id}\` | Host: ${g.playerName} | ${formatNumber(g.betAmount)} coin | ⏳ ${timeLeft}m\nJoin: \`.${g.joinCmd} ${id}\`\n\n`;
            }
            return message.reply(desc);
        }

        // ==================== BATAL ROOM ====================
        if (cmd === 'cancel' || cmd === 'batal') {
            const gameId = args[0]?.toUpperCase();
            if (!gameId) return message.reply('❌ Gunakan: `.cancel ID`');

            let game = activeGames.get(gameId);
            if (game) {
                if (game.hostId !== message.author.id) return message.reply('❌ Kamu bukan host!');
                const host = db.users[game.hostId];
                host.coins += game.betAmount;
                saveDB();
                activeGames.delete(gameId);
                return message.reply(`✅ Room **${gameId}** dibatalkan. Coin dikembalikan.`);
            }

            game = activePVH.get(gameId);
            if (game) {
                if (game.playerId !== message.author.id) return message.reply('❌ Kamu bukan host!');
                const player = db.users[game.playerId];
                player.coins += game.betAmount;
                saveDB();
                activePVH.delete(gameId);
                return message.reply(`✅ Room **${gameId}** dibatalkan. Coin dikembalikan.`);
            }

            return message.reply('❌ Game tidak ditemukan!');
        }

        // ==================== HOST PVP ====================
        async function handleHost(gameType, bet, joinCmd, gameFunc) {
            if (isNaN(bet) || bet <= 0) return message.reply(`❌ Gunakan: \`.${cmd} jumlah\``);
            if (user.coins < bet) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            const gameId = generateId();
            user.coins -= bet;
            saveDB();

            const game = {
                id: gameId, type: gameType,
                hostId: message.author.id, hostName: message.author.username,
                betAmount: bet, status: 'waiting',
                joinCmd: joinCmd, gameFunc: gameFunc,
                rounds: 5,
                expiresAt: Date.now() + config.gameExpireTime
            };
            activeGames.set(gameId, game);

            const fee = calculateFee(bet * 2);
            return message.reply(
                `🎮 **HOST ${gameType}**\n` +
                `ID: \`${gameId}\`\n` +
                `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                `💎 Pemenang dapat: ${formatNumber(bet*2 - fee)} coin (setelah fee ${formatNumber(fee)})\n` +
                `📝 Join: \`.${joinCmd} ${gameId}\``
            );
        }

        // ==================== JOIN PVP ====================
        async function handleJoin(gameType, gameId, gameFunc) {
            const game = activeGames.get(gameId);
            if (!game) return message.reply('❌ Game tidak ditemukan!');
            if (game.type !== gameType) return message.reply(`❌ Ini bukan game ${gameType}!`);
            if (game.hostId === message.author.id) return message.reply('❌ Tidak bisa join game sendiri!');

            const joiner = db.users[message.author.id];
            if (joiner.coins < game.betAmount) {
                return message.reply(`❌ Coin tidak cukup! Kamu butuh ${formatNumber(game.betAmount)} coin.`);
            }

            joiner.coins -= game.betAmount;
            const host = db.users[game.hostId];

            const result = gameFunc(5);
            let winner = null, winnerObj = null, winnerName = '';
            if (result.playerWins > result.opponentWins) {
                winner = game.hostId; winnerName = game.hostName; winnerObj = host;
            } else if (result.opponentWins > result.playerWins) {
                winner = message.author.id; winnerName = message.author.username; winnerObj = joiner;
            }

            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);

            if (winner) {
                winnerObj.coins += totalPot - fee;
                winnerObj.gamesWon++;
                applyFee(totalPot, winner, winnerName, gameType);
            } else {
                host.coins += game.betAmount;
                joiner.coins += game.betAmount;
            }

            host.gamesPlayed++; joiner.gamesPlayed++;
            host.gamesVsPlayer++; joiner.gamesVsPlayer++;
            saveDB();
            activeGames.delete(gameId);

            const resultsText = result.results.join('\n');
            let reply = `🎮 **${gameType} - 5 RONDE**\n${game.hostName} vs ${message.author.username}\n\n${resultsText}\n\n📊 Skor: ${game.hostName} ${result.playerWins} - ${result.opponentWins} ${message.author.username}\n💰 Taruhan: ${formatNumber(game.betAmount)} coin/player\n💎 Total Pot: ${formatNumber(totalPot)} coin\n`;
            if (winner) {
                reply += `💰 Fee: ${formatNumber(fee)} coin\n🏆 **Pemenang: ${winnerName}**\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin (profit ${formatNumber(totalPot - fee - game.betAmount)})`;
            } else {
                reply += `🤝 **DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }
            return message.reply(reply);
        }

        // ==================== HOST PVH ====================
        async function handlePVHHost(gameType, bet, joinCmd) {
            if (isNaN(bet) || bet <= 0) return message.reply(`❌ Gunakan: \`.${cmd} jumlah\``);
            if (user.coins < bet) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            const gameId = generateId();
            user.coins -= bet;
            saveDB();

            const game = {
                id: gameId, type: gameType,
                playerId: message.author.id, playerName: message.author.username,
                betAmount: bet, status: 'waiting',
                joinCmd: joinCmd,
                rounds: 5,
                expiresAt: Date.now() + config.gameExpireTime
            };
            activePVH.set(gameId, game);

            const fee = calculateFee(bet * 2);
            return message.reply(
                `🎮 **HOST ${gameType} (VS BOT)**\n` +
                `ID: \`${gameId}\`\n` +
                `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                `💎 Menang dapat: ${formatNumber(bet*2 - fee)} coin\n` +
                `📝 Join: \`.${joinCmd} ${gameId}\``
            );
        }

        // ==================== JOIN PVH ====================
        async function handlePVHJoin(gameType, gameId) {
            const game = activePVH.get(gameId);
            if (!game) return message.reply('❌ Game tidak ditemukan!');
            if (game.playerId === message.author.id) return message.reply('❌ Tidak bisa melawan diri sendiri!');

            const player = db.users[message.author.id];
            if (player.coins < game.betAmount) {
                return message.reply(`❌ Coin tidak cukup! Kamu butuh ${formatNumber(game.betAmount)} coin.`);
            }

            player.coins -= game.betAmount;
            const host = db.users[game.playerId];

            let playerWins = 0, botWins = 0, results = [];
            for (let r = 1; r <= 5; r++) {
                const playerScore = Math.floor(Math.random() * 100) + 1;
                const botScore = Math.floor(Math.random() * 100) + 1;
                if (playerScore > botScore) { playerWins++; results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ✅`); }
                else if (botScore > playerScore) { botWins++; results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ❌`); }
                else results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} 🤝`);
            }

            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);
            let resultText = '';

            if (playerWins > botWins) {
                player.coins += totalPot - fee;
                player.gamesWon++;
                applyFee(totalPot, player.userId, player.username, gameType);
                resultText = `🎉 **KAMU MENANG!**\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin (profit ${formatNumber(totalPot - fee - game.betAmount)})`;
            } else if (botWins > playerWins) {
                db.feeWallet += fee;
                db.feeHistory.push({ userId: 'BOT', username: 'BOT', amount: fee, gameType, timestamp: new Date().toISOString() });
                resultText = `😢 **BOT MENANG!**\n💸 Kerugian: -${formatNumber(game.betAmount)} coin`;
            } else {
                player.coins += game.betAmount;
                host.coins += game.betAmount;
                resultText = `🤝 **DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }

            player.gamesPlayed++;
            player.gamesVsBot++;
            host.gamesVsBot++;
            saveDB();
            activePVH.delete(gameId);

            const resultsText = results.join('\n');
            return message.reply(
                `🎮 **${gameType} VS BOT - 5 RONDE**\n${message.author.username} vs **BOT**\n\n${resultsText}\n\n📊 Skor: Kamu ${playerWins} - ${botWins} Bot\n💰 Taruhan: ${formatNumber(game.betAmount)} coin\n💰 Fee: ${formatNumber(fee)} coin\n${resultText}`
            );
        }

        // ==================== DAFTAR COMMAND PVP ====================
        const hostCommands = {
            reme: ['REME', 'remej', playReme],
            qeme: ['QEME', 'qemej', playQeme],
            qq: ['QQ', 'qqj', playQQ],
            csn: ['CSN', 'csnj', playCSN],
            btk: ['BTK', 'btkj', playBTK],
            dirt: ['DIRT', 'dirtj', playDirt],
            bc: ['BC', 'bcj', playBC],
            bj: ['BJ', 'bjj', playBJ],
            dadu: ['DADU', 'daduj', playDadu],
            card: ['CARD', 'cardj', playCard],
            flip: ['FLIP', 'flipj', playFlip]
        };

        if (hostCommands[cmd]) {
            const [gameType, joinCmd, gameFunc] = hostCommands[cmd];
            return handleHost(gameType, parseInt(args[0]), joinCmd, gameFunc);
        }

        // ==================== KB KHUSUS ====================
        if (cmd === 'kb') {
            if (args.length < 2) return message.reply('❌ Gunakan: `.kb <k/b> jumlah`');
            const choice = args[0].toLowerCase();
            const bet = parseInt(args[1]);
            if (choice !== 'k' && choice !== 'b') return message.reply('❌ Pilih "k" (kecil) atau "b" (besar)');
            if (isNaN(bet) || bet <= 0) return message.reply('❌ Jumlah tidak valid');
            if (user.coins < bet) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            const gameId = generateId();
            user.coins -= bet;
            saveDB();

            const game = {
                id: gameId, type: 'KB',
                hostId: message.author.id, hostName: message.author.username,
                hostChoice: choice === 'k' ? 'KECIL' : 'BESAR',
                betAmount: bet, status: 'waiting',
                joinCmd: 'kbj',
                rounds: 5,
                expiresAt: Date.now() + config.gameExpireTime
            };
            activeGames.set(gameId, game);

            const fee = calculateFee(bet * 2);
            return message.reply(
                `🎮 **HOST KB**\nID: \`${gameId}\`\n🎯 Pilihan: ${choice === 'k' ? 'KECIL' : 'BESAR'}\n💰 Taruhan: ${formatNumber(bet)} coin\n💎 Pemenang dapat: ${formatNumber(bet*2 - fee)} coin\n📝 Join: \`.kbj ${gameId}\``
            );
        }

        // ==================== JOIN COMMANDS ====================
        const joinCommands = {
            remej: ['REME', playReme],
            qemej: ['QEME', playQeme],
            qqj: ['QQ', playQQ],
            csnj: ['CSN', playCSN],
            btkj: ['BTK', playBTK],
            dirtj: ['DIRT', playDirt],
            bcj: ['BC', playBC],
            bjj: ['BJ', playBJ],
            daduj: ['DADU', playDadu],
            cardj: ['CARD', playCard],
            flipj: ['FLIP', playFlip]
        };

        if (joinCommands[cmd]) {
            const [gameType, gameFunc] = joinCommands[cmd];
            return handleJoin(gameType, args[0]?.toUpperCase(), gameFunc);
        }

        // ==================== KBJ KHUSUS ====================
        if (cmd === 'kbj') {
            const gameId = args[0]?.toUpperCase();
            const game = activeGames.get(gameId);
            if (!game) return message.reply('❌ Game tidak ditemukan!');
            if (game.type !== 'KB') return message.reply('❌ Ini bukan game KB!');
            if (game.hostId === message.author.id) return message.reply('❌ Tidak bisa join game sendiri!');

            const joiner = db.users[message.author.id];
            if (joiner.coins < game.betAmount) {
                return message.reply(`❌ Coin tidak cukup! Kamu butuh ${formatNumber(game.betAmount)} coin.`);
            }

            joiner.coins -= game.betAmount;
            const host = db.users[game.hostId];

            const result = playKB(5, game.hostChoice);
            let winner = null, winnerObj = null, winnerName = '';
            if (result.playerWins > result.opponentWins) {
                winner = game.hostId; winnerName = game.hostName; winnerObj = host;
            } else if (result.opponentWins > result.playerWins) {
                winner = message.author.id; winnerName = message.author.username; winnerObj = joiner;
            }

            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);

            if (winner) {
                winnerObj.coins += totalPot - fee;
                winnerObj.gamesWon++;
                applyFee(totalPot, winner, winnerName, 'KB');
            } else {
                host.coins += game.betAmount;
                joiner.coins += game.betAmount;
            }

            host.gamesPlayed++; joiner.gamesPlayed++;
            host.gamesVsPlayer++; joiner.gamesVsPlayer++;
            saveDB();
            activeGames.delete(gameId);

            const resultsText = result.results.join('\n');
            let reply = `🎮 **KB - 5 RONDE**\n${game.hostName} vs ${message.author.username}\n\n${resultsText}\n\n📊 Skor: ${game.hostName} ${result.playerWins} - ${result.opponentWins} ${message.author.username}\n💰 Taruhan: ${formatNumber(game.betAmount)} coin/player\n💎 Total Pot: ${formatNumber(totalPot)} coin\n`;
            if (winner) {
                reply += `💰 Fee: ${formatNumber(fee)} coin\n🏆 **Pemenang: ${winnerName}**\n💸 Mendapat: ${formatNumber(totalPot - fee)} coin (profit ${formatNumber(totalPot - fee - game.betAmount)})`;
            } else {
                reply += `🤝 **DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }
            return message.reply(reply);
        }

        // ==================== PVH HOST ====================
        const pvhHost = {
            hleme: ['LEME', 'leme'],
            hreme: ['REME', 'reme'],
            hlewa: ['LEWA', 'lewa'],
            hr: ['REWA', 'rw']
        };
        if (pvhHost[cmd]) {
            const [gameType, joinCmd] = pvhHost[cmd];
            return handlePVHHost(gameType, parseInt(args[0]), joinCmd);
        }

        // ==================== PVH JOIN ====================
        const pvhJoin = {
            leme: 'LEME',
            reme: 'REME',
            lewa: 'LEWA',
            rw: 'REWA'
        };
        if (pvhJoin[cmd]) {
            return handlePVHJoin(pvhJoin[cmd], args[0]?.toUpperCase());
        }

        // ==================== ADMIN COMMANDS ====================
        if (config.ownerIds.includes(message.author.id)) {
            
            // ADD COIN
            if (cmd === 'addcoin') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.addcoin @user jumlah`');
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Tag user');
                const amount = parseInt(args[1]);
                if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid');
                const targetUser = db.users[target.id] || { userId: target.id, username: target.username, coins: 0 };
                db.users[target.id] = targetUser;
                targetUser.coins += amount;
                saveDB();
                return message.reply(`✅ **ADD COIN**\n${target} mendapat +${formatNumber(amount)} coin`);
            }

            // DEL COIN
            if (cmd === 'delcoin') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.delcoin @user jumlah`');
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Tag user');
                const amount = parseInt(args[1]);
                if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid');
                const targetUser = db.users[target.id];
                if (!targetUser) return message.reply('❌ User tidak ditemukan');
                if (targetUser.coins < amount) return message.reply(`❌ User hanya punya ${formatNumber(targetUser.coins)} coin`);
                targetUser.coins -= amount;
                saveDB();
                return message.reply(`✅ **DEL COIN**\n${target} kehilangan -${formatNumber(amount)} coin`);
            }

            // FEE STATUS
            if (cmd === 'feestatus') {
                return message.reply(
                    `💰 **STATUS FEE**\n` +
                    `Aktif: ${config.fee.enabled}\n` +
                    `Fee: ${config.fee.percentage}%\n` +
                    `Min: ${config.fee.minFee} | Max: ${config.fee.maxFee}\n` +
                    `Total Terkumpul: ${formatNumber(db.feeWallet)} 🪙`
                );
            }

            // CREATE GIFT CODE DENGAN SALDO
            if (cmd === 'creategift' || cmd === 'makegift') {
                // Format: .creategift total_saldo per_orang [kode] [hari]
                // Contoh: .creategift 50000 3000 HUTRI75 7
                
                if (args.length < 2) {
                    return message.reply(
                        '❌ **Gunakan:** `.creategift total_saldo per_orang [kode] [hari]`\n' +
                        'Contoh:\n' +
                        '• `.creategift 50000 3000` (random code, 30 hari)\n' +
                        '• `.creategift 50000 3000 HUTRI75 7` (custom code, 7 hari)\n\n' +
                        '💡 50.000 saldo / 3.000 per orang = 16 orang maksimal'
                    );
                }
                
                const totalBalance = parseInt(args[0]);
                const perUserAmount = parseInt(args[1]);
                
                if (isNaN(totalBalance) || totalBalance <= 0) return message.reply('❌ Total saldo tidak valid!');
                if (isNaN(perUserAmount) || perUserAmount <= 0) return message.reply('❌ Jumlah per orang tidak valid!');
                
                if (perUserAmount > totalBalance) {
                    return message.reply('❌ Jumlah per orang tidak boleh lebih besar dari total saldo!');
                }
                
                let customCode = null;
                let expiresInDays = 30;
                
                if (args.length >= 3) {
                    customCode = args[2].toUpperCase();
                    if (customCode.length < 3 || customCode.length > 15) return message.reply('❌ Kode harus antara 3-15 karakter!');
                    if (!/^[A-Z0-9]+$/.test(customCode)) return message.reply('❌ Kode hanya boleh huruf dan angka!');
                }
                
                if (args.length >= 4) {
                    const days = parseInt(args[3]);
                    if (!isNaN(days) && days > 0) expiresInDays = days;
                }
                
                const maxUses = Math.floor(totalBalance / perUserAmount);
                const remainingBalance = totalBalance - (maxUses * perUserAmount);
                
                const gift = createGiftCode(totalBalance, perUserAmount, message.author.id, message.author.username, customCode, expiresInDays);
                
                if (!gift) return message.reply(`❌ Kode **${customCode}** sudah ada! Gunakan kode lain.`);
                
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ GIFT CODE DIBUAT')
                    .addFields(
                        { name: 'Kode Gift', value: `\`${gift.code}\``, inline: true },
                        { name: 'Total Saldo', value: `${formatNumber(totalBalance)} 🪙`, inline: true },
                        { name: 'Per Orang', value: `${formatNumber(perUserAmount)} 🪙`, inline: true },
                        { name: 'Maksimal Pengguna', value: `${maxUses} orang`, inline: true },
                        { name: 'Sisa Saldo', value: `${formatNumber(remainingBalance)} 🪙 (tidak cukup untuk 1 orang)`, inline: true },
                        { name: 'Masa Berlaku', value: `${expiresInDays} hari`, inline: true },
                        { name: 'Expired Pada', value: new Date(gift.expiresAt).toLocaleDateString(), inline: true },
                        { name: 'Dibuat Oleh', value: message.author.username, inline: true },
                        { name: 'Cara Redeem', value: `.tukar ${gift.code}`, inline: true }
                    )
                    .setFooter({ text: 'Simpan kode ini dengan baik!' });
                
                return message.channel.send({ embeds: [embed] });
            }

            // GIFT INFO
            if (cmd === 'giftinfo') {
                if (!args[0]) return message.reply('❌ Gunakan: `.giftinfo KODE`');
                
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code);
                
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                const remainingUsers = Math.floor(gift.remainingBalance / gift.perUserAmount);
                const status = !gift.isActive ? '🔴 Nonaktif' : 
                               (gift.remainingBalance < gift.perUserAmount) ? '🔴 Habis' :
                               (new Date(gift.expiresAt) < new Date()) ? '⚠️ Expired' : '🟢 Aktif';
                
                let reply = `🎁 **INFORMASI GIFT CODE: ${code}**\n\n`;
                reply += `💰 Total Saldo: ${formatNumber(gift.totalBalance)} 🪙\n`;
                reply += `💸 Per Orang: ${formatNumber(gift.perUserAmount)} 🪙\n`;
                reply += `📊 Sisa Saldo: ${formatNumber(gift.remainingBalance)} / ${formatNumber(gift.totalBalance)} 🪙\n`;
                reply += `👥 Sudah Digunakan: ${gift.currentUses} orang\n`;
                reply += `👥 Sisa Kuota: ${remainingUsers} orang lagi\n`;
                reply += `⏳ Status: ${status}\n`;
                reply += `📅 Dibuat: ${new Date(gift.createdAt).toLocaleDateString()} oleh ${gift.createdByUsername}\n`;
                reply += `⏰ Expired: ${new Date(gift.expiresAt).toLocaleDateString()}\n\n`;
                
                if (gift.usedBy.length > 0) {
                    reply += `👤 **DAFTAR PENGGUNA (${gift.usedBy.length} orang):**\n`;
                    gift.usedBy.slice(-10).reverse().forEach((u, i) => {
                        reply += `${i+1}. ${u.username} - ${formatNumber(u.amount)} 🪙 - ${new Date(u.usedAt).toLocaleDateString()}\n`;
                    });
                }
                
                return message.reply(reply);
            }

            // LIST ALL GIFT CODES
            if (cmd === 'giftlist' || cmd === 'listgift') {
                if (db.giftCodes.length === 0) return message.reply('📭 Belum ada gift code yang dibuat.');
                
                const now = new Date();
                const active = db.giftCodes.filter(g => g.isActive && g.remainingBalance >= g.perUserAmount && new Date(g.expiresAt) > now);
                const habis = db.giftCodes.filter(g => !g.isActive || g.remainingBalance < g.perUserAmount);
                const expired = db.giftCodes.filter(g => new Date(g.expiresAt) <= now && g.remainingBalance >= g.perUserAmount);
                
                let reply = '🎁 **DAFTAR GIFT CODE**\n\n';
                
                reply += `**🟢 AKTIF (${active.length}):**\n`;
                if (active.length === 0) reply += 'Tidak ada\n';
                else {
                    active.slice(0, 10).forEach(g => {
                        const remainingUsers = Math.floor(g.remainingBalance / g.perUserAmount);
                        const daysLeft = Math.ceil((new Date(g.expiresAt) - now) / (1000 * 60 * 60 * 24));
                        reply += `• \`${g.code}\` - ${formatNumber(g.totalBalance)}/${formatNumber(g.remainingBalance)} sisa - ${formatNumber(g.perUserAmount)}/org - ${remainingUsers} org - ${daysLeft} hari lagi\n`;
                    });
                    if (active.length > 10) reply += `... dan ${active.length - 10} lainnya\n`;
                }
                
                reply += `\n**🔴 HABIS (${habis.length}):**\n`;
                if (habis.length === 0) reply += 'Tidak ada\n';
                else {
                    habis.slice(0, 5).forEach(g => {
                        reply += `• \`${g.code}\` - ${formatNumber(g.totalBalance)}/${formatNumber(g.remainingBalance)} sisa - ${g.currentUses}/${Math.floor(g.totalBalance/g.perUserAmount)} org\n`;
                    });
                }
                
                reply += `\n**⚠️ EXPIRED (${expired.length}):**\n`;
                if (expired.length === 0) reply += 'Tidak ada\n';
                else {
                    expired.slice(0, 5).forEach(g => {
                        reply += `• \`${g.code}\` - ${formatNumber(g.totalBalance)}/${formatNumber(g.remainingBalance)} sisa - expired ${new Date(g.expiresAt).toLocaleDateString()}\n`;
                    });
                }
                
                return message.reply(reply);
            }

            // ADD GIFT BALANCE
            if (cmd === 'addgiftbalance') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.addgiftbalance KODE jumlah`');
                
                const code = args[0].toUpperCase();
                const amount = parseInt(args[1]);
                
                if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid');
                
                const gift = db.giftCodes.find(g => g.code === code);
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                const oldRemaining = gift.remainingBalance;
                const oldMaxUses = Math.floor(gift.totalBalance / gift.perUserAmount);
                
                gift.totalBalance += amount;
                gift.remainingBalance += amount;
                
                const newMaxUses = Math.floor(gift.totalBalance / gift.perUserAmount);
                const additionalUsers = newMaxUses - oldMaxUses;
                
                if (gift.remainingBalance >= gift.perUserAmount && !gift.isActive) {
                    gift.isActive = true;
                    gift.deactivatedAt = null;
                }
                
                saveDB();
                
                return message.reply(
                    `✅ **SALDO GIFT DITAMBAH**\n` +
                    `Kode: \`${code}\`\n` +
                    `💰 Saldo Sebelum: ${formatNumber(oldRemaining)} 🪙\n` +
                    `➕ Ditambah: ${formatNumber(amount)} 🪙\n` +
                    `💰 Saldo Sekarang: ${formatNumber(gift.remainingBalance)} 🪙\n` +
                    `👥 Kuota Tambahan: ${additionalUsers} orang lagi\n` +
                    `👥 Total Kuota: ${newMaxUses} orang`
                );
            }

            // SET GIFT AMOUNT PER ORANG
            if (cmd === 'setgiftamount') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.setgiftamount KODE jumlah_baru`');
                
                const code = args[0].toUpperCase();
                const newAmount = parseInt(args[1]);
                
                if (isNaN(newAmount) || newAmount <= 0) return message.reply('❌ Jumlah tidak valid');
                
                const gift = db.giftCodes.find(g => g.code === code);
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                if (newAmount > gift.remainingBalance) {
                    return message.reply(`❌ Jumlah per orang tidak boleh lebih besar dari sisa saldo (${formatNumber(gift.remainingBalance)} 🪙)!`);
                }
                
                const oldAmount = gift.perUserAmount;
                gift.perUserAmount = newAmount;
                
                const newMaxUses = Math.floor(gift.totalBalance / newAmount);
                
                saveDB();
                
                return message.reply(
                    `✅ **JUMLAH PER ORANG DIUBAH**\n` +
                    `Kode: \`${code}\`\n` +
                    `💸 Sebelum: ${formatNumber(oldAmount)} 🪙 per orang\n` +
                    `💸 Sesudah: ${formatNumber(newAmount)} 🪙 per orang\n` +
                    `💰 Sisa Saldo: ${formatNumber(gift.remainingBalance)} 🪙\n` +
                    `👥 Sisa Kuota Baru: ${Math.floor(gift.remainingBalance / newAmount)} orang\n` +
                        `📊 Total Kuota Maksimal: ${newMaxUses} orang`
                );
            }

            // DEACTIVATE GIFT
            if (cmd === 'deactivategift') {
                if (!args[0]) return message.reply('❌ Gunakan: `.deactivategift KODE`');
                
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code);
                
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                if (!gift.isActive) return message.reply(`❌ Kode **${code}** sudah tidak aktif!`);
                
                gift.isActive = false;
                gift.deactivatedAt = new Date().toISOString();
                saveDB();
                
                return message.reply(
                    `✅ **KODE DINONAKTIFKAN**\n` +
                    `Kode: \`${code}\`\n` +
                    `💰 Sisa Saldo: ${formatNumber(gift.remainingBalance)} 🪙\n` +
                    `👥 Sisa Kuota: ${Math.floor(gift.remainingBalance / gift.perUserAmount)} orang\n` +
                    `⚠️ Kode tidak bisa digunakan lagi!`
                );
            }

            // ACTIVATE GIFT
            if (cmd === 'activategift') {
                if (!args[0]) return message.reply('❌ Gunakan: `.activategift KODE`');
                
                const code = args[0].toUpperCase();
                const gift = db.giftCodes.find(g => g.code === code);
                
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                if (gift.isActive) return message.reply(`❌ Kode **${code}** sudah aktif!`);
                
                if (gift.remainingBalance < gift.perUserAmount) {
                    return message.reply(`❌ Tidak bisa mengaktifkan kode dengan saldo tidak cukup! Sisa: ${formatNumber(gift.remainingBalance)} 🪙`);
                }
                
                if (new Date(gift.expiresAt) < new Date()) {
                    return message.reply(`❌ Tidak bisa mengaktifkan kode yang sudah expired!`);
                }
                
                gift.isActive = true;
                gift.deactivatedAt = null;
                saveDB();
                
                return message.reply(
                    `✅ **KODE DIAKTIFKAN KEMBALI**\n` +
                    `Kode: \`${code}\`\n` +
                    `💰 Sisa Saldo: ${formatNumber(gift.remainingBalance)} 🪙\n` +
                    `👥 Sisa Kuota: ${Math.floor(gift.remainingBalance / gift.perUserAmount)} orang`
                );
            }

            // EXTEND GIFT
            if (cmd === 'extendgift') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.extendgift KODE hari`');
                
                const code = args[0].toUpperCase();
                const days = parseInt(args[1]);
                
                if (isNaN(days) || days <= 0) return message.reply('❌ Jumlah hari tidak valid');
                
                const gift = db.giftCodes.find(g => g.code === code);
                if (!gift) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                const oldExpiry = new Date(gift.expiresAt);
                const newExpiry = new Date(oldExpiry.getTime() + days * 24 * 60 * 60 * 1000);
                
                gift.expiresAt = newExpiry.toISOString();
                saveDB();
                
                return message.reply(
                    `✅ **MASA BERLAKU DIPERPANJANG**\n` +
                    `Kode: \`${code}\`\n` +
                    `📅 Sebelum: ${oldExpiry.toLocaleDateString()}\n` +
                    `📅 Sesudah: ${newExpiry.toLocaleDateString()} (+${days} hari)\n` +
                    `💰 Sisa Saldo: ${formatNumber(gift.remainingBalance)} 🪙`
                );
            }

            // DELETE GIFT
            if (cmd === 'deletegift' || cmd === 'delgift') {
                if (!args[0]) return message.reply('❌ Gunakan: `.deletegift KODE`');
                
                const code = args[0].toUpperCase();
                const index = db.giftCodes.findIndex(g => g.code === code);
                
                if (index === -1) return message.reply(`❌ Kode **${code}** tidak ditemukan!`);
                
                const gift = db.giftCodes[index];
                
                if (gift.usedBy.length > 0) {
                    return message.reply(
                        `❌ Kode **${code}** sudah digunakan oleh ${gift.usedBy.length} orang!\n` +
                        `Gunakan \`.deactivategift ${code}\` untuk menonaktifkan saja.`
                    );
                }
                
                db.giftCodes.splice(index, 1);
                saveDB();
                
                return message.reply(`✅ Kode **${code}** berhasil dihapus dari database!`);
            }
        }

    } catch (err) {
        console.error(err);
        message.reply('❌ Terjadi kesalahan: ' + err.message);
    }
});

// ==================== LOGIN ====================
client.login(config.token).catch(err => {
    console.error('❌ Login failed:', err);
});

console.log(`🚀 ${config.botName} starting...`);
console.log(`📱 Deposit: ${config.deposit.dana}`);
console.log(`💰 Starting coins: ${config.startingCoins}`);
console.log(`🎁 Gift code system ready!`);
