// index.js - NERO COMMUNITY SECURITY SYSTEM (VERSION 6.0)
import { Client, GatewayIntentBits, Partials, Events, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const TIMEOUT_DURATION = 24 * 60 * 60 * 1000; 
const DATA_FILE = './timeouts.json';

// Persistent Data
let persistentTimeouts = new Set();
let offenseTracker = {}; 
let strikeTracker = {}; 
let kickedUsers = {}; 

if (fs.existsSync(DATA_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        persistentTimeouts = new Set(data.timeouts || []);
        offenseTracker = data.offenses || {};
        strikeTracker = data.strikes || {};
        kickedUsers = data.kicked || {};
    } catch (e) { console.error('Error loading data:', e); }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            timeouts: [...persistentTimeouts],
            offenses: offenseTracker,
            strikes: strikeTracker,
            kicked: kickedUsers
        }));
    } catch (e) { console.error('Error saving data:', e); }
}

// -- STRIKE DECAY SYSTEM (Removes 1 strike every 24h) --
setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const userId in strikeTracker) {
        const data = strikeTracker[userId];
        if (data.count > 0 && now - data.lastStrike > 24 * 60 * 60 * 1000) {
            data.count--;
            data.lastStrike = now;
            changed = true;
            if (data.count === 0) delete strikeTracker[userId];
        }
    }
    if (changed) saveData();
}, 60 * 60 * 1000);

const spamMap = new Map();

// -- KEEP ALIVE SERVER --
http.createServer((req, res) => {
    res.write('Nero Security System is Running 24/7!');
    res.end();
}).listen(process.env.PORT || 3000);

const FORBIDDEN_WORDS = ['hack', 'cheat', 'exploit', 'vpn', 'proxy', 'free nitro', 'token grabber'];
const BAD_WORDS = ['كسمك', 'شرموط', 'قحبة', 'منيوك', 'خول', 'عاهر', 'سافل', 'واطي', 'حقير', 'fuck', 'shit', 'bitch', 'nigger'];
const BULLY_WORDS = ['حمار', 'ورع', 'كلب', 'حيوان', 'فاشل', 'ضعيف', 'شحات', 'دب', 'نوب', 'ugly', 'fat', 'loser', 'stupid', 'dumb'];

client.on(Events.ClientReady, async (c) => {
    console.log(`🛡️ NERO SYSTEM ACTIVE: ${c.user.tag}`);
    connectToVoice();
});

async function connectToVoice() {
    const gid = process.env.GUILD_ID;
    const cid = process.env.AFK_CHANNEL_ID;
    if (!gid || !cid) return;
    const guild = client.guilds.cache.get(gid);
    if (!guild) return;
    try {
        const connection = joinVoiceChannel({ channelId: cid, guildId: gid, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try { await Promise.race([entersState(connection, VoiceConnectionStatus.Signalling, 5000), entersState(connection, VoiceConnectionStatus.Connecting, 5000)]); }
            catch (e) { connection.destroy(); connectToVoice(); }
        });
    } catch (e) { setTimeout(connectToVoice, 5000); }
}

client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    const isOwner = msg.author.id === msg.guild.ownerId;
    const content = msg.content.toLowerCase();

    // 1. LINKS & HACKS (Instant 24h)
    const linkRegex = /(([a-z0-9]+\.)+[a-z0-9]{2,4}(\/[^\s]*)?)|(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)/gi;
    if (linkRegex.test(content) || FORBIDDEN_WORDS.some(w => content.includes(w))) {
        await msg.delete().catch(() => {});
        if (isOwner) return;
        persistentTimeouts.add(msg.author.id);
        saveData();
        await msg.member.timeout(TIMEOUT_DURATION, 'NERO RULE: Links/Hacks');
        return msg.channel.send(`🛡️ **NERO SECURITY:** ${msg.author.tag} timed out for 24h (Forbidden Content).`);
    }

    // 2. BAD WORDS (5m -> 1h -> 24h)
    if (BAD_WORDS.some(w => content.includes(w))) {
        await msg.delete().catch(() => {});
        if (isOwner) return;
        const count = (offenseTracker[msg.author.id] || 0) + 1;
        offenseTracker[msg.author.id] = count;
        let duration = count === 1 ? 5*60*1000 : (count === 2 ? 60*60*1000 : 24*60*60*1000);
        if (count >= 3) persistentTimeouts.add(msg.author.id);
        saveData();
        await msg.member.timeout(duration, 'NERO RULE: Bad Language');
        return msg.channel.send(`🛡️ **NERO SECURITY:** ${msg.author.tag} timed out for **${count === 1 ? '5m' : (count === 2 ? '1h' : '24h')}**.`);
    }

    // 3. BULLYING (Strike System: 1, 2, 3+Kick)
    if (BULLY_WORDS.some(w => content.includes(w))) {
        await msg.delete().catch(() => {});
        if (isOwner) return;
        const strike = strikeTracker[msg.author.id] || { count: 0, lastStrike: Date.now() };
        strike.count++;
        strike.lastStrike = Date.now();
        strikeTracker[msg.author.id] = strike;
        saveData();
        if (strike.count === 1) return msg.channel.send(`⚠️ **NERO WARNING #1:** ${msg.author.tag}, bullying is forbidden.`);
        if (strike.count === 2) {
            await msg.member.timeout(60*60*1000, 'Nero Strike 2');
            return msg.channel.send(`⛔ **NERO WARNING #2:** ${msg.author.tag}, second strike! 1 hour timeout.`);
        }
        if (strike.count >= 3) {
            kickedUsers[msg.author.id] = Date.now();
            saveData();
            await msg.member.kick('NERO RULE: Strike 3 (Bullying)');
            return msg.channel.send(`🚫 **NERO BANISHMENT:** ${msg.author.tag} kicked for 72 hours.`);
        }
    }

    // 4. SPAM
    const now = Date.now();
    const userData = spamMap.get(msg.author.id) || [];
    userData.push(now);
    const recent = userData.filter(t => now - t < 5000);
    spamMap.set(msg.author.id, recent);
    if (recent.length >= 5) {
        await msg.delete().catch(() => {});
        if (isOwner) return;
        await msg.member.timeout(5*60*1000, 'NERO RULE: Spam');
        return msg.channel.send(`🛡️ **NERO SECURITY:** ${msg.author.tag} timed out for 5m (Spam).`);
    }
});

// Re-entry & Alt Protection
client.on(Events.GuildMemberAdd, async (m) => {
    const kTime = kickedUsers[m.id];
    if (kTime && (Date.now() - kTime) < 72*60*60*1000) {
        await m.send('🚫 **NERO:** You are still under a 72-hour entry ban.').catch(() => {});
        return m.kick('NERO: 72h re-entry ban.');
    }
    const age = (Date.now() - m.user.createdTimestamp) / (1000*60*60*24);
    if (age < 60) return m.kick('NERO: Account too new.');
});

// Voice & Kick protection
client.on(Events.VoiceStateUpdate, async (o, n) => {
    if (o.member.id === client.user.id && o.channelId && !n.channelId) connectToVoice();
});
client.on(Events.GuildDelete, async (g) => {
    const owner = await client.users.fetch(g.ownerId);
    owner.send(`⚠️ **NERO ALERT:** Bot was removed from **${g.name}**.`).catch(() => {});
});

client.login(process.env.DISCORD_TOKEN);
