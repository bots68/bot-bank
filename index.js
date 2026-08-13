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

// ==================== [ 4. الحماية الصارمة من دخول أي بوت (مع معاقبة من أضافه) ] ====================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.ban({ reason: 'Anti-Bot: Unauthorized bot detected entering the server.' });
            
            // جلب سجل التدقيق لمعرفة من قام بدعوة البوت وتنتيله
            const fetchedLogs = await member.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.BotAdd,
            });
            const auditLog = fetchedLogs.entries.first();
            if (auditLog && auditLog.executor && !auditLog.executor.bot) {
                const inviter = await member.guild.members.fetch(auditLog.executor.id);
                await inviter.roles.add(PUNISHMENT_ROLE_ID);
                console.log(`[ANTI-BOT] Banned bot ${member.user.tag} and punished inviter ${inviter.user.tag}`);
            }
        } catch (error) {
            console.error(`[ANTI-BOT ERROR] Could not ban bot:`, error);
        }
    }
});

// ==================== [ 5. مراقبة التلاعب بالرولات عبر البايو/البروفايل ] ====================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const fetchedLogs = await newMember.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberRoleUpdate,
    });
    const auditLog = fetchedLogs.entries.first();
    
    if (auditLog) {
        const { executor, target } = auditLog;
        
        if (target.id === newMember.id && !executor.bot) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

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

// ==================== [ 6. مراقبة التايم أوت (منع ثغرات البايو) ] ====================
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.MemberUpdate,
        });
        const auditLog = fetchedLogs.entries.first();
        
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

// ==================== [ 8. الأوامر الكتابية، أمر "سحب رول"، والصلاحيات في الرومات ] ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    if (!member) return;

    // دعم أمر "سحب رول [اسم أو أول حرفين]" بالمنشن أو الرد
    if (message.content.startsWith('سحب رول')) {
        let targetMember = message.mentions.members.first();
        
        // إذا كان رداً على رسالة شخص
        if (!targetMember && message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                targetMember = await message.guild.members.fetch(repliedMessage.author.id);
            } catch (err) {
                // تجاهل خطأ جلب الرسالة المردود عليها
            }
        }

        if (targetMember) {
            // استخراج اسم الرول أو الحروف المكتوبة بعد الأمر والمنشن
            const args = message.content.split(' ').slice(1);
            // تصفية الكلمات التي تحتوي على منشن لإبقاء اسم الرول/الحروف
            const roleQueryArgs = args.filter(arg => !arg.startsWith('<@'));
            const roleQuery = roleQueryArgs.join(' ').toLowerCase();

            if (roleQuery) {
                // البحث عن الرول بالبداية أو الاحتواء
                const foundRole = message.guild.roles.cache.find(r => 
                    r.name.toLowerCase().startsWith(roleQuery) || r.name.toLowerCase().includes(roleQuery)
                );

                if (foundRole && targetMember.roles.cache.has(foundRole.id)) {
                    try {
                        await targetMember.roles.remove(foundRole);
                        await message.react('✅');
                        console.log(`[ROLE REMOVED VIA COMMAND] Removed role ${foundRole.name} from ${targetMember.user.tag}`);
                        return;
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                    await message.react('❌');
                    return;
                }
            }
        }
    }

    // مراقبة الرومات المخصصة وحظر الكتابة لمن لا يملك الصلاحية (بدون إعطاء رولات)
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
