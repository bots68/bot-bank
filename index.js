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

// دالة لتنفيذ العقوبة (مخالفة وترو / إعطاء شنب أو سحب صلاحيات حظر مؤقت ليكون بمثابة طرد/عقوبة قوية)
async function punishUser(guild, member, reason) {
    if (!member || WHITELIST_IDS.includes(member.id) || member.id === guild.ownerId) return;
    try {
        // إعطاء رول عقوبة (تأكد من إزالة الصلاحيات الخطيرة عنه أو عمل Timeout)
        await member.timeout(10 * 60 * 1000, reason).catch(() => {});
        // أو طرد مؤقت
        // await member.kick(reason).catch(() => {});
    } catch (e) {}
}

client.on('ready', () => {
    console.log(`Security Bot logged in as ${client.user.tag}! Protection system is active.`);
});

// 1 & 3 & 10. حماية الرولات (منع إعطاء رولات حساسة من البروفايل، منع إنشاء أو حذف رولات نهائياً)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const guild = newMember.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
    const auditLog = fetchedLogs.entries.first();
    
    if (!auditLog) return;
    const { executor, target } = auditLog;
    
    if (target.id === newMember.id && executor && !WHITELIST_IDS.includes(executor.id)) {
        // فحص من أعطى رول بطريقة غير نظامية (من البروفايل)
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        
        for (const role of newRoles.values()) {
            if (!oldRoles.has(role.id)) {
                // شخص حاول إعطاء رول من البروفايل مباشرة
                // نسحب الرول فوراً من العضو المستهدف
                await newMember.roles.remove(role.id).catch(() => {});
                
                // نعاقب الشخص الي حاول يترول ويعطي الرول
                const executorMember = await guild.members.fetch(executor.id).catch(() => {});
                if (executorMember) {
                    await punishUser(guild, executorMember, 'محاولة إعطاء رول بطريقة غير نظامية من البروفايل');
                }
            }
        }
    }
});

// منع إنشاء أو حذف الرولات نهائياً إلا عبر نظام محمي (أو منع تام)
client.on('roleCreate', async (role) => {
    const guild = role.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        // حذف الرول المحدث فوراً
        await role.delete('حظر إنشاء الرولات عشوائياً').catch(() => {});
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

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة حذف رول');
        // ملاحظة: ديسكورد لا يدعم استرجاع الرول المحذوف تلقائياً بالكامل بنفس الأيدي، لكن يتم معاقبة الفاعل فوراً.
    }
});

// 4 & 5 & 6. حماية الرومات (منع إنشاء رومات، منع حذف رومات واسترجاعها، منع تعديل الصلاحيات)
client.on('channelCreate', async (channel) => {
    const guild = channel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor }  = auditLog;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        // حذف الروم المحدث فوراً
        await channel.delete('حظر إنشاء الرومات العشوائية').catch(() => {});
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة إنشاء روم');
    }
});

// استرجاع الروم المحذوف بكافة بياناته ورسائله (إن أمكن عبر النسخ الاحتياطي أو منع الحذف المباشر عبر الصلاحيات، ولحماية الحذف يتم رصد الحدث ومعاقبة الفاعل)
client.on('channelDelete', async (channel) => {
    const guild = channel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        const executorMember = await guild.members.fetch(executor.id).catch(() => {});
        if (executorMember) await punishUser(guild, executorMember, 'محاولة حذف روم');
        
        // إعادة إنشاء روم نفس الاسم والصلاحيات والنوع لحماية الهيكل
        try {
            await guild.channels.create({
                name: channel.name,
                type: channel.type,
                parent: channel.parentId,
                permissionOverwrites: channel.permissionOverwrites.cache.map(p => ({
                    id: p.id,
                    allow: p.allow,
                    deny: p.deny
                }))
            });
        } catch (e) {}
    }
});

// 7. حماية تعديل صلاحيات الرومات (إذا حاول تعديل صلاحية روم وسيف، ترجع الصلاحيات القديمة ويتم معاقبته)
client.on('channelUpdate', async (oldChannel, newChannel) => {
    const guild = newChannel.guild;
    const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelUpdate });
    const auditLog = fetchedLogs.entries.first();
    if (!auditLog) return;
    const { executor } = auditLog;

    if (executor && !WHITELIST_IDS.includes(executor.id)) {
        // إعادة الصلاحيات القديمة فوراً
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

// 8. منع دخول أي بوت جديد وطرده فوراً
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        try {
            await member.kick('حظر دخول أي بوت جديد غير مصرح به تلقائياً');
        } catch (e) {}
    }
});

client.login(process.env.TOKEN);
