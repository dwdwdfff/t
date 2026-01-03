// 🚀 واتساب ماستر برو v4.0

import TelegramBot from 'node-telegram-bot-api';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

import { CONFIG } from './config.js';
import { 
    db, initDatabase, getSetting, setSetting,
    getUser, createUser, isSubscribed, activateSubscription,
    getUserAccounts, canAddAccount, deleteAccount,
    getPlans, getPlan, getPaymentMethods, createPaymentRequest, getPendingRequests,
    getTemplates, getTemplate, createTemplate, updateTemplateUsage, deleteTemplate,
    getBlacklist, addToBlacklist, removeFromBlacklist,
    getScheduledMessages, createScheduledMessage, deleteScheduledMessage,
    getCampaigns, getCampaign, createCampaign, deleteCampaign,
    getAutoReplies, getAutoReply, createAutoReply, toggleAutoReply, deleteAutoReply,
    getContactLists, getContactList, createContactList, deleteContactList,
    logMessage
} from './database/init.js';

import { 
    sessions, userStates, 
    startPairing, startQR, reconnect, loadAccounts,
    sendTextMessage
} from './handlers/whatsapp.js';

import { 
    startCampaign, pauseCampaign, resumeCampaign, cancelCampaign, 
    getCampaignReport
} from './handlers/campaigns.js';

import { startScheduler, parseScheduleTime, formatScheduleTime } from './handlers/scheduler.js';
import { extractNumbers, formatDateShort, getTimeRemaining, createProgressBar, messageTemplates } from './utils/helpers.js';
import * as KB from './utils/keyboards.js';

// تهيئة البوت
if (!fs.existsSync(CONFIG.ACCOUNTS_DIR)) {
    fs.mkdirSync(CONFIG.ACCOUNTS_DIR, { recursive: true });
}

initDatabase();

const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
console.log(`🚀 ${CONFIG.BOT_NAME} v${CONFIG.BOT_VERSION}`);

// ════════════════════════════════════════════════════════════════
// 🏠 أمر البداية
// ════════════════════════════════════════════════════════════════

bot.onText(/\/start/, async (msg) => {
    const { id } = msg.from;
    const firstName = msg.from.first_name || 'صديقي';
    createUser(id, msg.from.username || '', firstName);

    if (id === CONFIG.ADMIN_ID) {
        await bot.sendMessage(msg.chat.id, `👑 *مرحباً ${firstName}!*\n\n🚀 ${CONFIG.BOT_NAME}\n📦 v${CONFIG.BOT_VERSION}`, 
            { parse_mode: 'Markdown', ...KB.mainAdminKeyboard });
    } else if (isSubscribed(id)) {
        const user = getUser(id);
        const accounts = getUserAccounts(id);
        await bot.sendMessage(msg.chat.id, `👋 *مرحباً ${firstName}!*\n\n💎 ${user.subscription_type}\n📱 ${accounts.length}/${user.max_accounts} حساب\n📅 ينتهي: ${formatDateShort(user.subscription_end)}`, 
            { parse_mode: 'Markdown', ...KB.mainUserKeyboard });
    } else {
        await bot.sendMessage(msg.chat.id, `🚀 *${CONFIG.BOT_NAME}*\n\n👋 أهلاً *${firstName}*!\n\nأقوى بوت لإدارة واتساب`, 
            { parse_mode: 'Markdown', ...KB.subscribeKeyboard });
    }
});

// ════════════════════════════════════════════════════════════════
// 🔘 معالج الأزرار
// ════════════════════════════════════════════════════════════════

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
        // ════════════════════════════════════════════════════════
        // 🏠 القائمة الرئيسية
        // ════════════════════════════════════════════════════════
        
        if (data === 'main' || data === 'none') {
            delete userStates[chatId];
            if (data === 'none') return;
            
            if (isAdmin) {
                await bot.editMessageText(`👑 *مرحباً ${firstName}!*\n\n🚀 ${CONFIG.BOT_NAME}`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.mainAdminKeyboard
                });
            } else if (subscribed) {
                const user = getUser(userId);
                const accounts = getUserAccounts(userId);
                await bot.editMessageText(`👋 *مرحباً ${firstName}!*\n\n💎 ${user.subscription_type}\n📱 ${accounts.length}/${user.max_accounts} حساب`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.mainUserKeyboard
                });
            } else {
                await bot.editMessageText(`🚀 *${CONFIG.BOT_NAME}*\n\n👋 أهلاً *${firstName}*!`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.subscribeKeyboard
                });
            }
        }

        // ════════════════════════════════════════════════════════
        // 💎 الاشتراك
        // ════════════════════════════════════════════════════════
        
        else if (data === 'subscribe') {
            const plans = getPlans();
            let txt = `💎 *اختر باقتك:*\n\n`;
            plans.forEach(p => {
                txt += `*${p.name}* - ${p.price} جنيه\n`;
                txt += `📱 ${p.max_accounts} حساب | ⏱ ${p.duration_days} يوم\n\n`;
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
            
            await bot.editMessageText(`📦 *${plan.name}*\n\n💰 ${plan.price} جنيه\n⏱ ${plan.duration_days} يوم\n📱 ${plan.max_accounts} حساب\n\n💳 *اختر طريقة الدفع:*`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.paymentMethodsKeyboard(methods, planId)
            });
        }

        else if (data.startsWith('pay_')) {
            const [_, methodId, planId] = data.split('_').map(Number);
            const method = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(methodId);
            const plan = getPlan(planId);
            userStates[chatId] = { action: 'waiting_screenshot', planId, methodId };
            
            await bot.editMessageText(`💳 *${method.name}*\n\n📦 ${plan.name} - ${plan.price} جنيه\n📱 الرقم: \`${method.number}\`\n\n✅ بعد التحويل أرسل صورة الإيصال`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'mysub') {
            if (!subscribed) {
                await bot.editMessageText('❌ ليس لديك اشتراك', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [
                        [{ text: '💎 اشترك الآن', callback_data: 'subscribe' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            const user = getUser(userId);
            const accounts = getUserAccounts(userId);
            await bot.editMessageText(`💎 *اشتراكك*\n\n📦 ${user.subscription_type}\n📱 ${accounts.length}/${user.max_accounts} حساب\n📅 ينتهي: ${formatDateShort(user.subscription_end)}\n⏳ ${getTimeRemaining(user.subscription_end)}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '🔄 تجديد', callback_data: 'subscribe' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        // ════════════════════════════════════════════════════════
        // 📱 الحسابات
        // ════════════════════════════════════════════════════════
        
        else if (data === 'accounts') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            const accounts = getUserAccounts(userId);
            if (accounts.length === 0) {
                await bot.editMessageText(`📱 *حساباتك*\n\nلا توجد حسابات مربوطة`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ إضافة حساب', callback_data: 'add_acc' }],
                        [{ text: '🔙 رجوع', callback_data: 'main' }]
                    ]}
                });
                return;
            }
            
            await bot.editMessageText(`📱 *حساباتك (${accounts.length})*\n\n🟢 متصل | 🔴 غير متصل`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.accountsMenuKeyboard(accounts, sessions)
            });
        }

        else if (data === 'add_acc') {
            if (!canAddAccount(userId)) {
                await bot.answerCallbackQuery(q.id, { text: '❌ وصلت للحد الأقصى', show_alert: true });
                return;
            }
            await bot.editMessageText(`➕ *إضافة حساب*\n\n🔢 *كود* - أسرع\n📷 *QR* - تقليدي`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.addAccountKeyboard
            });
        }

        else if (data === 'pair') {
            userStates[chatId] = { action: 'phone', userId };
            await bot.editMessageText(`🔢 *الربط بالكود*\n\nأرسل رقم الهاتف:\n\`201234567890\``, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
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
            await bot.editMessageText(`📱 *${phone}*\n\nالحالة: ${isOnline ? '🟢 متصل' : '🔴 غير متصل'}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.accountActionsKeyboard(phone, isOnline)
            });
        }

        else if (data.startsWith('recon_')) {
            const phone = data.split('_')[1];
            await bot.editMessageText('⏳ جاري إعادة الاتصال...', { chat_id: chatId, message_id: msgId });
            await reconnect(bot, phone, chatId, userId);
        }

        else if (data.startsWith('del_') && !data.includes('tpl') && !data.includes('sched') && !data.includes('ar')) {
            const phone = data.split('_')[1];
            if (sessions[phone]) {
                try { await sessions[phone].logout(); } catch (e) {}
                delete sessions[phone];
            }
            deleteAccount(phone);
            const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
            if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
            await bot.editMessageText('🗑️ تم حذف الحساب', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        // ════════════════════════════════════════════════════════
        // 📤 الإرسال
        // ════════════════════════════════════════════════════════
        
        else if (data === 'send') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            await bot.editMessageText(`📤 *الإرسال*\n\n📤 فردي - رسالة لرقم\n📢 حملة - إرسال جماعي`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.sendMenuKeyboard
            });
        }

        else if (data === 'single') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText('❌ لا توجد حسابات متصلة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            const btns = accounts.map(a => [{ text: `📱 ${a.phone}`, callback_data: `from_${a.phone}` }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'send' }]);
            
            await bot.editMessageText('📱 *اختر الحساب:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('from_')) {
            const phone = data.split('_')[1];
            userStates[chatId] = { action: 'recipient', phone, userId };
            await bot.editMessageText(`📤 *إرسال من ${phone}*\n\nأرسل رقم المستلم:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        // ════════════════════════════════════════════════════════
        // 📢 الحملات
        // ════════════════════════════════════════════════════════
        
        else if (data === 'campaigns') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            await bot.editMessageText(`📢 *الحملات*\n\nإنشاء وإدارة حملات الإرسال`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.campaignMenuKeyboard
            });
        }

        else if (data === 'new_campaign') {
            userStates[chatId] = { action: 'camp_name', userId, campaign: {} };
            await bot.editMessageText(`📢 *حملة جديدة*\n\n1️⃣ أرسل اسم الحملة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
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
            await bot.editMessageText(`📢 *${camp.name}*\n\n📊 ${camp.status}\n👥 ${report.totalRecipients} مستلم\n✅ ${report.sent} | ❌ ${report.failed}`, {
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
            await bot.editMessageText('⏸️ تم إيقاف الحملة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
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
            await bot.editMessageText(`📱 *اختر الحسابات:*\n\nالمحدد: ${st.campaign.selectedAccounts.length}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, st.campaign.selectedAccounts)
            });
        }

        else if (data === 'sel_all_acc') {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            st.campaign.selectedAccounts = accounts.map(a => a.phone);
            
            await bot.editMessageText(`📱 *اختر الحسابات:*\n\nالمحدد: ${st.campaign.selectedAccounts.length}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, st.campaign.selectedAccounts)
            });
        }

        else if (data === 'desel_all_acc') {
            const st = userStates[chatId];
            if (!st?.campaign) return;
            
            st.campaign.selectedAccounts = [];
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            
            await bot.editMessageText(`📱 *اختر الحسابات:*\n\nالمحدد: 0`, {
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
                await bot.editMessageText(`🔄 *اختر نوع التبديل:*`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.rotationModeKeyboard
                });
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
            
            await bot.editMessageText(`✅ *تم إنشاء الحملة!*\n\n📋 ${st.campaign.name}\n👥 ${st.campaign.numbers.length} مستلم\n📱 ${st.campaign.selectedAccounts.length} حساب`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '▶️ بدء الآن', callback_data: `camp_start_${campId}` }],
                    [{ text: '📋 لاحقاً', callback_data: 'campaigns' }]
                ]}
            });
        }

        // ════════════════════════════════════════════════════════
        // 📥 استخراج البيانات
        // ════════════════════════════════════════════════════════
        
        else if (data === 'extract_data') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            await bot.editMessageText(`📥 *استخراج البيانات*\n\nاستخرج أرقام من مصادر مختلفة`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.extractDataKeyboard
            });
        }

        else if (data === 'extract_group') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText('❌ لا توجد حسابات متصلة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            const btns = accounts.map(a => [{ text: `📱 ${a.phone}`, callback_data: `ext_acc_${a.phone}` }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'extract_data' }]);
            
            await bot.editMessageText('📱 *اختر الحساب:*', {
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
            
            await bot.editMessageText('⏳ جاري تحميل المجموعات...', { chat_id: chatId, message_id: msgId });
            
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups).filter(g => g.id.endsWith('@g.us'));
                
                if (groupList.length === 0) {
                    await bot.editMessageText('❌ لا توجد مجموعات', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                    return;
                }
                
                userStates[chatId] = { action: 'extract_from_group', phone, userId, groups: groupList };
                
                await bot.editMessageText(`👥 *اختر المجموعة:*\n\nوجدنا ${groupList.length} مجموعة`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    ...KB.groupsKeyboard(groupList, 'extgrp', 'extract_data')
                });
            } catch (e) {
                await bot.editMessageText('❌ خطأ في تحميل المجموعات', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
            }
        }

        else if (data.startsWith('extgrp_')) {
            const st = userStates[chatId];
            if (!st?.groups) return;
            
            const groupId = data.replace('extgrp_', '') + '@g.us';
            const group = st.groups.find(g => g.id === groupId);
            if (!group) return;
            
            const participants = group.participants?.map(p => p.id.split('@')[0]) || [];
            
            if (participants.length === 0) {
                await bot.editMessageText('❌ لا يوجد أعضاء', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                delete userStates[chatId];
                return;
            }
            
            // حفظ كقائمة
            createContactList(st.userId, group.subject, participants);
            
            // إرسال ملف
            const filePath = `/tmp/group_${Date.now()}.txt`;
            fs.writeFileSync(filePath, participants.join('\n'));
            
            await bot.sendDocument(chatId, filePath, {
                caption: `✅ *تم استخراج ${participants.length} رقم*\n\n👥 ${group.subject}\n📇 تم الحفظ في قوائمك`,
                parse_mode: 'Markdown'
            });
            
            fs.unlinkSync(filePath);
            delete userStates[chatId];
        }

        else if (data === 'extract_web') {
            userStates[chatId] = { action: 'extract_web_keywords', userId };
            await bot.editMessageText(`🌐 *استخراج من الويب*\n\nأرسل كلمات البحث:\n\nمثال:\n\`شركات عقارات مصر\`\n\`مطاعم الرياض\``, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'my_lists') {
            const lists = getContactLists(userId);
            if (lists.length === 0) {
                await bot.editMessageText('❌ لا توجد قوائم محفوظة', {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('extract_data')
                });
                return;
            }
            
            const btns = lists.slice(0, 10).map(l => [{
                text: `📇 ${l.name} (${l.count})`,
                callback_data: `list_${l.id}`
            }]);
            btns.push([{ text: '🔙 رجوع', callback_data: 'extract_data' }]);
            
            await bot.editMessageText('📇 *قوائمك:*', {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: btns }
            });
        }

        else if (data.startsWith('list_')) {
            const listId = parseInt(data.split('_')[1]);
            const list = getContactList(listId);
            if (!list) return;
            
            const contacts = JSON.parse(list.contacts);
            
            await bot.editMessageText(`📇 *${list.name}*\n\n👥 ${contacts.length} رقم`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '📤 استخدام في حملة', callback_data: `use_list_${listId}` }],
                    [{ text: '📥 تحميل كملف', callback_data: `download_list_${listId}` }],
                    [{ text: '🗑️ حذف', callback_data: `del_list_${listId}` }],
                    [{ text: '🔙 رجوع', callback_data: 'my_lists' }]
                ]}
            });
        }

        else if (data.startsWith('download_list_')) {
            const listId = parseInt(data.split('_')[2]);
            const list = getContactList(listId);
            if (!list) return;
            
            const contacts = JSON.parse(list.contacts);
            const filePath = `/tmp/list_${Date.now()}.txt`;
            fs.writeFileSync(filePath, contacts.join('\n'));
            
            await bot.sendDocument(chatId, filePath, { caption: `📇 ${list.name}` });
            fs.unlinkSync(filePath);
        }

        else if (data.startsWith('del_list_')) {
            const listId = parseInt(data.split('_')[2]);
            deleteContactList(listId);
            await bot.editMessageText('🗑️ تم حذف القائمة', { chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('my_lists') });
        }

        else if (data.startsWith('use_list_')) {
            const listId = parseInt(data.split('_')[2]);
            const list = getContactList(listId);
            if (!list) return;
            
            const contacts = JSON.parse(list.contacts);
            userStates[chatId] = { action: 'camp_name', userId, campaign: { numbers: contacts, fromList: true } };
            
            await bot.editMessageText(`✅ تم تحميل ${contacts.length} رقم\n\n📢 *أرسل اسم الحملة:*`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        // ════════════════════════════════════════════════════════
        // 🔄 نقل الأعضاء
        // ════════════════════════════════════════════════════════
        
        else if (data === 'transfer_members') {
            if (!subscribed && !isAdmin) {
                await bot.editMessageText('❌ اشترك أولاً', {
                    chat_id: chatId, message_id: msgId,
                    reply_markup: { inline_keyboard: [[{ text: '💎 اشترك', callback_data: 'subscribe' }]] }
                });
                return;
            }
            
            await bot.editMessageText(`🔄 *نقل الأعضاء*\n\nنقل أعضاء من مجموعة لأخرى`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.transferMenuKeyboard
            });
        }

        else if (data === 'start_transfer') {
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            if (accounts.length === 0) {
                await bot.editMessageText('❌ لا توجد حسابات متصلة', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                return;
            }
            
            userStates[chatId] = { action: 'transfer_select_accounts', userId, transfer: { selectedAccounts: [] } };
            
            await bot.editMessageText(`🔄 *نقل الأعضاء*\n\n1️⃣ اختر الحسابات للإضافة:\n(يمكن اختيار أكثر من حساب)`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, [])
            });
        }

        else if (data === 'transfer_settings') {
            const minDelay = getSetting('transfer_delay_min') || '2';
            const maxDelay = getSetting('transfer_delay_max') || '5';
            
            await bot.editMessageText(`⚙️ *إعدادات النقل*\n\n⏱️ التأخير: ${minDelay}-${maxDelay} ثانية`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.transferSettingsKeyboard({ min: minDelay, max: maxDelay, accountsCount: 1 })
            });
        }

        else if (data === 'set_transfer_delay') {
            await bot.editMessageText(`⏱️ *تأخير النقل*\n\nاختر التأخير بين كل إضافة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.transferDelayKeyboard
            });
        }

        else if (data.startsWith('td_')) {
            const [_, min, max] = data.split('_');
            setSetting('transfer_delay_min', min);
            setSetting('transfer_delay_max', max);
            await bot.editMessageText(`✅ تم: ${min}-${max} ثانية`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('transfer_settings')
            });
        }

        // اختيار حسابات النقل
        else if (data.startsWith('sel_acc_') && userStates[chatId]?.action === 'transfer_select_accounts') {
            const phone = data.split('_')[2];
            const st = userStates[chatId];
            
            const idx = st.transfer.selectedAccounts.indexOf(phone);
            if (idx > -1) {
                st.transfer.selectedAccounts.splice(idx, 1);
            } else {
                st.transfer.selectedAccounts.push(phone);
            }
            
            const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
            await bot.editMessageText(`🔄 *اختر الحسابات:*\n\nالمحدد: ${st.transfer.selectedAccounts.length}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, st.transfer.selectedAccounts)
            });
        }

        else if (data === 'next_step' && userStates[chatId]?.action === 'transfer_select_accounts') {
            const st = userStates[chatId];
            if (!st.transfer.selectedAccounts?.length) {
                await bot.answerCallbackQuery(q.id, { text: '❌ اختر حساب واحد على الأقل', show_alert: true });
                return;
            }
            
            // تحميل المجموعات من أول حساب
            const phone = st.transfer.selectedAccounts[0];
            const sock = sessions[phone];
            
            await bot.editMessageText('⏳ جاري تحميل المجموعات...', { chat_id: chatId, message_id: msgId });
            
            try {
                const groups = await sock.groupFetchAllParticipating();
                const groupList = Object.values(groups).filter(g => g.id.endsWith('@g.us'));
                
                if (groupList.length === 0) {
                    await bot.editMessageText('❌ لا توجد مجموعات', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                    delete userStates[chatId];
                    return;
                }
                
                st.transfer.groups = groupList;
                st.action = 'transfer_select_source';
                
                await bot.editMessageText(`2️⃣ *اختر المجموعة المصدر:*\n\n(المجموعة التي ستنقل منها)`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    ...KB.groupsKeyboard(groupList, 'srcgrp', 'transfer_members')
                });
            } catch (e) {
                await bot.editMessageText('❌ خطأ في تحميل المجموعات', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
                delete userStates[chatId];
            }
        }

        else if (data.startsWith('srcgrp_')) {
            const st = userStates[chatId];
            if (!st?.transfer?.groups) return;
            
            const groupId = data.replace('srcgrp_', '') + '@g.us';
            const sourceGroup = st.transfer.groups.find(g => g.id === groupId);
            if (!sourceGroup) return;
            
            st.transfer.sourceGroup = sourceGroup;
            st.action = 'transfer_select_dest';
            
            const otherGroups = st.transfer.groups.filter(g => g.id !== groupId);
            
            await bot.editMessageText(`✅ المصدر: *${sourceGroup.subject}*\n👥 ${sourceGroup.participants?.length || 0} عضو\n\n3️⃣ *اختر المجموعة الهدف:*`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.groupsKeyboard(otherGroups, 'dstgrp', 'transfer_members')
            });
        }

        else if (data.startsWith('dstgrp_')) {
            const st = userStates[chatId];
            if (!st?.transfer?.sourceGroup) return;
            
            const groupId = data.replace('dstgrp_', '') + '@g.us';
            const destGroup = st.transfer.groups.find(g => g.id === groupId);
            if (!destGroup) return;
            
            st.transfer.destGroup = destGroup;
            
            const sourceMembers = st.transfer.sourceGroup.participants?.length || 0;
            
            await bot.editMessageText(`🔄 *تأكيد النقل*\n\n📤 من: *${st.transfer.sourceGroup.subject}*\n📥 إلى: *${destGroup.subject}*\n👥 ${sourceMembers} عضو\n📱 ${st.transfer.selectedAccounts.length} حساب\n\n⚠️ سيتم الإضافة تدريجياً`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.confirmKeyboard('confirm_transfer')
            });
        }

        else if (data === 'confirm_transfer') {
            const st = userStates[chatId];
            if (!st?.transfer?.sourceGroup || !st?.transfer?.destGroup) return;
            
            await bot.editMessageText('⏳ جاري نقل الأعضاء...', { chat_id: chatId, message_id: msgId });
            
            const members = st.transfer.sourceGroup.participants || [];
            const accounts = st.transfer.selectedAccounts;
            let added = 0, failed = 0, accountIndex = 0;
            
            const minDelay = parseInt(getSetting('transfer_delay_min') || '2') * 1000;
            const maxDelay = parseInt(getSetting('transfer_delay_max') || '5') * 1000;
            
            for (const member of members) {
                // تخطي الحسابات المستخدمة
                if (accounts.some(acc => member.id.includes(acc))) continue;
                
                // اختيار الحساب بالتناوب
                const currentPhone = accounts[accountIndex % accounts.length];
                const sock = sessions[currentPhone];
                
                if (!sock) {
                    failed++;
                    continue;
                }
                
                try {
                    await sock.groupParticipantsUpdate(st.transfer.destGroup.id, [member.id], 'add');
                    added++;
                    accountIndex++;
                } catch (e) {
                    failed++;
                }
                
                const delay = minDelay + Math.random() * (maxDelay - minDelay);
                await new Promise(r => setTimeout(r, delay));
                
                // تحديث كل 5
                if ((added + failed) % 5 === 0) {
                    try {
                        await bot.editMessageText(`⏳ *جاري النقل...*\n\n✅ ${added} | ❌ ${failed}\n📊 ${members.length - added - failed} متبقي`, {
                            chat_id: chatId, message_id: msgId, parse_mode: 'Markdown'
                        });
                    } catch (e) {}
                }
            }
            
            delete userStates[chatId];
            await bot.editMessageText(`✅ *اكتمل النقل!*\n\n📤 ${st.transfer.sourceGroup.subject}\n📥 ${st.transfer.destGroup.subject}\n\n✅ ${added} | ❌ ${failed}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.backKeyboard
            });
        }

        // ════════════════════════════════════════════════════════
        // 📝 القوالب
        // ════════════════════════════════════════════════════════
        
        else if (data === 'templates') {
            const templates = getTemplates(userId);
            await bot.editMessageText(`📝 *القوالب*\n\nاحفظ رسائلك المتكررة`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.templatesMenuKeyboard(templates)
            });
        }

        else if (data === 'new_template') {
            await bot.editMessageText(`📝 *قالب جديد*\n\nاختر نوع:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.predefinedTemplatesKeyboard
            });
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
            await bot.editMessageText(`📝 *القالب:*\n\n${templates[preset]}\n\nأرسل اسم للقالب:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'custom_template') {
            userStates[chatId] = { action: 'tpl_content', userId, template: {} };
            await bot.editMessageText(`📝 *قالب مخصص*\n\nأرسل محتوى القالب:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data.startsWith('tpl_') && !data.includes('del') && !data.includes('use')) {
            const tplId = parseInt(data.split('_')[1]);
            const tpl = getTemplate(tplId);
            if (!tpl) return;
            
            await bot.editMessageText(`📝 *${tpl.name}*\n\n${tpl.content}\n\n📊 استخدم ${tpl.usage_count} مرة`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.templateActionsKeyboard(tplId)
            });
        }

        else if (data.startsWith('use_tpl_')) {
            const tplId = parseInt(data.split('_')[2]);
            const tpl = getTemplate(tplId);
            if (!tpl) return;
            
            updateTemplateUsage(tplId);
            userStates[chatId] = { action: 'camp_name', userId, campaign: { message: tpl.content, fromTemplate: true } };
            await bot.editMessageText(`✅ تم اختيار: *${tpl.name}*\n\n📢 أرسل اسم الحملة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data.startsWith('del_tpl_')) {
            const tplId = parseInt(data.split('_')[2]);
            deleteTemplate(tplId);
            await bot.editMessageText('🗑️ تم حذف القالب', { chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('templates') });
        }

        // ════════════════════════════════════════════════════════
        // 🚫 القائمة السوداء
        // ════════════════════════════════════════════════════════
        
        else if (data === 'blacklist') {
            const blacklist = getBlacklist(userId);
            await bot.editMessageText(`🚫 *القائمة السوداء*\n\n${blacklist.length} رقم محظور`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.blacklistMenuKeyboard
            });
        }

        else if (data === 'bl_add') {
            userStates[chatId] = { action: 'bl_add', userId };
            await bot.editMessageText(`🚫 *إضافة للقائمة السوداء*\n\nأرسل الأرقام:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
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
            await bot.editMessageText('✅ تم مسح القائمة', { chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('blacklist') });
        }

        // ════════════════════════════════════════════════════════
        // 📆 الجدولة
        // ════════════════════════════════════════════════════════
        
        else if (data === 'scheduled') {
            const scheduled = getScheduledMessages(userId);
            await bot.editMessageText(`📆 *المجدولة*\n\n${scheduled.length} رسالة مجدولة`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.scheduledMenuKeyboard
            });
        }

        else if (data === 'new_scheduled') {
            userStates[chatId] = { action: 'sched_numbers', userId, scheduled: {} };
            await bot.editMessageText(`📆 *جدولة رسالة*\n\n1️⃣ أرسل الأرقام:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (data === 'view_scheduled') {
            const scheduled = getScheduledMessages(userId);
            if (scheduled.length === 0) {
                await bot.editMessageText('📋 لا توجد رسائل مجدولة', {
                    chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('scheduled')
                });
                return;
            }
            
            let txt = '📆 *المجدولة:*\n\n';
            scheduled.forEach((s, i) => {
                const recipients = JSON.parse(s.recipients);
                txt += `${i + 1}. 📱 ${s.from_phone}\n   👥 ${recipients.length} | ⏰ ${formatScheduleTime(s.scheduled_time)}\n\n`;
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
            await bot.editMessageText('🗑️ تم الحذف', { chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('scheduled') });
        }

        // ════════════════════════════════════════════════════════
        // 📊 التقارير
        // ════════════════════════════════════════════════════════
        
        else if (data === 'stats') {
            const accounts = getUserAccounts(userId);
            const online = accounts.filter(a => sessions[a.phone]).length;
            const totalMsgs = db.prepare('SELECT COUNT(*) as c FROM messages_log WHERE user_id = ?').get(userId).c;
            const successMsgs = db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE user_id = ? AND status = 'success'").get(userId).c;
            const todayMsgs = db.prepare("SELECT COUNT(*) as c FROM messages_log WHERE user_id = ? AND date(timestamp) = date('now')").get(userId).c;
            
            await bot.editMessageText(`📊 *التقارير*\n\n📱 *الحسابات:*\n🟢 ${online} متصل | 🔴 ${accounts.length - online} غير متصل\n\n📨 *الرسائل:*\n📊 ${totalMsgs} إجمالي\n✅ ${successMsgs} نجح\n❌ ${totalMsgs - successMsgs} فشل\n📅 ${todayMsgs} اليوم`, {
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
                FROM messages_log WHERE user_id = ? AND timestamp >= datetime('now', '-7 days')
                GROUP BY date(timestamp) ORDER BY day DESC
            `).all(userId);
            
            let txt = '📈 *آخر 7 أيام:*\n\n';
            if (last7days.length === 0) {
                txt += 'لا توجد بيانات';
            } else {
                last7days.forEach(d => {
                    const rate = d.total > 0 ? Math.round((d.success / d.total) * 100) : 0;
                    txt += `📅 ${d.day}\n📨 ${d.total} | ✅ ${d.success} | ${rate}%\n\n`;
                });
            }
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.backToKeyboard('stats')
            });
        }

        // ════════════════════════════════════════════════════════
        // ⚙️ الإعدادات
        // ════════════════════════════════════════════════════════
        
        else if (data === 'settings') {
            const settings = {
                delayMin: getSetting('delay_min') || '3',
                delayMax: getSetting('delay_max') || '7',
                batchSize: getSetting('batch_size') || '10',
                autoReconnect: getSetting('auto_reconnect') === 'true',
                notifyDisconnect: getSetting('notify_disconnect') === 'true',
                notifyReply: getSetting('notify_reply') === 'true',
                autoBlock: getSetting('auto_block_unsubscribe') === 'true'
            };
            
            await bot.editMessageText(`⚙️ *الإعدادات*`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.settingsMenuKeyboard(settings)
            });
        }

        else if (data === 'set_delay') {
            await bot.editMessageText(`⏱️ *التأخير*\n\nالحالي: ${getSetting('delay_min')}-${getSetting('delay_max')} ث`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.delayOptionsKeyboard
            });
        }

        else if (data.startsWith('d_') && !data.startsWith('del') && !data.startsWith('dst') && !data.startsWith('download')) {
            const [_, min, max] = data.split('_');
            setSetting('delay_min', min);
            setSetting('delay_max', max);
            await bot.editMessageText(`✅ التأخير: ${min}-${max} ث`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        else if (data === 'set_batch') {
            await bot.editMessageText(`📦 *حجم الدفعة*\n\nالحالي: ${getSetting('batch_size')}`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                ...KB.batchOptionsKeyboard
            });
        }

        else if (data.startsWith('b_') && !data.startsWith('bl')) {
            const size = data.split('_')[1];
            setSetting('batch_size', size);
            await bot.editMessageText(`✅ حجم الدفعة: ${size}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
        }

        else if (data === 'set_reconnect') {
            const current = getSetting('auto_reconnect') === 'true';
            setSetting('auto_reconnect', current ? 'false' : 'true');
            await bot.editMessageText(`✅ إعادة الاتصال: ${!current ? 'مفعل' : 'معطل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard('settings')
            });
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

        else if (data === 'set_auto_block') {
            const current = getSetting('auto_block_unsubscribe') === 'true';
            const keywords = getSetting('unsubscribe_keywords') || 'stop,الغاء';
            
            await bot.editMessageText(`🚫 *الحظر التلقائي*\n\nالحالة: ${current ? '✅' : '❌'}\n\nالكلمات:\n\`${keywords}\``, {
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
            await bot.editMessageText(`✏️ *كلمات الحظر*\n\nأرسل الكلمات مفصولة بفاصلة:`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        // ════════════════════════════════════════════════════════
        // 🤖 الرد التلقائي
        // ════════════════════════════════════════════════════════
        
        else if (data.startsWith('autoreply_')) {
            const phone = data.split('_')[1];
            const autoReplies = getAutoReplies(userId).filter(ar => ar.phone === phone);
            
            if (autoReplies.length === 0) {
                await bot.editMessageText(`🤖 *الرد التلقائي*\n\n📱 ${phone}\n\nلا يوجد رد تلقائي`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: '➕ إضافة', callback_data: `new_ar_${phone}` }],
                        [{ text: '🔙 رجوع', callback_data: `acc_${phone}` }]
                    ]}
                });
            } else {
                const ar = autoReplies[0];
                await bot.editMessageText(`🤖 *الرد التلقائي*\n\n📱 ${phone}\n${ar.is_active ? '✅ مفعل' : '❌ معطل'}\n\n${ar.reply_message}`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [
                        [{ text: ar.is_active ? '❌ تعطيل' : '✅ تفعيل', callback_data: `toggle_ar_${ar.id}` }],
                        [{ text: '🗑️ حذف', callback_data: `del_ar_${ar.id}` }],
                        [{ text: '🔙 رجوع', callback_data: `acc_${phone}` }]
                    ]}
                });
            }
        }

        else if (data.startsWith('new_ar_')) {
            const phone = data.split('_')[2];
            userStates[chatId] = { action: 'ar_type', userId, autoReply: { phone } };
            await bot.editMessageText(`🤖 *رد تلقائي جديد*\n\nاختر النوع:`, {
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
                await bot.editMessageText(`🔑 *الكلمات المفتاحية*\n\nأرسلها مفصولة بفاصلة:`, {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
                });
            } else {
                st.action = 'ar_message';
                await bot.editMessageText('💬 *أرسل رسالة الرد:*', {
                    chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
                });
            }
        }

        else if (data.startsWith('toggle_ar_')) {
            const arId = parseInt(data.split('_')[2]);
            toggleAutoReply(arId);
            const ar = getAutoReply(arId);
            await bot.editMessageText(`✅ ${ar.is_active ? 'تم التفعيل' : 'تم التعطيل'}`, {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard(`autoreply_${ar.phone}`)
            });
        }

        else if (data.startsWith('del_ar_')) {
            const arId = parseInt(data.split('_')[2]);
            const ar = getAutoReply(arId);
            deleteAutoReply(arId);
            await bot.editMessageText('🗑️ تم الحذف', {
                chat_id: chatId, message_id: msgId, ...KB.backToKeyboard(`acc_${ar.phone}`)
            });
        }

        // ════════════════════════════════════════════════════════
        // 👑 لوحة الأدمن
        // ════════════════════════════════════════════════════════
        
        else if (data === 'a_users' && isAdmin) {
            const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 20").all();
            const total = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
            const active = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_subscribed = 1").get().c;
            
            let txt = `👥 *المستخدمين*\n\n📊 ${total} | ✅ ${active}\n\n`;
            users.forEach((u, i) => {
                txt += `${i + 1}. ${u.is_subscribed ? '✅' : '❌'} ${u.first_name} \`${u.user_id}\`\n`;
            });
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '➕ تفعيل', callback_data: 'a_activate' }],
                    [{ text: '📢 إرسال للكل', callback_data: 'a_broadcast' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'a_activate' && isAdmin) {
            userStates[chatId] = { action: 'a_activate' };
            await bot.editMessageText('➕ أرسل ID المستخدم:', {
                chat_id: chatId, message_id: msgId, ...KB.cancelKeyboard
            });
        }

        else if (data === 'a_broadcast' && isAdmin) {
            userStates[chatId] = { action: 'a_broadcast' };
            await bot.editMessageText('📢 أرسل الرسالة:', {
                chat_id: chatId, message_id: msgId, ...KB.cancelKeyboard
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
                await bot.editMessageText('💳 لا توجد طلبات', {
                    chat_id: chatId, message_id: msgId, ...KB.backKeyboard
                });
                return;
            }
            
            let txt = '💳 *طلبات الدفع:*\n\n';
            const btns = [];
            reqs.forEach((r, i) => {
                txt += `${i + 1}. ${r.first_name} - ${r.plan_name}\n`;
                btns.push([
                    { text: `✅ #${r.id}`, callback_data: `approve_${r.id}` },
                    { text: `❌ #${r.id}`, callback_data: `reject_${r.id}` }
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
                bot.sendMessage(req.user_id, `🎉 *تم تفعيل اشتراكك!*`, { parse_mode: 'Markdown', ...KB.mainUserKeyboard });
            }
            await bot.editMessageText('✅ تم القبول', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        else if (data.startsWith('reject_') && isAdmin) {
            const reqId = parseInt(data.split('_')[1]);
            const req = db.prepare("SELECT * FROM payment_requests WHERE id = ?").get(reqId);
            if (req) {
                db.prepare("UPDATE payment_requests SET status = 'rejected' WHERE id = ?").run(reqId);
                bot.sendMessage(req.user_id, '❌ تم رفض طلبك');
            }
            await bot.editMessageText('❌ تم الرفض', { chat_id: chatId, message_id: msgId, ...KB.backKeyboard });
        }

        else if (data === 'a_plans' && isAdmin) {
            const plans = db.prepare("SELECT * FROM plans").all();
            let txt = '📦 *الباقات:*\n\n';
            plans.forEach(p => {
                txt += `${p.is_active ? '✅' : '❌'} ${p.name} - ${p.price}ج\n`;
            });
            
            await bot.editMessageText(txt, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [
                    [{ text: '➕ إضافة', callback_data: 'add_plan' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'add_plan' && isAdmin) {
            userStates[chatId] = { action: 'add_plan' };
            await bot.editMessageText(`➕ *إضافة باقة*\n\nأرسل:\n\`الاسم|السعر|الأيام|الحسابات|الرسائل\``, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
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
                    [{ text: '➕ إضافة', callback_data: 'add_payment' }],
                    [{ text: '🔙 رجوع', callback_data: 'main' }]
                ]}
            });
        }

        else if (data === 'add_payment' && isAdmin) {
            userStates[chatId] = { action: 'add_payment' };
            await bot.editMessageText(`➕ *إضافة طريقة دفع*\n\nأرسل:\n\`الاسم|الرقم\``, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        // ════════════════════════════════════════════════════════
        // 🔧 أخرى
        // ════════════════════════════════════════════════════════
        
        else if (data === 'support') {
            await bot.editMessageText(`📞 *الدعم*\n\n@YourUsername`, {
                chat_id: chatId, message_id: msgId, parse_mode: 'Markdown', ...KB.backKeyboard
            });
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

// ════════════════════════════════════════════════════════════════
// 💬 معالج الرسائل
// ════════════════════════════════════════════════════════════════

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

        // رقم المستلم
        else if (st.action === 'recipient' && msg.text) {
            const to = msg.text.replace(/\D/g, '');
            if (to.length < 10) {
                bot.sendMessage(chatId, '❌ رقم غير صحيح', KB.cancelKeyboard);
                return;
            }
            userStates[chatId] = { ...st, action: 'message', to };
            bot.sendMessage(chatId, '✍️ أرسل الرسالة:', KB.cancelKeyboard);
        }

        // الرسالة
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
                bot.sendMessage(chatId, '✅ تم الإرسال', KB.backKeyboard);
            } catch (e) {
                logMessage(st.userId, st.phone, st.to, 'failed');
                bot.sendMessage(chatId, '❌ فشل الإرسال', KB.backKeyboard);
            }
            delete userStates[chatId];
        }

        // اسم الحملة
        else if (st.action === 'camp_name' && msg.text) {
            st.campaign.name = msg.text;
            
            if (st.campaign.fromList || st.campaign.fromTemplate) {
                if (st.campaign.fromList) {
                    st.action = 'camp_message';
                    bot.sendMessage(chatId, '✍️ أرسل نص الرسالة:', KB.cancelKeyboard);
                } else {
                    st.action = 'camp_numbers';
                    bot.sendMessage(chatId, '📝 أرسل الأرقام:', KB.cancelKeyboard);
                }
            } else {
                st.action = 'camp_numbers';
                bot.sendMessage(chatId, '2️⃣ أرسل الأرقام أو ملف:', KB.cancelKeyboard);
            }
        }

        // أرقام الحملة
        else if (st.action === 'camp_numbers' && msg.text) {
            const nums = extractNumbers(msg.text);
            if (nums.length === 0) {
                bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام', KB.cancelKeyboard);
                return;
            }
            st.campaign.numbers = nums;
            st.action = 'camp_message';
            bot.sendMessage(chatId, `✅ ${nums.length} رقم\n\n3️⃣ أرسل الرسالة:`, KB.cancelKeyboard);
        }

        // رسالة الحملة
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
            bot.sendMessage(chatId, `4️⃣ *اختر الحسابات:*`, {
                parse_mode: 'Markdown',
                ...KB.selectAccountsKeyboard(accounts, sessions, [])
            });
        }

        // القوالب
        else if (st.action === 'tpl_content' && msg.text) {
            st.template.content = msg.text;
            st.action = 'tpl_name';
            bot.sendMessage(chatId, '📝 أرسل اسم القالب:', KB.cancelKeyboard);
        }

        else if (st.action === 'tpl_name' && msg.text) {
            createTemplate(st.userId, msg.text, st.template.content);
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم حفظ: *${msg.text}*`, {
                parse_mode: 'Markdown', ...KB.backToKeyboard('templates')
            });
        }

        // القائمة السوداء
        else if (st.action === 'bl_add' && msg.text) {
            const nums = extractNumbers(msg.text);
            let added = 0;
            nums.forEach(n => { if (addToBlacklist(st.userId, n)) added++; });
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم إضافة ${added} رقم`, KB.backToKeyboard('blacklist'));
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
            bot.sendMessage(chatId, `✅ ${nums.length} رقم\n\n2️⃣ أرسل الرسالة:`, KB.cancelKeyboard);
        }

        else if (st.action === 'sched_message' && msg.text) {
            st.scheduled.message = msg.text;
            st.action = 'sched_time';
            bot.sendMessage(chatId, `3️⃣ *حدد الوقت:*\n\n\`14:30\` أو \`+1h\` أو \`+30m\``, {
                parse_mode: 'Markdown', ...KB.cancelKeyboard
            });
        }

        else if (st.action === 'sched_time' && msg.text) {
            const scheduledTime = parseScheduleTime(msg.text);
            if (!scheduledTime) {
                bot.sendMessage(chatId, '❌ صيغة غير صحيحة', KB.cancelKeyboard);
                return;
            }
            
            st.scheduled.time = scheduledTime;
            st.action = 'sched_account';
            
            const accounts = getUserAccounts(st.userId).filter(a => sessions[a.phone]);
            const btns = accounts.map(a => [{ text: `📱 ${a.phone}`, callback_data: `sched_from_${a.phone}` }]);
            btns.push([{ text: '❌ إلغاء', callback_data: 'cancel' }]);
            
            bot.sendMessage(chatId, '4️⃣ اختر الحساب:', { reply_markup: { inline_keyboard: btns } });
        }

        // الرد التلقائي
        else if (st.action === 'ar_keywords' && msg.text) {
            st.autoReply.keywords = msg.text;
            st.action = 'ar_message';
            bot.sendMessage(chatId, '💬 أرسل رسالة الرد:', KB.cancelKeyboard);
        }

        else if (st.action === 'ar_message' && msg.text) {
            createAutoReply(st.userId, st.autoReply.phone, st.autoReply.triggerType, st.autoReply.keywords || null, msg.text);
            delete userStates[chatId];
            bot.sendMessage(chatId, '✅ تم إضافة الرد التلقائي', KB.backToKeyboard(`autoreply_${st.autoReply.phone}`));
        }

        // كلمات الحظر
        else if (st.action === 'edit_block_keywords' && msg.text) {
            setSetting('unsubscribe_keywords', msg.text.trim());
            delete userStates[chatId];
            bot.sendMessage(chatId, '✅ تم التحديث', KB.backToKeyboard('settings'));
        }

        // استخراج من الويب
        else if (st.action === 'extract_web_keywords' && msg.text) {
            const keywords = encodeURIComponent(msg.text.trim());
            bot.sendMessage(chatId, '⏳ جاري البحث...');
            
            try {
                // البحث في Google
                const searchUrl = `https://www.google.com/search?q=${keywords}+phone+number+contact`;
                const response = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const html = await response.text();
                
                // استخراج الأرقام
                const phonePatterns = [
                    /\+?[0-9]{10,15}/g,
                    /\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g
                ];
                
                let allNumbers = [];
                for (const pattern of phonePatterns) {
                    const matches = html.match(pattern) || [];
                    allNumbers.push(...matches);
                }
                
                const cleanedNumbers = [...new Set(
                    allNumbers.map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10 && n.length <= 15)
                )];
                
                if (cleanedNumbers.length === 0) {
                    bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام', KB.backKeyboard);
                    delete userStates[chatId];
                    return;
                }
                
                const listName = `بحث: ${msg.text.substring(0, 20)}`;
                createContactList(st.userId, listName, cleanedNumbers);
                
                const filePath = `/tmp/search_${Date.now()}.txt`;
                fs.writeFileSync(filePath, cleanedNumbers.join('\n'));
                
                await bot.sendDocument(chatId, filePath, {
                    caption: `✅ *${cleanedNumbers.length} رقم*\n\n🔍 ${msg.text}\n📇 تم الحفظ`,
                    parse_mode: 'Markdown'
                });
                
                fs.unlinkSync(filePath);
            } catch (e) {
                bot.sendMessage(chatId, '❌ خطأ في البحث', KB.backKeyboard);
            }
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
                parse_mode: 'Markdown', reply_markup: { inline_keyboard: btns }
            });
        }

        else if (st.action === 'a_broadcast' && msg.text && isAdmin) {
            const users = db.prepare("SELECT user_id FROM users").all();
            let sent = 0;
            for (const u of users) {
                try { await bot.sendMessage(u.user_id, msg.text, { parse_mode: 'Markdown' }); sent++; } catch (e) {}
            }
            delete userStates[chatId];
            bot.sendMessage(chatId, `✅ تم الإرسال لـ ${sent}/${users.length}`, KB.backKeyboard);
        }

        else if (st.action === 'add_plan' && msg.text && isAdmin) {
            const parts = msg.text.split('|');
            if (parts.length >= 5) {
                db.prepare("INSERT INTO plans (name, price, duration_days, max_accounts, max_messages) VALUES (?, ?, ?, ?, ?)")
                    .run(parts[0], parseFloat(parts[1]), parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4]));
                bot.sendMessage(chatId, '✅ تم الإضافة', KB.backKeyboard);
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

// ════════════════════════════════════════════════════════════════
// 📷 معالج الصور
// ════════════════════════════════════════════════════════════════

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
        caption: `💳 *طلب #${reqId}*\n\n👤 ${user.first_name} \`${userId}\`\n📦 ${plan.name} - ${plan.price}ج`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
            [{ text: '✅ قبول', callback_data: `approve_${reqId}` }, { text: '❌ رفض', callback_data: `reject_${reqId}` }]
        ]}
    });

    bot.sendMessage(chatId, `✅ تم إرسال طلبك #${reqId}`, KB.backKeyboard);
    delete userStates[chatId];
});

// ════════════════════════════════════════════════════════════════
// 📁 معالج الملفات
// ════════════════════════════════════════════════════════════════

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const st = userStates[chatId];

    if (!st || st.action !== 'camp_numbers') return;

    const fileName = msg.document.file_name.toLowerCase();
    if (!fileName.match(/\.(xlsx|csv|txt)$/)) {
        bot.sendMessage(chatId, '❌ نوع غير مدعوم', KB.cancelKeyboard);
        return;
    }

    try {
        const file = await bot.getFile(msg.document.file_id);
        const res = await fetch(`https://api.telegram.org/file/bot${CONFIG.TOKEN}/${file.file_path}`);
        const buf = Buffer.from(await res.arrayBuffer());

        let nums = [];
        if (fileName.endsWith('.xlsx')) {
            const wb = xlsx.read(buf, { type: 'buffer' });
            xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).forEach(row => {
                row.forEach(cell => { if (cell) nums.push(...extractNumbers(cell.toString())); });
            });
        } else {
            nums = extractNumbers(buf.toString('utf-8'));
        }

        nums = [...new Set(nums)];
        if (nums.length === 0) {
            bot.sendMessage(chatId, '❌ لم يتم العثور على أرقام', KB.cancelKeyboard);
            return;
        }

        st.campaign.numbers = nums;
        st.action = 'camp_message';
        bot.sendMessage(chatId, `✅ ${nums.length} رقم\n\n3️⃣ أرسل الرسالة:`, KB.cancelKeyboard);
    } catch (e) {
        bot.sendMessage(chatId, '❌ خطأ في قراءة الملف', KB.cancelKeyboard);
    }
});

// ════════════════════════════════════════════════════════════════
// 🚀 بدء التشغيل
// ════════════════════════════════════════════════════════════════

async function start() {
    console.log('📱 Loading accounts...');
    await loadAccounts(bot);
    
    console.log('📆 Starting scheduler...');
    startScheduler(bot);
    
    console.log('✅ Bot is running!');
}

start();
