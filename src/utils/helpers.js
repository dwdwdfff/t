// 🛠️ الدوال المساعدة

import { getSetting } from '../database/init.js';
import { EMOJIS } from '../config.js';


// ⏱️ دوال الوقت والتأخير


export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getRandomDelay = () => {
    const min = parseInt(getSetting('delay_min'));
    const max = parseInt(getSetting('delay_max'));
    return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
};

export const formatDate = (date, locale = 'ar-EG') => {
    return new Date(date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const formatDateShort = (date) => {
    return new Date(date).toLocaleDateString('ar-EG');
};

export const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    
    if (diff <= 0) return 'منتهي';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} يوم`;
    return `${hours} ساعة`;
};


// 📱 دوال استخراج الأرقام


export const extractNumbers = (text) => {
    const matches = text.match(/\+?[0-9]{10,15}/g) || [];
    const numbers = matches.map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10);
    return [...new Set(numbers)];
};

export const formatPhoneNumber = (phone) => {
    if (phone.startsWith('20') && phone.length === 12) {
        return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    }
    return phone;
};

export const normalizePhone = (phone) => {
    let normalized = phone.replace(/\D/g, '');
    if (normalized.startsWith('0')) {
        normalized = '20' + normalized.slice(1);
    }
    return normalized;
};


// 🎨 دوال تنسيق النصوص


export const formatText = {
    bold: (text) => `*${text}*`,
    italic: (text) => `_${text}_`,
    strike: (text) => `~${text}~`,
    mono: (text) => `\`${text}\``,
    code: (text) => `\`\`\`${text}\`\`\``,
    quote: (text) => `> ${text}`,
    
    // تنسيق متعدد الأسطر للاقتباس
    multiQuote: (text) => text.split('\n').map(line => `> ${line}`).join('\n'),
    
    // تنسيق الرسالة مع متغيرات
    withVariables: (template, variables) => {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
        return result;
    }
};


// 📊 دوال الإحصائيات


export const calculatePercentage = (part, total) => {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
};

export const createProgressBar = (current, total, length = 10) => {
    const percentage = calculatePercentage(current, total);
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
};


// 🎯 دوال التحقق


export const isValidPhone = (phone) => {
    const normalized = phone.replace(/\D/g, '');
    return normalized.length >= 10 && normalized.length <= 15;
};

export const isValidTime = (timeStr) => {
    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return regex.test(timeStr);
};

export const isValidDate = (dateStr) => {
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
};


// 📝 دوال الرسائل المنسقة


export const createBox = (title, content, emoji = '📋') => {
    return `

  ${emoji} ${title}

${content}

`.trim();
};

export const createList = (items, numbered = false) => {
    return items.map((item, i) => {
        const prefix = numbered ? `${i + 1}.` : '•';
        return `${prefix} ${item}`;
    }).join('\n');
};

export const createStatsMessage = (stats) => {
    let msg = `📊 *الإحصائيات*\n\n`;
    for (const [key, value] of Object.entries(stats)) {
        msg += `${key}: *${value}*\n`;
    }
    return msg;
};


// 🔄 دوال Rotation للحسابات


export class AccountRotator {
    constructor(accounts, mode = 'round_robin') {
        this.accounts = accounts;
        this.mode = mode;
        this.currentIndex = 0;
        this.usageCount = new Map();
        accounts.forEach(acc => this.usageCount.set(acc.phone, 0));
    }

    getNext() {
        if (this.accounts.length === 0) return null;

        let account;
        switch (this.mode) {
            case 'round_robin':
                account = this.accounts[this.currentIndex];
                this.currentIndex = (this.currentIndex + 1) % this.accounts.length;
                break;
            
            case 'random':
                const randomIndex = Math.floor(Math.random() * this.accounts.length);
                account = this.accounts[randomIndex];
                break;
            
            case 'least_used':
                account = this.accounts.reduce((min, acc) => 
                    this.usageCount.get(acc.phone) < this.usageCount.get(min.phone) ? acc : min
                );
                break;
            
            default:
                account = this.accounts[this.currentIndex];
                this.currentIndex = (this.currentIndex + 1) % this.accounts.length;
        }

        this.usageCount.set(account.phone, this.usageCount.get(account.phone) + 1);
        return account;
    }

    reset() {
        this.currentIndex = 0;
        this.accounts.forEach(acc => this.usageCount.set(acc.phone, 0));
    }
}


// 🎨 قوالب الرسائل الجاهزة


export const messageTemplates = {
    welcome: `
🎉 *مرحباً {{name}}!*

شكراً لتواصلك معنا
نحن سعداء بخدمتك

_فريق الدعم_
`.trim(),

    promotion: `
🔥 *عرض خاص!*

{{offer_details}}

⏰ العرض ساري حتى: {{end_date}}

للاستفسار: {{contact}}
`.trim(),

    reminder: `
⏰ *تذكير*

{{reminder_text}}

📅 التاريخ: {{date}}
⏰ الوقت: {{time}}
`.trim(),

    thanks: `
💝 *شكراً لك!*

نقدر تعاملك معنا
نتمنى لك يوماً سعيداً

_مع تحياتنا_
`.trim()
};


// 🔧 دوال متنوعة


export const chunk = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

export const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export const truncate = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
};

export const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
};
