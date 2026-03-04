const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// --- SISTEM DATABASE PERMANEN ---
const DB_PATH = './database.json';
let db = { users: {}, vault: { totalFee: 0 } };

if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

const saveDB = () => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

// --- KONFIGURASI ---
const config = {
    adminId: "1478560895058579476", // GANTI DENGAN ID DISCORD KAMU
    nomorDepo: "6283173495612",
    botName: "DUEL RXV X TEAMRXVVX",
    feePercentage: 0.05
};

let activeDuels = {};

client.once('ready', () => {
    console.log(`✅ ${config.botName} Online di Railway!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('.')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (!db.users[userId]) db.users[userId] = { coin: 0 };
    let user = db.users[userId];

    // ================= [ MENU UTAMA ] =================
    if (command === 'menu') {
        const menuEmbed = new EmbedBuilder()
            .setTitle(`✨ ${config.botName} ✨`)
            .setColor('#2b2d31')
            .setDescription('📜 **Update:**\n• Valentine Edition 💕\n• PvP & PvH Games Completed 👌\n• Auto-Fee 5% Active 🏦')
            .addFields(
                { name: '✨ MENU UTAMA', value: '`.menu` `.admin` `.tukar` `.spin`' },
                { name: '💰 ECONOMY', value: '`.depo` `.qris` `.tfcoin` `.cc` `.leaderboard`' },
                { name: '🎮 PVP GAMES', value: '`.reme` `.qq` `.bj` `.dadu` `.flip` (Gunakan: `.game @lawan bet`)' },
                { name: '🛡️ PVH GAMES', value: '`.leme` `.lewa` `.rewa` (Gunakan: `.game bet`)' }
            )
            .setFooter({ text: `Owner: ${config.nomorDepo} | Admin: .addcoin` });
        return message.reply({ embeds: [menuEmbed] });
    }

    // ================= [ ECONOMY ] =================
    if (command === 'cc') return message.reply(`🪙 Saldo: **${user.coin.toLocaleString()}** koin.`);
    
    if (command === 'depo' || command === 'qris') {
        return message.reply(`💳 **DEPOSIT**\nTransfer: **${config.nomorDepo}** (DANA/GOPAY/OVO)\nKirim bukti ke Admin!`);
    }

    // ================= [ PVP + FEE 5% ] =================
    const pvpGames = ['reme', 'qq', 'bj', 'dadu', 'flip'];
    if (pvpGames.includes(command)) {
        const target = message.mentions.users.first();
        const bet = parseInt(args[1]);

        if (!target || isNaN(bet) || bet <= 0) return message.reply(`Format: \`.${command} @lawan [bet]\``);
        if (target.id === userId) return message.reply("❌ Jangan duel sendiri!");
        if (user.coin < bet) return message.reply("❌ Koin tidak cukup!");

        activeDuels[target.id] = { challenger: userId, bet: bet, game: command.toUpperCase() };
        return message.reply(`⚔️ **TANTANGAN PVP**\n<@${userId}> vs <@${target.id}>\nBet: **${bet}**\nKetik **.acc** untuk terima!`);
    }

    if (command === 'acc') {
        const duel = activeDuels[userId];
        if (!duel) return message.reply("❌ Tidak ada tantangan.");
        if (user.coin < duel.bet) return message.reply("❌ Koin kamu kurang!");

        const p1Score = Math.floor(Math.random() * 10) + 1;
        const p2Score = Math.floor(Math.random() * 10) + 1;
        let winnerId, loserId;

        if (p1Score > p2Score) { winnerId = duel.challenger; loserId = userId; }
        else if (p2Score > p1Score) { winnerId = userId; loserId = duel.challenger; }
        else { 
            delete activeDuels[userId];
            return message.reply("🤝 **SERI!** Koin aman."); 
        }

        const fee = Math.floor(duel.bet * config.feePercentage);
        const netWin = duel.bet - fee;

        db.users[winnerId].coin += netWin;
        db.users[loserId].coin -= duel.bet;
        db.vault.totalFee += fee;
        saveDB();
        delete activeDuels[userId];

        return message.reply(`🏆 <@${winnerId}> Menang!\n💰 Hadiah Bersih: **${netWin}** (Fee 5%: ${fee})`);
    }

    // ================= [ PVH ] =================
    if (['leme', 'lewa', 'rewa'].includes(command)) {
        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet <= 0 || user.coin < bet) return message.reply("❌ Saldo tidak cukup!");
        
        if (Math.random() > 0.65) {
            user.coin += bet;
            message.reply(`🎯 **WIN!** Saldo: ${user.coin}`);
        } else {
            user.coin -= bet;
            message.reply(`💥 **LOSE!** Saldo: ${user.coin}`);
        }
        saveDB();
    }

    // ================= [ ADMIN ] =================
    if (command === 'addcoin') {
        if (userId !== config.adminId) return;
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!db.users[target.id]) db.users[target.id] = { coin: 0 };
        db.users[target.id].coin += amount;
        saveDB();
        message.reply(`✅ +${amount} koin ke ${target.username}`);
    }
});

client.login(process.env.TOKEN); // Menggunakan Environment Variable Railway
