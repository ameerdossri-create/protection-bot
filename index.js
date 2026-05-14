// index.js - AGGRESSIVE NERO PROTECTION BOT (VERSION 7.0 - INVINCIBLE)
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

const TIMEOUT_DURATION = 24 * 60 * 60 * 1000; // 24 Hours
const DATA_FILE = './timeouts.json';

// Configuration from .env
const CONFIG = {
    GUILD_ID: process.env.GUILD_ID,
    AFK_CHANNEL_ID: process.env.AFK_CHANNEL_ID,
    WARNING_ROLE_1: process.env.WARNING_ROLE_1_ID,
    WARNING_ROLE_2: process.env.WARNING_ROLE_2_ID,
    OWNER_ID: null // Will be fetched at start
};

// Load persistent data
let persistentTimeouts = new Set();
let offenseTracker = {}; // { userId: count } for bad words
let strikeTracker = {}; // { userId: { count: 0, lastStrike: Date } } for bullying/rules
let kickedUsers = {}; // { userId: timestamp }

if (fs.existsSync(DATA_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        persistentTimeouts = new Set(data.timeouts || []);
        offenseTracker = data.offenses || {};
        strikeTracker = data.strikes || {};
        kickedUsers = data.kicked || {};
        console.log(`📂 Loaded records: ${persistentTimeouts.size} timeouts, ${Object.keys(offenseTracker).length} offenses, ${Object.keys(strikeTracker).length} strikes.`);
    } catch (e) { console.error('Error loading data:', e); }
}

function saveTimeouts() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            timeouts: [...persistentTimeouts],
            offenses: offenseTracker,
            strikes: strikeTracker,
            kicked: kickedUsers
        }));
    } catch (e) { console.error('Error saving data:', e); }
}

const spamMap = new Map();

// -- KEEP ALIVE SERVER (ROBUST) --
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.write(`
        <body style="background: #1a1a1a; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
            <h1 style="color: #5865F2;">🛡️ NERO INVINCIBLE SYSTEM</h1>
            <p>Status: <span style="color: #3ba55c;">ONLINE</span></p>
            <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
            <p>Ping this URL every 5 mins to stay 24/7!</p>
        </body>
    `);
    res.end();
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Keep-alive server is listening on port ${PORT}`);
});

// -- SELF-PING LOGIC (FOR RENDER/HEROKU) --
setInterval(() => {
    // If you are using Render, add RENDER_EXTERNAL_URL to your environment variables
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    if (url.startsWith('http')) {
        http.get(url).on('error', (err) => {
            console.error('Self-ping failed:', err.message);
        });
    }
}, 5 * 60 * 1000); // Ping every 5 minutes

// -- FORBIDDEN WORDS --
const FORBIDDEN_WORDS = [
    'hack', 'cheat', 'exploit', 'injector', 'aimbot', 'wallhack', 'vpn', 'proxy', 
    'free nitro', 'token grabber', 'selfbot', 'raid', 'nuke', 'executor'
];

// -- BAD WORDS (ENGLISH & ARABIC) --
const BAD_WORDS = [
    // English
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'stfu', 'faggot', 'nigger', 'cunt', 'piss', 'bastard', 'slut', 'whore', 'retard', 'nigga', 'kike', 'spic', 'chink', 'motherfucker', 'cocksucker', 'bollocks', 'wanker', 'twat', 'punani', 'fanny', 'minge', 'cum', 'semen', 'porn', 'sex', 'masturbate', 'jerkoff', 'clit', 'tit', 'boob', 'vagina', 'penis', 'erection', 'horny', 'slutty', 'rape', 'pedophile', 'incest', 'deepthroat', 'blowjob',
    // Arabic (Insults & Slurs)
    'كسمك', 'شرموط', 'قحبة', 'منيوك', 'كس', 'طيز', 'زب', 'متناكة', 'خول', 'عقبة', 'ديوث', 'عرص', 'قواد', 'منيوكة', 'تفو', 'لبوة', 'عاهر', 'داشر', 'سافل', 'واطي', 'حقير', 'تيزي', 'نيكة', 'يا ابن الحرام', 'يا ابن الكلب', 'يا ابن القحبة', 'يا ابن الشرموطة', 'يا ابن المتناكة', 'يا ابن الزانية', 'يابن الحرام', 'يابن الكلب', 'يابن القحبة', 'يابن الشرموطة', 'يابن المتناكة', 'يابن الزانية', 'يلعن ابوك', 'يلعن امك', 'يلعن اختك', 'يلعن ربك', 'يلعن دينك', 'يا منيك', 'يا عرص', 'يا خنيث', 'يا لوطي', 'يا شاذ', 'يا قذر', 'يا نجس', 'يا حثالة', 'يا قمامة', 'يا وصخ', 'يا صرصور', 'يا برص', 'يا فاشل', 'يا جزمة', 'يا كندرة', 'اهين امك', 'اهينك'
];

// -- BULLYING WORDS --
const BULLY_WORDS = [
    // English
    'ugly', 'fat', 'loser', 'stupid', 'dumb', 'idiot', 'noob', 'trash', 'garbage', 'poor', 'beggar', 'lowlife', 'failure', 'horrible person', 'kill yourself', 'kys', 'get cancer', 'die', 'nerd', 'geek', 'weirdo', 'creep', 'freak', 'moron', 'imbecile', 'brainless', 'useless', 'pathetic', 'worthless', 'nobody', 'disgusting', 'gross', 'smelly', 'stinky', 'shorty', 'midget', 'baldy', 'four-eyes', 'dumbass', 'dumbfuck', 'jackass',
    // Arabic (Bullying)
    'حمار', 'ورع', 'كلب', 'حيوان', 'صرصور', 'غبي', 'فاشل', 'ضعيف', 'فقير', 'شحات', 'دب', 'نوب', 'جاهل', 'تافه', 'معفن', 'نجس', 'حشرة', 'زق', 'يا غبي', 'يا فاشل', 'يا لوح', 'يا ثور', 'يا بقرة', 'يا تيس', 'يا عنزة', 'يا خنزير', 'يا قرد', 'يا جحش', 'يا كر', 'يا صخل', 'يا دجاجة', 'يا فار', 'يا ارنب', 'يا خواف', 'يا جبان', 'يا رعديد', 'يا حثالة', 'يا زبالة', 'يا مهان', 'يا ذليل', 'يا وضيع', 'يا منحط', 'يا متخلف', 'يا معاق', 'يا مشلول', 'يا اعمى', 'يا اطرش', 'يا ابكم'
];

// -- ERROR HANDLING & AUTO-RESTART --
process.on('unhandledRejection', e => {
    console.error('CRITICAL ERROR (Promise):', e);
    // Don't kill the process, just log it
});
process.on('uncaughtException', e => {
    console.error('CRITICAL ERROR (Crash):', e);
    // If it's a fatal error, we might want to exit and let PM2 or the host restart it
    // but for now, we'll try to keep it alive
});

client.on(Events.Error, e => console.error('Discord Client Error:', e));
client.on(Events.ShardDisconnect, () => console.warn('Bot disconnected from Discord... attempting to reconnect.'));
client.on(Events.ShardReconnecting, () => console.log('Bot is reconnecting to Discord...'));
client.on(Events.ShardResume, () => console.log('Bot connection resumed!'));

client.on(Events.ClientReady, async (c) => {
    console.log(`🛡️ NERO INVINCIBLE SYSTEM ACTIVE: ${c.user.tag}`);
    
    // Fetch owner ID
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    if (guild) {
        CONFIG.OWNER_ID = guild.ownerId;
        console.log(`👑 Recognized Owner ID: ${CONFIG.OWNER_ID}`);
    }

    connectToVoice();
});

// -- VOICE RESILIENCE --
async function connectToVoice() {
    const gid = CONFIG.GUILD_ID;
    const cid = CONFIG.AFK_CHANNEL_ID;
    if (!gid || !cid) return;
    const guild = client.guilds.cache.get(gid);
    if (!guild) return;

    try {
        const connection = joinVoiceChannel({
            channelId: cid,
            guildId: gid,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (e) {
                connection.destroy();
                connectToVoice();
            }
        });
    } catch (e) { setTimeout(connectToVoice, 5000); }
}

// -- UNBREAKABLE TIMEOUT LOGIC --
client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    if (oldM.communicationDisabledUntilTimestamp && !newM.communicationDisabledUntilTimestamp) {
        if (persistentTimeouts.has(newM.id)) {
            try {
                await new Promise(r => setTimeout(r, 2000));
                const fetchedLogs = await newM.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberUpdate,
                });
                const log = fetchedLogs.entries.first();
                
                // If executor is NOT the owner, re-apply
                if (log && log.executorId !== CONFIG.OWNER_ID) {
                    await newM.timeout(TIMEOUT_DURATION, 'SECURITY: Unauthorized untimeout. Only the Owner can remove this!');
                    const logChan = newM.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'));
                    if (logChan) logChan.send(`🛡️ **Protection Alert:** ${newM.user.tag} tried to bypass timeout. **Re-applied for 24h.**`);
                } else if (log && log.executorId === CONFIG.OWNER_ID) {
                    persistentTimeouts.delete(newM.id);
                    saveTimeouts();
                    console.log(`🔓 Owner bypassed timeout for ${newM.user.tag}`);
                }
            } catch (e) { console.error('Bypass protection error:', e); }
        }
    }
});

// -- PUNISHMENT LOGIC --
async function punishUser(member, reason, force = false) {
    const isOwner = member.id === CONFIG.OWNER_ID;
    if (isOwner && !force) return;

    const guild = member.guild;
    const botMember = guild.members.me;

    // Check if bot can moderate
    if (botMember.roles.highest.position <= member.roles.highest.position) {
        console.error(`[CRITICAL] Bot role is too low to punish ${member.user.tag}!`);
        return;
    }

    const userData = strikeTracker[member.id] || { count: 0, lastStrike: Date.now() };
    userData.count++;
    userData.lastStrike = Date.now();
    strikeTracker[member.id] = userData;
    saveTimeouts();

    try {
        const ownerInfo = "Owner: 1xliaw";
        
        if (userData.count === 1) {
            // Send Message First
            await member.send(`⚠️ **NERO WARNING #1:** You received a warning for **${reason}**.\nPlease follow the server rules.\n${ownerInfo}`).catch(() => {});
            
            // Then Apply Role
            if (CONFIG.WARNING_ROLE_1) {
                await member.roles.add(CONFIG.WARNING_ROLE_1).catch(e => console.error('Role 1 error:', e.message));
            }
            
            return member.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'))
                ?.send(`⚠️ **NERO WARNING #1:** ${member.user.tag}, violating rules. Strike 1 applied.`);
        } 
        else if (userData.count === 2) {
            // Send Message First
            await member.send(`⛔ **NERO WARNING #2:** You have been timed out for 24 hours for **${reason}**.\nThis is your final warning.\n${ownerInfo}`).catch(() => {});

            // Remove Role 1, Add Role 2 + Timeout
            if (CONFIG.WARNING_ROLE_1) await member.roles.remove(CONFIG.WARNING_ROLE_1).catch(() => {});
            if (CONFIG.WARNING_ROLE_2) await member.roles.add(CONFIG.WARNING_ROLE_2).catch(e => console.error('Role 2 error:', e.message));
            
            persistentTimeouts.add(member.id);
            saveTimeouts();
            await member.timeout(TIMEOUT_DURATION, `NERO RULE: Strike 2 (${reason})`).catch(e => console.error('Timeout error:', e.message));
            
            return member.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'))
                ?.send(`⛔ **NERO WARNING #2:** ${member.user.tag}, second strike! 24h timeout. Next is a **72-HOUR KICK**.`);
        } 
        else {
            // Strike 3: KICK + 72H RE-ENTRY BAN
            kickedUsers[member.id] = Date.now();
            saveTimeouts();
            await member.send(`🚫 **NERO SECURITY:** You have been kicked for 72 hours due to **${reason}**.\nDo not attempt to rejoin early.\n${ownerInfo}`).catch(() => {});
            await member.kick(`NERO RULE: Strike 3 (${reason})`);
            return member.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'))
                ?.send(`🚫 **NERO BANISHMENT:** ${member.user.tag} kicked for 72 hours (Strike 3).`);
        }
    } catch (e) { console.error('Punishment execution error:', e); }
}

// -- AUTO-EXPIRE STRIKES (24H) --
setInterval(async () => {
    const now = Date.now();
    let changed = false;
    const guild = client.guilds.cache.get(CONFIG.GUILD_ID);
    
    for (const userId in strikeTracker) {
        const data = strikeTracker[userId];
        // If strike is older than 24 hours, reset it
        if (now - data.lastStrike > 24 * 60 * 60 * 1000) {
            console.log(`🕒 Expiring strikes for ${userId}`);
            if (guild) {
                try {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member) {
                        if (CONFIG.WARNING_ROLE_1) await member.roles.remove(CONFIG.WARNING_ROLE_1).catch(() => {});
                        if (CONFIG.WARNING_ROLE_2) await member.roles.remove(CONFIG.WARNING_ROLE_2).catch(() => {});
                    }
                } catch (e) { console.error('Error removing expired roles:', e); }
            }
            delete strikeTracker[userId];
            changed = true;
        }
    }
    if (changed) saveTimeouts();
}, 10 * 60 * 1000); // Check every 10 minutes


// -- MESSAGE PROTECTION --
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    
    // Debug logging for the owner to see what the bot sees
    console.log(`[DEBUG] ${msg.author.tag}: "${msg.content}"`);

    const isOwner = msg.author.id === CONFIG.OWNER_ID;
    const content = msg.content.toLowerCase();
    
    // TEST COMMAND FOR OWNER
    if (content === '!warnme') {
        console.log(`[TEST] Owner ${msg.author.tag} requested a test warning.`);
        return punishUser(msg.member, 'Manual Test', true);
    }
    
    // 1. LINK / FORBIDDEN DETECTION
    const linkRegex = /(([a-z0-9]+\.)+[a-z0-9]{2,4}(\/[^\s]*)?)|(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)/gi;
    const hasForbiddenWord = FORBIDDEN_WORDS.some(word => content.includes(word));

    if (linkRegex.test(content) || hasForbiddenWord) {
        await msg.delete().catch(e => console.error('Delete error:', e.message));
        if (isOwner) return;
        return punishUser(msg.member, 'Forbidden Content');
    }

    // 2. BAD WORD FILTER (Escalating)
    const hasBadWord = BAD_WORDS.some(word => content.includes(word));
    if (hasBadWord) {
        await msg.delete().catch(e => console.error('Delete error:', e.message));
        if (isOwner) {
            return msg.channel.send(`🛡️ **NERO LOG:** ${msg.author.tag}, detected bad word. (Owner is immune to punishment)`).then(m => setTimeout(() => m.delete(), 3000));
        }
        return punishUser(msg.member, 'Bad Language');
    }

    // 3. BULLYING WORD FILTER
    const hasBullyWord = BULLY_WORDS.some(word => content.includes(word));
    if (hasBullyWord) {
        await msg.delete().catch(e => console.error('Delete error:', e.message));
        if (isOwner) return;
        return punishUser(msg.member, 'Bullying');
    }

    // 4. SPAM PROTECTION
    const now = Date.now();
    const userData = spamMap.get(msg.author.id) || [];
    userData.push(now);
    const recent = userData.filter(t => now - t < 5000);
    spamMap.set(msg.author.id, recent);

    if (recent.length >= 6) {
        await msg.delete().catch(() => {});
        if (isOwner) return;
        return punishUser(msg.member, 'Spamming');
    }
});

// -- 72-HOUR RE-ENTRY PROTECTION --
client.on(Events.GuildMemberAdd, async (m) => {
    const kickTime = kickedUsers[m.id];
    if (kickTime) {
        const hoursPassed = (Date.now() - kickTime) / (1000 * 60 * 60);
        if (hoursPassed < 72) {
            await m.send(`🚫 **NERO SECURITY:** You are still under a 72-hour entry ban. Please wait ${ (72 - hoursPassed).toFixed(1) } more hours.`).catch(() => {});
            return m.kick('NERO RULE: 72-hour re-entry ban active.');
        } else {
            delete kickedUsers[m.id];
            saveTimeouts();
        }
    }
    
    // Alt Detection (60 days)
    const age = (Date.now() - m.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (age < 60) {
        await m.kick('NERO SECURITY: Account too new (60-day limit)');
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => console.error('LOGIN FAILED:', err));
