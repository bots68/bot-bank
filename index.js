const { Client, GatewayIntentBits, AuditLogEvent, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==================== [ الثوابت والمعرفات الأساسية ] ====================
const PUNISHMENT_ROLE_ID = '1537101884710592626'; // رول التنتيل العام
const TIMEOUT_ALLOWED_ROLE = '1535522564061929512'; // الرول المسموح له بالتايم أوت
const BAN_ALLOWED_ROLE = '1535522481719349249'; // رول الباند (الذي ينتل أيضاً عند الاستخدام)
const EXEMPT_ROLE_1 = '1535724553563668561'; // الرول الوحيد المستثنى نهائياً من السحب والتنتيل
const STRICT_CHAT_ROLE = '1535375782736560128'; // الرول المسموح له بالكتابة في الرومات المحددة

// سجل تتبع الباندات لفحص الفارق الزمني (أقل من 30 دقيقة)
const banTracker = new Map();

// الـ 26 روم المحمية الأساسية
const PROTECTED_CHANNELS = new Set([
    '1535489711420735549', '1535426951333027972', '1535490093358252074',
    '1535375475289890879', '1535406298781192292', '1535490327610400810',
    '1535490429724921986', '1535496283115225208', '1535879098445078528',
    '1535880789114486834', '1535491432230555678', '1535491143897325578',
    '1536659884420890724', '1536693109662949406', '1536689417136119888',
    '1535495503414825061', '1535495713473962024', '1535495916428206100',
    '1535495952994009180', '1535495994186137610', '1535822130342658118',
    '1535821718751289354', '1535496238307213352', '1536977594702888960',
    '1537003891286347828', '1537032400561905674'
]);

// الرومات المحددة الممنوعة على غير الرول المخصص
const STRICT_CHAT_CHANNELS = [
    '1535426951333027972',
    '1535490093358252074',
    '1535489711420735549'
];

// دالة مساعدة لتنتيل العضو وسحب جميع رولاته عدا الرول المستثنى الأول فقط
async function punishMember(member, reason) {
    try {
        const rolesToKeep = member.roles.cache.filter(role => 
            role.id === EXEMPT_ROLE_1 || role.id === PUNISHMENT_ROLE_ID
        );
        
        await member.roles.set(rolesToKeep, reason);
        if (!member.roles.cache.has(PUNISHMENT_ROLE_ID)) {
            await member.roles.add(PUNISHMENT_ROLE_ID, reason);
        }
    } catch (e) { console.error('Punish Error:', e); }
}

client.once('ready', () => {
    console.log(`[SECURE BOT ACTIVE] Logged in as ${client.user.tag}`);
});

// ==================== [ 1. حماية الويب هوك ] ====================
client.on('webhookUpdate', async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        const webhooks = await channel.fetchWebhooks();
        for (const [, webhook] of webhooks) {
            await webhook.delete('Anti-Webhook');
        }

        const member = await channel.guild.members.fetch(auditLog.executor.id);
        await punishMember(member, 'Anti-Webhook: Created unauthorized webhook.');
    } catch (e) { console.error(e); }
});

// ==================== [ 2. حماية الرومات ] ====================
client.on('channelCreate', async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        await channel.delete('Anti-Nuke: Unauthorized channel creation.');
        const member = await channel.guild.members.fetch(auditLog.executor.id);
        await punishMember(member, 'Anti-Nuke: Created unauthorized channel.');
    } catch (e) { console.error(e); }
});

client.on('channelDelete', async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && !auditLog.executor.bot) {
            const member = await channel.guild.members.fetch(auditLog.executor.id);
            await punishMember(member, 'Anti-Nuke: Deleted a channel.');
        }
    } catch (e) { console.error(e); }

    if (PROTECTED_CHANNELS.has(channel.id)) {
        try {
            await channel.guild.channels.create({
                name: channel.name,
                type: channel.type,
                parent: channel.parentId,
                topic: channel.topic,
                bitrate: channel.bitrate,
                userLimit: channel.userLimit,
                permissionOverwrites: channel.permissionOverwrites.cache,
                reason: 'Anti-Nuke: Restore protected channel.'
            });
        } catch (e) { console.error(e); }
    }
});

client.on('channelUpdate', async (oldChannel, newChannel) => {
    try {
        const fetchedLogs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        const executorMember = await newChannel.guild.members.fetch(auditLog.executor.id);
        await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache);
        await punishMember(executorMember, 'Anti-Nuke: Modified channel permissions.');
    } catch (e) { console.error(e); }
});

// ==================== [ 3. حماية الرولات والتحكم بها ] ====================
client.on('roleCreate', async (role) => {
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        await role.delete('Anti-Nuke');
        const member = await role.guild.members.fetch(auditLog.executor.id);
        await punishMember(member, 'Anti-Nuke: Created role.');
    } catch (e) { console.error(e); }
});

client.on('roleDelete', async (role) => {
    try {
        const roleAge = Date.now() - role.createdTimestamp;
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        if (roleAge >= 24 * 60 * 60 * 1000) {
            await role.guild.roles.create({
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                position: role.position,
                permissions: role.permissions,
                mentionable: role.mentionable,
                reason: 'Anti-Nuke: Restoring deleted established role.'
            });
        }

        const member = await role.guild.members.fetch(auditLog.executor.id);
        await punishMember(member, 'Anti-Nuke: Deleted role.');
    } catch (e) { console.error(e); }
});

// ==================== [ حماية التايم أوت وإعطاء/سحب الرولات يدوياً ] ====================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // حماية التايم أوت (منع إعطائه من البروفايل أو بدون الصلاحية)
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const auditLog = fetchedLogs.entries.first();
        
        if (auditLog && !auditLog.executor.bot) {
            const executorId = auditLog.executor.id;
            const executorMember = await newMember.guild.members.fetch(executorId);

            if (!executorMember.roles.cache.has(TIMEOUT_ALLOWED_ROLE) || executorId === newMember.id) {
                try {
                    await newMember.timeout(null, 'Anti-Exploit');
                    await punishMember(executorMember, 'Anti-Nuke: Unauthorized timeout from profile.');
                } catch (e) { console.error(e); }
            }
        }
    }

    // حماية إعطاء أو سحب الرولات يدوياً
    const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
    const auditLog = fetchedLogs.entries.first();

    if (auditLog && !auditLog.executor.bot) {
        const { executor, target } = auditLog;
        if (target.id === newMember.id) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            const executorMember = await newMember.guild.members.fetch(executor.id);

            if (addedRoles.size > 0) {
                for (const [roleId] of addedRoles) {
                    try {
                        await newMember.roles.remove(roleId);
                        await punishMember(executorMember, 'Anti-Nuke: Added role manually without command.');
                    } catch (e) { console.error(e); }
                }
            }

            if (removedRoles.size > 0) {
                for (const [roleId] of removedRoles) {
                    try {
                        await newMember.roles.add(roleId);
                        await punishMember(executorMember, 'Anti-Nuke: Removed role from member manually.');
                    } catch (e) { console.error(e); }
                }
            }
        }
    }
});

// ==================== [ حماية الباندات (تنتيل رول الباند + فحص أقل من 30 دقيقة) ] ====================
client.on('guildBanAdd', async (ban) => {
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        const executorId = auditLog.executor.id;
        const executorMember = await ban.guild.members.fetch(executorId);

        if (!executorMember.roles.cache.has(BAN_ALLOWED_ROLE)) {
            await ban.guild.members.unban(ban.user.id, 'Anti-Exploit');
            await punishMember(executorMember, 'Anti-Nuke: Unauthorized ban.');
            return;
        }

        await punishMember(executorMember, 'Anti-Nuke: Executed a ban.');

        const now = Date.now();
        if (!banTracker.has(executorId)) {
            banTracker.set(executorId, []);
        }
        
        let timestamps = banTracker.get(executorId);
        timestamps = timestamps.filter(t => now - t < 30 * 60 * 1000);
        timestamps.push(now);
        banTracker.set(executorId, timestamps);

        if (timestamps.length >= 2) {
            await punishMember(executorMember, 'Anti-Nuke: Banned multiple users in under 30 minutes.');
        }
    } catch (e) { console.error(e); }
});

client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.ban({ reason: 'Anti-Bot' });
            const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.executor && !auditLog.executor.bot) {
                const inviter = await member.guild.members.fetch(auditLog.executor.id);
                await punishMember(inviter, 'Anti-Nuke: Added unauthorized bot.');
            }
        } catch (e) { console.error(e); }
    }
});

// ==================== [ 4. الأوامر الكتابية وحماية الرومات الثلاثة وأمر "سحب رول" ] ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    if (!member) return;

    if (STRICT_CHAT_CHANNELS.includes(message.channel.id)) {
        if (!member.roles.cache.has(STRICT_CHAT_ROLE)) {
            try {
                await message.delete();
                await punishMember(member, 'Anti-Nuke: Unauthorized speaking in protected chat.');
                return;
            } catch (e) { console.error(e); }
        }
    }

    if (message.content.startsWith('سحب رول')) {
        let targetMember = message.mentions.members.first();
        
        if (!targetMember && message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                targetMember = await message.guild.members.fetch(repliedMessage.author.id);
            } catch (err) {}
        }

        if (targetMember) {
            const fullContent = message.content.slice(7).trim();
            const cleanQuery = fullContent.replace(/<@!?\d+>/g, '').replace(/;/g, '').trim().toLowerCase();

            if (cleanQuery) {
                const foundRole = message.guild.roles.cache.find(r => {
                    const rName = r.name.toLowerCase().replace(/;/g, '').trim();
                    return rName === cleanQuery || rName.includes(cleanQuery);
                });

                if (foundRole && targetMember.roles.cache.has(foundRole.id)) {
                    try {
                        await targetMember.roles.remove(foundRole);
                        await message.react('✅');
                        return;
                    } catch (e) { console.error(e); }
                } else {
                    await message.react('❌');
                    return;
                }
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
