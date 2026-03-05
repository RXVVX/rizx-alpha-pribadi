// DUEL RXV TEAMRXVVX - BOT DENGAN SISTEM FEE OTOMATIS
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
    version: "Valentine Edition",
    
    // Nomor Deposit
    deposit: {
        dana: "6283173495612",
        ovo: "6283173495612", 
        gopay: "6283173495612"
    },
    
    startingCoins: 0,
    gameExpireTime: 120000, // 2 menit
    
    // ==================== SISTEM FEE ====================
    fee: {
        enabled: true,           // Aktifkan fee
        percentage: 5,            // 5% fee
        minFee: 10,               // Minimal fee 10 coin
        maxFee: 5000,             // Maksimal fee 5000 coin
        feeWallet: "FEE_WALLET",  // Virtual wallet untuk menampung fee
        description: "Biaya layanan 5% (min 10, max 5000)"
    }
};

// ==================== DATABASE JSON ====================
let db = { 
    users: {}, 
    games: [],
    feeWallet: 0,  // Total fee terkumpul
    feeHistory: [] // History fee
};

try {
    if (fs.existsSync('./database.json')) {
        db = JSON.parse(fs.readFileSync('./database.json'));
        console.log('✅ Database loaded');
    } else {
        fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
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
    
    // Terapkan min dan max fee
    if (fee < config.fee.minFee) fee = config.fee.minFee;
    if (fee > config.fee.maxFee) fee = config.fee.maxFee;
    
    return fee;
}

function applyFee(amount, userId, username, gameType) {
    const fee = calculateFee(amount);
    
    if (fee > 0) {
        db.feeWallet += fee;
        db.feeHistory.push({
            userId, username,
            amount: fee,
            gameType,
            timestamp: new Date().toISOString()
        });
        
        // Catat fee yang dibayar user
        if (db.users[userId]) {
            db.users[userId].totalFeePaid = (db.users[userId].totalFeePaid || 0) + fee;
        }
        
        saveDB();
    }
    
    return fee;
}

// ==================== CLIENT INIT ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Active games storage
const activeGames = new Map(); // PVP games
const activePVH = new Map(); // VS Bot games

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

// ==================== GAME FUNCTIONS WITH ROUNDS ====================

// Game REME (Adu angka)
function playReme(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game QEME (Tebak angka)
function playQeme(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const secret = Math.floor(Math.random() * 10) + 1;
        const p1 = Math.floor(Math.random() * 10) + 1;
        const p2 = Math.floor(Math.random() * 10) + 1;
        
        const diff1 = Math.abs(secret - p1);
        const diff2 = Math.abs(secret - p2);
        
        if (diff1 < diff2) playerWins++;
        else if (diff2 < diff1) opponentWins++;
        
        results.push(`Ronde ${r}: Angka=${secret} | ${p1} vs ${p2} ${diff1 < diff2 ? '✅' : diff2 < diff1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game QQ (Kartu)
function playQQ(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 13) + 1;
        const p2 = Math.floor(Math.random() * 13) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Dadu
function playDadu(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = rollDice();
        const p2 = rollDice();
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: 🎲 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Coinflip
function playFlip(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const flip = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
        const p1 = Math.random() < 0.5 ? 'KEPALA' : 'EKOR';
        const p2 = p1 === 'KEPALA' ? 'EKOR' : 'KEPALA';
        
        if (p1 === flip) playerWins++;
        else opponentWins++;
        
        results.push(`Ronde ${r}: 🪙 ${flip} | ${p1} vs ${p2} ${p1 === flip ? '✅' : '❌'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Kecil/Besar
function playKB(rounds, hostChoice) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const dice = rollDice();
        const isSmall = dice <= 3;
        const hasil = isSmall ? 'KECIL' : 'BESAR';
        const joinerChoice = hostChoice === 'KECIL' ? 'BESAR' : 'KECIL';
        
        if (hostChoice === hasil) playerWins++;
        else if (joinerChoice === hasil) opponentWins++;
        
        results.push(`Ronde ${r}: 🎲 ${dice} (${hasil}) | Host:${hostChoice} vs Joiner:${joinerChoice} ${hostChoice === hasil ? '✅' : '❌'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game CSN (Casino - random)
function playCSN(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 100) + 1;
        const p2 = Math.floor(Math.random() * 100) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game BTK (Battle)
function playBTK(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 20) + 1;
        const p2 = Math.floor(Math.random() * 20) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: ⚔️ ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Dirt
function playDirt(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 50) + 1;
        const p2 = Math.floor(Math.random() * 50) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: 🌱 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Baccarat
function playBaccarat(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 9) + 1;
        const p2 = Math.floor(Math.random() * 9) + 1;
        
        if (p1 > p2) playerWins++;
        else if (p2 > p1) opponentWins++;
        
        results.push(`Ronde ${r}: 🎰 ${p1} vs ${p2} ${p1 > p2 ? '✅' : p2 > p1 ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Blackjack sederhana
function playBJ(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    
    for (let r = 1; r <= rounds; r++) {
        const p1 = Math.floor(Math.random() * 21) + 1;
        const p2 = Math.floor(Math.random() * 21) + 1;
        
        if (p1 > p2 && p1 <= 21) playerWins++;
        else if (p2 > p1 && p2 <= 21) opponentWins++;
        else if (p1 > 21 && p2 <= 21) opponentWins++;
        else if (p2 > 21 && p1 <= 21) playerWins++;
        
        results.push(`Ronde ${r}: 🃏 ${p1} vs ${p2} ${(p1 > p2 && p1 <= 21) ? '✅' : (p2 > p1 && p2 <= 21) ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// Game Kartu
function playCard(rounds) {
    let playerWins = 0, opponentWins = 0;
    let results = [];
    const cards = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    
    for (let r = 1; r <= rounds; r++) {
        const p1Card = cards[Math.floor(Math.random() * cards.length)];
        const p2Card = cards[Math.floor(Math.random() * cards.length)];
        const p1Value = cards.indexOf(p1Card) + 2;
        const p2Value = cards.indexOf(p2Card) + 2;
        
        if (p1Value > p2Value) playerWins++;
        else if (p2Value > p1Value) opponentWins++;
        
        results.push(`Ronde ${r}: 🎴 ${p1Card}(${p1Value}) vs ${p2Card}(${p2Value}) ${p1Value > p2Value ? '✅' : p2Value > p1Value ? '❌' : '🤝'}`);
    }
    
    return { playerWins, opponentWins, results };
}

// ==================== READY EVENT ====================
client.once('ready', () => {
    console.log(`✅ ${config.botName} ONLINE!`);
    console.log(`📱 Deposit: ${config.deposit.dana}`);
    console.log(`💰 Fee: ${config.fee.percentage}% (min ${config.fee.minFee}, max ${config.fee.maxFee})`);
    client.user.setActivity('.menu | 5 Ronde + Fee', { type: 'PLAYING' });

    // Clean expired games
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

// ==================== MESSAGE EVENT ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    try {
        const user = getUser(message.author.id, message.author.username);

        // ==================== MENU UTAMA ====================
        if (cmd === 'menu') {
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🎮 ${config.botName} - MENU UTAMA`)
                .setDescription(`**Update: ${config.version}**\n• Semua Game 5 Ronde!\n• Fee ${config.fee.percentage}% (min ${config.fee.minFee}, max ${config.fee.maxFee})`)
                .addFields(
                    { 
                        name: '📋 **MENU UTAMA**', 
                        value: '`.menu` - Menu Utama\n`.help` - Bantuan\n`.admin` - List Admin\n`.tukar` - Redeem Gift\n`.spin` - Spin Roulette' 
                    },
                    { 
                        name: '💰 **ECONOMY MENU**', 
                        value: '`.depo` - Deposit\n`.qris` - QRIS\n`.tf @user` - Transfer\n`.cc` - Cek Coin\n`.lb` - Leaderboard\n`.feetop` - Top Fee' 
                    },
                    { 
                        name: '⚔️ **PVP GAMES (5 RONDE)**', 
                        value: '`.reme 100` - Reme PVP\n`.qeme 100` - Qeme PVP\n`.qq 100` - QQ PVP\n`.csn 100` - CSN PVP\n`.btk 100` - BTK PVP\n`.dirt 100` - Dirt Seed\n`.bc 100` - Baccarat\n`.bj 100` - BJ PVP\n`.kb k 100` - Kecil/Besar\n`.dadu 100` - Adu Dadu\n`.card 100` - Adu Kartu\n`.flip 100` - Coinflip' 
                    },
                    { 
                        name: '🤝 **PVH GAMES (5 RONDE)**', 
                        value: '`.hleme 100` - Host Leme\n`.leme ID` - Join Leme\n`.hreme 100` - Host Reme\n`.reme ID` - Join Reme\n`.hlewa 100` - Host Lewa\n`.lewa ID` - Join Lewa\n`.hr 100` - Host Rewa\n`.rw ID` - Join Rewa' 
                    },
                    { 
                        name: '🔍 **FITUR ROOM**', 
                        value: '`.rooms` - Lihat Semua Room\n`.cancel ID` - Batalkan Room' 
                    }
                )
                .setFooter({ text: `Deposit: ${config.deposit.dana} | Fee: ${config.fee.percentage}%` });
            return message.channel.send({ embeds: [embed] });
        }

        // ==================== HELP ====================
        if (cmd === 'help') {
            return message.reply(
                '📚 **BANTUAN**\n\n' +
                '**SISTEM FEE OTOMATIS:**\n' +
                `• Fee ${config.fee.percentage}% dari taruhan\n` +
                `• Minimal fee: ${config.fee.minFee} coin\n` +
                `• Maksimal fee: ${config.fee.maxFee} coin\n` +
                '• Fee dipotong dari pemenang\n\n' +
                '**CARA MAIN PVP (5 RONDE):**\n' +
                '1. Host: `.reme 500` (buat room)\n' +
                '2. Join: `.remej ID` (join room)\n' +
                '3. Game 5 ronde, pemenang terbanyak menang\n\n' +
                '**CEK ROOM:** `.rooms`\n' +
                '**BATAL:** `.cancel ID`\n\n' +
                `**DEPOSIT:** ${config.deposit.dana} (DANA/OVO/GOPAY)`
            );
        }

        // ==================== ADMIN LIST ====================
        if (cmd === 'admin') {
            return message.reply(`👑 **ADMIN**\nOwner: ${config.ownerIds.join(', ')}\n📱 Deposit: ${config.deposit.dana}`);
        }

        // ==================== TOP FEE ====================
        if (cmd === 'feetop' || cmd === 'topfee') {
            const topFee = Object.values(db.users)
                .filter(u => u.totalFeePaid > 0)
                .sort((a, b) => (b.totalFeePaid || 0) - (a.totalFeePaid || 0))
                .slice(0, 10);

            if (topFee.length === 0) {
                return message.reply('💰 Belum ada data fee.');
            }

            let desc = '🏆 **TOP PAYER FEE**\n\n';
            for (let i = 0; i < topFee.length; i++) {
                const u = topFee[i];
                desc += `${i+1}. **${u.username}** - ${formatNumber(u.totalFeePaid)} 🪙\n`;
            }
            
            desc += `\n💰 **Total Fee Terkumpul:** ${formatNumber(db.feeWallet)} 🪙`;
            
            return message.reply(desc);
        }

        // ==================== DEPOSIT ====================
        if (cmd === 'depo') {
            return message.reply(
                '💰 **DEPOSIT COIN**\n' +
                `📱 DANA: \`${config.deposit.dana}\`\n` +
                `📱 OVO: \`${config.deposit.ovo}\`\n` +
                `📱 GOPAY: \`${config.deposit.gopay}\`\n` +
                '💎 Rate: Rp 10.000 = 1000 coin\n' +
                '📋 Kirim bukti transfer ke admin'
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
                `Total Fee Dibayar: ${formatNumber(u.totalFeePaid || 0)} 🪙`
            );
        }

        // ==================== LEADERBOARD ====================
        if (cmd === 'lb' || cmd === 'leaderboard') {
            const users = Object.values(db.users)
                .sort((a, b) => b.coins - a.coins)
                .slice(0, 10);

            if (users.length === 0) return message.reply('❌ Belum ada data!');

            let desc = '🏆 **TOP 10 LEADERBOARD**\n\n';
            for (let i = 0; i < users.length; i++) {
                const u = users[i];
                desc += `${i+1}. **${u.username}** - ${formatNumber(u.coins)} 🪙 (${u.gamesWon} wins)\n`;
            }
            return message.reply(desc);
        }

        // ==================== TRANSFER ====================
        if (cmd === 'tf' || cmd === 'tfcion') {
            if (args.length < 2) return message.reply('❌ Gunakan: `.tf @user jumlah`');

            const target = message.mentions.users.first();
            if (!target) return message.reply('❌ Tag user!');
            if (target.id === message.author.id) return message.reply('❌ Tidak bisa transfer ke diri sendiri!');

            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid!');

            if (user.coins < amount) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            const receiver = db.users[target.id] || { userId: target.id, username: target.username, coins: 0 };
            db.users[target.id] = receiver;

            user.coins -= amount;
            receiver.coins += amount;
            saveDB();

            return message.reply(`💸 **TRANSFER BERHASIL**\n${message.author} → ${target}\nJumlah: ${formatNumber(amount)} coin`);
        }

        // ==================== SPIN ====================
        if (cmd === 'spin') {
            const bet = parseInt(args[0]);
            if (isNaN(bet) || bet <= 0) return message.reply('❌ Gunakan: `.spin jumlah`');

            if (user.coins < bet) return message.reply(`❌ Coin tidak cukup! Kamu punya ${formatNumber(user.coins)} coin.`);

            user.coins -= bet;

            const dice1 = rollDice();
            const dice2 = rollDice();
            const dice3 = rollDice();
            const total = dice1 + dice2 + dice3;

            let prize = 0;
            let multiplier = 0;

            if (total === 18) { prize = bet * 10; multiplier = 10; }
            else if (total >= 15) { prize = bet * 3; multiplier = 3; }
            else if (total >= 12) { prize = bet * 2; multiplier = 2; }
            else if (total >= 9) { prize = bet * 1; multiplier = 1; }
            else if (total >= 6) { prize = Math.floor(bet * 0.5); multiplier = 0.5; }
            else { prize = 0; multiplier = 0; }

            user.coins += prize;
            user.gamesPlayed += 1;
            if (prize > bet) user.gamesWon += 1;
            saveDB();

            return message.reply(
                `🎲 **SPIN DADU**\n` +
                `${message.author} melempar 3 dadu!\n\n` +
                `🎲 ${dice1} | ${dice2} | ${dice3} = **${total}**\n` +
                `💰 Taruhan: ${formatNumber(bet)}\n` +
                `🎁 Hadiah: ${formatNumber(prize)} (${multiplier}x)\n` +
                `💳 Total: ${formatNumber(user.coins)}`
            );
        }

        // ==================== REDEEM GIFT ====================
        if (cmd === 'tukar') {
            return message.reply('🎁 **GIFT CODE**\nHubungi admin untuk mendapatkan gift code.');
        }

        // ==================== CEK ROOM ====================
        if (cmd === 'rooms' || cmd === 'listroom') {
            if (activeGames.size === 0 && activePVH.size === 0) {
                return message.reply('📭 Tidak ada room yang tersedia.');
            }

            let desc = '**🎮 ROOM TERSEDIA (5 RONDE + FEE):**\n\n';

            for (const [id, game] of activeGames.entries()) {
                const timeLeft = Math.max(0, Math.ceil((game.expiresAt - Date.now()) / 1000 / 60 * 10) / 10);
                const fee = calculateFee(game.betAmount);
                desc += `⚔️ **${game.type.toUpperCase()}** | ID: \`${id}\`\n`;
                desc += `👤 Host: ${game.hostName} | 💰 ${formatNumber(game.betAmount)} coin\n`;
                desc += `💰 Fee: ${formatNumber(fee)} coin | ⏳ ${timeLeft}m\n`;
                desc += `📝 Join: \`.${game.joinCmd} ${id}\`\n\n`;
            }

            for (const [id, game] of activePVH.entries()) {
                const timeLeft = Math.max(0, Math.ceil((game.expiresAt - Date.now()) / 1000 / 60 * 10) / 10);
                const fee = calculateFee(game.betAmount);
                desc += `🤖 **${game.type.toUpperCase()} (VS BOT)** | ID: \`${id}\`\n`;
                desc += `👤 Host: ${game.playerName} | 💰 ${formatNumber(game.betAmount)} coin\n`;
                desc += `💰 Fee: ${formatNumber(fee)} coin | ⏳ ${timeLeft}m\n`;
                desc += `📝 Join: \`.${game.joinCmd} ${id}\`\n\n`;
            }

            return message.reply(desc);
        }

        // ==================== BATAL ROOM ====================
        if (cmd === 'cancel' || cmd === 'batal') {
            const gameId = args[0]?.toUpperCase();
            if (!gameId) return message.reply('❌ Gunakan: `.cancel ID_GAME`');

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

        // ==================== GENERATE HOST FUNCTION ====================
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

            const fee = calculateFee(bet);
            
            return message.reply(
                `🎮 **HOST ${gameType} PVP (5 RONDE)**\n` +
                `🆔 ID: \`${gameId}\`\n` +
                `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                `💰 Fee (${config.fee.percentage}%): ${formatNumber(fee)} coin\n` +
                `💎 Pemenang dapat: ${formatNumber(bet * 2 - fee)} coin (setelah fee)\n` +
                `📝 Join: \`.${joinCmd} ${gameId}\`\n` +
                `⏳ Expired: 2 menit\n` +
                `👤 Host: ${message.author.username}`
            );
        }

        // ==================== GENERATE JOIN FUNCTION ====================
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

            // Main game 5 ronde
            const result = gameFunc(5);
            
            let winner = null;
            let winnerName = '';
            let winnerObj = null;
            let loserObj = null;
            
            if (result.playerWins > result.opponentWins) {
                winner = game.hostId;
                winnerName = game.hostName;
                winnerObj = host;
                loserObj = joiner;
            } else if (result.opponentWins > result.playerWins) {
                winner = message.author.id;
                winnerName = message.author.username;
                winnerObj = joiner;
                loserObj = host;
            }

            // Hitung fee
            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);
            
            if (winner) {
                // Ada pemenang, potong fee
                const winningAmount = totalPot - fee;
                winnerObj.coins += winningAmount;
                winnerObj.gamesWon++;
                
                // Catat fee
                applyFee(totalPot, winner, winnerName, gameType);
            } else {
                // Draw, kembalikan taruhan (tanpa fee)
                host.coins += game.betAmount;
                joiner.coins += game.betAmount;
            }

            host.gamesPlayed++; joiner.gamesPlayed++;
            host.gamesVsPlayer++; joiner.gamesVsPlayer++;
            saveDB();
            activeGames.delete(gameId);

            const resultsText = result.results.join('\n');
            
            let response = 
                `🎮 **${gameType} PVP - 5 RONDE**\n` +
                `${game.hostName} vs ${message.author.username}\n\n` +
                `**HASIL PERTANDINGAN:**\n${resultsText}\n\n` +
                `📊 **SKOR AKHIR:**\n` +
                `${game.hostName}: ${result.playerWins} kemenangan\n` +
                `${message.author.username}: ${result.opponentWins} kemenangan\n\n` +
                `💰 Taruhan: ${formatNumber(game.betAmount)} coin/player\n` +
                `💎 Total Pot: ${formatNumber(totalPot)} coin\n`;

            if (winner) {
                response += 
                    `💰 Fee (${config.fee.percentage}%): ${formatNumber(fee)} coin\n` +
                    `🏆 **Pemenang: ${winnerName}**\n` +
                    `💸 Mendapat: ${formatNumber(totalPot - fee)} coin (setelah fee)\n` +
                    `💳 Profit: +${formatNumber(totalPot - fee - game.betAmount)} coin`;
            } else {
                response += `🤝 **HASIL DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }

            return message.reply(response);
        }

        // ==================== GENERATE PVH FUNCTION ====================
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

            const fee = calculateFee(bet);
            
            return message.reply(
                `🎮 **HOST ${gameType} (VS BOT) - 5 RONDE**\n` +
                `🆔 ID: \`${gameId}\`\n` +
                `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                `💰 Fee (${config.fee.percentage}%): ${formatNumber(fee)} coin\n` +
                `💎 Menang dapat: ${formatNumber(bet * 2 - fee)} coin\n` +
                `📝 Join: \`.${joinCmd} ${gameId}\`\n` +
                `⏳ Expired: 2 menit`
            );
        }

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

            // Bot vs Player 5 ronde
            let playerWins = 0, botWins = 0;
            let results = [];
            
            for (let r = 1; r <= 5; r++) {
                const playerScore = Math.floor(Math.random() * 100) + 1;
                const botScore = Math.floor(Math.random() * 100) + 1;
                
                if (playerScore > botScore) {
                    playerWins++;
                    results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ✅`);
                } else if (botScore > playerScore) {
                    botWins++;
                    results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} ❌`);
                } else {
                    results.push(`Ronde ${r}: 🎯 ${playerScore} vs 🤖 ${botScore} 🤝`);
                }
            }

            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);
            
            let result = '';
            if (playerWins > botWins) {
                result = 'KAMU MENANG';
                const winningAmount = totalPot - fee;
                player.coins += winningAmount;
                player.gamesWon++;
                applyFee(totalPot, player.userId, player.username, gameType);
            } else if (botWins > playerWins) {
                result = 'BOT MENANG';
                // Bot menang, fee tetap masuk wallet
                db.feeWallet += fee;
                db.feeHistory.push({
                    userId: 'BOT',
                    username: 'BOT',
                    amount: fee,
                    gameType,
                    timestamp: new Date().toISOString()
                });
            } else {
                result = 'DRAW';
                player.coins += game.betAmount;
                host.coins += game.betAmount;
            }

            player.gamesPlayed++;
            player.gamesVsBot++;
            host.gamesVsBot++;
            saveDB();
            activePVH.delete(gameId);

            const resultsText = results.join('\n');

            let response = 
                `🎮 **${gameType} VS BOT - 5 RONDE**\n` +
                `${message.author.username} vs **BOT**\n\n` +
                `**HASIL PERTANDINGAN:**\n${resultsText}\n\n` +
                `📊 **SKOR AKHIR:**\n` +
                `Kamu: ${playerWins} kemenangan\n` +
                `Bot: ${botWins} kemenangan\n\n` +
                `💰 Taruhan: ${formatNumber(game.betAmount)} coin\n`;

            if (result === 'KAMU MENANG') {
                response += 
                    `💰 Fee: ${formatNumber(fee)} coin\n` +
                    `🎉 **KAMU MENANG!**\n` +
                    `💸 Mendapat: ${formatNumber(totalPot - fee)} coin\n` +
                    `💳 Profit: +${formatNumber(totalPot - fee - game.betAmount)} coin`;
            } else if (result === 'BOT MENANG') {
                response += 
                    `💰 Fee: ${formatNumber(fee)} coin\n` +
                    `😢 **BOT MENANG!**\n` +
                    `💸 Kerugian: -${formatNumber(game.betAmount)} coin`;
            } else {
                response += `🤝 **DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }

            return message.reply(response);
        }

        // ==================== SEMUA HOST COMMANDS ====================
        if (cmd === 'reme') return handleHost('REME', parseInt(args[0]), 'remej', playReme);
        if (cmd === 'qeme') return handleHost('QEME', parseInt(args[0]), 'qemej', playQeme);
        if (cmd === 'qq') return handleHost('QQ', parseInt(args[0]), 'qqj', playQQ);
        if (cmd === 'csn') return handleHost('CSN', parseInt(args[0]), 'csnj', playCSN);
        if (cmd === 'btk') return handleHost('BTK', parseInt(args[0]), 'btkj', playBTK);
        if (cmd === 'dirt') return handleHost('DIRT', parseInt(args[0]), 'dirtj', playDirt);
        if (cmd === 'bc') return handleHost('BC', parseInt(args[0]), 'bcj', playBaccarat);
        if (cmd === 'bj') return handleHost('BJ', parseInt(args[0]), 'bjj', playBJ);
        if (cmd === 'dadu') return handleHost('DADU', parseInt(args[0]), 'daduj', playDadu);
        if (cmd === 'card') return handleHost('CARD', parseInt(args[0]), 'cardj', playCard);
        if (cmd === 'flip') return handleHost('FLIP', parseInt(args[0]), 'flipj', playFlip);
        
        // Khusus KB perlu pilihan
        if (cmd === 'kb') {
            if (args.length < 2) return message.reply('❌ Gunakan: `.kb <k/b> jumlah`\nContoh: `.kb k 500`');
            const choice = args[0].toLowerCase();
            const bet = parseInt(args[1]);
            if (choice !== 'k' && choice !== 'b') return message.reply('❌ Pilih "k" (kecil) atau "b" (besar)!');
            if (isNaN(bet) || bet <= 0) return message.reply('❌ Jumlah tidak valid!');
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

            const fee = calculateFee(bet);

            return message.reply(
                `🎮 **HOST KB PVP (5 RONDE)**\n` +
                `🆔 ID: \`${gameId}\`\n` +
                `🎯 Pilihan Host: ${choice === 'k' ? 'KECIL' : 'BESAR'}\n` +
                `💰 Taruhan: ${formatNumber(bet)} coin\n` +
                `💰 Fee: ${formatNumber(fee)} coin\n` +
                `📝 Join: \`.kbj ${gameId}\`\n` +
                `⏳ Expired: 2 menit`
            );
        }

        // ==================== SEMUA JOIN COMMANDS ====================
        if (cmd === 'remej') return handleJoin('REME', args[0]?.toUpperCase(), playReme);
        if (cmd === 'qemej') return handleJoin('QEME', args[0]?.toUpperCase(), playQeme);
        if (cmd === 'qqj') return handleJoin('QQ', args[0]?.toUpperCase(), playQQ);
        if (cmd === 'csnj') return handleJoin('CSN', args[0]?.toUpperCase(), playCSN);
        if (cmd === 'btkj') return handleJoin('BTK', args[0]?.toUpperCase(), playBTK);
        if (cmd === 'dirtj') return handleJoin('DIRT', args[0]?.toUpperCase(), playDirt);
        if (cmd === 'bcj') return handleJoin('BC', args[0]?.toUpperCase(), playBaccarat);
        if (cmd === 'bjj') return handleJoin('BJ', args[0]?.toUpperCase(), playBJ);
        if (cmd === 'daduj') return handleJoin('DADU', args[0]?.toUpperCase(), playDadu);
        if (cmd === 'cardj') return handleJoin('CARD', args[0]?.toUpperCase(), playCard);
        if (cmd === 'flipj') return handleJoin('FLIP', args[0]?.toUpperCase(), playFlip);
        
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

            // Main KB 5 ronde
            const result = playKB(5, game.hostChoice);
            
            let winner = null;
            let winnerName = '';
            let winnerObj = null;
            let loserObj = null;
            
            if (result.playerWins > result.opponentWins) {
                winner = game.hostId;
                winnerName = game.hostName;
                winnerObj = host;
                loserObj = joiner;
            } else if (result.opponentWins > result.playerWins) {
                winner = message.author.id;
                winnerName = message.author.username;
                winnerObj = joiner;
                loserObj = host;
            }

            const totalPot = game.betAmount * 2;
            const fee = calculateFee(totalPot);
            
            if (winner) {
                const winningAmount = totalPot - fee;
                winnerObj.coins += winningAmount;
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

            let response = 
                `🎮 **KB PVP - 5 RONDE**\n` +
                `${game.hostName} vs ${message.author.username}\n\n` +
                `**HASIL PERTANDINGAN:**\n${resultsText}\n\n` +
                `📊 **SKOR AKHIR:**\n` +
                `${game.hostName}: ${result.playerWins} kemenangan\n` +
                `${message.author.username}: ${result.opponentWins} kemenangan\n\n` +
                `💰 Taruhan: ${formatNumber(game.betAmount)} coin/player\n` +
                `💎 Total Pot: ${formatNumber(totalPot)} coin\n`;

            if (winner) {
                response += 
                    `💰 Fee: ${formatNumber(fee)} coin\n` +
                    `🏆 **Pemenang: ${winnerName}**\n` +
                    `💸 Mendapat: ${formatNumber(totalPot - fee)} coin (setelah fee)\n` +
                    `💳 Profit: +${formatNumber(totalPot - fee - game.betAmount)} coin`;
            } else {
                response += `🤝 **HASIL DRAW!** Taruhan dikembalikan (tanpa fee)`;
            }

            return message.reply(response);
        }

        // ==================== SEMUA PVH COMMANDS ====================
        if (cmd === 'hleme') return handlePVHHost('LEME', parseInt(args[0]), 'leme');
        if (cmd === 'leme') return handlePVHJoin('LEME', args[0]?.toUpperCase());
        if (cmd === 'hreme') return handlePVHHost('REME', parseInt(args[0]), 'reme');
        if (cmd === 'reme') return handlePVHJoin('REME', args[0]?.toUpperCase());
        if (cmd === 'hlewa') return handlePVHHost('LEWA', parseInt(args[0]), 'lewa');
        if (cmd === 'lewa') return handlePVHJoin('LEWA', args[0]?.toUpperCase());
        if (cmd === 'hr') return handlePVHHost('REWA', parseInt(args[0]), 'rw');
        if (cmd === 'rw') return handlePVHJoin('REWA', args[0]?.toUpperCase());

        // ==================== ADMIN COMMANDS ====================
        if (config.ownerIds.includes(message.author.id)) {
            if (cmd === 'addcoin') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.addcoin @user jumlah`');
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Tag user!');
                const amount = parseInt(args[1]);
                if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid!');

                if (!db.users[target.id]) {
                    db.users[target.id] = { userId: target.id, username: target.username, coins: 0, gamesPlayed: 0, gamesWon: 0 };
                }
                db.users[target.id].coins += amount;
                saveDB();

                return message.reply(`✅ **ADD COIN**\n${target} mendapat +${formatNumber(amount)} coin`);
            }

            if (cmd === 'delcoin') {
                if (args.length < 2) return message.reply('❌ Gunakan: `.delcoin @user jumlah`');
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Tag user!');
                const amount = parseInt(args[1]);
                if (isNaN(amount) || amount <= 0) return message.reply('❌ Jumlah tidak valid!');

                const targetUser = db.users[target.id];
                if (!targetUser) return message.reply('❌ User tidak ditemukan!');
                if (targetUser.coins < amount) return message.reply(`❌ User hanya punya ${formatNumber(targetUser.coins)} coin!`);

                targetUser.coins -= amount;
                saveDB();
                return message.reply(`✅ **DEL COIN**\n${target} kehilangan -${formatNumber(amount)} coin`);
            }

            if (cmd === 'feestatus') {
                return message.reply(
                    `💰 **STATUS FEE**\n` +
                    `Status: ${config.fee.enabled ? '✅ Aktif' : '❌ Nonaktif'}\n` +
                    `Percentage: ${config.fee.percentage}%\n` +
                    `Min Fee: ${config.fee.minFee} coin\n` +
                    `Max Fee: ${config.fee.maxFee} coin\n` +
                    `Total Fee Terkumpul: ${formatNumber(db.feeWallet)} 🪙`
                );
            }
        }

    } catch (err) {
        console.error(err);
        message.reply('❌ Error: ' + err.message);
    }
});

// ==================== LOGIN ====================
client.login(config.token).catch(err => {
    console.error('❌ Login failed:', err);
});

console.log(`🚀 ${config.botName} starting...`);
console.log(`📱 Deposit: ${config.deposit.dana}`);
console.log(`💰 Fee: ${config.fee.percentage}% (min ${config.fee.minFee}, max ${config.fee.maxFee})`);