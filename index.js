const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

// قاعدة بيانات وهمية لتخزين أموال المستخدمين
const balances = new Map();

function getBalance(userId) {
    if (!balances.has(userId)) {
        balances.set(userId, 1000); // رصيد افتراضي للبداية
    }
    return balances.get(userId);
}

function setBalance(userId, amount) {
    balances.set(userId, Math.max(0, amount));
}

// دالة لتوليد رقم فيزا عشوائي
function generateRandomVisa() {
    const p1 = Math.floor(1000 + Math.random() * 9000);
    const p2 = Math.floor(10 + Math.random() * 90);
    const p3 = Math.floor(100 + Math.random() * 900);
    const p4 = Math.floor(1000 + Math.random() * 9000);
    const p5 = Math.floor(10 + Math.random() * 90);
    return `${p1} ${p2} ${p3} ${p4} ${p5}`;
}

// دالة لتنسيق الأموال (مثل 1M أو 759K)
function formatMoney(amount) {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`.replace('.0', '');
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
}

// دالة رسم صورة البنك (الفيزا)
async function createBankCard(user, amountText, subtitleText) {
    const canvas = createCanvas(1000, 450);
    const ctx = canvas.getContext('2d');

    // رسم خلفية كارد متدرجة وزرقاء
    ctx.fillStyle = '#4a7c9d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // إضافة تأثيرات بصرية دائرية في الزوايا (لإزالة البيضاوية الفجة)
    ctx.fillStyle = 'rgba(20, 50, 80, 0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, 200, 0, Math.PI * 2);
    ctx.arc(canvas.width, canvas.height, 250, 0, Math.PI * 2);
    ctx.fill();

    // خط الفاصل العلوي
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(60, 120);
    ctx.lineTo(940, 120);
    ctx.stroke();

    // شعار Ryth Bank في الأعلى اليسار
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Ryth Bank', 130, 80);

    // رسم أيقونة دائرية صغيرة للشعار
    ctx.save();
    ctx.beginPath();
    ctx.arc(80, 70, 30, 0, Math.PI * 2);
    ctx.clip();
    try {
        const logoImg = await loadImage('https://i.imgur.com/3YQ5p9o.png'); // رابط بديل مؤقت للشعار أو الشعار الدائري
        ctx.drawImage(logoImg, 50, 40, 60, 60);
    } catch (e) {
        ctx.fillStyle = '#222';
        ctx.fillRect(50, 40, 60, 60);
    }
    ctx.restore();

    // صورة المستخدم الكبيرة الدائرية في المنتصف
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    try {
        const avatar = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(500, 200, 45, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 455, 155, 90, 90);
        ctx.restore();
    } catch (e) {}

    // اسم المستخدم
    ctx.fillStyle = 'white';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(user.username, 500, 280);

    // المبلغ المالي باللون الأخضر
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 50px sans-serif';
    ctx.fillText(amountText, 500, 340);

    // النص السفلي
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(subtitleText, 500, 395);

    // كلمة VISA ورقم البطاقة في الأسفل
    ctx.textAlign = 'left';
    ctx.fillStyle = 'white';
    ctx.font.bold = true;
    ctx.font = 'italic 28px sans-serif';
    ctx.fillText('VISA', 60, 745 / 2);

    ctx.font = '24px monospace';
    ctx.fillText(generateRandomVisa(), 60, 850 / 2);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'bank-card.png' });
}

// دالة رسم مقارنة النرد (لعبة نرد)
async function createDiceCanvas(user, userDice, botDice, userAmountChange, botAmountChange) {
    const canvas = createCanvas(1000, 400);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#6b9ac4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // تغييرات الأموال فوق الأصور
    ctx.fillStyle = userAmountChange >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(userAmountChange >= 0 ? `+${formatMoney(userAmountChange)}` : formatMoney(userAmountChange), 250, 80);

    ctx.fillStyle = '#2ecc71';
    ctx.fillText(`+${formatMoney(botAmountChange)}`, 750, 80);

    // صورة المستخدم اليسرى (دائرية)
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    try {
        const avatar = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(200, 220, 75, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 125, 145, 150, 150);
        ctx.restore();
    } catch (e) {}

    // اسم المستخدم تحت الصورة
    ctx.fillStyle = 'white';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(user.username, 200, 330);

    // صورة البنك اليمين (دائرية)
    ctx.save();
    ctx.beginPath();
    ctx.arc(800, 220, 75, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#333';
    ctx.fillRect(725, 145, 150, 150);
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.fillText('Bank', 800, 330);

    // VS في المنتصف
    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('vs', 500, 230);

    return new AttachmentBuilder(canvas.toBuffer(), { name: 'dice-game.png' });
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const targetChannelId = '1535490476700995604';

    // 1. أمر إرسال رسالة ترحيبية أو تلقائية في الروم المحدد
    if (message.channel.id === targetChannelId && message.content === 'بدء') {
        return message.channel.send('مرحباً بك في نظام Ryth Bank المتطور!');
    }

    const args = message.content.split(' ');
    const command = args[0];
    const userId = message.author.id;
    let userBal = getBalance(userId);

    // 2. أمر: فلوسي
    if (command === 'فلوسي') {
        const formatted = formatMoney(userBal);
        const cardAttachment = await createBankCard(message.author, formatted, 'تم ايداع المبلغ في حسابك وانتبه لا يصيدك');
        return message.channel.send({ files: [cardAttachment] });
    }

    // 3. أمر: بخشيش
    if (command === 'بخشيش') {
        const tipAmount = Math.floor(1500 + Math.random() * (10000 - 1500 + 1));
        userBal += tipAmount;
        setBalance(userId, userBal);

        const formatted = formatMoney(userBal);
        const cardAttachment = await createBankCard(message.author, formatted, `مبروك حصلت على بخشيش بقيمة ${formatMoney(tipAmount)}`);
        return message.channel.send({ files: [cardAttachment] });
    }

    // 4. أمر: نهب @user
    if (command === 'نهب') {
        const targetMember = message.mentions.users.first();
        if (!targetMember || targetMember.id === userId) {
            return message.channel.send('يرجى منشن شخص صحيح لنهبه!');
        }

        const targetId = targetMember.id;
        const targetBal = getBalance(targetId);

        if (targetBal < 5000) {
            const lowCard = await createBankCard(targetMember, formatMoney(targetBal), 'ذا الشخص طفران مامعه 5000$');
            return message.channel.send({ files: [lowCard] });
        }

        // النهب الناجح (من 3% إلى 5% أو حتى 10% بالحظ)
        const percentage = Math.floor(3 + Math.random() * 8); // من 3 إلى 10
        const stolenAmount = Math.floor((targetBal * percentage) / 100);

        setBalance(targetId, targetBal - stolenAmount);
        setBalance(userId, getBalance(userId) + stolenAmount);

        const formattedNew = formatMoney(getBalance(userId));
        const successCard = await createBankCard(message.author, formattedNew, 'تمت عملية السرقة بنجاح وتم إضافتها لحسابك');
        
        // إرسال رسالة للخاص للمنهوب
        try {
            await targetMember.send(`الحق انسرقت واللي سرقك <@${userId}> واذا مو مصدق شيك على فلوسك <#1535490476700995604>`);
        } catch (err) {}

        return message.channel.send({ files: [successCard] });
    }

    // 5. أمر: نرد (نرد، نرد كل، نرد نص، نرد ربع، أو نرد [عدد])
    if (command === 'نرد') {
        let betAmount = 0;
        const subArg = args[1];

        if (!subArg || subArg === 'كل') {
            betAmount = userBal;
        } else if (subArg === 'نص') {
            betAmount = Math.floor(userBal / 2);
        } else if (subArg === 'ربع') {
            betAmount = Math.floor(userBal / 4);
        } else {
            const parsedNum = parseInt(subArg);
            if (!isNaN(parsedNum)) {
                betAmount = parsedNum;
            } else {
                betAmount = userBal; // الافتراضي كل
            }
        }

        if (betAmount <= 0 || userBal < betAmount) {
            return message.channel.send('فلوسك أقل ولا يمكنك المغامرة بهذا المبلغ!');
        }

        // رمي النرد عشوائياً (من 1 إلى 6)
        const userDiceNum = Math.floor(1 + Math.random() * 6);
        const botDiceNum = Math.floor(1 + Math.random() * 6);

        let netChange = 0;
        if (userDiceNum > botDiceNum) {
            // فوز اللاعب (دبل المبلغ أو نسبته حسب نوع الرهان)
            netChange = betAmount;
            userBal += betAmount;
        } else {
            // خسارة
            netChange = -betAmount;
            userBal -= betAmount;
        }
        setBalance(userId, userBal);

        // الانتظار ثوانٍ قليلة ثم إرسال النتيجة كصورة
        setTimeout(async () => {
            const diceAttachment = await createDiceCanvas(message.author, userDiceNum, botDiceNum, netChange, Math.abs(netChange));
            await message.channel.send({ files: [diceAttachment] });
        }, 2000);
    }
});

client.login(process.env.TOKEN);
