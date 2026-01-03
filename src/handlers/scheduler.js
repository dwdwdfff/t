// 
//                     📆 معالج الجدولة                              
// 

import { 
    getPendingScheduledMessages, 
    updateScheduledMessageStatus,
    logMessage,
    isBlacklisted
} from '../database/init.js';
import { sessions } from './whatsapp.js';
import { sleep, getRandomDelay } from '../utils/helpers.js';

let schedulerInterval = null;


// 🚀 بدء المجدول


export function startScheduler(bot) {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }

    console.log('📆 Scheduler started');

    // فحص كل دقيقة
    schedulerInterval = setInterval(async () => {
        await processScheduledMessages(bot);
    }, 60000);

    // فحص فوري عند البدء
    processScheduledMessages(bot);
}


// ⚡ معالجة الرسائل المجدولة


async function processScheduledMessages(bot) {
    const pendingMessages = getPendingScheduledMessages();

    for (const msg of pendingMessages) {
        try {
            await sendScheduledMessage(bot, msg);
            updateScheduledMessageStatus(msg.id, 'sent');
        } catch (e) {
            console.error(`Scheduled message ${msg.id} failed:`, e.message);
            updateScheduledMessageStatus(msg.id, 'failed');
        }
    }
}


// 📤 إرسال رسالة مجدولة


async function sendScheduledMessage(bot, scheduledMsg) {
    const sock = sessions[scheduledMsg.from_phone];
    if (!sock) {
        throw new Error('الحساب غير متصل');
    }

    const recipients = JSON.parse(scheduledMsg.recipients);
    let sent = 0, failed = 0;

    for (const recipient of recipients) {
        // التحقق من القائمة السوداء
        if (isBlacklisted(scheduledMsg.user_id, recipient)) {
            failed++;
            continue;
        }

        try {
            if (scheduledMsg.media_type && scheduledMsg.media_file_id) {
                // TODO: إرسال وسائط
                await sock.sendMessage(`${recipient}@s.whatsapp.net`, { text: scheduledMsg.message });
            } else {
                await sock.sendMessage(`${recipient}@s.whatsapp.net`, { text: scheduledMsg.message });
            }
            sent++;
            logMessage(scheduledMsg.user_id, scheduledMsg.from_phone, recipient, 'success', 'scheduled');
        } catch (e) {
            failed++;
            logMessage(scheduledMsg.user_id, scheduledMsg.from_phone, recipient, 'failed', 'scheduled');
        }

        await sleep(getRandomDelay());
    }

    // إشعار المستخدم
    try {
        bot.sendMessage(scheduledMsg.user_id, `

    📆 *تم إرسال الرسالة المجدولة* 

  ✅ نجح: ${sent}
  ❌ فشل: ${failed}
  📱 من: ${scheduledMsg.from_phone}

        `.trim(), { parse_mode: 'Markdown' });
    } catch (e) {}
}


// 🛑 إيقاف المجدول


export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('📆 Scheduler stopped');
    }
}


// 🔧 دوال مساعدة


export function parseScheduleTime(timeStr) {
    // تنسيقات مدعومة:
    // - "14:30" - وقت اليوم
    // - "2024-01-15 14:30" - تاريخ ووقت
    // - "+1h" - بعد ساعة
    // - "+30m" - بعد 30 دقيقة

    const now = new Date();

    // تنسيق +Xh أو +Xm
    if (timeStr.startsWith('+')) {
        const match = timeStr.match(/^\+(\d+)([hm])$/);
        if (match) {
            const value = parseInt(match[1]);
            const unit = match[2];
            if (unit === 'h') {
                now.setHours(now.getHours() + value);
            } else {
                now.setMinutes(now.getMinutes() + value);
            }
            return now.toISOString();
        }
    }

    // تنسيق HH:MM
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        now.setHours(hours, minutes, 0, 0);
        if (now < new Date()) {
            now.setDate(now.getDate() + 1);
        }
        return now.toISOString();
    }

    // تنسيق YYYY-MM-DD HH:MM
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(timeStr)) {
        return new Date(timeStr).toISOString();
    }

    return null;
}

export function formatScheduleTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
