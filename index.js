const { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } = require('discord.js');

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

// قائمة الأيدي المستثناة (الإداريين الكبار أو المطور) لتجنب معاقبتهم بالخطأ
const WHITELIST_IDS = ['YOUR_ID_HERE'];

// أيدي الرومات الصوتية الـ 26 المحددة التي إذا انحذفت ترجع، وباقي الرومات تحذف نهائياً
const PROTECTED_VOICE_CHANNELS = [
    '1535489711420735549', '1535426951333027972', '1535490093358252074', '1535375475289890879',
    '1535406298781192292', '1535490327610400810', '1535490429724921986', '1535496283115225208',
    '1535879098445078528', '1535880789114486834', '1535491432230555678', '1535491143897325578',
    '1536659884420890724', '1536693109662949406', '1536689417136119888', '1535495503414825061',
    '1535495713473962024', '1535495916428206100', '1535495952994009180', '1535495994186137610',
    '1535822130342658118', '1535821718751289354', '1535496238307213352', '1536977594702888960',
    '1537003891286347828', '1537032400561905674'
];

// ذاكرة مؤقتة لتخزين رسائل الرومات المحمية
const messageCache = new Map();

client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    // تخزين الرسائل للرومات المحمية فقط لاسترجاعها عند الحذف الخطأ
    if (PROTECTED_VOICE_CHANNELS.includes(message.channelId)) {
        if (!messageCache.has(message.channelId)) {
            messageCache.set(message.channelId, []);
        }
        const channelMessages = messageCache.get(message.channelId);
        channelMessages.push({ content: message.content, author: message.author.tag });
        if (channelMessages.length > 50) channelMessages.shift();
    }
    // ملاحظة: تم إلغاء قيود الشات بالكامل بناءً على طلبك لتعمل أوامر البوتات (رول، سحب رول، قفل، فتح، وغيرها) بحرية تامة دون تدخل بوت الحماية.
});

async function punishUser(guild, member, reason) {
    if (!member || WHITELIST_IDS.includes(member.id) || member.id === guild.ownerId) return;
    try {
        await member.timeout(15 * 60 * 1000, reason).catch(() => {});
    } catch (e) {}
}

client.on('ready', () => {
    console.log(`Security Bot logged in as ${client.user.tag}! Clean Profile & Channel Protection System is active.`);
});

// نظام إنشاء روم صوتي تلقائي عند دخول الروم (1536689417136119888) بحيث يوضع الروم الجديد في الشانل/الكاتيجوري (1535491760627646524)
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channelId === '1536689417136119888') {
        const guild = newState.guild;
        const member = newState.member;
        if (!member) return;

        try {
            const targetParent = '1535491760627646524';
            const parentChannel = guild.channels.cache.get(targetParent);
            let categoryId = null;
            if (parentChannel) {
                if (parentChannel.type === 4) { // GuildCategory
                    categoryId = parentChannel.id;
                } else {
                    categoryId = parentChannel.parentId;
                }
            }

            const createdChannel = await guild.channels.create({
                name: `${member.user.username}`,
                type: 2, // GuildVoice
                parent: categoryId,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers]
                    }
                ]
            });

            await member.voice.setChannel(createdChannel).catch(() => {});
        } catch (e) {}
    }
});

// 1. حماية الرولات من البروفايل / البايو (Manag Roles) فقط
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const guild = newMember.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
    const auditLog = fetchedLogs.entries.first();
    
    if (!auditLog) return;
    const { executor, target } = auditLog;
    if (executor && executor.id === client.user.id) return;
    
    if (target.id === newMember.id && executor && !WHITELIST_IDS.includes(executor.id)) {
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        
        for (const role of newRoles.values()) {
            if (!oldRoles.has(role.id)) {
                await newMember.roles.remove(role.id).catch(() => {});
                const executorMember = await guild.members.fetch(executor.id).catch(() => {});
                if (executorMember) {
                    await punishUser(guild, executorMember, 'محاولة إعطاء رول بطريقة غير نظامية من البايو');
                }
            }
        }
    }
});

client.on('roleCreate', async (role) => {
    const guild = role.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;
    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        await role.delete('حظر إنشاء الرولات').catch(() => {});
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة إنشاء رول');
    }
});

client.on('roleDelete', async (role) => {
    const guild = role.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;
    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة حذف رول');
    }
});

// 2. حماية إنشاء الرومات: حذف الروم فوراً ومعاقبة الفاعل
client.on('channelCreate', async (channel) => {
    const guild = channel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        await channel.delete('حظر إنشاء الرومات العشوائية').catch(() => {});
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) {
            await punishUser(guild, executorMember, 'محاولة إنشاء روم غير مسموح به');
        }
    }
});

// 3. حماية حذف الرومات: الرومات الـ 26 المحددة ترجع برسائلها، والباقي يحذف نهائياً مع معاقبة الفاعل
client.on('channelDelete', async (channel) => {
    const guild = channel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) {
            await punishUser(guild, executorMember, 'محاولة حذف روم');
        }

        // إذا كان الروم المحذوف ضمن الرومات الـ 26 المحمية -> يرجع بكامل بياناته ورسائله
        if (PROTECTED_VOICE_CHANNELS.includes(channel.id)) {
            try {
                const restoredChannel = await guild.channels.create({
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parentId,
                    position: channel.position,
                    topic: channel.topic,
                    rateLimitPerUser: channel.rateLimitPerUser,
                    nsfw: channel.nsfw,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(p => ({
                        id: p.id,
                        allow: p.allow,
                        deny: p.deny
                    }))
                });

                const cachedMsgs = messageCache.get(channel.id);
                if (cachedMsgs && cachedMsgs.length > 0) {
                    setTimeout(async () => {
                        for (const msg of cachedMsgs) {
                            await restoredChannel.send(`[استرجاع رسالة سابقة] **${msg.author}**: ${msg.content}`).catch(() => {});
                        }
                    }, 1000);
                }
            } catch (e) {}
        }
    }
});

// 4. حماية تعديل صلاحيات الرومات: إعادة الصلاحيات القديمة ومعاقبة الفاعل فوراً
client.on('channelUpdate', async (oldChannel, newChannel) => {
    const guild = newChannel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;
    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        try {
            await newChannel.edit({
                permissionOverwrites: oldChannel.permissionOverwrites.cache.map(p => ({
                    id: p.id,
                    allow: p.allow,
                    deny: p.deny
                }))
            });
        } catch (e) {}

        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة التعديل على صلاحيات الرومات');
    }
});

// 5. منع دخول أي بوت جديد وطرده فوراً
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.kick('حظر دخول أي بوت جديد غير مصرح به');
        } catch (e) {}
    }
});

client.login(process.env.TOKEN);
