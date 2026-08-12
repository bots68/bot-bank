const { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// قائمة الأيدي المستثناة (الإداريين الكبار أو المطور) لتجنب معاقبتهم بالخطأ
const WHITELIST_IDS = ['YOUR_ID_HERE'];

// ذاكرة مؤقتة لتخزين رسائل الرومات لضمان إرجاعها عند الحذف الطارئ
const messageCache = new Map();

client.on('messageCreate', (message) => {
    if (!message.guild || message.author.bot) return;
    if (!messageCache.has(message.channelId)) {
        messageCache.set(message.channelId, []);
    }
    const channelMessages = messageCache.get(message.channelId);
    channelMessages.push({ content: message.content, author: message.author.tag });
    if (channelMessages.length > 50) channelMessages.shift(); // الاحتفاظ بآخر 50 رسالة لكل روم
});

// دالة لتنفيذ العقوبة (تايم آوت لمنع التخريب)
async function punishUser(guild, member, reason) {
    if (!member || WHITELIST_IDS.includes(member.id) || member.id === guild.ownerId) return;
    try {
        await member.timeout(15 * 60 * 1000, reason).catch(() => {});
    } catch (e) {}
}

client.on('ready', () => {
    console.log(`Security Bot logged in as ${client.user.tag}! Full Loop-Free Protection System is active.`);
});

// 1. حماية الرولات (منع إعطاء رولات من البروفايل، منع إنشاء أو حذف رولات)
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
                    await punishUser(guild, executorMember, 'محاولة إعطاء رول بطريقة غير نظامية');
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

// 2. حماية إنشاء الرومات: يحذف الروم المضاف فوراً ولا يعيد إنشائه، مع معاقبة الفاعل
client.on('channelCreate', async (channel) => {
    const guild = channel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    // تجاهل إذا كان البوت هو من قام بإنشاء الروم (أثناء عملية الاسترجاع)
    if (executor && executor.id === client.user.id) return;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        await channel.delete('حظر إنشاء الرومات العشوائية').catch(() => {});
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) {
            await punishUser(guild, executorMember, 'محاولة إنشاء روم غير مسموح به');
        }
    }
});

// 3. حماية حذف الرومات: يرجع الروم المحذوف فوراً بنفس الثانية وبنفس الإعدادات ورسائله، ومعاقبة الفاعل
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

        // استرجاع الروم فوراً بنفس الاسم والنوع والصلاحيات والمكان
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

            // إعادة إرسال الرسائل السابقة للروم إن وجدت في الذاكرة المؤقتة
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
});

// 4. حماية تعديل صلاحيات الرومات (إذا حاول تعديل صلاحية روم، ترجع الصلاحيات ويترول)
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
