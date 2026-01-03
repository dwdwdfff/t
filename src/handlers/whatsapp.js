// 
//                     📱 معالج واتساب                               
// 

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { 
    addAccount, 
    updateAccountStatus, 
    deleteAccount, 
    getSetting,
    getActiveAutoReply,
    incrementAutoReplyCount,
    logMessage
} from '../database/init.js';
import { sleep } from '../utils/helpers.js';
import { backKeyboard, cancelKeyboard } from '../utils/keyboards.js';

export const sessions = {};
export const userStates = {};


// 🔗 ربط بالكود


export async function startPairing(bot, chatId, phone, userId) {
    const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
    
    let codeSent = false, connected = false, retries = 0;
    
    async function connect() {
        if (connected || retries >= 3) return;
        retries++;
        
        try {
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
            const { version } = await fetchLatestBaileysVersion();
            
            const sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: ['Chrome', 'Chrome', '120'],
                syncFullHistory: false,
                connectTimeoutMs: 60000
            });
            
            sessions[`p_${chatId}`] = sock;
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on('connection.update', async update => {
                const { connection, lastDisconnect } = update;
                console.log(`[${phone}] ${connection}`);
                
                if (connection === 'connecting' && !codeSent && !connected) {
                    codeSent = true;
                    await sleep(3000);
                    if (connected) return;
                    try {
                        const code = await sock.requestPairingCode(phone);
                        console.log(`[${phone}] Code: ${code}`);
                        const formattedCode = code.match(/.{1,4}/g).join('-');
                        bot.sendMessage(chatId, `
❝ *كود الربط* ❞

━━━━━━━━━━━━━━━━━━━━━
🔢 الكود: \`${formattedCode}\`
━━━━━━━━━━━━━━━━━━━━━

📱 *خطوات الربط:*

1️⃣ افتح *واتساب* على هاتفك
2️⃣ اذهب إلى ⚙️ *الإعدادات*
3️⃣ اضغط على *الأجهزة المرتبطة*
4️⃣ اضغط على *ربط جهاز*
5️⃣ اختر *الربط برقم الهاتف*
6️⃣ أدخل الكود: \`${formattedCode}\`

⏱️ *الكود صالح لمدة دقيقتين*
                        `.trim(), { parse_mode: 'Markdown', ...cancelKeyboard });
                    } catch (e) {
                        console.error(`[${phone}] Error:`, e.message);
                        if (!connected) {
                            bot.sendMessage(chatId, '❌ فشل إنشاء الكود، جرب مرة أخرى', backKeyboard);
                            delete userStates[chatId];
                        }
                    }
                }
                
                if (connection === 'open') {
                    connected = true;
                    delete sessions[`p_${chatId}`];
                    sessions[phone] = sock;
                    addAccount(userId, phone);
                    delete userStates[chatId];
                    setupMonitor(bot, sock, phone);
                    bot.sendMessage(chatId, `
❝ *تم الربط بنجاح!* ❞

━━━━━━━━━━━━━━━━━━━━━
✅ *الحالة:* متصل
📱 *الرقم:* ${phone}
━━━━━━━━━━━━━━━━━━━━━

🎉 يمكنك الآن استخدام جميع
مميزات البوت مع هذا الحساب!

💡 *نصيحة:* لا تقم بتسجيل الخروج
من الأجهزة المرتبطة في واتساب
                    `.trim(), { parse_mode: 'Markdown', ...backKeyboard });
                }
                
                if (connection === 'close' && !connected) {
                    const reason = lastDisconnect?.error?.output?.statusCode;
                    console.log(`[${phone}] Closed: ${reason}`);
                    if (reason === 515 || reason === 408) {
                        codeSent = false;
                        await sleep(2000);
                        connect();
                        return;
                    }
                    delete sessions[`p_${chatId}`];
                    delete userStates[chatId];
                }
            });
        } catch (e) {
            console.error(`[${phone}] Session error:`, e.message);
            if (retries < 3) {
                await sleep(2000);
                connect();
            } else {
                bot.sendMessage(chatId, '❌ خطأ في الاتصال', backKeyboard);
                delete userStates[chatId];
            }
        }
    }
    
    await connect();
}


// 📷 ربط بـ QR


export async function startQR(bot, chatId, userId) {
    const tempId = `qr_${Date.now()}`;
    const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, tempId);
    let connected = false;
    
    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
    
    async function connect() {
        if (connected) return;
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome', 'Chrome', '120'],
            syncFullHistory: false
        });
        
        sessions[`p_${chatId}`] = sock;
        userStates[chatId] = { action: 'qr_wait', sessionPath, userId };
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && !connected && userStates[chatId]?.action === 'qr_wait') {
                try {
                    const buf = await QRCode.toBuffer(qr, { width: 300, margin: 2 });
                    await bot.sendPhoto(chatId, buf, {
                        caption: `

         📷 *امسح QR*             

  📱 افتح واتساب                  
  ⚙️ الإعدادات > الأجهزة المرتبطة  
  🔗 ربط جهاز                     
  📷 امسح الكود                   

                        `.trim(),
                        parse_mode: 'Markdown',
                        ...cancelKeyboard
                    });
                } catch (e) {}
            }
            
            if (connection === 'open') {
                connected = true;
                delete sessions[`p_${chatId}`];
                delete userStates[chatId];
                
                const phone = sock.user?.id?.split(':')[0];
                sessions[phone] = sock;
                addAccount(userId, phone);
                setupMonitor(bot, sock, phone);
                
                setTimeout(() => {
                    try {
                        const newPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
                        if (fs.existsSync(sessionPath)) {
                            if (fs.existsSync(newPath)) fs.rmSync(newPath, { recursive: true });
                            fs.cpSync(sessionPath, newPath, { recursive: true });
                            fs.rmSync(sessionPath, { recursive: true });
                        }
                    } catch (e) {}
                }, 2000);
                
                bot.sendMessage(chatId, `

     ✅ *تم الربط بنجاح!*         

  📱 الرقم: ${phone}
  🟢 الحالة: متصل                 

                `.trim(), { parse_mode: 'Markdown', ...backKeyboard });
            }
            
            if (connection === 'close' && !connected) {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === 515 && userStates[chatId]?.action === 'qr_wait') {
                    setTimeout(connect, 2000);
                    return;
                }
                if (reason === 408) {
                    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
                    bot.sendMessage(chatId, '⏰ انتهت المهلة، جرب مرة أخرى', backKeyboard);
                }
                delete sessions[`p_${chatId}`];
                delete userStates[chatId];
            }
        });
    }
    
    try {
        await connect();
    } catch (e) {
        bot.sendMessage(chatId, '❌ خطأ في الاتصال', backKeyboard);
    }
}


// 🔄 إعادة الاتصال


export async function reconnect(bot, phone, chatId, userId) {
    const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
    if (!fs.existsSync(sessionPath)) {
        bot.sendMessage(chatId, '❌ لا توجد جلسة محفوظة', backKeyboard);
        return;
    }
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Chrome', 'Chrome', '120']
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async update => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'open') {
                sessions[phone] = sock;
                updateAccountStatus(phone, 'online');
                setupMonitor(bot, sock, phone);
                bot.sendMessage(chatId, `✅ ${phone} متصل الآن`, backKeyboard);
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    deleteAccount(phone);
                    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
                    bot.sendMessage(chatId, `❌ تم تسجيل الخروج من ${phone}`, backKeyboard);
                } else {
                    updateAccountStatus(phone, 'offline');
                }
            }
        });
    } catch (e) {
        bot.sendMessage(chatId, '❌ فشل الاتصال', backKeyboard);
    }
}


// 👁️ مراقبة الاتصال


export function setupMonitor(bot, sock, phone) {
    // مراقبة حالة الاتصال
    sock.ev.on('connection.update', async update => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`[${phone}] Monitor: ${reason}`);
            
            // الحصول على صاحب الحساب
            const account = await getAccountByPhone(phone);
            const ownerId = account?.user_id || CONFIG.ADMIN_ID;
            
            if (reason === DisconnectReason.loggedOut || reason === 401) {
                delete sessions[phone];
                deleteAccount(phone);
                const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, phone);
                if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true });
                if (getSetting('notify_disconnect') === 'true') {
                    bot.sendMessage(ownerId, `🚪 تم تسجيل الخروج: ${phone}`);
                }
            } else {
                updateAccountStatus(phone, 'offline');
                if (getSetting('notify_disconnect') === 'true') {
                    bot.sendMessage(ownerId, `⚠️ انقطع الاتصال: ${phone}`);
                }
                if (getSetting('auto_reconnect') === 'true') {
                    setTimeout(() => reconnect(bot, phone, ownerId, ownerId), 5000);
                }
            }
        }
        
        if (connection === 'open') {
            updateAccountStatus(phone, 'online');
        }
    });
    
    // مراقبة الرسائل الواردة للرد التلقائي وإشعار الردود والحظر التلقائي
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            
            // استخراج رقم المرسل بشكل صحيح
            let sender = msg.key.remoteJid || '';
            let displayNumber = '';
            
            // تجاهل المجموعات
            if (sender.includes('@g.us')) continue;
            
            // محاولة الحصول على الرقم الحقيقي
            if (sender.includes('@lid')) {
                // إذا كان LID، حاول الحصول على الرقم من participant أو pushName
                try {
                    // محاولة الحصول على معلومات جهة الاتصال
                    const contact = await sock.onWhatsApp(sender.replace('@lid', '') + '@s.whatsapp.net').catch(() => null);
                    if (contact && contact[0]?.jid) {
                        displayNumber = contact[0].jid.replace('@s.whatsapp.net', '');
                    }
                } catch (e) {}
                
                // إذا لم نجد الرقم، استخدم الـ participant إن وجد
                if (!displayNumber && msg.key.participant) {
                    displayNumber = msg.key.participant.replace('@s.whatsapp.net', '').replace('@lid', '');
                }
                
                // إذا لم نجد، استخدم pushName أو الرقم كما هو
                if (!displayNumber) {
                    displayNumber = msg.pushName || sender.replace('@lid', '');
                }
                
                sender = sender.replace('@lid', '');
            } else {
                // تنظيف الرقم من @s.whatsapp.net
                sender = sender.replace('@s.whatsapp.net', '');
                displayNumber = sender;
            }
            
            // إذا كان الرقم يحتوي على أحرف غريبة، حاول استخراج الرقم فقط
            if (!/^\d+$/.test(displayNumber)) {
                const numMatch = displayNumber.match(/\d+/);
                if (numMatch && numMatch[0].length >= 10) {
                    displayNumber = numMatch[0];
                }
            }
            
            if (!sender) continue;
            
            const messageText = msg.message?.conversation || 
                               msg.message?.extendedTextMessage?.text || 
                               msg.message?.imageMessage?.caption ||
                               msg.message?.videoMessage?.caption || '';
            
            // البحث عن الحساب
            const account = await getAccountByPhone(phone);
            if (!account) continue;
            
            // الحصول على اسم المرسل
            const senderName = msg.pushName || 'غير معروف';
            
            // التحقق من طلب إلغاء الاشتراك (الحظر التلقائي)
            const autoBlock = getSetting('auto_block_unsubscribe');
            if (autoBlock === 'true') {
                const unsubKeywords = getSetting('unsubscribe_keywords') || 'stop,الغاء,إلغاء';
                const keywords = unsubKeywords.split(',').map(k => k.trim().toLowerCase());
                const msgLower = messageText.toLowerCase().trim();
                
                if (keywords.some(k => msgLower === k || msgLower.includes(k))) {
                    try {
                        // إضافة للقائمة السوداء
                        const { addToBlacklist } = await import('../database/init.js');
                        addToBlacklist(account.user_id, displayNumber || sender);
                        
                        // إرسال رسالة تأكيد
                        await sock.sendMessage(msg.key.remoteJid, { 
                            text: '✅ تم حذف رقمك من قاعدة البيانات الخاصة بنا.\n\nلن تتلقى أي رسائل منا مستقبلاً.' 
                        });
                        
                        // إشعار المستخدم
                        bot.sendMessage(account.user_id, `
حظر تلقائي

━━━━━━━━━━━━━━━━━━━━━
الحساب: ${phone}
الاسم: ${senderName}
الرقم: ${displayNumber || sender}
الطلب: "${messageText}"
━━━━━━━━━━━━━━━━━━━━━

تم إضافته للقائمة السوداء تلقائياً`.trim());
                        
                        logMessage(account.user_id, phone, displayNumber || sender, 'blocked', 'auto_block');
                        continue;
                    } catch (e) {
                        console.error(`[${phone}] Auto-block error:`, e.message);
                    }
                }
            }
            
            // إشعار الردود للمستخدم
            const notifyReply = getSetting('notify_reply');
            if (notifyReply === 'true') {
                try {
                    const truncatedMsg = messageText.length > 100 
                        ? messageText.substring(0, 100) + '...' 
                        : (messageText || '(رسالة وسائط)');
                    
                    // رابط فتح المحادثة - استخدم الرقم الحقيقي إن وجد
                    const phoneForLink = /^\d{10,}$/.test(displayNumber) ? displayNumber : '';
                    const chatLink = phoneForLink ? `https://wa.me/${phoneForLink}` : null;
                    
                    // بناء الأزرار
                    const buttons = [];
                    if (chatLink) {
                        buttons.push([
                            { text: 'فتح المحادثة', url: chatLink },
                            { text: 'حظر الرقم', callback_data: `block_${displayNumber || sender}` }
                        ]);
                    } else {
                        buttons.push([{ text: 'حظر الرقم', callback_data: `block_${displayNumber || sender}` }]);
                    }
                    buttons.push([{ text: 'إيقاف الإشعارات', callback_data: 'stop_notify_reply' }]);
                    
                    bot.sendMessage(account.user_id, `
رسالة جديدة

━━━━━━━━━━━━━━━━━━━━━
الحساب: ${phone}
الاسم: ${senderName}
الرقم: ${displayNumber || 'غير متاح'}
━━━━━━━━━━━━━━━━━━━━━

${truncatedMsg}`.trim(), { 
                        reply_markup: { inline_keyboard: buttons }
                    });
                } catch (e) {
                    console.error(`[${phone}] Notify error:`, e.message);
                }
            }
            
            // الرد التلقائي
            const autoReply = getActiveAutoReply(account.user_id, phone);
            if (!autoReply) continue;
            
            let shouldReply = false;
            if (autoReply.trigger_type === 'all') {
                shouldReply = true;
            } else if (autoReply.trigger_type === 'keywords' && autoReply.trigger_keywords) {
                const arKeywords = autoReply.trigger_keywords.split(',').map(k => k.trim().toLowerCase());
                shouldReply = arKeywords.some(k => messageText.toLowerCase().includes(k));
            }
            
            if (shouldReply) {
                try {
                    await sleep(1000 + Math.random() * 2000);
                    await sock.sendMessage(msg.key.remoteJid, { text: autoReply.reply_message });
                    incrementAutoReplyCount(autoReply.id);
                    logMessage(account.user_id, phone, sender, 'success', 'auto_reply');
                } catch (e) {
                    console.error(`[${phone}] Auto-reply error:`, e.message);
                }
            }
        }
    });
}

// دالة مساعدة للحصول على الحساب
async function getAccountByPhone(phone) {
    const { db } = await import('../database/init.js');
    return db.prepare('SELECT * FROM accounts WHERE phone = ?').get(phone);
}


// 📤 إرسال الرسائل


// دالة مساعدة لإظهار "جاري الكتابة..."
async function showTypingIfEnabled(sock, jid) {
    const showTyping = getSetting('show_typing') === 'true';
    if (showTyping) {
        const duration = parseInt(getSetting('typing_duration') || '3') * 1000;
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await sleep(duration);
            await sock.sendPresenceUpdate('paused', jid);
        } catch (e) {
            // تجاهل أخطاء الـ presence
        }
    }
}

export async function sendTextMessage(phone, recipient, text) {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    const jid = `${recipient}@s.whatsapp.net`;
    await showTypingIfEnabled(sock, jid);
    await sock.sendMessage(jid, { text });
}

export async function sendImageMessage(phone, recipient, imageBuffer, caption = '') {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    const jid = `${recipient}@s.whatsapp.net`;
    await showTypingIfEnabled(sock, jid);
    await sock.sendMessage(jid, {
        image: imageBuffer,
        caption
    });
}

export async function sendVideoMessage(phone, recipient, videoBuffer, caption = '') {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    const jid = `${recipient}@s.whatsapp.net`;
    await showTypingIfEnabled(sock, jid);
    await sock.sendMessage(jid, {
        video: videoBuffer,
        caption
    });
}

export async function sendDocumentMessage(phone, recipient, documentBuffer, filename, caption = '') {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    const jid = `${recipient}@s.whatsapp.net`;
    await showTypingIfEnabled(sock, jid);
    await sock.sendMessage(jid, {
        document: documentBuffer,
        fileName: filename,
        caption
    });
}

export async function sendAudioMessage(phone, recipient, audioBuffer) {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    await sock.sendMessage(`${recipient}@s.whatsapp.net`, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: true
    });
}


// 🔍 التحقق من الأرقام


export async function verifyNumber(phone, numberToVerify) {
    const sock = sessions[phone];
    if (!sock) throw new Error('الحساب غير متصل');
    
    try {
        const [result] = await sock.onWhatsApp(`${numberToVerify}@s.whatsapp.net`);
        return {
            number: numberToVerify,
            exists: result?.exists || false,
            jid: result?.jid
        };
    } catch (e) {
        return {
            number: numberToVerify,
            exists: false,
            error: e.message
        };
    }
}

export async function verifyNumbers(phone, numbers, onProgress) {
    const results = { valid: [], invalid: [] };
    
    for (let i = 0; i < numbers.length; i++) {
        const result = await verifyNumber(phone, numbers[i]);
        if (result.exists) {
            results.valid.push(numbers[i]);
        } else {
            results.invalid.push(numbers[i]);
        }
        
        if (onProgress) {
            onProgress(i + 1, numbers.length, result);
        }
        
        await sleep(500 + Math.random() * 500);
    }
    
    return results;
}


// 📱 تحميل الحسابات عند البدء


export async function loadAccounts(bot) {
    const { db } = await import('../database/init.js');
    const accounts = db.prepare('SELECT * FROM accounts').all();
    console.log(`📱 Loading ${accounts.length} accounts...`);
    
    for (const account of accounts) {
        const sessionPath = path.join(CONFIG.ACCOUNTS_DIR, account.phone);
        if (fs.existsSync(sessionPath)) {
            try {
                await reconnect(bot, account.phone, CONFIG.ADMIN_ID, account.user_id);
                await sleep(3000);
            } catch (e) {
                console.error(`Failed to load ${account.phone}:`, e.message);
            }
        }
    }
}
