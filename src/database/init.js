// 🗄️ قاعدة البيانات

import Database from 'better-sqlite3';
import { CONFIG, DEFAULTS } from '../config.js';

export const db = new Database(CONFIG.DB_PATH);

export function initDatabase() {
    // الجداول الأساسية
    db.exec(`
        -- جدول المستخدمين
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            is_subscribed INTEGER DEFAULT 0,
            subscription_type TEXT,
            subscription_end DATETIME,
            max_accounts INTEGER DEFAULT 0,
            max_messages INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول الحسابات
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            phone TEXT UNIQUE,
            status TEXT DEFAULT 'offline',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول سجل الرسائل
        CREATE TABLE IF NOT EXISTS messages_log (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            phone TEXT,
            recipient TEXT,
            message_type TEXT DEFAULT 'text',
            status TEXT,
            campaign_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول الإعدادات
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        -- جدول الباقات
        CREATE TABLE IF NOT EXISTS plans (
            id INTEGER PRIMARY KEY,
            name TEXT,
            price REAL,
            duration_days INTEGER,
            max_accounts INTEGER,
            max_messages INTEGER,
            features TEXT,
            is_active INTEGER DEFAULT 1
        );

        -- جدول طلبات الدفع
        CREATE TABLE IF NOT EXISTS payment_requests (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            plan_id INTEGER,
            status TEXT DEFAULT 'pending',
            screenshot TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول طرق الدفع
        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY,
            name TEXT,
            number TEXT,
            is_active INTEGER DEFAULT 1
        );

        -- ═══════════════════════════════════════════════════════════
        -- 🆕 الجداول الجديدة للمميزات المتقدمة
        -- ═══════════════════════════════════════════════════════════

        -- جدول القوالب الجاهزة
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            name TEXT,
            content TEXT,
            media_type TEXT,
            media_file_id TEXT,
            variables TEXT,
            usage_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول القائمة السوداء
        CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            phone TEXT,
            reason TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, phone)
        );

        -- جدول الرسائل المجدولة
        CREATE TABLE IF NOT EXISTS scheduled_messages (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            from_phone TEXT,
            recipients TEXT,
            message TEXT,
            media_type TEXT,
            media_file_id TEXT,
            scheduled_time DATETIME,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول الحملات
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            name TEXT,
            message TEXT,
            media_type TEXT,
            media_file_id TEXT,
            recipients TEXT,
            selected_accounts TEXT,
            rotation_mode TEXT DEFAULT 'round_robin',
            total_recipients INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'draft',
            started_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول الرد التلقائي
        CREATE TABLE IF NOT EXISTS auto_replies (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            phone TEXT,
            trigger_type TEXT DEFAULT 'all',
            trigger_keywords TEXT,
            reply_message TEXT,
            media_type TEXT,
            media_file_id TEXT,
            is_active INTEGER DEFAULT 1,
            reply_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول قوائم جهات الاتصال
        CREATE TABLE IF NOT EXISTS contact_lists (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            name TEXT,
            contacts TEXT,
            count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- جدول التحقق من الأرقام
        CREATE TABLE IF NOT EXISTS verified_numbers (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            phone TEXT,
            is_whatsapp INTEGER,
            verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, phone)
        );

        -- جدول ردود الحملات (من رد على الحملة)
        CREATE TABLE IF NOT EXISTS campaign_replies (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            campaign_id INTEGER,
            phone TEXT,
            sender_name TEXT,
            message TEXT,
            replied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(campaign_id, phone)
        );
    `);

    // إضافة الإعدادات الافتراضية
    for (const [key, value] of Object.entries(DEFAULTS)) {
        db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, value);
    }

    // إضافة الباقات الافتراضية
    if (db.prepare("SELECT COUNT(*) as c FROM plans").get().c === 0) {
        const plans = [
            { name: '🥉 أساسي', price: 50, days: 30, accounts: 2, messages: 1000, features: 'إرسال نصي,قوالب' },
            { name: '🥈 متقدم', price: 100, days: 30, accounts: 5, messages: 5000, features: 'إرسال نصي,قوالب,وسائط,جدولة' },
            { name: '🥇 احترافي', price: 200, days: 30, accounts: 15, messages: 999999, features: 'كل المميزات' },
            { name: '💎 VIP', price: 500, days: 90, accounts: 50, messages: 999999, features: 'كل المميزات,دعم أولوية' }
        ];
        const stmt = db.prepare("INSERT INTO plans (name, price, duration_days, max_accounts, max_messages, features) VALUES (?, ?, ?, ?, ?, ?)");
        plans.forEach(p => stmt.run(p.name, p.price, p.days, p.accounts, p.messages, p.features));
    }

    // إضافة طرق الدفع الافتراضية
    if (db.prepare("SELECT COUNT(*) as c FROM payment_methods").get().c === 0) {
        db.prepare("INSERT INTO payment_methods (name, number) VALUES (?, ?)").run('📱 فودافون كاش', '01012345678');
        db.prepare("INSERT INTO payment_methods (name, number) VALUES (?, ?)").run('🏦 انستاباي', '01012345678');
    }

    console.log('✅ Database initialized');
}


// 📊 دوال الإعدادات


export const getSetting = (key) => db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value || DEFAULTS[key];
export const setSetting = (key, value) => db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);


// 👤 دوال المستخدمين


export const getUser = (id) => db.prepare("SELECT * FROM users WHERE user_id = ?").get(id);

export const createUser = (id, username, firstName) => {
    db.prepare("INSERT OR IGNORE INTO users (user_id, username, first_name) VALUES (?, ?, ?)").run(id, username, firstName);
    return getUser(id);
};

export const isSubscribed = (id) => {
    if (id === CONFIG.ADMIN_ID) return true;
    const user = getUser(id);
    if (!user?.is_subscribed) return false;
    if (user.subscription_end && new Date(user.subscription_end) < new Date()) {
        db.prepare("UPDATE users SET is_subscribed = 0 WHERE user_id = ?").run(id);
        return false;
    }
    return true;
};

export const activateSubscription = (userId, planId) => {
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId);
    if (!plan) return false;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);
    db.prepare(`
        UPDATE users SET 
            is_subscribed = 1, 
            subscription_type = ?, 
            subscription_end = ?, 
            max_accounts = ?,
            max_messages = ?
        WHERE user_id = ?
    `).run(plan.name, endDate.toISOString(), plan.max_accounts, plan.max_messages, userId);
    return true;
};


// 📱 دوال الحسابات


export const getUserAccounts = (userId) => {
    if (userId === CONFIG.ADMIN_ID) return db.prepare('SELECT * FROM accounts').all();
    return db.prepare('SELECT * FROM accounts WHERE user_id = ?').all(userId);
};

export const canAddAccount = (userId) => {
    if (userId === CONFIG.ADMIN_ID) return true;
    const user = getUser(userId);
    return (user?.max_accounts || 0) > getUserAccounts(userId).length;
};

export const addAccount = (userId, phone) => {
    db.prepare("INSERT OR REPLACE INTO accounts (user_id, phone, status) VALUES (?, ?, 'online')").run(userId, phone);
};

export const updateAccountStatus = (phone, status) => {
    db.prepare("UPDATE accounts SET status = ? WHERE phone = ?").run(status, phone);
};

export const deleteAccount = (phone) => {
    db.prepare('DELETE FROM accounts WHERE phone = ?').run(phone);
};


// 📝 دوال سجل الرسائل


export const logMessage = (userId, phone, recipient, status, messageType = 'text', campaignId = null) => {
    db.prepare(`
        INSERT INTO messages_log (user_id, phone, recipient, message_type, status, campaign_id) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, phone, recipient, messageType, status, campaignId);
};


// 📦 دوال الباقات والدفع


export const getPlans = () => db.prepare("SELECT * FROM plans WHERE is_active = 1").all();
export const getPlan = (id) => db.prepare("SELECT * FROM plans WHERE id = ?").get(id);
export const getPaymentMethods = () => db.prepare("SELECT * FROM payment_methods WHERE is_active = 1").all();

export const createPaymentRequest = (userId, planId, screenshot) => {
    db.prepare("INSERT INTO payment_requests (user_id, plan_id, screenshot) VALUES (?, ?, ?)").run(userId, planId, screenshot);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const getPendingRequests = () => {
    return db.prepare(`
        SELECT pr.*, u.username, u.first_name, p.name as plan_name, p.price 
        FROM payment_requests pr 
        JOIN users u ON pr.user_id = u.user_id 
        JOIN plans p ON pr.plan_id = p.id 
        WHERE pr.status = 'pending'
    `).all();
};


// 📝 دوال القوالب


export const getTemplates = (userId) => db.prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY usage_count DESC").all(userId);
export const getTemplate = (id) => db.prepare("SELECT * FROM templates WHERE id = ?").get(id);

export const createTemplate = (userId, name, content, mediaType = null, mediaFileId = null, variables = null) => {
    db.prepare(`
        INSERT INTO templates (user_id, name, content, media_type, media_file_id, variables) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, name, content, mediaType, mediaFileId, variables);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const updateTemplateUsage = (id) => {
    db.prepare("UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?").run(id);
};

export const deleteTemplate = (id) => db.prepare("DELETE FROM templates WHERE id = ?").run(id);


// 🚫 دوال القائمة السوداء


export const getBlacklist = (userId) => db.prepare("SELECT * FROM blacklist WHERE user_id = ?").all(userId);

export const addToBlacklist = (userId, phone, reason = '') => {
    try {
        db.prepare("INSERT INTO blacklist (user_id, phone, reason) VALUES (?, ?, ?)").run(userId, phone, reason);
        return true;
    } catch (e) {
        return false;
    }
};

export const removeFromBlacklist = (userId, phone) => {
    db.prepare("DELETE FROM blacklist WHERE user_id = ? AND phone = ?").run(userId, phone);
};

export const isBlacklisted = (userId, phone) => {
    return db.prepare("SELECT 1 FROM blacklist WHERE user_id = ? AND phone = ?").get(userId, phone) !== undefined;
};


// 📆 دوال الرسائل المجدولة


export const getScheduledMessages = (userId) => {
    return db.prepare("SELECT * FROM scheduled_messages WHERE user_id = ? AND status = 'pending' ORDER BY scheduled_time").all(userId);
};

export const createScheduledMessage = (userId, fromPhone, recipients, message, scheduledTime, mediaType = null, mediaFileId = null) => {
    db.prepare(`
        INSERT INTO scheduled_messages (user_id, from_phone, recipients, message, scheduled_time, media_type, media_file_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, fromPhone, JSON.stringify(recipients), message, scheduledTime, mediaType, mediaFileId);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const getPendingScheduledMessages = () => {
    return db.prepare(`
        SELECT * FROM scheduled_messages 
        WHERE status = 'pending' AND scheduled_time <= datetime('now')
    `).all();
};

export const updateScheduledMessageStatus = (id, status) => {
    db.prepare("UPDATE scheduled_messages SET status = ? WHERE id = ?").run(status, id);
};

export const deleteScheduledMessage = (id) => db.prepare("DELETE FROM scheduled_messages WHERE id = ?").run(id);


// 📢 دوال الحملات


export const getCampaigns = (userId) => {
    return db.prepare("SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC").all(userId);
};

export const getCampaign = (id) => db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);

export const createCampaign = (userId, name, message, recipients, selectedAccounts, rotationMode = 'round_robin', mediaType = null, mediaFileId = null) => {
    const recipientsList = Array.isArray(recipients) ? recipients : JSON.parse(recipients);
    db.prepare(`
        INSERT INTO campaigns (user_id, name, message, recipients, selected_accounts, rotation_mode, total_recipients, media_type, media_file_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, name, message, JSON.stringify(recipientsList), JSON.stringify(selectedAccounts), rotationMode, recipientsList.length, mediaType, mediaFileId);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const updateCampaignProgress = (id, sentCount, failedCount) => {
    db.prepare("UPDATE campaigns SET sent_count = ?, failed_count = ? WHERE id = ?").run(sentCount, failedCount, id);
};

export const updateCampaignStatus = (id, status) => {
    const updates = { status };
    if (status === 'running') updates.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'cancelled') updates.completed_at = new Date().toISOString();
    
    db.prepare(`UPDATE campaigns SET status = ?, started_at = COALESCE(?, started_at), completed_at = ? WHERE id = ?`)
        .run(status, updates.started_at || null, updates.completed_at || null, id);
};

export const deleteCampaign = (id) => db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);


// 🤖 دوال الرد التلقائي


export const getAutoReplies = (userId) => db.prepare("SELECT * FROM auto_replies WHERE user_id = ?").all(userId);
export const getAutoReply = (id) => db.prepare("SELECT * FROM auto_replies WHERE id = ?").get(id);

export const getActiveAutoReply = (userId, phone) => {
    return db.prepare("SELECT * FROM auto_replies WHERE user_id = ? AND phone = ? AND is_active = 1").get(userId, phone);
};

export const createAutoReply = (userId, phone, triggerType, triggerKeywords, replyMessage, mediaType = null, mediaFileId = null) => {
    db.prepare(`
        INSERT INTO auto_replies (user_id, phone, trigger_type, trigger_keywords, reply_message, media_type, media_file_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, phone, triggerType, triggerKeywords, replyMessage, mediaType, mediaFileId);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const toggleAutoReply = (id) => {
    db.prepare("UPDATE auto_replies SET is_active = NOT is_active WHERE id = ?").run(id);
};

export const incrementAutoReplyCount = (id) => {
    db.prepare("UPDATE auto_replies SET reply_count = reply_count + 1 WHERE id = ?").run(id);
};

export const deleteAutoReply = (id) => db.prepare("DELETE FROM auto_replies WHERE id = ?").run(id);


// 📇 دوال قوائم جهات الاتصال


export const getContactLists = (userId) => db.prepare("SELECT * FROM contact_lists WHERE user_id = ?").all(userId);
export const getContactList = (id) => db.prepare("SELECT * FROM contact_lists WHERE id = ?").get(id);

export const createContactList = (userId, name, contacts) => {
    const contactsArray = Array.isArray(contacts) ? contacts : JSON.parse(contacts);
    db.prepare(`
        INSERT INTO contact_lists (user_id, name, contacts, count) 
        VALUES (?, ?, ?, ?)
    `).run(userId, name, JSON.stringify(contactsArray), contactsArray.length);
    return db.prepare("SELECT last_insert_rowid() as id").get().id;
};

export const updateContactList = (id, contacts) => {
    const contactsArray = Array.isArray(contacts) ? contacts : JSON.parse(contacts);
    db.prepare("UPDATE contact_lists SET contacts = ?, count = ? WHERE id = ?").run(JSON.stringify(contactsArray), contactsArray.length, id);
};

export const deleteContactList = (id) => db.prepare("DELETE FROM contact_lists WHERE id = ?").run(id);


// 🔍 دوال التحقق من الأرقام


export const saveVerifiedNumber = (userId, phone, isWhatsapp) => {
    try {
        db.prepare(`
            INSERT OR REPLACE INTO verified_numbers (user_id, phone, is_whatsapp, verified_at) 
            VALUES (?, ?, ?, datetime('now'))
        `).run(userId, phone, isWhatsapp ? 1 : 0);
        return true;
    } catch (e) {
        return false;
    }
};

export const getVerifiedNumbers = (userId) => db.prepare("SELECT * FROM verified_numbers WHERE user_id = ?").all(userId);

export const isNumberVerified = (userId, phone) => {
    return db.prepare("SELECT * FROM verified_numbers WHERE user_id = ? AND phone = ?").get(userId, phone);
};


// 📢 دوال ردود الحملات


export const saveCampaignReply = (userId, campaignId, phone, senderName, message) => {
    try {
        db.prepare(`
            INSERT OR REPLACE INTO campaign_replies (user_id, campaign_id, phone, sender_name, message, replied_at) 
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(userId, campaignId, phone, senderName, message);
        return true;
    } catch (e) {
        return false;
    }
};

export const getCampaignReplies = (campaignId) => {
    return db.prepare("SELECT * FROM campaign_replies WHERE campaign_id = ? ORDER BY replied_at DESC").all(campaignId);
};

export const getCampaignRepliesCount = (campaignId) => {
    return db.prepare("SELECT COUNT(*) as count FROM campaign_replies WHERE campaign_id = ?").get(campaignId)?.count || 0;
};

export const getAllUserReplies = (userId) => {
    return db.prepare(`
        SELECT cr.*, c.name as campaign_name 
        FROM campaign_replies cr 
        JOIN campaigns c ON cr.campaign_id = c.id 
        WHERE cr.user_id = ? 
        ORDER BY cr.replied_at DESC
    `).all(userId);
};

export const exportCampaignReplies = (campaignId) => {
    return db.prepare(`
        SELECT phone, sender_name, message, replied_at 
        FROM campaign_replies 
        WHERE campaign_id = ? 
        ORDER BY replied_at DESC
    `).all(campaignId);
};
