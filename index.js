// index.js - AGGRESSIVE PROTECTION BOT (VERSION 4.0 - UNBREAKABLE)
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

// Load persistent data
let persistentTimeouts = new Set();
let offenseTracker = {}; // { userId: count }
let bullyTracker = {}; // { userId: count }

if (fs.existsSync(DATA_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        persistentTimeouts = new Set(data.timeouts || []);
        offenseTracker = data.offenses || {};
        bullyTracker = data.bullying || {};
        console.log(`📂 Loaded records: ${persistentTimeouts.size} timeouts, ${Object.keys(offenseTracker).length} offenses, ${Object.keys(bullyTracker).length} bullying strikes.`);
    } catch (e) { console.error('Error loading data:', e); }
}

function saveTimeouts() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            timeouts: [...persistentTimeouts],
            offenses: offenseTracker,
            bullying: bullyTracker
        }));
    } catch (e) { console.error('Error saving data:', e); }
}

const spamMap = new Map();

// -- KEEP ALIVE SERVER (For Hosting) --
http.createServer((req, res) => {
    res.write('Aggressive Protection Bot is Running 24/7!');
    res.end();
}).listen(process.env.PORT || 3000);

// -- FORBIDDEN WORDS (HACKS/VPN/SCAMS) --
const FORBIDDEN_WORDS = [
    'hack', 'cheat', 'exploit', 'injector', 'aimbot', 'wallhack', 'vpn', 'proxy', 
    'free nitro', 'token grabber', 'selfbot', 'raid', 'nuke', 'executor'
];

// -- BAD WORDS (ENGLISH & ARABIC - EXPANDED) --
const BAD_WORDS = [
    // English
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'stfu', 'faggot', 'nigger', 'cunt', 'piss', 'bastard', 'slut', 'whore', 'retard', 'nigga', 'kike', 'spic', 'chink', 'motherfucker', 'cocksucker', 'bollocks', 'wanker', 'twat', 'punani', 'fanny', 'minge',
    // Arabic (Harshest slurs/bad words)
    'كسمك', 'شرموط', 'قحبة', 'منيوك', 'كس', 'طيز', 'زب', 'متناكة', 'خول', 'عقبة', 'ديوث', 'عرص', 'قواد', 'منيوكة', 'تفو', 'لبوة', 'عاهر', 'داشر', 'سافل', 'واطي', 'حقير', 'تيزي', 'نيكة'
];

// -- BULLYING WORDS --
const BULLY_WORDS = [
    // English
    'ugly', 'fat', 'loser', 'stupid', 'dumb', 'idiot', 'noob', 'trash', 'garbage', 'poor', 'beggar', 'lowlife', 'failure', 'horrible person', 'kill yourself', 'kys', 'get cancer', 'die',
    // Arabic
    'حمار', 'ورع', 'كلب', 'حيوان', 'صرصور', 'غبي', 'فاشل', 'ضعيف', 'فقير', 'شحات', 'دب', 'نوب', 'جاهل', 'تافه', 'معفن', 'نجس', 'حشرة', 'زق'
];

// -- ROBUST ERROR HANDLING --
process.on('unhandledRejection', e => console.error('CRITICAL ERROR (Promise):', e));
process.on('uncaughtException', e => console.error('CRITICAL ERROR (Crash):', e));

client.on(Events.ClientReady, async (c) => {
    console.log(`🛡️ AGGRESSIVE PROTECTION SYSTEM ACTIVE: ${c.user.tag}`);
    connectToVoice();
});

// -- VOICE RESILIENCE --
async function connectToVoice() {
    const gid = process.env.GUILD_ID;
    const cid = process.env.AFK_CHANNEL_ID;
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

// -- THE "UNBREAKABLE" TIMEOUT LOGIC --
client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    // If timeout was removed
    if (oldM.communicationDisabledUntilTimestamp && !newM.communicationDisabledUntilTimestamp) {
        if (persistentTimeouts.has(newM.id)) {
            // Check if OWNER removed it (Optional: only the owner can bypass)
            // But the user said "only from u", meaning the bot enforces it.
            
            try {
                // Wait a moment for audit logs
                await new Promise(r => setTimeout(r, 2000));
                const fetchedLogs = await newM.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberUpdate,
                });
                const log = fetchedLogs.entries.first();
                
                // If the owner (target of bypass) is NOT the one who did it, re-apply
                if (log && log.executorId !== newM.guild.ownerId) {
                    await newM.timeout(TIMEOUT_DURATION, 'SECURITY: Unauthorized untimeout. Nobody can remove this!');
                    const logChan = newM.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'));
                    if (logChan) logChan.send(`🛡️ **Protection Alert:** ${newM.user.tag} tried to bypass timeout. **Re-applied for 24h.**`);
                } else if (log && log.executorId === newM.guild.ownerId) {
                    // Owner removed it, so we allow it
                    persistentTimeouts.delete(newM.id);
                    saveTimeouts();
                    console.log(`🔓 Owner bypassed timeout for ${newM.user.tag}`);
                }
            } catch (e) { console.error('Bypass protection error:', e); }
        }
    }
});

// -- AGGRESSIVE MESSAGE PROTECTION --
client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    const isOwner = msg.author.id === msg.guild.ownerId;

    const content = msg.content.toLowerCase();
    
    // 1. LINK DETECTION (Aggressive)
    const linkRegex = /(([a-z0-9]+\.)+[a-z0-9]{2,4}(\/[^\s]*)?)|(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)/gi;
    
    // 2. FORBIDDEN WORD DETECTION (Hacking/VPN) - Instant 24h
    const hasForbiddenWord = FORBIDDEN_WORDS.some(word => content.includes(word));

    if (linkRegex.test(content) || hasForbiddenWord) {
        try {
            await msg.delete().catch(() => {});
            
            if (isOwner) return; // Skip punishment for owner, but delete message

            persistentTimeouts.add(msg.author.id);
            saveTimeouts();
            await msg.member.timeout(TIMEOUT_DURATION, 'SECURITY: Forbidden content (Link/Hack/VPN word)');
            
            setTimeout(() => {
                persistentTimeouts.delete(msg.author.id);
                saveTimeouts();
            }, TIMEOUT_DURATION);

            const em = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🛡️ Security Breach Blocked')
                .setDescription(`**${msg.author.tag}** has been timed out for **24 HOURS**.\n**Reason:** Sending links or hacking/VPN terms.`)
                .setFooter({ text: 'Only the Server Owner can remove this timeout.' });
            
            return msg.channel.send({ embeds: [em] }).catch(() => {});
        } catch (e) { console.error('Aggressive Protection Error:', e); }
    }

    // 3. BAD WORD FILTER (Escalating: 5m -> 1h -> 24h)
    const hasBadWord = BAD_WORDS.some(word => content.includes(word));
    if (hasBadWord) {
        try {
            await msg.delete().catch(() => {});
            
            if (isOwner) return; // Skip punishment for owner

            const count = (offenseTracker[msg.author.id] || 0) + 1;
            offenseTracker[msg.author.id] = count;
            
            let duration = 0;
            let label = '';

            if (count === 1) {
                duration = 5 * 60 * 1000;
                label = '5 Minutes (First Warning)';
            } else if (count === 2) {
                duration = 60 * 60 * 1000;
                label = '1 Hour (Second Warning)';
            } else {
                duration = 24 * 60 * 60 * 1000;
                label = '24 Hours (Final Punishment)';
                persistentTimeouts.add(msg.author.id); // Make it unbreakable if it's the 1-day timeout
            }

            saveTimeouts();
            await msg.member.timeout(duration, `SECURITY: Bad Language (Offense #${count})`);

            const em = new EmbedBuilder()
                .setColor('#FFFF00')
                .setTitle('⚠️ Bad Language Detected')
                .setDescription(`**${msg.author.tag}** has been timed out for **${label}**.\n**Offense Count:** ${count}/3`)
                .setFooter({ text: 'Clean up your language to avoid longer timeouts!' });
            
            return msg.channel.send({ embeds: [em] }).catch(() => {});
        } catch (e) { console.error('Bad Word Filter Error:', e); }
    }

    // 4. ANTI-BULLYING SYSTEM (Strike 1/2 = Warning, Strike 3 = Kick)
    const hasBullyWord = BULLY_WORDS.some(word => content.includes(word));
    if (hasBullyWord) {
        try {
            await msg.delete().catch(() => {});
            
            if (isOwner) return; // Skip punishment for owner

            const strikes = (bullyTracker[msg.author.id] || 0) + 1;
            bullyTracker[msg.author.id] = strikes;
            saveTimeouts();

            if (strikes === 1) {
                const em = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ BULLYING WARNING #1')
                    .setDescription(`**${msg.author.tag}**, bullying is NOT allowed here.\nThis is your first warning.`)
                    .setFooter({ text: 'Strike 1/3' });
                return msg.channel.send({ content: `<@${msg.author.id}>`, embeds: [em] });
            } else if (strikes === 2) {
                await msg.member.timeout(30 * 60 * 1000, 'Bullying Warning #2'); // 30m timeout
                const em = new EmbedBuilder()
                    .setColor('#FF4500')
                    .setTitle('⚠️ BULLYING WARNING #2')
                    .setDescription(`**${msg.author.tag}**, this is your SECOND warning.\nYou have been timed out for 30 minutes.`)
                    .setFooter({ text: 'Strike 2/3 - NEXT IS A KICK' });
                return msg.channel.send({ content: `<@${msg.author.id}>`, embeds: [em] });
            } else {
                // Strike 3 = KICK
                const logChan = msg.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'));
                if (logChan) logChan.send(`👢 **Kicked:** ${msg.author.tag} for repeated bullying (Strike 3).`);
                
                await msg.author.send('❌ You have been kicked from the server for repeated bullying.').catch(() => {});
                await msg.member.kick('SECURITY: Repeated Bullying (Strike 3)');
                bullyTracker[msg.author.id] = 0; // Reset after kick
                saveTimeouts();
            }
        } catch (e) { console.error('Bully Filter Error:', e); }
    }

    // 3. SPAM PROTECTION
    const now = Date.now();
    const userData = spamMap.get(msg.author.id) || [];
    userData.push(now);
    const recent = userData.filter(t => now - t < 5000);
    spamMap.set(msg.author.id, recent);

    if (recent.length >= 5) {
        try {
            await msg.delete().catch(() => {}); // Delete the 5th message that triggered spam
            
            if (isOwner) return; // Skip punishment for owner

            persistentTimeouts.add(msg.author.id);
            saveTimeouts();
            await msg.member.timeout(TIMEOUT_DURATION, 'SECURITY: Spamming');
            msg.channel.send(`🛡️ **${msg.author.tag}** timed out for 24h for spamming.`).catch(() => {});
        } catch (e) { console.error('Spam Protection Error:', e); }
    }
});

// -- AGGRESSIVE ALT / VPN ACCOUNT PROTECTION --
client.on(Events.GuildMemberAdd, async (m) => {
    const age = (Date.now() - m.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const hasDefaultAvatar = m.user.avatar === null;
    
    // Aggressive Alt Check: 
    // 1. Account younger than 60 days
    // 2. Default avatar (no profile picture)
    
    let shouldKick = false;
    let reason = '';

    if (age < 60) {
        shouldKick = true;
        reason = `Account age too low (${age.toFixed(1)} days). Minimum required is 60 days.`;
    } else if (hasDefaultAvatar && age < 180) {
        // Even if account is older, if it has no profile pic and is < 6 months old, kick it
        shouldKick = true;
        reason = 'Account is suspicious (No profile picture + relatively new).';
    }
    
    if (shouldKick) {
        try { 
            await m.send(`❌ **SECURITY:** Your account was flagged as a potential ALT or VPN account.\n**Reason:** ${reason}\n\nIf this is a mistake, contact the Server Owner.`).catch(() => {});
            await m.kick(`SECURITY: ${reason}`);
            console.log(`👢 Kicked suspect account: ${m.user.tag} | Reason: ${reason}`);
            
            const logChan = m.guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('general'));
            if (logChan) {
                const em = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('🛡️ Alt Account Blocked')
                    .setDescription(`**User:** ${m.user.tag}\n**Reason:** ${reason}`)
                    .setTimestamp();
                logChan.send({ embeds: [em] });
            }
        } catch(e){ console.error('Alt Kick Error:', e); }
    }
});

client.login(process.env.DISCORD_TOKEN).catch(err => console.error('LOGIN FAILED:', err));
