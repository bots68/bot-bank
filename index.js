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
const PUNISHMENT_ROLE_ID = '1537101884710592626'; // رول العقوبة / التنتيل العام

// قائمة الرومات الصوتية والرومات الأخرى المحمية التي يجب أن تعود إذا انحذفت
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

// إعدادات الأذونات والكتابة في الرومات المحددة
const CHANNEL_PERMISSIONS_CONFIG = {
    group1: {
        channels: ['1535489711420735549', '1535426951333027972', '1535490093358252074'],
        allowedRole: '1537101884710592626'
    },
    group2: {
        channels: ['1535495503414825061', '1535495713473962024', '1535495916428206100'],
        allowedRole: '1537103042371919942'
    },
    group3: {
        channels: ['1535495952994009180'],
        allowedRole: '1535845072690741360'
    },
    group4: {
        channels: ['1535495994186137610'],
        allowedRoles: ['1535856845330194432', '1535774790357614652']
    },
    group5: {
        channels: ['1536977594702888960', '1537003891286347828', '1537032400561905674'],
        allowedRole: '1535375782736560128'
    }
};

client.once('ready', () => {
    console.log(`[SECURE BOT ACTIVE] Logged in as ${client.user.tag}`);
});

// ==================== [ 1. الحماية من إنشاء الويب هوك (Webhooks) ] ====================
client.on('webhookUpdate', async (channel) => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.WebhookCreate,
        });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog) return;

        const { executor } = auditLog;
        if (executor.bot) return;

        const webhooks = await channel.fetchWebhooks();
        for (const [, webhook] of webhooks) {
            await webhook.delete('Anti-Webhook: Webhook creation is strictly prohibited.');
        }

        const member = await channel.guild.members.fetch(executor.id);
        await member.roles.add(PUNISHMENT_ROLE_ID);
        console.log(`[WEBHOOK BLOCKED] Deleted webhook created by ${executor.tag} and punished.`);
    } catch (e) {
        console.error('[WEBHOOK ERROR]', e);
    }
});

// ==================== [ 2. الحماية من إنشاء رولات جديدة ] ====================
client.on('roleCreate', async (role) => {
    try {
        const fetchedLogs = await role.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleCreate,
        });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog) return;

        const { executor } = auditLog;
        if (executor.bot) return;

        await role.delete('Anti-Nuke: Unauthorized role creation blocked.');

        const member = await role.guild.members.fetch(executor.id);
        await member.roles.add(PUNISHMENT_ROLE_ID);
        console.log(`[ROLE CREATE BLOCKED] Deleted new role created by ${executor.tag} and punished.`);
    } catch (e) {
        console.error('[ROLE CREATE ERROR]', e);
    }
});

// ==================== [ 3. الحماية من حذف رولات قديمة (مر عليها أكثر من يوم واحد) ] ====================
client.on('roleDelete', async (role) => {
    try {
        const roleCreationTime = role.createdTimestamp;
        const currentTime = Date.now();
        const oneDayInMs = 24 * 60 * 60 * 1000;

        if ((currentTime - roleCreationTime) < oneDayInMs) {
            return;
        }

        const fetchedLogs = await role.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.RoleDelete,
        });
        const auditLog = fetchedLogs.entries.first();
        if (!auditLog) return;

        const { executor } = auditLog;
        if (executor.bot) return;

        await role.guild.roles.create({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            position: role.position,
            permissions: role.permissions,
            mentionable: role.mentionable,
            reason: 'Anti-Nuke: Restoring deleted old/established role automatically.'
        });

        const member = await role.guild.members.fetch(executor.id);
        await member.roles.add(PUNISHMENT_ROLE_ID);
        console.log(`[ROLE DELETE BLOCKED] Restored deleted old role: ${role.name} and punished ${executor.tag}`);
    } catch (e) {
        console.error('[ROLE DELETE ERROR]', e);
    }
});

// ==================== [ 4. الحماية من دخول أي بوت غريب ] ====================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.ban({ reason: 'Anti-Bot: Unauthorized bot detected entering the server.' });
            console.log(`[ANTI-BOT] Banned unauthorized bot: ${member.user.tag}`);
        } catch (error) {
            console.error(`[ANTI-BOT ERROR] Could not ban bot:`, error);
        }
    }
});

// ==================== [ 5. مراقبة التلاعب بالرولات عبر البايو/البروفايل (مع استثناء الأوامر اليدوية) ] ====================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const fetchedLogs = await newMember.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberRoleUpdate,
    });
    const auditLog = fetchedLogs.entries.first();
    
    // التحقق عما إذا كان التعديل تم عبر الواجهة الخارجية (Profile / Bio) وليس عبر بوت أو أمر شات معتمد
    if (auditLog) {
        const { executor, target } = auditLog;
        
        // إذا قام الشخص بتعديل رولات نفسه أو استخدام ثغرة البروفايل لتغيير الرولات
        if (target.id === newMember.id && !executor.bot) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            // إذا أضاف رول عبر البايو/البروفايل
            if (addedRoles.size > 0) {
                for (const [roleId] of addedRoles) {
                    try {
                        await newMember.roles.remove(roleId);
                        await newMember.roles.add(PUNISHMENT_ROLE_ID);
                        console.log(`[BIO ROLE EXPLOIT BLOCKED] Removed unauthorized role and punished ${newMember.user.tag}`);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            // إذا سحب رول عبر البايو/البروفايل (نسترجعه وننتله)
            if (removedRoles.size > 0) {
                for (const [roleId] of removedRoles) {
                    try {
                        await newMember.roles.add(roleId);
                        await newMember.roles.add(PUNISHMENT_ROLE_ID);
                        console.log(`[BIO ROLE REMOVE EXPLOIT] Restored removed role and punished ${newMember.user.tag}`);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
    }
});

// ==================== [ 6. مراقبة التايم أوت (منع ثغرات البايو والسماح للأوامر اليدوية) ] ====================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberUpdate,
        });
        const auditLog = fetchedLogs.entries.first();
        
        // إذا قام الشخص بعمل تايم أوت لنفسه أو من البايو (وليس عبر أمر بوت معتمد في الشات)
        if (auditLog && auditLog.executor.id === newMember.id) {
            try {
                await newMember.timeout(null, 'Anti-Exploit: Removing unauthorized self/bio timeout.');
                await newMember.roles.add(PUNISHMENT_ROLE_ID);
                console.log(`[TIMEOUT EXPLOIT] Punished ${newMember.user.tag} for bio/unauthorized timeout.`);
            } catch (e) {
                console.error(e);
            }
        }
    }
});

// ==================== [ 7. مراقبة إنشاء الرومات وحذفها (Anti-Nuke & Temp Channels) ] ====================
client.on('channelCreate', async (channel) => {
    const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate,
    });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;

    const { executor } = auditLog;
    if (executor.bot) return;

    const TEMP_CREATOR_TRIGGER = '1535491760627646524';
    
    try {
        const member = await channel.guild.members.fetch(executor.id);
        if (channel.parentId !== TEMP_CREATOR_TRIGGER && channel.id !== '1535491760627646524') {
            await channel.delete('Anti-Nuke: Unauthorized channel creation.');
            await member.roles.add(PUNISHMENT_ROLE_ID);
            console.log(`[CHANNEL CREATION BLOCKED] Deleted channel created by ${executor.tag} and punished.`);
        }
    } catch (e) {
        console.error(e);
    }
});

client.on('channelDelete', async (channel) => {
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
                reason: 'Anti-Nuke: Protected channel restored automatically.'
            });
            console.log(`[CHANNEL RESTORED] Successfully restored protected channel: ${channel.name}`);
        } catch (e) {
            console.error(`[RESTORE ERROR] Failed to restore channel:`, e);
        }
    }
});

// ==================== [ 8. مراقبة الرسائل والصلاحيات الصارمة في الرومات ] ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    if (!member) return;

    for (const key in CHANNEL_PERMISSIONS_CONFIG) {
        const config = CHANNEL_PERMISSIONS_CONFIG[key];
        
        if (config.channels.includes(message.channel.id)) {
            let hasPermission = false;

            if (config.allowedRole) {
                hasPermission = member.roles.cache.has(config.allowedRole);
            } else if (config.allowedRoles) {
                hasPermission = config.allowedRoles.some(roleId => member.roles.cache.has(roleId));
            }

            if (!hasPermission) {
                try {
                    await message.delete();
                    await member.roles.add(PUNISHMENT_ROLE_ID);
                    console.log(`[UNAUTHORIZED MESSAGE] Deleted message from ${member.user.tag} in protected room and punished.`);
                } catch (e) {
                    console.error(e);
                }
                break;
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
