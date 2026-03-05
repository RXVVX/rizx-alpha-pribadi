// DUEL RXV TEAMRXVVX - BOT TARUHAN SUNGGUHAN
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
    
    startingCoins: 0, // Tidak ada gratis coin
    gameExpireTime: 120000, // 2 menit
    
    fee: {
        enabled: true,
        percentage: 5,
        minFee: 10,
        maxFee: 5000
    }
};

// ==================== DATABASE ====================
let db = { users: {}, games: [], feeWallet: 0, feeHistory: [] };

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

// ==================== GAME LOGIC YANG LEBIH SUSAH ====================

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

// 2. QEME (tebak angka 1-50, selisih terkecil menang)
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

// 3. QQ (kartu 1-13, nilai tertinggi menang)
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

// 4. CSN (casino - random 1-100)
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

// 5. BTK (battle - damage 1-50)
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

// 6. DIRT (dirt seed - random 1-100)
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

// 7. BC (baccarat sederhana - nilai 0-9)
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

// 8. BJ (blackjack sederhana - 1-21, mendekati 21 menang)
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

// 9. KB (kecil/besar dengan 2 dadu)
function playKB(rounds, hostChoice) {
    let playerWins = 0, opponentWins = 0, results = [];
    for (let r = 1; r <= rounds; r++) {
        const dice1 = rollDice();
        const dice2 = rollDice();
        const total = dice1 + dice2;
        const hasil = total <= 6 ? 'KECIL' : 'BESAR'; // 2-6 kecil, 7-12 besar
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
                    { name: '🎲 SPIN GRATIS', value: '`.spin` - Lempar 3 dadu gratis (no coin)' },
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
                '**SPIN GRATIS:** `.spin` (tidak memakai coin)\n' +
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

        // ==================== REDEEM GIFT ====================
        if (cmd === 'tukar') {
            return message.reply('🎁 **GIFT CODE**\nHubungi admin untuk mendapatkan kode gift.');
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

        // ==================== DAFTAR COMMAND ====================
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

        // KHUSUS KB
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

        // JOIN COMMANDS
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
            flipj: ['FLIP', playFlip],
            kbj: ['KB', playKB] // khusus kb perlu penanganan sendiri karena butuh hostChoice
        };

        if (joinCommands[cmd]) {
            const [gameType, gameFunc] = joinCommands[cmd];
            if (cmd === 'kbj') {
                // handle kbj khusus
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
            } else {
                return handleJoin(gameType, args[0]?.toUpperCase(), gameFunc);
            }
        }

        // PVH HOST
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

        // PVH JOIN
        const pvhJoin = {
            leme: 'LEME',
            reme: 'REME',
            lewa: 'LEWA',
            rw: 'REWA'
        };
        if (pvhJoin[cmd]) {
            return handlePVHJoin(pvhJoin[cmd], args[0]?.toUpperCase());
        }

        // ==================== ADMIN ====================
        if (config.ownerIds.includes(message.author.id)) {
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

            if (cmd === 'feestatus') {
                return message.reply(
                    `💰 **STATUS FEE**\n` +
                    `Aktif: ${config.fee.enabled}\n` +
                    `Fee: ${config.fee.percentage}%\n` +
                    `Min: ${config.fee.minFee} | Max: ${config.fee.maxFee}\n` +
                    `Total Terkumpul: ${formatNumber(db.feeWallet)} 🪙`
                );
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
