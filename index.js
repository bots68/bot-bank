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
const BAN_ALLOWED_ROLE = '1535522481719349249'; // الرول المسموح له بالباند

// الـ 26 روم المحمية بالكامل
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

// إعدادات رومات الكلام المخصصة (الروم المطلوب قفله يتبع للمجموعة الأولى برول العقوبة/أو الرول المحدد)
const CHANNEL_PERMISSIONS_CONFIG = {
    group1: { 
        channels: ['1535489711420735549', '1535426951333027972', '1535490093358252074'], 
        allowedRole: PUNISHMENT_ROLE_ID // الرول المسموح له بالكتابة هنا
    },
    group2: { channels: ['1535495503414825061', '1535495713473962024', '1535495916428206100'], allowedRole: '1537103042371919942' },
    group3: { channels: ['1535495952994009180'], allowedRole: '1535845072690741360' },
    group4: { channels: ['1535495994186137610'], allowedRoles: ['1535856845330194432', '1535774790357614652'] },
    group5: { channels: ['1536977594702888960', '1537003891286347828', '1537032400561905674'], allowedRole: '1535375782736560128' }
};

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
        await member.roles.add(PUNISHMENT_ROLE_ID);
    } catch (e) { console.error(e); }
});

// ==================== [ 2. حماية الرولات ] ====================
client.on('roleCreate', async (role) => {
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        await role.delete('Anti-Nuke');
        const member = await role.guild.members.fetch(auditLog.executor.id);
        await member.roles.add(PUNISHMENT_ROLE_ID);
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
        await member.roles.add(PUNISHMENT_ROLE_ID);
    } catch (e) { console.error(e); }
});

// ==================== [ 3. الحماية الشاملة للبوتات، التايم أوت، الباند، والرولات الخارجية ] ====================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.ban({ reason: 'Anti-Bot' });
            const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.executor && !auditLog.executor.bot) {
                const inviter = await member.guild.members.fetch(auditLog.executor.id);
                await inviter.roles.add(PUNISHMENT_ROLE_ID);
            }
        } catch (e) { console.error(e); }
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const auditLog = fetchedLogs.entries.first();
        
        if (auditLog && !auditLog.executor.bot) {
            const executorId = auditLog.executor.id;
            const executorMember = await newMember.guild.members.fetch(executorId);

            if (!executorMember.roles.cache.has(TIMEOUT_ALLOWED_ROLE) || executorId === newMember.id) {
                try {
                    await newMember.timeout(null, 'Anti-Exploit: Removing unauthorized timeout.');
                    await executorMember.roles.add(PUNISHMENT_ROLE_ID);
                } catch (e) { console.error(e); }
            }
        }
    }

    const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
    const auditLog = fetchedLogs.entries.first();

    if (auditLog && !auditLog.executor.bot) {
        const { executor, target } = auditLog;
        if (target.id === newMember.id) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            if (addedRoles.size > 0) {
                for (const [roleId] of addedRoles) {
                    try {
                        await newMember.roles.remove(roleId);
                        const executorMember = await newMember.guild.members.fetch(executor.id);
                        await executorMember.roles.add(PUNISHMENT_ROLE_ID);
                    } catch (e) { console.error(e); }
                }
            }

            if (removedRoles.size > 0) {
                for (const [roleId] of removedRoles) {
                    try {
                        await newMember.roles.add(roleId);
                        const executorMember = await newMember.guild.members.fetch(executor.id);
                        await executorMember.roles.add(PUNISHMENT_ROLE_ID);
                    } catch (e) { console.error(e); }
                }
            }
        }
    }
});

client.on('guildBanAdd', async (ban) => {
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        const executorMember = await ban.guild.members.fetch(auditLog.executor.id);
        if (!executorMember.roles.cache.has(BAN_ALLOWED_ROLE)) {
            await ban.guild.members.unban(ban.user.id, 'Anti-Exploit');
            await executorMember.roles.add(PUNISHMENT_ROLE_ID);
        }
    } catch (e) { console.error(e); }
});

// ==================== [ 4. حماية الرومات وصلاحياتها ] ====================
client.on('channelUpdate', async (oldChannel, newChannel) => {
    try {
        const fetchedLogs = await newChannel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog || auditLog.executor.bot) return;

        const executorMember = await newChannel.guild.members.fetch(auditLog.executor.id);
        await newChannel.permissionOverwrites.set(oldChannel.permissionOverwrites.cache);
        await executorMember.roles.add(PUNISHMENT_ROLE_ID);
    } catch (e) { console.error(e); }
});

client.on('channelDelete', async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const auditLog = fetchedLogs.entries.first();
        if (auditLog && !auditLog.executor.bot) {
            const member = await channel.guild.members.fetch(auditLog.executor.id);
            await member.roles.add(PUNISHMENT_ROLE_ID);
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

// ==================== [ 5. الأوامر الكتابية وأمر "سحب رول" المطور ] ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    if (!member) return;

    // أمر سحب رول (معالجة ذكية للأسماء التي تحتوي على رموز مثل ; أو مسافات)
    if (message.content.startsWith('سحب رول')) {
        let targetMember = message.mentions.members.first();
        
        if (!targetMember && message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                targetMember = await message.guild.members.fetch(repliedMessage.author.id);
            } catch (err) {}
        }

        if (targetMember) {
            const fullContent = message.content.slice(7).trim(); // إزالة كلمة "سحب رول"
            // استخراج اسم الرول المتواجد بغض النظر عن المنشن والرموز مثل ;
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

    // مراقبة الرومات المخصصة (بما فيها روم 1535426951333027972) وحذف رسالة المخالف وتنتيله برول 1537101884710592626
    for (const key in CHANNEL_PERMISSIONS_CONFIG) {
        const config = CHANNEL_PERMISSIONS_CONFIG[key];
        if (config.channels.includes(message.channel.id)) {
            let hasPermission = config.allowedRole ? member.roles.cache.has(config.allowedRole) : config.allowedRoles.some(r => member.roles.cache.has(r));
            if (!hasPermission) {
                try {
                    await message.delete();
                    await member.roles.add(PUNISHMENT_ROLE_ID);
                } catch (e) { console.error(e); }
                break;
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
