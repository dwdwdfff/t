// 📢 معالج الحملات

import { 
    getCampaign, 
    updateCampaignProgress, 
    updateCampaignStatus,
    logMessage,
    getSetting,
    isBlacklisted,
    getUserAccounts
} from '../database/init.js';
import { sessions } from './whatsapp.js';
import { sleep, getRandomDelay, AccountRotator, createProgressBar } from '../utils/helpers.js';
import { backKeyboard } from '../utils/keyboards.js';

// تخزين الحملات النشطة
const activeCampaigns = new Map();


// 🚀 بدء الحملة


export async function startCampaign(bot, chatId, campaignId) {
    const campaign = getCampaign(campaignId);
    if (!campaign) {
        bot.sendMessage(chatId, '❌ الحملة غير موجودة', backKeyboard);
        return;
    }

    if (campaign.status === 'running') {
        bot.sendMessage(chatId, '⚠️ الحملة قيد التشغيل بالفعل', backKeyboard);
        return;
    }

    const recipients = JSON.parse(campaign.recipients);
    const selectedAccounts = JSON.parse(campaign.selected_accounts);
    
    // التحقق من الحسابات المتصلة
    const connectedAccounts = selectedAccounts.filter(phone => sessions[phone]);
    if (connectedAccounts.length === 0) {
        bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة من المحددة', backKeyboard);
        return;
    }

    // تحديث حالة الحملة
    updateCampaignStatus(campaignId, 'running');

    // إنشاء رسالة التقدم
    const statusMsg = await bot.sendMessage(chatId, `📢 *جاري تشغيل الحملة*

📋 ${campaign.name}
👥 ${recipients.length} مستلم
📱 ${connectedAccounts.length} حساب
🔄 ${campaign.rotation_mode}

⏳ جاري البدء...`, { parse_mode: 'Markdown' });

    // تخزين معلومات الحملة النشطة
    activeCampaigns.set(campaignId, {
        paused: false,
        cancelled: false
    });

    // بدء الإرسال
    await executeCampaign(bot, chatId, statusMsg.message_id, campaign, recipients, connectedAccounts);
}


// ⚡ تنفيذ الحملة


async function executeCampaign(bot, chatId, statusMsgId, campaign, recipients, accounts) {
    const rotator = new AccountRotator(
        accounts.map(phone => ({ phone })),
        campaign.rotation_mode
    );

    const batchSize = parseInt(getSetting('batch_size'));
    const batchDelay = parseInt(getSetting('batch_delay')) * 1000;

    let sent = campaign.sent_count || 0;
    let failed = campaign.failed_count || 0;
    const startIndex = sent + failed;

    for (let i = startIndex; i < recipients.length; i++) {
        const campaignState = activeCampaigns.get(campaign.id);
        
        // التحقق من الإيقاف أو الإلغاء
        if (campaignState?.cancelled) {
            updateCampaignStatus(campaign.id, 'cancelled');
            await updateStatusMessage(bot, chatId, statusMsgId, campaign, sent, failed, recipients.length, 'ملغية');
            activeCampaigns.delete(campaign.id);
            return;
        }

        if (campaignState?.paused) {
            updateCampaignStatus(campaign.id, 'paused');
            await updateStatusMessage(bot, chatId, statusMsgId, campaign, sent, failed, recipients.length, 'متوقفة');
            return;
        }

        const recipient = recipients[i];

        // التحقق من القائمة السوداء
        if (isBlacklisted(campaign.user_id, recipient)) {
            failed++;
            logMessage(campaign.user_id, 'blacklisted', recipient, 'skipped', 'text', campaign.id);
            continue;
        }

        // الحصول على الحساب التالي
        const account = rotator.getNext();
        const sock = sessions[account.phone];

        if (!sock) {
            failed++;
            logMessage(campaign.user_id, account.phone, recipient, 'failed', 'text', campaign.id);
            continue;
        }

        try {
            // إرسال الرسالة
            if (campaign.media_type && campaign.media_file_id) {
                // TODO: إرسال وسائط
                await sock.sendMessage(`${recipient}@s.whatsapp.net`, { text: campaign.message });
            } else {
                await sock.sendMessage(`${recipient}@s.whatsapp.net`, { text: campaign.message });
            }

            sent++;
            logMessage(campaign.user_id, account.phone, recipient, 'success', 'text', campaign.id);
        } catch (e) {
            failed++;
            logMessage(campaign.user_id, account.phone, recipient, 'failed', 'text', campaign.id);
            console.error(`Campaign send error: ${e.message}`);
        }

        // تحديث التقدم
        updateCampaignProgress(campaign.id, sent, failed);

        // تحديث رسالة الحالة كل 5 رسائل
        if ((i + 1) % 5 === 0 || i === recipients.length - 1) {
            await updateStatusMessage(bot, chatId, statusMsgId, campaign, sent, failed, recipients.length, 'جارية');
        }

        // التأخير
        if ((i + 1) % batchSize === 0 && i < recipients.length - 1) {
            await sleep(batchDelay);
        } else {
            await sleep(getRandomDelay());
        }
    }

    // اكتمال الحملة
    updateCampaignStatus(campaign.id, 'completed');
    activeCampaigns.delete(campaign.id);
    
    await bot.editMessageText(`✅ *اكتملت الحملة!*

📋 ${campaign.name}
✅ نجح: ${sent}
❌ فشل: ${failed}
📊 النسبة: ${Math.round((sent / recipients.length) * 100)}%
${createProgressBar(sent, recipients.length)}`, {
        chat_id: chatId,
        message_id: statusMsgId,
        parse_mode: 'Markdown',
        ...backKeyboard
    });
}


// 📊 تحديث رسالة الحالة


async function updateStatusMessage(bot, chatId, msgId, campaign, sent, failed, total, status) {
    try {
        await bot.editMessageText(`📢 *الحملة ${status}*

📋 ${campaign.name}
✅ نجح: ${sent}
❌ فشل: ${failed}
📊 التقدم: ${sent + failed}/${total}
${createProgressBar(sent + failed, total)}`, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown'
        });
    } catch (e) {}
}


// ⏸️ إيقاف مؤقت


export function pauseCampaign(campaignId) {
    const state = activeCampaigns.get(campaignId);
    if (state) {
        state.paused = true;
        return true;
    }
    return false;
}


// ▶️ استئناف


export async function resumeCampaign(bot, chatId, campaignId) {
    const campaign = getCampaign(campaignId);
    if (!campaign || campaign.status !== 'paused') {
        return false;
    }

    activeCampaigns.set(campaignId, { paused: false, cancelled: false });
    
    const recipients = JSON.parse(campaign.recipients);
    const selectedAccounts = JSON.parse(campaign.selected_accounts);
    const connectedAccounts = selectedAccounts.filter(phone => sessions[phone]);

    if (connectedAccounts.length === 0) {
        bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', backKeyboard);
        return false;
    }

    updateCampaignStatus(campaignId, 'running');

    const statusMsg = await bot.sendMessage(chatId, '⏳ جاري الاستئناف...');
    await executeCampaign(bot, chatId, statusMsg.message_id, campaign, recipients, connectedAccounts);
    
    return true;
}


// ❌ إلغاء


export function cancelCampaign(campaignId) {
    const state = activeCampaigns.get(campaignId);
    if (state) {
        state.cancelled = true;
        return true;
    }
    
    // إذا لم تكن نشطة، نحدث الحالة مباشرة
    updateCampaignStatus(campaignId, 'cancelled');
    return true;
}


// 📊 تقرير الحملة


export function getCampaignReport(campaignId) {
    const campaign = getCampaign(campaignId);
    if (!campaign) return null;

    const recipients = JSON.parse(campaign.recipients);
    const selectedAccounts = JSON.parse(campaign.selected_accounts);
    
    const successRate = campaign.total_recipients > 0 
        ? Math.round((campaign.sent_count / campaign.total_recipients) * 100) 
        : 0;

    return {
        name: campaign.name,
        status: campaign.status,
        totalRecipients: campaign.total_recipients,
        sent: campaign.sent_count,
        failed: campaign.failed_count,
        remaining: campaign.total_recipients - campaign.sent_count - campaign.failed_count,
        successRate,
        accounts: selectedAccounts.length,
        rotationMode: campaign.rotation_mode,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at,
        createdAt: campaign.created_at
    };
}


// 📤 إرسال جماعي سريع (بدون حملة)


export async function quickBroadcast(bot, chatId, userId, numbers, message, fromPhone = 'all', mediaType = null, mediaBuffer = null) {
    const accounts = getUserAccounts(userId).filter(a => sessions[a.phone]);
    
    if (accounts.length === 0) {
        bot.sendMessage(chatId, '❌ لا توجد حسابات متصلة', backKeyboard);
        return;
    }

    const sendAccounts = fromPhone === 'all' 
        ? accounts 
        : accounts.filter(a => a.phone === fromPhone);

    if (sendAccounts.length === 0) {
        bot.sendMessage(chatId, '❌ الحساب المحدد غير متصل', backKeyboard);
        return;
    }

    const batchSize = parseInt(getSetting('batch_size'));
    const batchDelay = parseInt(getSetting('batch_delay')) * 1000;

    let sent = 0, failed = 0;
    const statusMsg = await bot.sendMessage(chatId, `📢 جاري الإرسال... 0/${numbers.length}`);

    const rotator = new AccountRotator(sendAccounts, 'round_robin');

    for (let i = 0; i < numbers.length; i++) {
        // التحقق من القائمة السوداء
        if (isBlacklisted(userId, numbers[i])) {
            failed++;
            continue;
        }

        const account = rotator.getNext();
        const sock = sessions[account.phone];

        if (!sock) {
            failed++;
            continue;
        }

        try {
            if (mediaType && mediaBuffer) {
                const mediaMsg = { caption: message };
                mediaMsg[mediaType] = mediaBuffer;
                await sock.sendMessage(`${numbers[i]}@s.whatsapp.net`, mediaMsg);
            } else {
                await sock.sendMessage(`${numbers[i]}@s.whatsapp.net`, { text: message });
            }
            sent++;
            logMessage(userId, account.phone, numbers[i], 'success', mediaType || 'text');
        } catch (e) {
            failed++;
            logMessage(userId, account.phone, numbers[i], 'failed', mediaType || 'text');
        }

        // تحديث الحالة
        if ((i + 1) % 5 === 0 || i === numbers.length - 1) {
            try {
                await bot.editMessageText(
                    `📢 ✅ ${sent} | ❌ ${failed} | ${i + 1}/${numbers.length}\n${createProgressBar(i + 1, numbers.length)}`,
                    { chat_id: chatId, message_id: statusMsg.message_id }
                );
            } catch (e) {}
        }

        // التأخير
        if ((i + 1) % batchSize === 0 && i < numbers.length - 1) {
            await sleep(batchDelay);
        } else {
            await sleep(getRandomDelay());
        }
    }

    await bot.editMessageText(`✅ *اكتمل الإرسال!*

✅ نجح: ${sent}
❌ فشل: ${failed}
📊 النسبة: ${Math.round((sent / numbers.length) * 100)}%`, {
        chat_id: chatId,
        message_id: statusMsg.message_id,
        parse_mode: 'Markdown',
        ...backKeyboard
    });
}
