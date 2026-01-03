// 🚀 واتساب ماستر برو v4.0

import TelegramBot from 'node-telegram-bot-api';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

import { CONFIG, EMOJIS } from './config.js';
import { 
    db, initDatabase, getSetting, setSetting,
    getUser, createUser, isSubscribed, activateSubscription,
    getUserAccounts, canAddAccount, deleteAccount,
    getPlans, getPlan, getPaymentMethods, createPaymentRequest, getPendingRequests,
    getTemplates, getTemplate, createTemplate, updateTemplateUsage, deleteTemplate,
    getBlacklist, addToBlacklist, removeFromBlacklist, isBlacklisted,
    getScheduledMessages, createScheduledMessage, deleteScheduledMessage,
    getCampaigns, getCampaign, createCampaign, deleteCampaign,
    getAutoReplies, getAutoReply, createAutoReply, toggleAutoReply, deleteAutoReply,
    getContactLists, getContactList, createContactList, deleteContactList,
    saveVerifiedNumber, logMessage
} from './database/init.js';

import { 
    sessions, userStates, 
    startPairing, startQR, reconnect, loadAccounts,
    sendTextMessage, verifyNumbers
} from './handlers/whatsapp.js';

import { 
    startCampaign, pauseCampaign, resumeCampaign, cancelCampaign, 
    getCampaignReport, quickBroadcast 
} from './handlers/campaigns.js';

import { startScheduler, parseScheduleTime, formatScheduleTime } from './handlers/scheduler.js';

import { 
    extractNumbers, formatText, messageTemplates, 
    createProgressBar, formatDateShort, getTimeRemaining, chunk
} from './utils/helpers.js';

import * as KB from './utils/keyboards.js';

// تهيئة البوت
if (!fs.existsSync(CONFIG.ACCOUNTS_DIR)) {
    fs.mkdirSync(CONFIG.ACCOUNTS_DIR, { recursive: true });
}

initDatabase();

const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });

// ═══════════════════════════════════════════════════════════
// 📨 دالة إرسال إشعار للأدمن
// ═══════════════════════════════════════════════════════════
async function notifyAdmin(message) {
    try {
        await bot.sendMessage(CONFIG.ADMIN_ID, message, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('فشل إرسال إشعار للأدمن:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// 🎨 دالة تنسيق الرسائل بشكل احترافي
// ═══════════════════════════════════════════════════════════
function formatMessage(title, content, footer = null) {
    let msg = `❝ ${title} ❞\n\n${content}`;
    if (footer) msg += `\n\n💡 ${footer}`;
    return msg;
}

// ═══════════════════════════════════════════════════════════
// 🚀 بدء تشغيل البوت
// ═══════════════════════════════════════════════════════════
console.log(`🚀 ${CONFIG.BOT_NAME} v${CONFIG.BOT_VERSION}`);

// إرسال إشعار بدء التشغيل للأدمن
notifyAdmin(`
🟢 *تم تشغيل البوت بنجاح!*

🚀 ${CONFIG.BOT_NAME}
📦 الإصدار: ${CONFIG.BOT_VERSION}
⏰ وقت التشغيل: ${new Date().toLocaleString('ar-EG')}

✅ جميع الأنظمة تعمل بشكل طبيعي
`.trim());

// معالجة إيقاف البوت
process.on('SIGINT', async () => {
    await notifyAdmin(`
🔴 *تم إيقاف البوت*

⏰ وقت الإيقاف: ${new Date().toLocaleString('ar-EG')}
    `.trim());
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await notifyAdmin(`
🔴 *تم إيقاف البوت*

⏰ وقت الإيقاف: ${new Date().toLocaleString('ar-EG')}
    `.trim());
    process.exit(0);
});


// 🏠 أمر البداية


bot.onText(/\/start/, async (msg) => {
    const { id } = msg.from;
    const firstName = msg.from.first_name || 'صديقي';
    const username = msg.from.username || '';
    
    // التحقق إذا كان مستخدم جديد
    const existingUser = getUser(id);
    const isNewUser = !existingUser;
    
    // إنشاء/تحديث المستخدم
    createUser(id, username, firstName);
    
    // إشعار الأدمن بالمستخدم الجديد
    if (isNewUser && id !== CONFIG.ADMIN_ID) {
        const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
        
        await notifyAdmin(`
🆕 *مستخدم جديد!*

━━━━━━━━━━━━━━━━━━━━━
👤 *معلومات المستخدم:*
━━━━━━━━━━━━━━━━━━━━━
🆔 الآيدي: \`${id}\`
📛 الاسم: *${firstName}*
${username ? `📱 اليوزر: @${username}` : '📱 اليوزر: لا يوجد'}
━━━━━━━━━━━━━━━━━━━━━

📊 إجمالي المستخدمين الآن: *${totalUsers}*
⏰ ${new Date().toLocaleString('ar-EG')}
        `.trim());
    }

    if (id === CONFIG.ADMIN_ID) {
        const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
        const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_subscribed = 1").get().c;
        const accounts = getUserAccounts(id);
        const onlineAccounts = accounts.filter(a => sessions[a.phone]).length;
        
        await bot.sendMessage(msg.chat.id, `
❝ *لوحة تحكم الأدمن* ❞

👋 مرحباً *${firstName}*!

━━━━━━━━━━━━━━━━━━━━━
📊 *إحصائيات سريعة:*
━━━━━━━━━━━━━━━━━━━━━
👥 إجمالي المستخدمين ← *${totalUsers}*
✅ المشتركين النشطين ← *${activeUsers}*
📱 حساباتك المتصلة ← *${onlineAccounts}/${accounts.length}*
━━━━━━━━━━━━━━━━━━━━━

🚀 ${CONFIG.BOT_NAME}
📦 الإصدار: ${CONFIG.BOT_VERSION}

💡 *اختر من القائمة أدناه للبدء*
        `.trim(), { parse_mode: 'Markdown', ...KB.mainAdminKeyboard });
    } else if (isSubscribed(id)) {
        const user = getUser(id);
        const accounts = getUserAccounts(id);
        const onlineAccounts = accounts.filter(a => sessions[a.phone]).length;
        const remaining = getTimeRemaining(user.subscription_end);
        
        await bot.sendMessage(msg.chat.id, `
❝ *مرحباً بك ${firstName}!* ❞

━━━━━━━━━━━━━━━━━━━━━
📊 *معلومات حسابك:*
━━━━━━━━━━━━━━━━━━━━━
💎 الباقة ← *${user.subscription_type}*
📱 الحسابات ← *${onlineAccounts}🟢 / ${accounts.length} متصل*
📅 ينتهي في ← *${formatDateShort(user.subscription_end)}*
⏳ المتبقي ← *${remaining}*
━━━━━━━━━━━━━━━━━━━━━

💡 *اختر من القائمة أدناه للبدء*
        `.trim(), { parse_mode: 'Markdown', ...KB.mainUserKeyboard });
    } else {
        await bot.sendMessage(msg.chat.id, `
❝ *${CONFIG.BOT_NAME}* ❞

👋 أهلاً *${firstName}*!

🌟 *أقوى بوت لإدارة واتساب*

━━━━━━━━━━━━━━━━━━━━━
✨ *المميزات الرئيسية:*
━━━━━━━━━━━━━━━━━━━━━
📱 إدارة حسابات متعددة
📤 إرسال جماعي ذكي
📢 حملات تسويقية متقدمة
📝 قوالب رسائل جاهزة
📆 جدولة الرسائل
🤖 الرد التلقائي الذكي
📥 استخراج البيانات والأرقام
🔄 نقل الأعضاء بين المجموعات
🔍 فحص صحة الأرقام
📊 تقارير وإحصائيات مفصلة
━━━━━━━━━━━━━━━━━━━━━

💡 *اشترك الآن للاستمتاع بكل المميزات!*
        `.trim(), { parse_mode: 'Markdown', ...KB.subscribeKeyboard });
    }
});


// 🔘 معالج الأزرار


bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const msgId = q.message.message_id;
    const userId = q.from.id;
    const data = q.data;
    const firstName = q.from.first_name || 'صديقي';
    const isAdmin = userId === CONFIG.ADMIN_ID;
    const subscribed = isSubscribed(userId);

    try { await bot.answerCallbackQuery(q.id); } catch (e) {}

    try {
        // ═══════════════════════════════════════════════════════════
        // 🏠 القائمة الرئيسية
        // ═══════════════════════════════════════════════════════════
        
        if (data === 'main') {
            delete userStates[chatId];
            if (isAdmin) {
                await bot.editMessageText(`👑 *لوحة تحكم الأدمن*`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.mainAdminKeyboard
                });
            } else if (subscribed) {
                const user = getUser(userId);
                const accounts = getUserAccounts(userId);
                await bot.editMessageText(`
👋 *مرحباً ${firstName}!*

💎 ${user.subscription_type}
📱 ${accounts.length}/${user.max_accounts} حساب
📅 ينتهي: ${formatDateShort(user.subscription_end)}
                `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.mainUserKeyboard });
            } else {
                await bot.editMessageText(`👋 *${firstName}!*\n\n🚀 *${CONFIG.BOT_NAME}*`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.subscribeKeyboard
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // 💎 الاشتراك
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'subscribe') {
            const plans = getPlans();
            let txt = `💎 *اختر باقتك:*\n\n`;
            plans.forEach(p => {
                txt += `*${p.name}*\n`;
                txt += `💰 ${p.price} جنيه | ⏱ ${p.duration_days} يوم\n`;
                txt += `📱 ${p.max_accounts} حساب | 📨 ${p.max_messages > 99999 ? '∞' : p.max_messages}\n\n`;
            });
            
            await bot.editMessageText(txt.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.plansKeyboard(plans)
            });
        }

        else if (data.startsWith('plan_')) {
            const planId = parseInt(data.split('_')[1]);
            const plan = getPlan(planId);
            const methods = getPaymentMethods();
            userStates[chatId] = { action: 'select_payment', planId };
            
            await bot.editMessageText(`
📦 *${plan.name}*

💰 السعر: *${plan.price} جنيه*
⏱ المدة: ${plan.duration_days} يوم
📱 الحسابات: ${plan.max_accounts}
📨 الرسائل: ${plan.max_messages > 99999 ? '∞' : plan.max_messages}

💳 *اختر طريقة الدفع:*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.paymentMethodsKeyboard(methods, planId)
            });
        }

        else if (data.startsWith('pay_')) {
            const [_, methodId, planId] = data.split('_').map(Number);
            const method = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(methodId);
            const plan = getPlan(planId);
            userStates[chatId] = { action: 'waiting_screenshot', planId, methodId };
            
            await bot.editMessageText(`
💳 *تفاصيل الدفع*

📦 الباقة: *${plan.name}*
💰 المبلغ: *${plan.price} جنيه*

${method.name}
📱 الرقم: \`${method.number}\`

✅ *بعد التحويل:*
أرسل صورة (سكرين شوت) للإيصال
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        // ═══════════════════════════════════════════════════════════
        // 💎 اشتراكي
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'mysub') {
            if (!subscribed) {
                await bot.editMessageText('❌ *ليس لديك اشتراك نشط*', {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '💎 اشترك الآن', callback_data: 'subscribe' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            const user = getUser(userId);
            const accounts = getUserAccounts(userId);
            const remaining = getTimeRemaining(user.subscription_end);
            
            await bot.editMessageText(`
💎 *اشتراكك*

📦 الباقة: ${user.subscription_type}
📱 الحسابات: ${accounts.length}/${user.max_accounts}
📅 ينتهي: ${formatDateShort(user.subscription_end)}
⏳ المتبقي: ${remaining}
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '🔄 تجديد', callback_data: 'subscribe' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        // ═══════════════════════════════════════════════════════════
        // 📱 الحسابات
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'accounts') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً للوصول لهذه الميزة', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            const accounts = getUserAccounts(userId);
            const onlineCount = accounts.filter(a => sessions[a.phone]).length;
            const offlineCount = accounts.length - onlineCount;
            
            if (accounts.length === 0) {
                await bot.editMessageText(`
❝ *حسابات واتساب* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 لا توجد حسابات مربوطة
━━━━━━━━━━━━━━━━━━━━━

💡 *لماذا تربط حساب؟*
• إرسال رسائل جماعية
• استخراج أرقام من المجموعات
• نقل الأعضاء بين المجموعات
• الرد التلقائي على الرسائل

👇 اضغط لإضافة حساب جديد
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ إضافة حساب', callback_data: 'add_acc' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            
            await bot.editMessageText(`
❝ *حسابات واتساب* ❞

━━━━━━━━━━━━━━━━━━━━━
📊 *الإحصائيات:*
━━━━━━━━━━━━━━━━━━━━━
📱 إجمالي الحسابات: *${accounts.length}*
🟢 متصل: *${onlineCount}*
🔴 غير متصل: *${offlineCount}*
━━━━━━━━━━━━━━━━━━━━━

💡 اضغط على أي حساب لإدارته
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.accountsMenuKeyboard(accounts, sessions)
            });
        }

        else if (data === 'add_acc') {
            if (!canAddAccount(userId)) {
                await bot.answerCallbackQuery(q.id, { text: '❌ وصلت للحد الأقصى من الحسابات', show_alert: true });
                return;
            }
            await bot.editMessageText(`
❝ *إضافة حساب جديد* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *اختر طريقة الربط:*
━━━━━━━━━━━━━━━━━━━━━

🔢 *الربط بالكود (موصى به)*
• الأسرع والأسهل
• أدخل رقمك واحصل على كود
• أدخل الكود في واتساب

📷 *الربط بـ QR*
• الطريقة التقليدية
• امسح الكود من واتساب
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.addAccountKeyboard });
        }

        else if (data === 'pair') {
            userStates[chatId] = { action: 'phone', userId };
            await bot.editMessageText(`
❝ *الربط بالكود* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *أرسل رقم الهاتف:*
━━━━━━━━━━━━━━━━━━━━━

📝 *الصيغة المطلوبة:*
\`201234567890\`

⚠️ *ملاحظات:*
• بدون علامة +
• بدون مسافات
• مع كود الدولة

📌 *أمثلة:*
• مصر: \`201012345678\`
• السعودية: \`966512345678\`
• الإمارات: \`971501234567\`
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'qr') {
            userStates[chatId] = { action: 'qr', userId };
            await bot.deleteMessage(chatId, msgId).catch(() => {});
            await bot.sendMessage(chatId, '⏳ جاري إنشاء QR...', KB.cancelKeyboard);
            startQR(bot, chatId, userId);
        }

        else if (data.startsWith('acc_')) {
            const phone = data.split('_')[1];
            const isOnline = sessions[phone] ? true : false;
            await bot.editMessageText(`
📱 *${phone}*

الحالة: ${isOnline ? '🟢 متصل' : '🔴 غير متصل'}
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.accountActionsKeyboard(phone, isOnline)
            });
        }

        else if (data.startsWith('recon_')) {
            const phone = data.split('_')[1];
            await bot.editMessageText('⏳ جاري إعادة الاتصال...', { chat_id: chatId, message_id: msgId });
            await reconnect(bot, phone, chatId, userId);
        }

        else if (data.startsWith('del_')) {
            const phone = data.split('_')[1];
            if (sessions[phone]) {
                try { await sessions[phone].logout(); } catch (e) {}
                delete sessions[phone];
            }
            deleteAccount(phone);
            const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
            if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
            await bot.editMessageText('🗑️ تم حذف الحساب بنجاح', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        // ═══════════════════════════════════════════════════════════
        // 📤 الإرسال
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'send') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            await bot.editMessageText(`📤 *الإرسال*

📤 *فردي* - رسالة لرقم واحد
📢 *حملة* - إرسال جماعي متقدم`, { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.sendMenuKeyboard });
        }

        else if (data === 'single') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText('❌ لا توجد حسابات متصلة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            const btns = [];
            for (let i = 0; i < accounts.length; i += 2) {
                const row = [{ text: `📱 ${accounts[i].phone}`, callback_data: `from_${accounts[i].phone}` }];
                if (accounts[i + 1]) row.push({ text: `📱 ${accounts[i + 1].phone}`, callback_data: `from_${accounts[i + 1].phone}` });
                btns.push(row);
            }
            btns.push([{ text: '🔙 رجوع', callback_data: 'send' }]);
            
            await bot.editMessageText('📱 *اختر الحساب للإرسال منه:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('from_')) {
            const phone = data.split('_')[1];
            userStates[chatId] = { action: 'recipient', phone, userId };
            await bot.editMessageText(`
📤 *إرسال فردي*

📱 من: ${phone}

أرسل رقم المستلم:
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'broadcast') {
            await bot.editMessageText(`
📢 *إرسال جماعي*

📝 *يدوي* - أدخل الأرقام
📁 *ملف* - Excel/CSV/TXT
📇 *قائمة* - من قوائمك
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.broadcastMenuKeyboard });
        }

        else if (data === 'bc_manual') {
            userStates[chatId] = { action: 'bc_numbers', userId };
            await bot.editMessageText(`
📝 *أدخل الأرقام*

أرسل الأرقام (كل رقم بسطر):

\`201234567890\`
\`201234567891\`
\`201234567892\`
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'bc_file') {
            userStates[chatId] = { action: 'bc_file', userId };
            await bot.editMessageText(`
📁 *أرسل ملف*

الأنواع المدعومة:
• Excel (.xlsx)
• CSV (.csv)
• Text (.txt)
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'bc_list') {
            const lists = getContactLists(userId);
            if (lists.length === 0) {
                await bot.editMessageText('❌ لا توجد قوائم محفوظة', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ إنشاء قائمة', callback_data: 'new_list' }],
                        [{ text: '🔙 رجوع', callback_data: 'broadcast' }]
                    ]}
                });
                return;
            }
            
            const btns = lists.map(l => [{ text: `📇 ${l.name} (${l.count})`, callback_data: `use_list_${l.id}` }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'broadcast' }]);
            
            await bot.editMessageText('📇 *اختر قائمة:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('use_list_')) {
            const listId = parseInt(data.split('_')[2]);
            const list = getContactList(listId);
            if (!list) return;
            
            const contacts = JSON.parse(list.contacts);
            userStates[chatId] = { action: 'bc_message', userId, numbers: contacts };
            await bot.editMessageText(`✅ تم تحميل ${contacts.length} رقم\n\n✍️ أرسل الرسالة:`, {
                chat_id: chatId, message_id: msgId, ...KB.cancelKeyboard
            });
        }

        // ═══════════════════════════════════════════════════════════
        // 📢 الحملات
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'campaigns') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            await bot.editMessageText(`
📢 *الحملات*

إنشاء وإدارة حملات الإرسال
مع اختيار الحسابات والـ Rotation
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.campaignMenuKeyboard });
        }

        else if (data === 'new_campaign') {
            userStates[chatId] = { action: 'camp_name', userId, campaign: {} };
            await bot.editMessageText(`
📢 *حملة جديدة*

الخطوة 1/5: اسم الحملة

أرسل اسم للحملة:
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'my_campaigns') {
            const campaigns = getCampaigns(userId);
            if (campaigns.length === 0) {
                await bot.editMessageText('❌ لا توجد حملات', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ حملة جديدة', callback_data: 'new_campaign' }],
                        [{ text: '🔙 رجوع', callback_data: 'campaigns' }]
                    ]}
                });
                return;
            }
            
            const statusEmoji = { draft: '📝', running: '▶️', paused: '⏸️', completed: '✅', cancelled: '❌' };
            const btns = campaigns.slice(0, 10).map(c => [{
                text: `${statusEmoji[c.status] || '📢'} ${c.name}`,
                callback_data: `camp_${c.id}`
            }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'campaigns' }]);
            
            await bot.editMessageText('📢 *حملاتك:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('camp_') && !data.includes('start') && !data.includes('pause') && !data.includes('resume') && !data.includes('del') && !data.includes('report')) {
            const campId = parseInt(data.split('_')[1]);
            const camp = getCampaign(campId);
            if (!camp) return;
            
            const report = getCampaignReport(campId);
            await bot.editMessageText(`
📢 *${camp.name}*

الحالة: ${camp.status}
👥 المستلمين: ${report.totalRecipients}
✅ نجح: ${report.sent}
❌ فشل: ${report.failed}
📊 النسبة: ${report.successRate}%
🔄 الـ Rotation: ${report.rotationMode}
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.campaignActionsKeyboard(campId, camp.status)
            });
        }

        else if (data.startsWith('camp_start_')) {
            const campId = parseInt(data.split('_')[2]);
            await bot.editMessageText('⏳ جاري بدء الحملة...', { chat_id: chatId, message_id: msgId });
            await startCampaign(bot, chatId, campId);
        }

        else if (data.startsWith('camp_pause_')) {
            const campId = parseInt(data.split('_')[2]);
            pauseCampaign(campId);
            await bot.editMessageText('⏸️ تم إيقاف الحملة مؤقتاً', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        else if (data.startsWith('camp_resume_')) {
            const campId = parseInt(data.split('_')[2]);
            await resumeCampaign(bot, chatId, campId);
        }

        else if (data.startsWith('camp_del_')) {
            const campId = parseInt(data.split('_')[2]);
            cancelCampaign(campId);
            deleteCampaign(campId);
            await bot.editMessageText('🗑️ تم حذف الحملة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        // اختيار الحسابات للحملة
        else if (data.startsWith('sel_acc_')) {
            const phone = data.split('_')[2];
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            if (!st.campaign.selectedAccounts) st.campaign.selectedAccounts = [];
            
            const idx = st.campaign.selectedAccounts.indexOf(phone);
            if (idx > -1) {
                st.campaign.selectedAccounts.splice(idx, 1);
            } else {
                st.campaign.selectedAccounts.push(phone);
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            await bot.editMessageText(`
📱 *اختر الحسابات للإرسال:*
المحدد: ${st.campaign.selectedAccounts.length}
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, st.campaign.selectedAccounts)
            });
        }

        else if (data === 'sel_all_acc') {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            st.campaign.selectedAccounts = accounts.map(a => a.phone);
            
            await bot.editMessageText(`
📱 *اختر الحسابات للإرسال:*
المحدد: ${st.campaign.selectedAccounts.length}
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, st.campaign.selectedAccounts)
            });
        }

        else if (data === 'desel_all_acc') {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            st.campaign.selectedAccounts = [];
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            
            await bot.editMessageText(`
📱 *اختر الحسابات للإرسال:*
المحدد: 0
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, [])
            });
        }

        else if (data === 'next_step') {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            if (st.action === 'camp_accounts') {
                if (!st.campaign.selectedAccounts?.length) {
                    await bot.answerCallbackQuery(q.id, { text: '❌ اختر حساب واحد على الأقل', show_alert: true });
                    return;
                }
                st.action = 'camp_rotation';
                await bot.editMessageText(`
🔄 *اختر نوع الـ Rotation*

كيف يتم التبديل بين الحسابات؟
                `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.rotationModeKeyboard });
            }
        }

        else if (data.startsWith('rot_')) {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            st.campaign.rotationMode = data.split('_')[1];
            
            const campId = createCampaign(
                userId,
                st.campaign.name,
                st.campaign.message,
                st.campaign.numbers,
                st.campaign.selectedAccounts,
                st.campaign.rotationMode
            );
            
            delete userStates[chatId];
            
            await bot.editMessageText(`
✅ *تم إنشاء الحملة!*

📋 ${st.campaign.name}
👥 ${st.campaign.numbers.length} مستلم
📱 ${st.campaign.selectedAccounts.length} حساب
🔄 ${st.campaign.rotationMode}

هل تريد بدء الحملة الآن؟
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '▶️ بدء الآن', callback_data: `camp_start_${campId}` }],
                    [{ text: '📋 لاحقاً', callback_data: 'campaigns' }]
                ]}
            });
        }

        // اختيار الحساب للإرسال الجماعي
        else if (data.startsWith('bcfrom_')) {
            const phone = data.split('_')[1];
            const st = userStates[chatId];
            if (!st?.numbers || !st?.message) return;
            
            st.fromPhone = phone;
            await bot.editMessageText(`
📢 *تأكيد الإرسال*

📱 من: ${phone === 'all' ? 'كل الحسابات' : phone}
👥 إلى: ${st.numbers.length} رقم

هل تريد البدء؟
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '✅ إرسال', callback_data: 'bc_start' }, { text: '❌ إلغاء', callback_data: 'cancel' }]
                ]}
            });
        }

        else if (data === 'bc_start') {
            const st = userStates[chatId];
            if (!st?.numbers || !st?.message) return;
            
            await bot.editMessageText('📢 جاري الإرسال...', { chat_id: chatId, message_id: msgId });
            await quickBroadcast(bot, chatId, userId, st.numbers, st.message, st.fromPhone);
            delete userStates[chatId];
        }

        // ═══════════════════════════════════════════════════════════
        // 📝 القوالب
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'templates') {
            const templates = getTemplates(userId);
            await bot.editMessageText(`
📝 *القوالب*

احفظ رسائلك المتكررة واستخدمها بسرعة
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.templatesMenuKeyboard(templates)
            });
        }

        else if (data === 'new_template') {
            await bot.editMessageText(`
📝 *قالب جديد*

اختر نوع القالب:
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.predefinedTemplatesKeyboard });
        }

        else if (data.startsWith('preset_')) {
            const preset = data.split('_')[1];
            const templates = {
                welcome: messageTemplates.welcome,
                promotion: messageTemplates.promotion,
                reminder: messageTemplates.reminder,
                thanks: messageTemplates.thanks
            };
            
            userStates[chatId] = { action: 'tpl_name', userId, template: { content: templates[preset] } };
            await bot.editMessageText(`
📝 *محتوى القالب:*

${templates[preset]}

أرسل اسم للقالب:
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'custom_template') {
            userStates[chatId] = { action: 'tpl_content', userId, template: {} };
            await bot.editMessageText(`
📝 *قالب مخصص*

أرسل محتوى القالب:

💡 يمكنك استخدام:
*نص عريض*
_نص مائل_
~نص مشطوب~
\`كود\`
> اقتباس

المتغيرات:
{{name}} - اسم المستلم
{{date}} - التاريخ
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data.startsWith('tpl_')) {
            const tplId = parseInt(data.split('_')[1]);
            const tpl = getTemplate(tplId);
            if (!tpl) return;
            
            await bot.editMessageText(`
📝 *${tpl.name}*

${tpl.content}

📊 استخدم: ${tpl.usage_count} مرة
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.templateActionsKeyboard(tplId)
            });
        }

        else if (data.startsWith('use_tpl_')) {
            const tplId = parseInt(data.split('_')[2]);
            const tpl = getTemplate(tplId);
            if (!tpl) return;
            
            updateTemplateUsage(tplId);
            userStates[chatId] = { action: 'bc_numbers', userId, templateContent: tpl.content };
            await bot.editMessageText(`
✅ تم اختيار القالب: *${tpl.name}*

أرسل الأرقام للإرسال إليها:
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data.startsWith('del_tpl_')) {
            const tplId = parseInt(data.split('_')[2]);
            deleteTemplate(tplId);
            await bot.editMessageText('🗑️ تم حذف القالب', { chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('templates') });
        }

        // ═══════════════════════════════════════════════════════════
        // 🚫 القائمة السوداء
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'blacklist') {
            const blacklist = getBlacklist(userId);
            await bot.editMessageText(`
🚫 *القائمة السوداء*

الأرقام المحظورة: ${blacklist.length}

لن يتم الإرسال لهذه الأرقام
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.blacklistMenuKeyboard });
        }

        else if (data === 'bl_add') {
            userStates[chatId] = { action: 'bl_add', userId };
            await bot.editMessageText(`
🚫 *إضافة للقائمة السوداء*

أرسل الأرقام (كل رقم بسطر):
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'bl_view') {
            const blacklist = getBlacklist(userId);
            if (blacklist.length === 0) {
                await bot.editMessageText('📋 القائمة فارغة', {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('blacklist')
                });
                return;
            }
            
            let txt = '🚫 *القائمة السوداء:*\n\n';
            blacklist.slice(0, 20).forEach((b, i) => {
                txt += `${i + 1}. \`${b.phone}\`\n`;
            });
            if (blacklist.length > 20) txt += `\n... و ${blacklist.length - 20} آخرين`;
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '🗑️ مسح الكل', callback_data: 'bl_clear' }],
                    [{ text: '🔙 رجوع', callback_data: 'blacklist' }]
                ]}
            });
        }

        else if (data === 'bl_clear') {
            db.prepare("DELETE FROM blacklist WHERE user_id = ?").run(userId);
            await bot.editMessageText('✅ تم مسح القائمة السوداء', {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('blacklist')
            });
        }

        // ═══════════════════════════════════════════════════════════
        // 📆 الجدولة
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'scheduled') {
            const scheduled = getScheduledMessages(userId);
            await bot.editMessageText(`
📆 *الرسائل المجدولة*

المجدولة: ${scheduled.length}

جدول رسائلك للإرسال لاحقاً
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.scheduledMenuKeyboard });
        }

        else if (data === 'new_scheduled') {
            userStates[chatId] = { action: 'sched_numbers', userId, scheduled: {} };
            await bot.editMessageText(`
📆 *جدولة رسالة جديدة*

الخطوة 1: أرسل الأرقام
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'view_scheduled') {
            const scheduled = getScheduledMessages(userId);
            if (scheduled.length === 0) {
                await bot.editMessageText('📋 لا توجد رسائل مجدولة', {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('scheduled')
                });
                return;
            }
            
            let txt = '📆 *الرسائل المجدولة:*\n\n';
            scheduled.forEach((s, i) => {
                const recipients = JSON.parse(s.recipients);
                txt += `${i + 1}. 📱 ${s.from_phone}\n`;
                txt += `   👥 ${recipients.length} مستلم\n`;
                txt += `   ⏰ ${formatScheduleTime(s.scheduled_time)}\n\n`;
            });
            
            const btns = scheduled.slice(0, 5).map(s => [{
                text: `🗑️ حذف #${s.id}`,
                callback_data: `del_sched_${s.id}`
            }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'scheduled' }]);
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('del_sched_')) {
            const schedId = parseInt(data.split('_')[2]);
            deleteScheduledMessage(schedId);
            await bot.editMessageText('🗑️ تم حذف الرسالة المجدولة', {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('scheduled')
            });
        }

        // ═══════════════════════════════════════════════════════════
        // 🤖 الرد التلقائي
        // ═══════════════════════════════════════════════════════════
        
        else if (data.startsWith('autoreply_')) {
            const phone = data.split('_')[1];
            const autoReplies = getAutoReplies(userId).filter(ar => ar.phone === phone);
            
            if (autoReplies.length === 0) {
                await bot.editMessageText(`
🤖 *الرد التلقائي - ${phone}*

لا يوجد رد تلقائي مفعل
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ إضافة رد تلقائي', callback_data: `new_ar_${phone}` }],
                        [{ text: '🔙 رجوع', callback_data: `acc_${phone}` }]
                    ]}
                });
            } else {
                const ar = autoReplies[0];
                await bot.editMessageText(`
🤖 *الرد التلقائي - ${phone}*

الحالة: ${ar.is_active ? '✅ مفعل' : '❌ معطل'}
النوع: ${ar.trigger_type === 'all' ? 'كل الرسائل' : 'كلمات محددة'}
الردود: ${ar.reply_count}

${ar.reply_message}
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: ar.is_active ? '❌ تعطيل' : '✅ تفعيل', callback_data: `toggle_ar_${ar.id}` }],
                        [{ text: '✏️ تعديل', callback_data: `edit_ar_${ar.id}` }],
                        [{ text: '🗑️ حذف', callback_data: `del_ar_${ar.id}` }],
                        [{ text: '🔙 رجوع', callback_data: `acc_${phone}` }]
                    ]}
                });
            }
        }

        else if (data.startsWith('new_ar_')) {
            const phone = data.split('_')[2];
            userStates[chatId] = { action: 'ar_type', userId, autoReply: { phone } };
            await bot.editMessageText(`
🤖 *إضافة رد تلقائي*

اختر نوع التفعيل:
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📨 كل الرسائل', callback_data: 'ar_type_all' }],
                    [{ text: '🔑 كلمات محددة', callback_data: 'ar_type_keywords' }],
                    [{ text: '❌ إلغاء', callback_data: 'cancel' }]
                ]}
            });
        }

        else if (data === 'ar_type_all' || data === 'ar_type_keywords') {
            const st = userStates[chatId];
            if (!st?.autoReply) return;
            
            st.autoReply.triggerType = data === 'ar_type_all' ? 'all' : 'keywords';
            
            if (data === 'ar_type_keywords') {
                st.action = 'ar_keywords';
                await bot.editMessageText(`
🔑 *أدخل الكلمات المفتاحية*

افصل بينها بفاصلة:
مثال: سعر, عرض, خصم
                `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
            } else {
                st.action = 'ar_message';
                await bot.editMessageText('💬 *أدخل رسالة الرد:*', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
            }
        }

        else if (data.startsWith('toggle_ar_')) {
            const arId = parseInt(data.split('_')[2]);
            toggleAutoReply(arId);
            const ar = getAutoReply(arId);
            await bot.editMessageText(`✅ تم ${ar.is_active ? 'تفعيل' : 'تعطيل'} الرد التلقائي`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard(`autoreply_${ar.phone}`)
            });
        }

        else if (data.startsWith('del_ar_')) {
            const arId = parseInt(data.split('_')[2]);
            const ar = getAutoReply(arId);
            deleteAutoReply(arId);
            await bot.editMessageText('🗑️ تم حذف الرد التلقائي', {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard(`acc_${ar.phone}`)
            });
        }

        // ═══════════════════════════════════════════════════════════
        // 📊 الإحصائيات والتقارير
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'stats') {
            const accounts = getUserAccounts(userId);
            const online = accounts.filter(a => sessions[a.phone]).length;
            const totalMsgs = isAdmin 
                ? db.prepare('SELECT COUNT(*) as c FROM messages_log').get().c 
                : db.prepare('SELECT COUNT(*) as c FROM messages_log WHERE user_id = ?').get(userId).c;
            const successMsgs = isAdmin
                ? db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE status = 'success'").get().c
                : db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE user_id = ? AND status = 'success'").get(userId).c;
            
            const todayMsgs = isAdmin
                ? db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE date(timestamp) = date('now')").get().c
                : db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE user_id = ? AND date(timestamp) = date('now')").get(userId).c;
            
            await bot.editMessageText(`
📊 *الإحصائيات والتقارير*

📱 *الحسابات:*
• الإجمالي: ${accounts.length}
• متصل: ${online} 🟢
• غير متصل: ${accounts.length - online} 🔴

📨 *الرسائل:*
• الإجمالي: ${totalMsgs}
• نجحت: ${successMsgs} ✅
• فشلت: ${totalMsgs - successMsgs} ❌
• اليوم: ${todayMsgs}
• نسبة النجاح: ${totalMsgs > 0 ? Math.round((successMsgs / totalMsgs) * 100) : 0}%
            `.trim(), { 
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📈 تقرير مفصل', callback_data: 'detailed_report' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'detailed_report') {
            const last7days = db.prepare(`
                SELECT date(timestamp) as day, COUNT(*) as total,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
                FROM messages_log 
                WHERE user_id = ? AND timestamp >= datetime('now', '-7 days')
                GROUP BY date(timestamp)
                ORDER BY day DESC
            `).all(isAdmin ? CONFIG.ADMIN_ID : userId);
            
            let txt = '📈 *تقرير آخر 7 أيام:*\n\n';
            if (last7days.length === 0) {
                txt += 'لا توجد بيانات';
            } else {
                last7days.forEach(d => {
                    const rate = d.total > 0 ? Math.round((d.success / d.total) * 100) : 0;
                    txt += `📅 ${d.day}\n`;
                    txt += `   📨 ${d.total} | ✅ ${d.success} | ${rate}%\n\n`;
                });
            }
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.backToKeyboard('stats')
            });
        }

        // ═══════════════════════════════════════════════════════════
        // ⚙️ الإعدادات
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'settings') {
            const notifyReply = getSetting('notify_reply') === 'true';
            const notifyDisconnect = getSetting('notify_disconnect') === 'true';
            const autoReconnect = getSetting('auto_reconnect') === 'true';
            const autoBlock = getSetting('auto_block_unsubscribe') === 'true';
            const delayMin = getSetting('delay_min') || '3';
            const delayMax = getSetting('delay_max') || '7';
            const batchSize = getSetting('batch_size') || '10';
            
            await bot.editMessageText(`
❝ *الإعدادات العامة* ❞

━━━━━━━━━━━━━━━━━━━━━
⚙️ *إعدادات الإرسال:*
━━━━━━━━━━━━━━━━━━━━━
⏱️ التأخير: *${delayMin}-${delayMax}* ثانية
📦 حجم الدفعة: *${batchSize}* رسالة

━━━━━━━━━━━━━━━━━━━━━
🔔 *الإشعارات:*
━━━━━━━━━━━━━━━━━━━━━
🔄 إعادة الاتصال التلقائي: ${autoReconnect ? '✅' : '❌'}
📡 إشعار انقطاع الاتصال: ${notifyDisconnect ? '✅' : '❌'}
💬 إشعار الردود الجديدة: ${notifyReply ? '✅' : '❌'}
🚫 الحظر التلقائي: ${autoBlock ? '✅' : '❌'}

━━━━━━━━━━━━━━━━━━━━━
💡 اضغط على أي إعداد لتغييره
            `.trim(), { 
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', 
                ...KB.settingsMenuKeyboard({
                    delayMin, delayMax, batchSize,
                    autoReconnect, notifyDisconnect, notifyReply, autoBlock
                })
            });
        }

        else if (data === 'set_delay') {
            await bot.editMessageText(`
❝ *التأخير بين الرسائل* ❞

━━━━━━━━━━━━━━━━━━━━━
الحالي: *${getSetting('delay_min') || '3'}-${getSetting('delay_max') || '7'}* ثانية
━━━━━━━━━━━━━━━━━━━━━

اختر مدة التأخير:
            `.trim(), { 
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', 
                reply_markup: { inline_keyboard: [
                    [
                        { text: '1-3 ث', callback_data: 'd_1_3' },
                        { text: '3-5 ث', callback_data: 'd_3_5' },
                        { text: '5-10 ث', callback_data: 'd_5_10' }
                    ],
                    [
                        { text: '10-15 ث', callback_data: 'd_10_15' },
                        { text: '15-30 ث', callback_data: 'd_15_30' },
                        { text: '30-60 ث', callback_data: 'd_30_60' }
                    ],
                    [{ text: 'رجوع', callback_data: 'settings' }]
                ]}
            });
        }

        else if (data.startsWith('d_') && !data.startsWith('del_')) {
            const parts = data.split('_');
            if (parts.length === 3) {
                const min = parts[1];
                const max = parts[2];
                setSetting('delay_min', min);
                setSetting('delay_max', max);
                await bot.editMessageText(`✅ تم تعيين التأخير: ${min}-${max} ثانية`, {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
                });
            }
        }

        else if (data === 'set_batch') {
            await bot.editMessageText(`
❝ *حجم الدفعة* ❞

━━━━━━━━━━━━━━━━━━━━━
الحالي: *${getSetting('batch_size') || '10'}* رسالة
━━━━━━━━━━━━━━━━━━━━━

عدد الرسائل قبل التوقف المؤقت:
            `.trim(), { 
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', 
                reply_markup: { inline_keyboard: [
                    [
                        { text: '5', callback_data: 'b_5' },
                        { text: '10', callback_data: 'b_10' },
                        { text: '20', callback_data: 'b_20' }
                    ],
                    [
                        { text: '50', callback_data: 'b_50' },
                        { text: '100', callback_data: 'b_100' },
                        { text: '200', callback_data: 'b_200' }
                    ],
                    [{ text: 'رجوع', callback_data: 'settings' }]
                ]}
            });
        }

        else if (data.startsWith('b_') && !data.startsWith('bc_') && !data.startsWith('bl_')) {
            const size = data.split('_')[1];
            if (!isNaN(size)) {
                setSetting('batch_size', size);
                await bot.editMessageText(`✅ تم تعيين حجم الدفعة: ${size} رسالة`, {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
                });
            }
        }

        else if (data === 'set_notify') {
            const current = getSetting('notify_disconnect') === 'true';
            setSetting('notify_disconnect', current ? 'false' : 'true');
            await bot.editMessageText(`✅ إشعار الانقطاع: ${!current ? 'مفعل' : 'معطل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        else if (data === 'set_notify_reply') {
            const current = getSetting('notify_reply') === 'true';
            setSetting('notify_reply', current ? 'false' : 'true');
            await bot.editMessageText(`✅ إشعار الردود: ${!current ? 'مفعل' : 'معطل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        else if (data === 'set_reconnect') {
            const current = getSetting('auto_reconnect') === 'true';
            setSetting('auto_reconnect', current ? 'false' : 'true');
            await bot.editMessageText(`✅ إعادة الاتصال التلقائي: ${!current ? 'مفعل' : 'معطل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        // إعدادات الحظر التلقائي
        else if (data === 'set_auto_block') {
            const current = getSetting('auto_block_unsubscribe') === 'true';
            const keywords = getSetting('unsubscribe_keywords') || 'stop,الغاء,إلغاء';
            
            await bot.editMessageText(`🚫 *الحظر التلقائي*

الحالة: ${current ? '✅ مفعل' : '❌ معطل'}

عند إرسال شخص كلمة مثل:
\`${keywords}\`

سيتم:
• إضافته للقائمة السوداء تلقائياً
• إرسال رسالة تأكيد له
• إشعارك بذلك`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: current ? '❌ تعطيل' : '✅ تفعيل', callback_data: 'toggle_auto_block' }],
                    [{ text: '✏️ تعديل الكلمات', callback_data: 'edit_block_keywords' }],
                    [{ text: '🔙 رجوع', callback_data: 'settings' }]
                ]}
            });
        }

        else if (data === 'toggle_auto_block') {
            const current = getSetting('auto_block_unsubscribe') === 'true';
            setSetting('auto_block_unsubscribe', current ? 'false' : 'true');
            await bot.editMessageText(`✅ الحظر التلقائي: ${!current ? 'مفعل' : 'معطل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        else if (data === 'edit_block_keywords') {
            userStates[chatId] = { action: 'edit_block_keywords', userId };
            const keywords = getSetting('unsubscribe_keywords') || 'stop,الغاء,إلغاء';
            await bot.editMessageText(`✏️ *تعديل كلمات الحظر*

الكلمات الحالية:
\`${keywords}\`

أرسل الكلمات الجديدة مفصولة بفاصلة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }

        // إعدادات تأخير النقل
        else if (data === 'set_transfer_delay') {
            const minDelay = getSetting('transfer_delay_min') || '2';
            const maxDelay = getSetting('transfer_delay_max') || '5';
            
            await bot.editMessageText(`⏱️ *تأخير نقل الأعضاء*

الحالي: ${minDelay}-${maxDelay} ثانية

اختر التأخير بين كل إضافة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [
                        { text: '1-3 ث', callback_data: 'td_1_3' },
                        { text: '2-5 ث', callback_data: 'td_2_5' },
                        { text: '3-7 ث', callback_data: 'td_3_7' }
                    ],
                    [
                        { text: '5-10 ث', callback_data: 'td_5_10' },
                        { text: '10-20 ث', callback_data: 'td_10_20' }
                    ],
                    [{ text: '🔙 رجوع', callback_data: 'settings' }]
                ]}
            });
        }

        else if (data.startsWith('td_')) {
            const [_, min, max] = data.split('_');
            setSetting('transfer_delay_min', min);
            setSetting('transfer_delay_max', max);
            await bot.editMessageText(`✅ تم تعيين تأخير النقل: ${min}-${max} ثانية`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        // ═══════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════
        // 📥 استخراج البيانات - محسّن
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'extract_data') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            await bot.editMessageText(`
❝ *استخراج البيانات والأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
📥 *يمكنك استخراج الأرقام من:*
━━━━━━━━━━━━━━━━━━━━━
👥 مجموعات واتساب
🔑 كلمات مفتاحية (بحث)
🌐 صفحات الويب
📁 ملفات Excel/CSV
━━━━━━━━━━━━━━━━━━━━━

💡 *اختر طريقة الاستخراج:*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '👥 من مجموعة واتساب', callback_data: 'extract_group' }],
                    [{ text: '🔑 بحث بكلمات مفتاحية', callback_data: 'extract_keywords' }],
                    [{ text: '🌐 من صفحة ويب', callback_data: 'extract_web' }],
                    [{ text: '📁 من ملف', callback_data: 'extract_file' }],
                    [{ text: '📇 قوائمي المحفوظة', callback_data: 'my_lists' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }
        
        // استخراج بالكلمات المفتاحية
        else if (data === 'extract_keywords') {
            userStates[chatId] = { action: 'extract_keywords', userId };
            await bot.editMessageText(`
❝ *استخراج بالكلمات المفتاحية* ❞

━━━━━━━━━━━━━━━━━━━━━
🔑 *أرسل الكلمات المفتاحية للبحث:*
━━━━━━━━━━━━━━━━━━━━━

📝 *أمثلة:*
• \`عقارات مصر\`
• \`سيارات للبيع\`
• \`مطاعم الرياض\`

💡 سيتم البحث عن أرقام الهواتف
المرتبطة بهذه الكلمات
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        // استخراج من ملف
        else if (data === 'extract_file') {
            userStates[chatId] = { action: 'extract_file', userId };
            await bot.editMessageText(`
❝ *استخراج من ملف* ❞

━━━━━━━━━━━━━━━━━━━━━
📁 *أرسل ملف يحتوي على أرقام:*
━━━━━━━━━━━━━━━━━━━━━

✅ الأنواع المدعومة:
• Excel (.xlsx, .xls)
• CSV (.csv)
• Text (.txt)

💡 سيتم استخراج جميع الأرقام
من الملف تلقائياً
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // 🔄 نقل الأعضاء - محسّن مع Live Count
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'transfer_members') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            const totalAccounts = getUserAccounts(userId).length;
            
            await bot.editMessageText(`
❝ *نقل الأعضاء بين المجموعات* ❞

━━━━━━━━━━━━━━━━━━━━━
📊 *إحصائيات حساباتك:*
━━━━━━━━━━━━━━━━━━━━━
👤 عدد حساباتك في البوت ← *${totalAccounts}*
🟢 الحسابات المتصلة ← *${accounts.length}*
🔴 الحسابات غير المتصلة ← *${totalAccounts - accounts.length}*
━━━━━━━━━━━━━━━━━━━━━

💡 *يمكنك تحديد حسابات متعددة*
*للنقل بشكل أسرع!*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '🔄 بدء نقل جديد', callback_data: 'start_new_transfer' }],
                    [{ text: '📱 إضافة حسابات للنقل', callback_data: 'add_transfer_accounts' }],
                    [{ text: '⚙️ إعدادات النقل', callback_data: 'transfer_settings' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }
        
        // إعدادات النقل
        else if (data === 'transfer_settings') {
            const minDelay = getSetting('transfer_delay_min') || '2';
            const maxDelay = getSetting('transfer_delay_max') || '5';
            
            await bot.editMessageText(`
❝ *إعدادات النقل* ❞

━━━━━━━━━━━━━━━━━━━━━
⚙️ *الإعدادات الحالية:*
━━━━━━━━━━━━━━━━━━━━━
⏱️ التأخير بين الإضافات ← *${minDelay}-${maxDelay} ثانية*
━━━━━━━━━━━━━━━━━━━━━

💡 *التأخير يحمي حسابك من الحظر*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '⏱️ تغيير التأخير', callback_data: 'set_transfer_delay' }],
                    [{ text: '🔙 رجوع', callback_data: 'transfer_members' }]
                ]}
            });
        }
        
        else if (data === 'set_transfer_delay') {
            await bot.editMessageText(`
❝ *اختر مدة التأخير* ❞

━━━━━━━━━━━━━━━━━━━━━
⏱️ *التأخير بين كل إضافة:*
━━━━━━━━━━━━━━━━━━━━━

⚡ سريع = خطر حظر أعلى
🐢 بطيء = أمان أكثر
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.transferDelayKeyboard
            });
        }
        
        // إضافة حسابات متعددة للنقل
        else if (data === 'add_transfer_accounts') {
            const accounts = getUserAccounts(userId);
            const selectedAccounts = userStates[chatId]?.selectedTransferAccounts || [];
            
            const btns = accounts.map(a => {
                const isOnline = sessions[a.phone] ? '🟢' : '🔴';
                const isSelected = selectedAccounts.includes(a.phone) ? '✅' : '⬜';
                return [{
                    text: `${isSelected} ${isOnline} ${a.phone}`,
                    callback_data: `toggle_trans_acc_${a.phone}`
                }];
            });
            
            btns.push([
                { text: '✅ تحديد الكل', callback_data: 'select_all_trans' },
                { text: '⬜ إلغاء الكل', callback_data: 'deselect_all_trans' }
            ]);
            btns.push([{ text: '➡️ متابعة', callback_data: 'continue_transfer' }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'transfer_members' }]);
            
            await bot.editMessageText(`
❝ *اختر الحسابات للنقل* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *حساباتك المتاحة:*
━━━━━━━━━━━━━━━━━━━━━
✅ = محدد | ⬜ = غير محدد
🟢 = متصل | 🔴 = غير متصل
━━━━━━━━━━━━━━━━━━━━━

📊 المحدد: *${selectedAccounts.length}* حساب

💡 *اختر حسابات متعددة للنقل الأسرع*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data.startsWith('toggle_trans_acc_')) {
            const phone = data.replace('toggle_trans_acc_', '');
            if (!userStates[chatId]) userStates[chatId] = {};
            if (!userStates[chatId].selectedTransferAccounts) userStates[chatId].selectedTransferAccounts = [];
            
            const idx = userStates[chatId].selectedTransferAccounts.indexOf(phone);
            if (idx > -1) {
                userStates[chatId].selectedTransferAccounts.splice(idx, 1);
            } else {
                userStates[chatId].selectedTransferAccounts.push(phone);
            }
            
            // إعادة عرض القائمة
            const accounts = getUserAccounts(userId);
            const selectedAccounts = userStates[chatId].selectedTransferAccounts;
            
            const btns = accounts.map(a => {
                const isOnline = sessions[a.phone] ? '🟢' : '🔴';
                const isSelected = selectedAccounts.includes(a.phone) ? '✅' : '⬜';
                return [{
                    text: `${isSelected} ${isOnline} ${a.phone}`,
                    callback_data: `toggle_trans_acc_${a.phone}`
                }];
            });
            
            btns.push([
                { text: '✅ تحديد الكل', callback_data: 'select_all_trans' },
                { text: '⬜ إلغاء الكل', callback_data: 'deselect_all_trans' }
            ]);
            btns.push([{ text: '➡️ متابعة', callback_data: 'continue_transfer' }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'transfer_members' }]);
            
            await bot.editMessageText(`
❝ *اختر الحسابات للنقل* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *حساباتك المتاحة:*
━━━━━━━━━━━━━━━━━━━━━
✅ = محدد | ⬜ = غير محدد
🟢 = متصل | 🔴 = غير متصل
━━━━━━━━━━━━━━━━━━━━━

📊 المحدد: *${selectedAccounts.length}* حساب

💡 *اختر حسابات متعددة للنقل الأسرع*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data === 'select_all_trans') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (!userStates[chatId]) userStates[chatId] = {};
            userStates[chatId].selectedTransferAccounts = accounts.map(a => a.phone);
            
            // إعادة التوجيه لعرض القائمة
            await bot.editMessageText('⏳ جاري التحديث...', { chat_id: chatId, message_id: msgId });
            // محاكاة الضغط على add_transfer_accounts
            const allAccounts = getUserAccounts(userId);
            const selectedAccounts = userStates[chatId].selectedTransferAccounts;
            
            const btns = allAccounts.map(a => {
                const isOnline = sessions[a.phone] ? '🟢' : '🔴';
                const isSelected = selectedAccounts.includes(a.phone) ? '✅' : '⬜';
                return [{
                    text: `${isSelected} ${isOnline} ${a.phone}`,
                    callback_data: `toggle_trans_acc_${a.phone}`
                }];
            });
            
            btns.push([
                { text: '✅ تحديد الكل', callback_data: 'select_all_trans' },
                { text: '⬜ إلغاء الكل', callback_data: 'deselect_all_trans' }
            ]);
            btns.push([{ text: '➡️ متابعة', callback_data: 'continue_transfer' }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'transfer_members' }]);
            
            await bot.editMessageText(`
❝ *اختر الحسابات للنقل* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *حساباتك المتاحة:*
━━━━━━━━━━━━━━━━━━━━━
✅ = محدد | ⬜ = غير محدد
🟢 = متصل | 🔴 = غير متصل
━━━━━━━━━━━━━━━━━━━━━

📊 المحدد: *${selectedAccounts.length}* حساب

💡 *تم تحديد جميع الحسابات المتصلة!*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data === 'deselect_all_trans') {
            if (!userStates[chatId]) userStates[chatId] = {};
            userStates[chatId].selectedTransferAccounts = [];
            
            const accounts = getUserAccounts(userId);
            const btns = accounts.map(a => {
                const isOnline = sessions[a.phone] ? '🟢' : '🔴';
                return [{
                    text: `⬜ ${isOnline} ${a.phone}`,
                    callback_data: `toggle_trans_acc_${a.phone}`
                }];
            });
            
            btns.push([
                { text: '✅ تحديد الكل', callback_data: 'select_all_trans' },
                { text: '⬜ إلغاء الكل', callback_data: 'deselect_all_trans' }
            ]);
            btns.push([{ text: '➡️ متابعة', callback_data: 'continue_transfer' }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'transfer_members' }]);
            
            await bot.editMessageText(`
❝ *اختر الحسابات للنقل* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *حساباتك المتاحة:*
━━━━━━━━━━━━━━━━━━━━━
✅ = محدد | ⬜ = غير محدد
🟢 = متصل | 🔴 = غير متصل
━━━━━━━━━━━━━━━━━━━━━

📊 المحدد: *0* حساب

💡 *اختر حسابات متعددة للنقل الأسرع*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        // بدء نقل جديد (حساب واحد)
        else if (data === 'start_new_transfer') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText(`
❝ *لا توجد حسابات متصلة* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ يجب ربط حساب واتساب أولاً
━━━━━━━━━━━━━━━━━━━━━
                `.trim(), { 
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '📱 إضافة حساب', callback_data: 'add_acc' }],
                        [{ text: '🔙 رجوع', callback_data: 'transfer_members' }]
                    ]}
                });
                return;
            }
            
            const btns = accounts.map(a => [{ 
                text: `🟢 ${a.phone}`, 
                callback_data: `trans_acc_${a.phone}` 
            }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'transfer_members' }]);
            
            await bot.editMessageText(`
❝ *اختر حساب للنقل* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *الحسابات المتصلة:*
━━━━━━━━━━━━━━━━━━━━━

💡 اختر الحساب الذي سيقوم بالنقل
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data.startsWith('trans_acc_')) {
            const phone = data.split('_')[2];
            const sock = sessions[phone];
            if (!sock) {
                await bot.editMessageText('❌ الحساب غير متصل', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            await bot.editMessageText('⏳ جاري تحميل المجموعات...', { chat_id: chatId, message_id: msgId });
            
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups).filter(g => g.id.endsWith('@g.us'));
                
                if (groupList.length === 0) {
                    await bot.editMessageText(`
❝ *لا توجد مجموعات* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ هذا الحساب ليس في أي مجموعة
━━━━━━━━━━━━━━━━━━━━━
                    `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.backKeyboard });
                    return;
                }
                
                userStates[chatId] = { action: 'select_source_group', phone, userId, groups: groupList };
                
                const btns = groupList.slice(0, 15).map(g => [{
                    text: `👥 ${g.subject.substring(0, 25)} (${g.participants?.length || 0})`,
                    callback_data: `src_grp_${g.id.split('@')[0].substring(0, 30)}`
                }]);
                btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
                
                await bot.editMessageText(`
❝ *اختر المجموعة المصدر* ❞

━━━━━━━━━━━━━━━━━━━━━
📤 *المجموعة التي ستنقل منها:*
━━━━━━━━━━━━━━━━━━━━━
📊 عدد المجموعات: ${groupList.length}
━━━━━━━━━━━━━━━━━━━━━
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: btns }
                });
            } catch (e) {
                await bot.editMessageText('❌ خطأ في تحميل المجموعات', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
            }
        }
        
        else if (data.startsWith('src_grp_')) {
            const st = userStates[chatId];
            if (!st?.groups) return;
            
            const groupIdPart = data.replace('src_grp_', '');
            const sourceGroup = st.groups.find(g => g.id.split('@')[0].startsWith(groupIdPart));
            if (!sourceGroup) return;
            
            st.sourceGroup = sourceGroup;
            st.action = 'select_dest_group';
            
            const btns = st.groups
                .filter(g => g.id !== sourceGroup.id)
                .slice(0, 15)
                .map(g => [{
                    text: `👥 ${g.subject.substring(0, 25)} (${g.participants?.length || 0})`,
                    callback_data: `dst_grp_${g.id.split('@')[0].substring(0, 30)}`
                }]);
            btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
            
            await bot.editMessageText(`
❝ *اختر المجموعة الهدف* ❞

━━━━━━━━━━━━━━━━━━━━━
✅ المصدر: *${sourceGroup.subject}*
👥 عدد الأعضاء: *${sourceGroup.participants?.length || 0}*
━━━━━━━━━━━━━━━━━━━━━

📥 *اختر المجموعة التي ستنقل إليها:*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data.startsWith('dst_grp_')) {
            const st = userStates[chatId];
            if (!st?.sourceGroup) return;
            
            const groupId = data.split('_')[2] + '@g.us';
            const destGroup = st.groups.find(g => g.id === groupId);
            if (!destGroup) return;
            
            st.destGroup = destGroup;
            
            const sourceMembers = st.sourceGroup.participants?.length || 0;
            
            await bot.editMessageText(`🔄 *تأكيد النقل*

📤 من: *${st.sourceGroup.subject}*
📥 إلى: *${destGroup.subject}*
👥 سيتم نقل: ${sourceMembers} عضو

⚠️ ملاحظة: سيتم إضافة الأعضاء تدريجياً

هل تريد البدء؟`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '✅ بدء النقل', callback_data: 'start_transfer' }],
                    [{ text: '❌ إلغاء', callback_data: 'cancel' }]
                ]}
            });
        }
        
        else if (data === 'start_transfer') {
            const st = userStates[chatId];
            if (!st?.sourceGroup || !st?.destGroup) return;
            
            const sock = sessions[st.phone];
            if (!sock) {
                await bot.editMessageText('❌ الحساب غير متصل', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                delete userStates[chatId];
                return;
            }
            
            await bot.editMessageText('⏳ جاري نقل الأعضاء...', { chat_id: chatId, message_id: msgId });
            
            const members = st.sourceGroup.participants || [];
            let added = 0, failed = 0;
            
            // الحصول على تأخير النقل من الإعدادات
            const minDelay = parseInt(getSetting('transfer_delay_min') || '2') * 1000;
            const maxDelay = parseInt(getSetting('transfer_delay_max') || '5') * 1000;
            
            for (const member of members) {
                if (member.id.includes(st.phone)) continue;
                
                try {
                    await sock.groupParticipantsUpdate(st.destGroup.id, [member.id], 'add');
                    added++;
                } catch (e) {
                    failed++;
                }
                
                // تأخير عشوائي بين الحد الأدنى والأقصى
                const delay = minDelay + Math.random() * (maxDelay - minDelay);
                await new Promise(r => setTimeout(r, delay));
                
                if ((added + failed) % 5 === 0) {
                    try {
                        await bot.editMessageText(`⏳ جاري النقل...

✅ تمت إضافة: ${added}
❌ فشل: ${failed}
📊 المتبقي: ${members.length - added - failed}`, { chat_id: chatId, message_id: msgId });
                    } catch (e) {}
                }
            }
            
            delete userStates[chatId];
            await bot.editMessageText(`✅ *اكتمل النقل!*

📤 من: ${st.sourceGroup.subject}
📥 إلى: ${st.destGroup.subject}

✅ تمت إضافة: ${added}
❌ فشل: ${failed}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.backKeyboard
            });
        }
        
        // استخراج من الويب
        else if (data === 'extract_web') {
            userStates[chatId] = { action: 'extract_web_url', userId };
            await bot.editMessageText(`🌐 *استخراج أرقام من الويب*

أرسل رابط الموقع أو الصفحة:

مثال:
\`https://example.com/contacts\`

سيتم البحث عن أرقام الهواتف في الصفحة`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }

        else if (data === 'extract_group') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText(`
❝ *لا توجد حسابات متصلة* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ يجب ربط حساب واتساب أولاً
━━━━━━━━━━━━━━━━━━━━━
                `.trim(), { 
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '📱 إضافة حساب', callback_data: 'add_acc' }],
                        [{ text: '🔙 رجوع', callback_data: 'extract_data' }]
                    ]}
                });
                return;
            }
            
            const btns = accounts.map(a => [{ text: `📱 ${a.phone}`, callback_data: `ext_acc_${a.phone}` }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'extract_data' }]);
            
            await bot.editMessageText(`
❝ *استخراج من مجموعة واتساب* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *اختر الحساب:*
━━━━━━━━━━━━━━━━━━━━━

💡 سيتم عرض مجموعات الحساب المختار
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('ext_acc_')) {
            const phone = data.split('_')[2];
            const sock = sessions[phone];
            if (!sock) {
                await bot.editMessageText('❌ الحساب غير متصل', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            await bot.editMessageText('⏳ جاري جلب المجموعات...', { chat_id: chatId, message_id: msgId });
            
            try {
                // جلب المجموعات من واتساب
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups).filter(g => g.id.endsWith('@g.us'));
                
                if (groupList.length === 0) {
                    await bot.editMessageText(`
❝ *لا توجد مجموعات* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ هذا الحساب ليس عضواً في أي مجموعة
━━━━━━━━━━━━━━━━━━━━━
                    `.trim(), { 
                        chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                        ...KB.backToKeyboard('extract_data')
                    });
                    return;
                }
                
                // عرض المجموعات
                const btns = groupList.slice(0, 15).map(g => [{
                    text: `👥 ${g.subject} (${g.participants?.length || 0})`,
                    callback_data: `extgrp_${phone}_${g.id.split('@')[0].slice(0, 20)}`
                }]);
                btns.push([{ text: '🔙 رجوع', callback_data: 'extract_group' }]);
                
                // حفظ المجموعات في الحالة
                userStates[chatId] = { action: 'select_extract_group', phone, userId, groups: groupList };
                
                await bot.editMessageText(`
❝ *اختر المجموعة* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *الحساب:* ${phone}
👥 *عدد المجموعات:* ${groupList.length}
━━━━━━━━━━━━━━━━━━━━━

💡 اختر المجموعة لاستخراج الأرقام منها
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: btns }
                });
            } catch (e) {
                console.error('Error fetching groups:', e.message);
                await bot.editMessageText('❌ خطأ في جلب المجموعات', { 
                    chat_id: chatId, message_id: msgId, 
                    ...KB.backToKeyboard('extract_data')
                });
            }
        }
        
        else if (data.startsWith('extgrp_')) {
            const parts = data.split('_');
            const phone = parts[1];
            const groupIdPart = parts[2];
            const st = userStates[chatId];
            
            if (!st || !st.groups) {
                await bot.editMessageText('❌ انتهت الجلسة، حاول مرة أخرى', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            const group = st.groups.find(g => g.id.startsWith(groupIdPart));
            if (!group) {
                await bot.editMessageText('❌ المجموعة غير موجودة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            await bot.editMessageText('⏳ جاري استخراج الأرقام...', { chat_id: chatId, message_id: msgId });
            
            try {
                const sock = sessions[phone];
                const metadata = await sock.groupMetadata(group.id);
                const participants = metadata.participants || [];
                
                const numbers = participants
                    .map(p => p.id.replace('@s.whatsapp.net', ''))
                    .filter(n => n && !n.includes(':'));
                
                if (numbers.length === 0) {
                    await bot.editMessageText('❌ لم يتم العثور على أرقام', { 
                        chat_id: chatId, message_id: msgId, 
                        ...KB.backToKeyboard('extract_data')
                    });
                    return;
                }
                
                // حفظ كقائمة
                createContactList(userId, `${group.subject} - ${new Date().toLocaleDateString('ar')}`, numbers);
                
                // إرسال ملف
                const filePath = `/tmp/extract_${Date.now()}.txt`;
                fs.writeFileSync(filePath, numbers.join('\n'));
                
                await bot.sendDocument(chatId, filePath, {
                    caption: `
❝ *تم استخراج الأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
👥 *المجموعة:* ${group.subject}
📱 *عدد الأرقام:* ${numbers.length}
━━━━━━━━━━━━━━━━━━━━━

✅ تم حفظ الأرقام في قوائمك
                    `.trim(),
                    parse_mode: 'Markdown'
                });
                
                fs.unlinkSync(filePath);
                delete userStates[chatId];
                
            } catch (e) {
                console.error('Error extracting:', e.message);
                await bot.editMessageText('❌ خطأ في الاستخراج', { 
                    chat_id: chatId, message_id: msgId, 
                    ...KB.backToKeyboard('extract_data')
                });
            }
        }

        // ═══════════════════════════════════════════════════════════
        // 👑 لوحة الأدمن
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'a_users' && isAdmin) {
            const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 20").all();
            const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
            const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_subscribed = 1").get().c;
            
            let txt = `👥 *المستخدمين*\n\n`;
            txt += `📊 الإجمالي: ${totalUsers}\n`;
            txt += `✅ مشتركين: ${activeUsers}\n\n`;
            
            users.forEach((u, i) => {
                txt += `${i + 1}. ${u.is_subscribed ? '✅' : '❌'} ${u.first_name} \`${u.user_id}\`\n`;
            });
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '➕ تفعيل مستخدم', callback_data: 'a_activate' }],
                    [{ text: '🗑️ إلغاء اشتراك', callback_data: 'a_remove_sub' }],
                    [{ text: '📢 إرسال للكل', callback_data: 'a_broadcast' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'a_activate' && isAdmin) {
            userStates[chatId] = { action: 'a_activate' };
            await bot.editMessageText('➕ *أرسل ID المستخدم:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'a_remove_sub' && isAdmin) {
            userStates[chatId] = { action: 'a_remove_sub' };
            await bot.editMessageText('🗑️ *أرسل ID المستخدم لإلغاء اشتراكه:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'a_broadcast' && isAdmin) {
            userStates[chatId] = { action: 'a_broadcast' };
            await bot.editMessageText('📢 *أرسل الرسالة للجميع:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data.startsWith('actplan_') && isAdmin) {
            const [_, targetId, planId] = data.split('_').map(Number);
            activateSubscription(targetId, planId);
            const user = getUser(targetId);
            await bot.editMessageText(`✅ تم تفعيل ${user.first_name}`, {
                chat_id: chatId, message_id: msgId, ...KB.backKeyboard
            });
            bot.sendMessage(targetId, `🎉 *تم تفعيل اشتراكك!*\n\n📦 ${user.subscription_type}`, {
                parse_mode: 'Markdown', ...KB.mainUserKeyboard
            });
        }

        else if (data === 'a_reqs' && isAdmin) {
            const reqs = getPendingRequests();
            if (reqs.length === 0) {
                await bot.editMessageText('💳 *لا توجد طلبات معلقة*', {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.backKeyboard
                });
                return;
            }
            
            let txt = '💳 *طلبات الدفع:*\n\n';
            const btns = [];
            reqs.forEach((r, i) => {
                txt += `${i + 1}. ${r.first_name} - ${r.plan_name} (${r.price}ج)\n`;
                btns.push([
                    { text: `✅ قبول #${r.id}`, callback_data: `approve_${r.id}` },
                    { text: `❌ رفض #${r.id}`, callback_data: `reject_${r.id}` }
                ]);
            });
            btns.push([{ text: '🔙 رجوع', callback_data: 'main' }]);
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('approve_') && isAdmin) {
            const reqId = parseInt(data.split('_')[1]);
            const req = db.prepare("SELECT * FROM payment_requests WHERE id = ?").get(reqId);
            if (req) {
                activateSubscription(req.user_id, req.plan_id);
                db.prepare("UPDATE payment_requests SET status = 'approved' WHERE id = ?").run(reqId);
                const user = getUser(req.user_id);
                bot.sendMessage(req.user_id, `🎉 *تم تفعيل اشتراكك!*\n\n📦 ${user.subscription_type}`, {
                    parse_mode: 'Markdown', ...KB.mainUserKeyboard
                });
            }
            await bot.editMessageText('✅ تم القبول', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        else if (data.startsWith('reject_') && isAdmin) {
            const reqId = parseInt(data.split('_')[1]);
            const req = db.prepare("SELECT * FROM payment_requests WHERE id = ?").get(reqId);
            if (req) {
                db.prepare("UPDATE payment_requests SET status = 'rejected' WHERE id = ?").run(reqId);
                bot.sendMessage(req.user_id, '❌ *تم رفض طلبك*\n\nتواصل مع الدعم للمزيد', { parse_mode: 'Markdown' });
            }
            await bot.editMessageText('❌ تم الرفض', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        else if (data === 'a_plans' && isAdmin) {
            const plans = db.prepare("SELECT * FROM plans").all();
            let txt = '📦 *الباقات:*\n\n';
            plans.forEach(p => {
                txt += `${p.is_active ? '✅' : '❌'} ${p.name} - ${p.price}ج | ${p.max_accounts} حساب\n`;
            });
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '➕ إضافة باقة', callback_data: 'add_plan' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'add_plan' && isAdmin) {
            userStates[chatId] = { action: 'add_plan' };
            await bot.editMessageText(`
➕ *إضافة باقة جديدة*

أرسل البيانات بالصيغة:
\`الاسم|السعر|الأيام|الحسابات|الرسائل\`

مثال:
\`VIP|300|30|20|50000\`
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (data === 'a_payments' && isAdmin) {
            const methods = db.prepare("SELECT * FROM payment_methods").all();
            let txt = '💰 *طرق الدفع:*\n\n';
            methods.forEach(m => {
                txt += `${m.is_active ? '✅' : '❌'} ${m.name}: ${m.number}\n`;
            });
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '➕ إضافة طريقة', callback_data: 'add_payment' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'add_payment' && isAdmin) {
            userStates[chatId] = { action: 'add_payment' };
            await bot.editMessageText(`
➕ *إضافة طريقة دفع*

أرسل البيانات بالصيغة:
\`الاسم|الرقم\`

مثال:
\`فودافون كاش|01012345678\`
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        // ═══════════════════════════════════════════════════════════
        // 🔍 فحص الأرقام
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'verify_numbers') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText(`
❝ *لا توجد حسابات متصلة* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ يجب ربط حساب واتساب أولاً
━━━━━━━━━━━━━━━━━━━━━
                `.trim(), { 
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '📱 إضافة حساب', callback_data: 'add_acc' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            
            await bot.editMessageText(`
❝ *فحص صحة الأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
🔍 *هذه الميزة تتيح لك:*
━━━━━━━━━━━━━━━━━━━━━
✅ التحقق من وجود رقم على واتساب
📱 فحص قائمة أرقام دفعة واحدة
📊 الحصول على تقرير بالأرقام الصالحة
━━━━━━━━━━━━━━━━━━━━━

💡 *اختر طريقة الفحص:*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📱 فحص رقم واحد', callback_data: 'verify_single' }],
                    [{ text: '📋 فحص قائمة أرقام', callback_data: 'verify_list' }],
                    [{ text: '📁 فحص من ملف', callback_data: 'verify_file' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }
        
        else if (data === 'verify_single') {
            userStates[chatId] = { action: 'verify_single', userId };
            await bot.editMessageText(`
❝ *فحص رقم واحد* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *أرسل الرقم للفحص:*
━━━━━━━━━━━━━━━━━━━━━

مثال: \`201234567890\`
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        else if (data === 'verify_list') {
            userStates[chatId] = { action: 'verify_list', userId };
            await bot.editMessageText(`
❝ *فحص قائمة أرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
أرسل الأرقام (كل رقم بسطر):
━━━━━━━━━━━━━━━━━━━━━

مثال:
\`201234567890\`
\`201234567891\`
\`201234567892\`
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        else if (data === 'verify_file') {
            userStates[chatId] = { action: 'verify_file', userId };
            await bot.editMessageText(`
❝ *فحص أرقام من ملف* ❞

━━━━━━━━━━━━━━━━━━━━━
أرسل ملف يحتوي على الأرقام:
━━━━━━━━━━━━━━━━━━━━━

الأنواع المدعومة:
• Excel (.xlsx, .xls)
• CSV (.csv)
• Text (.txt)

سيتم فحص جميع الأرقام وإرسال تقرير
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // 📇 قوائم الاتصال
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'contact_lists' || data === 'my_lists') {
            const lists = getContactLists(userId);
            
            if (lists.length === 0) {
                await bot.editMessageText(`
❝ *قوائم جهات الاتصال* ❞

━━━━━━━━━━━━━━━━━━━━━
📇 لا توجد قوائم محفوظة
━━━━━━━━━━━━━━━━━━━━━

💡 يمكنك إنشاء قوائم من:
• استخراج من مجموعة
• استخراج من ملف
• استخراج من الويب
                `.trim(), {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '📥 استخراج بيانات', callback_data: 'extract_data' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            
            const btns = lists.slice(0, 10).map(l => [{
                text: `📇 ${l.name} (${l.count} رقم)`,
                callback_data: `list_${l.id}`
            }]);
            btns.push([{ text: '➕ إنشاء قائمة جديدة', callback_data: 'extract_data' }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'main' }]);
            
            await bot.editMessageText(`
❝ *قوائم جهات الاتصال* ❞

━━━━━━━━━━━━━━━━━━━━━
📇 *قوائمك المحفوظة:*
━━━━━━━━━━━━━━━━━━━━━
📊 عدد القوائم: ${lists.length}
━━━━━━━━━━━━━━━━━━━━━

💡 اختر قائمة لعرضها أو استخدامها
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }
        
        else if (data.startsWith('list_')) {
            const listId = parseInt(data.split('_')[1]);
            const list = getContactList(listId);
            
            if (!list) {
                await bot.editMessageText('❌ القائمة غير موجودة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            await bot.editMessageText(`
❝ *${list.name}* ❞

━━━━━━━━━━━━━━━━━━━━━
📊 *تفاصيل القائمة:*
━━━━━━━━━━━━━━━━━━━━━
📱 عدد الأرقام: *${list.count}*
📅 تاريخ الإنشاء: ${new Date(list.created_at).toLocaleDateString('ar')}
━━━━━━━━━━━━━━━━━━━━━

💡 *اختر إجراء:*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📤 إرسال رسالة للقائمة', callback_data: `send_to_list_${listId}` }],
                    [{ text: '📥 تحميل الأرقام', callback_data: `download_list_${listId}` }],
                    [{ text: '🗑️ حذف القائمة', callback_data: `delete_list_${listId}` }],
                    [{ text: '🔙 رجوع', callback_data: 'contact_lists' }]
                ]}
            });
        }
        
        else if (data.startsWith('download_list_')) {
            const listId = parseInt(data.split('_')[2]);
            const list = getContactList(listId);
            
            if (!list || !list.numbers) {
                await bot.editMessageText('❌ القائمة غير موجودة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            const numbers = JSON.parse(list.numbers);
            const filePath = `/tmp/list_${listId}_${Date.now()}.txt`;
            fs.writeFileSync(filePath, numbers.join('\n'));
            
            await bot.sendDocument(chatId, filePath, {
                caption: `
❝ *${list.name}* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 عدد الأرقام: *${numbers.length}*
━━━━━━━━━━━━━━━━━━━━━
                `.trim(),
                parse_mode: 'Markdown'
            });
            
            fs.unlinkSync(filePath);
        }
        
        else if (data.startsWith('delete_list_')) {
            const listId = parseInt(data.split('_')[2]);
            deleteContactList(listId);
            await bot.editMessageText('✅ تم حذف القائمة بنجاح', { 
                chat_id: chatId, message_id: msgId,
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'contact_lists' }]] }
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // 🤖 الرد التلقائي
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'auto_reply_menu') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            const autoReplyEnabled = getSetting('auto_reply_enabled') === 'true';
            const autoReplyMsg = getSetting('auto_reply_message') || 'شكراً لتواصلك!';
            
            await bot.editMessageText(`
❝ *الرد التلقائي* ❞

━━━━━━━━━━━━━━━━━━━━━
🤖 *الحالة:* ${autoReplyEnabled ? '✅ مفعّل' : '❌ معطّل'}
━━━━━━━━━━━━━━━━━━━━━

📝 *الرسالة الحالية:*
"${autoReplyMsg}"

━━━━━━━━━━━━━━━━━━━━━
💡 *الرد التلقائي يرد على:*
• الرسائل الجديدة
• عند عدم تواجدك
━━━━━━━━━━━━━━━━━━━━━
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: autoReplyEnabled ? '❌ إيقاف' : '✅ تفعيل', callback_data: 'toggle_auto_reply' }],
                    [{ text: '✏️ تغيير الرسالة', callback_data: 'edit_auto_reply' }],
                    [{ text: '📋 ردود مخصصة', callback_data: 'custom_replies' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }
        
        else if (data === 'toggle_auto_reply') {
            const current = getSetting('auto_reply_enabled') === 'true';
            setSetting('auto_reply_enabled', (!current).toString());
            
            await bot.editMessageText(`
✅ *تم ${!current ? 'تفعيل' : 'إيقاف'} الرد التلقائي*
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'auto_reply_menu' }]] }
            });
        }
        
        else if (data === 'edit_auto_reply') {
            userStates[chatId] = { action: 'edit_auto_reply', userId };
            await bot.editMessageText(`
❝ *تغيير رسالة الرد التلقائي* ❞

━━━━━━━━━━━━━━━━━━━━━
✍️ *أرسل الرسالة الجديدة:*
━━━━━━━━━━━━━━━━━━━━━

💡 يمكنك استخدام:
• {name} - اسم المرسل
• {time} - الوقت الحالي
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.cancelKeyboard
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // ❓ المساعدة
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'help') {
            await bot.editMessageText(`
❝ *دليل استخدام البوت* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 *إدارة الحسابات:*
━━━━━━━━━━━━━━━━━━━━━
• ربط حساب واتساب بالكود أو QR
• إدارة حسابات متعددة
• مراقبة حالة الاتصال

━━━━━━━━━━━━━━━━━━━━━
📤 *الإرسال:*
━━━━━━━━━━━━━━━━━━━━━
• إرسال فردي لرقم واحد
• إرسال جماعي لقائمة أرقام
• حملات تسويقية متقدمة

━━━━━━━━━━━━━━━━━━━━━
📥 *استخراج البيانات:*
━━━━━━━━━━━━━━━━━━━━━
• من مجموعات واتساب
• بالكلمات المفتاحية
• من صفحات الويب
• من ملفات Excel/CSV

━━━━━━━━━━━━━━━━━━━━━
🔄 *نقل الأعضاء:*
━━━━━━━━━━━━━━━━━━━━━
• نقل من مجموعة لأخرى
• دعم حسابات متعددة
• تأخير ذكي للحماية

━━━━━━━━━━━━━━━━━━━━━
⚙️ *أدوات إضافية:*
━━━━━━━━━━━━━━━━━━━━━
• فحص صحة الأرقام
• قوالب رسائل جاهزة
• جدولة الرسائل
• الرد التلقائي
• القائمة السوداء
            `.trim(), {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📞 الدعم الفني', callback_data: 'support' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }
        
        // ═══════════════════════════════════════════════════════════
        // 🔧 أخرى
        // ═══════════════════════════════════════════════════════════
        
        else if (data === 'support') {
            await bot.editMessageText(`
❝ *الدعم الفني* ❞

━━━━━━━━━━━━━━━━━━━━━
📞 *للمساعدة تواصل معنا:*
━━━━━━━━━━━━━━━━━━━━━

📱 تيليجرام: @YourUsername
⏰ متاح: 24/7

💡 *نحن هنا لمساعدتك!*
            `.trim(), { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.backKeyboard });
        }

        else if (data === 'cancel') {
            if (sessions[`p_${chatId}`]) {
                try { sessions[`p_${chatId}`].end(); } catch (e) {}
                delete sessions[`p_${chatId}`];
            }
            delete userStates[chatId];
            bot.emit('callback_query', { ...q, data: 'main' });
        }

    } catch (err) {
        console.error('Callback Error:', err.message);
    }
});


// 💬 معالج الرسائل النصية


bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const st = userStates[chatId];
    const isAdmin = userId === CONFIG.ADMIN_ID;

    if (!st || msg.text?.startsWith('/')) return;

    try {
        // ربط الهاتف
        if (st.action === 'phone' && msg.text) {
            const phone = msg.text.replace(/\D/g, '');
            if (phone.length < 10) {
                bot.sendMessage(chatId, '❌ رقم غير صحيح', KB.cancelKeyboard);
                return;
            }
            userStates[chatId] = { action: 'pairing', phone, userId: st.userId };
            bot.sendMessage(chatId, '⏳ جاري إنشاء الكود...');
            startPairing(bot, chatId, phone, st.userId);
        }

        // رقم المستلم للإرسال الفردي
        else if (st.action === 'recipient' && msg.text) {
            const to = msg.text.replace(/\D/g, '');
            if (to.length < 10) {
                bot.sendMessage(chatId, '❌ رقم غير صحيح', KB.cancelKeyboard);
                return;
            }
            userStates[chatId] = { ...st, action: 'message', to };
            bot.sendMessage(chatId, `
✍️ *أرسل الرسالة:*

💡 التنسيقات المدعومة:
*عريض* | _مائل_ | ~مشطوب~
\`كود\` | > اقتباس
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        // الرسالة للإرسال الفردي
        else if (st.action === 'message' && msg.text) {
            const sock = sessions[st.phone];
            if (!sock) {
                bot.sendMessage(chatId, '❌ الحساب غير متصل', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            try {
                await sock.sendMessage(`${st.to}@s.whatsapp.net`, { text: msg.text });
                logMessage(st.userId, st.phone, st.to, 'success');
                bot.sendMessage(chatId, '✅ تم إرسال الرسالة بنجاح', KB.backKeyboard);
            } catch (e) {
                logMessage(st.userId, st.phone, st.to, 'failed');
                bot.sendMessage(chatId, '❌ فشل الإرسال', KB.backKeyboard);
            }
            delete userStates[chatId];
        }

        // أرقام الإرسال الجماعي
        else if (st.action === 'bc_numbers' && msg.text) {
            const nums = extractNumbers(msg.text);
            if (nums.length === 0) {
                bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام صحيحة', KB.cancelKeyboard);
                return;
            }
            userStates[chatId] = { ...st, action: 'bc_message', numbers: nums };
            
            const message = st.templateContent 
                ? `✅ ${nums.length} رقم\n\n📝 القالب جاهز، اضغط إرسال أو عدل الرسالة:`
                : `✅ ${nums.length} رقم\n\n✍️ أرسل الرسالة:`;
            
            if (st.templateContent) {
                userStates[chatId].message = st.templateContent;
            }
            
            bot.sendMessage(chatId, message, KB.cancelKeyboard);
        }

        // رسالة الإرسال الجماعي
        else if (st.action === 'bc_message' && msg.text) {
            userStates[chatId] = { ...st, message: msg.text };
            const accounts = getUserAccounts(st.userId).filter(a => sessions[a.phone]);
            
            if (accounts.length === 0) {
                bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            const btns = [];
            for (let i = 0; i < accounts.length; i += 2) {
                const row = [{ text: `📱 ${accounts[i].phone}`, callback_data: `bcfrom_${accounts[i].phone}` }];
                if (accounts[i + 1]) row.push({ text: `📱 ${accounts[i + 1].phone}`, callback_data: `bcfrom_${accounts[i + 1].phone}` });
                btns.push(row);
            }
            btns.push([{ text: '📱 كل الحسابات (Rotation)', callback_data: 'bcfrom_all' }]);
            btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
            
            bot.sendMessage(chatId, `
📢 *${st.numbers.length} رقم*

اختر الحساب للإرسال منه:
            `.trim(), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns } });
        }

        // خطوات إنشاء الحملة
        else if (st.action === 'camp_name' && msg.text) {
            st.campaign.name = msg.text;
            st.action = 'camp_numbers';
            bot.sendMessage(chatId, `
📢 *الخطوة 2/5: الأرقام*

أرسل الأرقام أو ملف Excel/CSV
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (st.action === 'camp_numbers' && msg.text) {
            const nums = extractNumbers(msg.text);
            if (nums.length === 0) {
                bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام', KB.cancelKeyboard);
                return;
            }
            st.campaign.numbers = nums;
            st.action = 'camp_message';
            bot.sendMessage(chatId, `
✅ ${nums.length} رقم

📢 *الخطوة 3/5: الرسالة*

أرسل نص الرسالة:
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (st.action === 'camp_message' && msg.text) {
            st.campaign.message = msg.text;
            st.action = 'camp_accounts';
            
            const accounts = getUserAccounts(st.userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            st.campaign.selectedAccounts = [];
            bot.sendMessage(chatId, `
📢 *الخطوة 4/5: اختر الحسابات*

حدد الحسابات للإرسال منها:
            `.trim(), {
                parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, [])
            });
        }

        // القوالب
        else if (st.action === 'tpl_content' && msg.text) {
            st.template.content = msg.text;
            st.action = 'tpl_name';
            bot.sendMessage(chatId, '📝 أرسل اسم للقالب:', KB.cancelKeyboard);
        }

        else if (st.action === 'tpl_name' && msg.text) {
            createTemplate(st.userId, msg.text, st.template.content);
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم حفظ القالب: *${msg.text}*`, {
                parse_mode: 'Markdown', ...KB.backToKeyboard('templates')
            });
        }

        // القائمة السوداء
        else if (st.action === 'bl_add' && msg.text) {
            const nums = extractNumbers(msg.text);
            let added = 0;
            nums.forEach(n => {
                if (addToBlacklist(st.userId, n)) added++;
            });
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم إضافة ${added} رقم للقائمة السوداء`, {
                ...KB.backToKeyboard('blacklist')
            });
        }

        // الجدولة
        else if (st.action === 'sched_numbers' && msg.text) {
            const nums = extractNumbers(msg.text);
            if (nums.length === 0) {
                bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام', KB.cancelKeyboard);
                return;
            }
            st.scheduled.numbers = nums;
            st.action = 'sched_message';
            bot.sendMessage(chatId, `✅ ${nums.length} رقم\n\n✍️ أرسل الرسالة:`, KB.cancelKeyboard);
        }

        else if (st.action === 'sched_message' && msg.text) {
            st.scheduled.message = msg.text;
            st.action = 'sched_time';
            bot.sendMessage(chatId, `
⏰ *حدد وقت الإرسال:*

الصيغ المدعومة:
• \`14:30\` - وقت اليوم
• \`2024-01-15 14:30\` - تاريخ ووقت
• \`+1h\` - بعد ساعة
• \`+30m\` - بعد 30 دقيقة
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (st.action === 'sched_time' && msg.text) {
            const scheduledTime = parseScheduleTime(msg.text);
            if (!scheduledTime) {
                bot.sendMessage(chatId, '❌ صيغة الوقت غير صحيحة', KB.cancelKeyboard);
                return;
            }
            
            st.scheduled.time = scheduledTime;
            st.action = 'sched_account';
            
            const accounts = getUserAccounts(st.userId).filter(a => sessions[a.phone]);
            const btns = accounts.map(a => [{ text: `📱 ${a.phone}`, callback_data: `sched_from_${a.phone}` }]);
            btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
            
            bot.sendMessage(chatId, '📱 اختر الحساب للإرسال منه:', {
                reply_markup: { inline_keyboard: btns }
            });
        }

        // الرد التلقائي
        else if (st.action === 'ar_keywords' && msg.text) {
            st.autoReply.keywords = msg.text;
            st.action = 'ar_message';
            bot.sendMessage(chatId, '💬 *أرسل رسالة الرد:*', { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        }

        else if (st.action === 'ar_message' && msg.text) {
            createAutoReply(
                st.userId,
                st.autoReply.phone,
                st.autoReply.triggerType,
                st.autoReply.keywords || null,
                msg.text
            );
            delete userStates[chatId];
            bot.sendMessage(chatId, '✅ تم إضافة الرد التلقائي', {
                ...KB.backToKeyboard(`autoreply_${st.autoReply.phone}`)
            });
        }

        // تعديل كلمات الحظر
        else if (st.action === 'edit_block_keywords' && msg.text) {
            setSetting('unsubscribe_keywords', msg.text.trim());
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم تحديث كلمات الحظر:\n\`${msg.text.trim()}\``, {
                parse_mode: 'Markdown', ...KB.backToKeyboard('settings')
            });
        }

        // استخراج بالكلمات المفتاحية
        else if (st.action === 'extract_keywords' && msg.text) {
            const keywords = msg.text.trim();
            
            await bot.sendMessage(chatId, `
⏳ *جاري البحث...*

🔑 الكلمات: \`${keywords}\`

💡 يتم البحث في مصادر متعددة...
            `.trim(), { parse_mode: 'Markdown' });
            
            try {
                // البحث في Google
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keywords + ' phone number contact')}`;
                const response = await fetch(searchUrl, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'ar,en;q=0.9'
                    }
                });
                const html = await response.text();
                
                // استخراج الأرقام
                const phonePatterns = [
                    /\+?20[0-9]{10}/g,
                    /\+?966[0-9]{9}/g,
                    /\+?971[0-9]{9}/g,
                    /\+?[0-9]{10,15}/g,
                    /01[0-9]{9}/g,
                    /05[0-9]{8}/g
                ];
                
                let allNumbers = [];
                for (const pattern of phonePatterns) {
                    const matches = html.match(pattern) || [];
                    allNumbers.push(...matches);
                }
                
                const cleanedNumbers = [...new Set(
                    allNumbers
                        .map(n => n.replace(/\D/g, ''))
                        .filter(n => n.length >= 10 && n.length <= 15)
                )];
                
                if (cleanedNumbers.length === 0) {
                    await bot.sendMessage(chatId, `
❝ *لم يتم العثور على نتائج* ❞

━━━━━━━━━━━━━━━━━━━━━
🔑 الكلمات: ${keywords}
❌ لم يتم العثور على أرقام
━━━━━━━━━━━━━━━━━━━━━

💡 جرب كلمات مفتاحية أخرى
                    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
                    delete userStates[chatId];
                    return;
                }
                
                // حفظ كقائمة
                const listName = `بحث: ${keywords.substring(0, 20)}`;
                createContactList(st.userId, listName, cleanedNumbers);
                
                // إرسال ملف بالأرقام
                const numbersText = cleanedNumbers.join('\n');
                const filePath = `/tmp/keywords_${Date.now()}.txt`;
                fs.writeFileSync(filePath, numbersText);
                
                await bot.sendDocument(chatId, filePath, {
                    caption: `
❝ *تم استخراج الأرقام بنجاح!* ❞

━━━━━━━━━━━━━━━━━━━━━
🔑 الكلمات: ${keywords}
📱 عدد الأرقام: *${cleanedNumbers.length}*
━━━━━━━━━━━━━━━━━━━━━

✅ تم حفظها في قوائم جهات الاتصال
                    `.trim(),
                    parse_mode: 'Markdown'
                });
                
                fs.unlinkSync(filePath);
            } catch (e) {
                await bot.sendMessage(chatId, '❌ خطأ في البحث، حاول مرة أخرى', KB.backKeyboard);
            }
            delete userStates[chatId];
        }

        // استخراج من الويب
        else if (st.action === 'extract_web_url' && msg.text) {
            let url = msg.text.trim();
            if (!url.startsWith('http')) url = 'https://' + url;
            
            await bot.sendMessage(chatId, `
⏳ *جاري استخراج الأرقام...*

🌐 الرابط: ${url}
            `.trim(), { parse_mode: 'Markdown' });
            
            try {
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const html = await response.text();
                
                // استخراج الأرقام من HTML
                const phonePatterns = [
                    /\+?[0-9]{10,15}/g,
                    /\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
                    /[0-9]{2,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g
                ];
                
                let allNumbers = [];
                for (const pattern of phonePatterns) {
                    const matches = html.match(pattern) || [];
                    allNumbers.push(...matches);
                }
                
                // تنظيف وتصفية الأرقام
                const cleanedNumbers = [...new Set(
                    allNumbers
                        .map(n => n.replace(/\D/g, ''))
                        .filter(n => n.length >= 10 && n.length <= 15)
                )];
                
                if (cleanedNumbers.length === 0) {
                    await bot.sendMessage(chatId, `
❝ *لم يتم العثور على أرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
🌐 الرابط: ${url}
❌ لا توجد أرقام في هذه الصفحة
━━━━━━━━━━━━━━━━━━━━━
                    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
                    delete userStates[chatId];
                    return;
                }
                
                // حفظ كقائمة
                const listName = `ويب - ${new Date().toLocaleDateString('ar')}`;
                createContactList(st.userId, listName, cleanedNumbers);
                
                // إرسال ملف بالأرقام
                const numbersText = cleanedNumbers.join('\n');
                const filePath = `/tmp/numbers_${Date.now()}.txt`;
                fs.writeFileSync(filePath, numbersText);
                
                await bot.sendDocument(chatId, filePath, {
                    caption: `
❝ *تم استخراج الأرقام بنجاح!* ❞

━━━━━━━━━━━━━━━━━━━━━
🌐 من: ${url}
📱 عدد الأرقام: *${cleanedNumbers.length}*
━━━━━━━━━━━━━━━━━━━━━

✅ تم حفظها في قوائم جهات الاتصال
                    `.trim(),
                    parse_mode: 'Markdown'
                });
                
                fs.unlinkSync(filePath);
            } catch (e) {
                await bot.sendMessage(chatId, '❌ خطأ في الوصول للصفحة\nتأكد من صحة الرابط', KB.backKeyboard);
            }
            delete userStates[chatId];
        }

        // استخراج البيانات من مجموعة
        else if (st.action === 'extract_group' && msg.text) {
            const sock = sessions[st.phone];
            if (!sock) {
                bot.sendMessage(chatId, '❌ الحساب غير متصل', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            bot.sendMessage(chatId, '⏳ جاري البحث عن المجموعة...');
            
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups);
                const searchTerm = msg.text.toLowerCase();
                
                const matchedGroups = groupList.filter(g => 
                    g.subject.toLowerCase().includes(searchTerm) ||
                    g.id.includes(searchTerm)
                );
                
                if (matchedGroups.length === 0) {
                    bot.sendMessage(chatId, '❌ لم يتم العثور على مجموعة', KB.backKeyboard);
                    delete userStates[chatId];
                    return;
                }
                
                if (matchedGroups.length === 1) {
                    const group = matchedGroups[0];
                    const participants = group.participants.map(p => p.id.split('@')[0]);
                    
                    // حفظ كقائمة
                    createContactList(st.userId, group.subject, participants);
                    
                    bot.sendMessage(chatId, `
✅ *تم استخراج البيانات!*

👥 المجموعة: ${group.subject}
📱 الأعضاء: ${participants.length}

تم حفظها في قوائم جهات الاتصال
                    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
                } else {
                    const btns = matchedGroups.slice(0, 10).map(g => [{
                        text: `👥 ${g.subject} (${g.participants.length})`,
                        callback_data: `ext_grp_${g.id}`
                    }]);
                    btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
                    
                    userStates[chatId] = { ...st, groups: matchedGroups };
                    bot.sendMessage(chatId, '👥 *اختر المجموعة:*', {
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: btns }
                    });
                }
            } catch (e) {
                bot.sendMessage(chatId, '❌ خطأ في استخراج البيانات', KB.backKeyboard);
            }
            delete userStates[chatId];
        }

        // فحص رقم واحد
        else if (st.action === 'verify_single' && msg.text) {
            const phone = msg.text.replace(/\D/g, '');
            if (phone.length < 10) {
                await bot.sendMessage(chatId, '❌ رقم غير صحيح', KB.cancelKeyboard);
                return;
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            await bot.sendMessage(chatId, '⏳ جاري الفحص...');
            
            try {
                const sock = sessions[accounts[0].phone];
                const [result] = await sock.onWhatsApp(phone);
                
                if (result?.exists) {
                    await bot.sendMessage(chatId, `
❝ *نتيجة الفحص* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 الرقم: \`${phone}\`
✅ *موجود على واتساب*
━━━━━━━━━━━━━━━━━━━━━
                    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
                } else {
                    await bot.sendMessage(chatId, `
❝ *نتيجة الفحص* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 الرقم: \`${phone}\`
❌ *غير موجود على واتساب*
━━━━━━━━━━━━━━━━━━━━━
                    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
                }
            } catch (e) {
                await bot.sendMessage(chatId, '❌ خطأ في الفحص', KB.backKeyboard);
            }
            delete userStates[chatId];
        }
        
        // فحص قائمة أرقام
        else if (st.action === 'verify_list' && msg.text) {
            const numbers = extractNumbers(msg.text);
            if (numbers.length === 0) {
                await bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام صحيحة', KB.cancelKeyboard);
                return;
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            await bot.sendMessage(chatId, `⏳ جاري فحص ${numbers.length} رقم...`);
            
            try {
                const sock = sessions[accounts[0].phone];
                const validNumbers = [];
                const invalidNumbers = [];
                
                for (const num of numbers) {
                    try {
                        const [result] = await sock.onWhatsApp(num);
                        if (result?.exists) {
                            validNumbers.push(num);
                        } else {
                            invalidNumbers.push(num);
                        }
                    } catch (e) {
                        invalidNumbers.push(num);
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
                
                // حفظ الأرقام الصالحة كقائمة
                if (validNumbers.length > 0) {
                    createContactList(userId, `فحص - ${new Date().toLocaleDateString('ar')}`, validNumbers);
                }
                
                // إرسال ملف بالنتائج
                const resultText = `الأرقام الصالحة (${validNumbers.length}):\n${validNumbers.join('\n')}\n\nالأرقام غير الصالحة (${invalidNumbers.length}):\n${invalidNumbers.join('\n')}`;
                const filePath = `/tmp/verify_${Date.now()}.txt`;
                fs.writeFileSync(filePath, resultText);
                
                await bot.sendDocument(chatId, filePath, {
                    caption: `
❝ *نتيجة الفحص* ❞

━━━━━━━━━━━━━━━━━━━━━
📊 *الإحصائيات:*
━━━━━━━━━━━━━━━━━━━━━
📱 إجمالي الأرقام: *${numbers.length}*
✅ صالحة: *${validNumbers.length}*
❌ غير صالحة: *${invalidNumbers.length}*
━━━━━━━━━━━━━━━━━━━━━

✅ تم حفظ الأرقام الصالحة في قوائمك
                    `.trim(),
                    parse_mode: 'Markdown'
                });
                
                fs.unlinkSync(filePath);
            } catch (e) {
                await bot.sendMessage(chatId, '❌ خطأ في الفحص', KB.backKeyboard);
            }
            delete userStates[chatId];
        }
        
        // تغيير رسالة الرد التلقائي
        else if (st.action === 'edit_auto_reply' && msg.text) {
            setSetting('auto_reply_message', msg.text.trim());
            await bot.sendMessage(chatId, `
✅ *تم تحديث رسالة الرد التلقائي*

📝 الرسالة الجديدة:
"${msg.text.trim()}"
            `.trim(), { parse_mode: 'Markdown', ...KB.backToKeyboard('auto_reply_menu') });
            delete userStates[chatId];
        }

        // أوامر الأدمن
        else if (st.action === 'a_activate' && msg.text && isAdmin) {
            const targetId = parseInt(msg.text);
            let user = getUser(targetId);
            if (!user) {
                createUser(targetId, '', 'مستخدم');
                user = getUser(targetId);
            }
            
            const plans = getPlans();
            const btns = plans.map(p => [{ text: p.name, callback_data: `actplan_${targetId}_${p.id}` }]);
            btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
            
            bot.sendMessage(chatId, `👤 *${user.first_name}*\n\nاختر الباقة:`, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (st.action === 'a_remove_sub' && msg.text && isAdmin) {
            const targetId = parseInt(msg.text);
            const user = getUser(targetId);
            if (!user) {
                bot.sendMessage(chatId, '❌ المستخدم غير موجود', KB.cancelKeyboard);
                return;
            }
            if (!user.is_subscribed) {
                bot.sendMessage(chatId, '❌ المستخدم ليس لديه اشتراك', KB.cancelKeyboard);
                return;
            }
            
            db.prepare("UPDATE users SET is_subscribed = 0, subscription_type = NULL, subscription_end = NULL, max_accounts = 0 WHERE user_id = ?").run(targetId);
            delete userStates[chatId];
            
            bot.sendMessage(chatId, `✅ تم إلغاء اشتراك ${user.first_name}`, KB.backKeyboard);
            bot.sendMessage(targetId, '❌ *تم إلغاء اشتراكك*\n\nتواصل مع الدعم للتجديد', { parse_mode: 'Markdown' });
        }

        else if (st.action === 'a_broadcast' && msg.text && isAdmin) {
            const users = db.prepare("SELECT user_id FROM users").all();
            let sent = 0;
            
            for (const u of users) {
                try {
                    await bot.sendMessage(u.user_id, msg.text, { parse_mode: 'Markdown' });
                    sent++;
                } catch (e) {}
            }
            
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم الإرسال لـ ${sent}/${users.length} مستخدم`, KB.backKeyboard);
        }

        else if (st.action === 'add_plan' && msg.text && isAdmin) {
            const parts = msg.text.split('|');
            if (parts.length >= 5) {
                db.prepare("INSERT INTO plans (name, price, duration_days, max_accounts, max_messages) VALUES (?, ?, ?, ?, ?)")
                    .run(parts[0], parseFloat(parts[1]), parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4]));
                bot.sendMessage(chatId, '✅ تم إضافة الباقة', KB.backKeyboard);
            } else {
                bot.sendMessage(chatId, '❌ صيغة خاطئة', KB.cancelKeyboard);
            }
            delete userStates[chatId];
        }

        else if (st.action === 'add_payment' && msg.text && isAdmin) {
            const parts = msg.text.split('|');
            if (parts.length >= 2) {
                db.prepare("INSERT INTO payment_methods (name, number) VALUES (?, ?)").run(parts[0].trim(), parts[1].trim());
                bot.sendMessage(chatId, '✅ تم الإضافة', KB.backKeyboard);
            } else {
                bot.sendMessage(chatId, '❌ صيغة خاطئة', KB.cancelKeyboard);
            }
            delete userStates[chatId];
        }

    } catch (err) {
        console.error('Message Error:', err.message);
    }
});


// 📷 معالج الصور (سكرين شوت الدفع)


bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const st = userStates[chatId];

    if (!st || st.action !== 'waiting_screenshot') return;

    const photoId = msg.photo[msg.photo.length - 1].file_id;
    const plan = getPlan(st.planId);
    const user = getUser(userId);
    const reqId = createPaymentRequest(userId, st.planId, photoId);

    bot.sendPhoto(CONFIG.ADMIN_ID, photoId, {
        caption: `
💳 *طلب دفع جديد #${reqId}*

👤 ${user.first_name}
🆔 \`${userId}\`
👤 @${user.username || 'N/A'}

📦 ${plan.name}
💰 ${plan.price} جنيه
        `.trim(),
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ قبول', callback_data: `approve_${reqId}` }, { text: '❌ رفض', callback_data: `reject_${reqId}` }]
            ]
        }
    });

    bot.sendMessage(chatId, `
✅ *تم إرسال طلبك!*

رقم الطلب: #${reqId}
سيتم المراجعة قريباً
    `.trim(), { parse_mode: 'Markdown', ...KB.backKeyboard });
    
    delete userStates[chatId];
});


// 📁 معالج الملفات


bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const st = userStates[chatId];

    if (!st || (st.action !== 'bc_file' && st.action !== 'camp_numbers' && st.action !== 'extract_file' && st.action !== 'verify_file')) return;

    const fileName = msg.document.file_name.toLowerCase();
    if (!fileName.match(/\.(xlsx|xls|csv|txt)$/)) {
        await bot.sendMessage(chatId, `
❝ *نوع الملف غير مدعوم* ❞

━━━━━━━━━━━━━━━━━━━━━
❌ الملف: ${msg.document.file_name}
━━━━━━━━━━━━━━━━━━━━━

✅ الأنواع المدعومة:
• Excel (.xlsx, .xls)
• CSV (.csv)
• Text (.txt)
        `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        return;
    }

    try {
        await bot.sendMessage(chatId, '⏳ جاري قراءة الملف...');
        
        const file = await bot.getFile(msg.document.file_id);
        const res = await fetch(`https://api.telegram.org/file/bot${CONFIG.TOKEN}/${file.file_path}`);
        const buf = Buffer.from(await res.arrayBuffer());

        let nums = [];
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const wb = xlsx.read(buf, { type: 'buffer' });
            xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).forEach(row => {
                row.forEach(cell => {
                    if (cell) nums.push(...extractNumbers(cell.toString()));
                });
            });
        } else {
            nums = extractNumbers(buf.toString('utf-8'));
        }

        nums = [...new Set(nums)];
        if (nums.length === 0) {
            await bot.sendMessage(chatId, `
❝ *لم يتم العثور على أرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
📁 الملف: ${msg.document.file_name}
❌ لا توجد أرقام صالحة
━━━━━━━━━━━━━━━━━━━━━
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
            return;
        }

        if (st.action === 'extract_file') {
            // حفظ كقائمة
            const listName = `ملف: ${msg.document.file_name.substring(0, 20)}`;
            createContactList(userId, listName, nums);
            
            // إرسال ملف بالأرقام المستخرجة
            const numbersText = nums.join('\n');
            const filePath = `/tmp/extracted_${Date.now()}.txt`;
            fs.writeFileSync(filePath, numbersText);
            
            await bot.sendDocument(chatId, filePath, {
                caption: `
❝ *تم استخراج الأرقام بنجاح!* ❞

━━━━━━━━━━━━━━━━━━━━━
📁 من: ${msg.document.file_name}
📱 عدد الأرقام: *${nums.length}*
━━━━━━━━━━━━━━━━━━━━━

✅ تم حفظها في قوائم جهات الاتصال
                `.trim(),
                parse_mode: 'Markdown'
            });
            
            fs.unlinkSync(filePath);
            delete userStates[chatId];
        } else if (st.action === 'bc_file') {
            userStates[chatId] = { ...st, action: 'bc_message', numbers: nums };
            await bot.sendMessage(chatId, `
❝ *تم استخراج الأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
📱 عدد الأرقام: *${nums.length}*
━━━━━━━━━━━━━━━━━━━━━

✍️ *أرسل الرسالة الآن:*
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        } else if (st.action === 'camp_numbers') {
            st.campaign.numbers = nums;
            st.action = 'camp_message';
            await bot.sendMessage(chatId, `
❝ *تم استخراج الأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
عدد الأرقام: *${nums.length}*
━━━━━━━━━━━━━━━━━━━━━

*الخطوة 3/5: الرسالة*

أرسل نص الرسالة:
            `.trim(), { parse_mode: 'Markdown', ...KB.cancelKeyboard });
        } else if (st.action === 'verify_file') {
            // فحص الأرقام من ملف
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة للفحص', KB.backKeyboard);
                delete userStates[chatId];
                return;
            }
            
            const sock = sessions[accounts[0].phone];
            await bot.sendMessage(chatId, `⏳ جاري فحص ${nums.length} رقم...`);
            
            let valid = [];
            let invalid = [];
            
            for (let i = 0; i < nums.length; i++) {
                try {
                    const [result] = await sock.onWhatsApp(nums[i]);
                    if (result && result.exists) {
                        valid.push(nums[i]);
                    } else {
                        invalid.push(nums[i]);
                    }
                    
                    // تحديث كل 10 أرقام
                    if ((i + 1) % 10 === 0) {
                        await bot.sendMessage(chatId, `⏳ تم فحص ${i + 1}/${nums.length}...`);
                    }
                    
                    // تأخير بسيط
                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    invalid.push(nums[i]);
                }
            }
            
            // إرسال النتائج
            const validFile = `/tmp/valid_${Date.now()}.txt`;
            fs.writeFileSync(validFile, valid.join('\n'));
            
            await bot.sendDocument(chatId, validFile, {
                caption: `
❝ *نتيجة فحص الأرقام* ❞

━━━━━━━━━━━━━━━━━━━━━
إجمالي الأرقام: *${nums.length}*
صالحة (على واتساب): *${valid.length}*
غير صالحة: *${invalid.length}*
نسبة النجاح: *${Math.round(valid.length/nums.length*100)}%*
━━━━━━━━━━━━━━━━━━━━━

تم حفظ الأرقام الصالحة في الملف المرفق
                `.trim(),
                parse_mode: 'Markdown'
            });
            
            fs.unlinkSync(validFile);
            delete userStates[chatId];
        }
    } catch (e) {
        console.error('File Error:', e.message);
        await bot.sendMessage(chatId, '❌ خطأ في قراءة الملف', KB.cancelKeyboard);
    }
});


// 🚀 بدء التشغيل


async function start() {
    console.log('📱 Loading accounts...');
    await loadAccounts(bot);
    
    console.log('📆 Starting scheduler...');
    startScheduler(bot);
    
    console.log('✅ Bot is running!');
}

start();
