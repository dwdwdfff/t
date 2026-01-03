// لوحات المفاتيح المحسنة - تصميم احترافي

// القائمة الرئيسية للمستخدم
export const mainUserKeyboard = {
    reply_markup: {
        inline_keyboard: [
            // إدارة الحسابات
            [{ text: 'إدارة الحسابات', callback_data: 'accounts' }],
            
            // الإرسال والحملات
            [
                { text: 'إرسال', callback_data: 'send' },
                { text: 'حملات', callback_data: 'campaigns' }
            ],
            
            // استخراج ونقل
            [
                { text: 'استخراج داتا', callback_data: 'extract_data' },
                { text: 'نقل أعضاء', callback_data: 'transfer_members' }
            ],
            
            // الأدوات
            [
                { text: 'القوالب', callback_data: 'templates' },
                { text: 'الجدولة', callback_data: 'scheduled' }
            ],
            [
                { text: 'فحص الأرقام', callback_data: 'verify_numbers' },
                { text: 'قوائم الاتصال', callback_data: 'contact_lists' }
            ],
            
            // الإعدادات والتقارير
            [
                { text: 'القائمة السوداء', callback_data: 'blacklist' },
                { text: 'التقارير', callback_data: 'stats' }
            ],
            [
                { text: 'الرد التلقائي', callback_data: 'auto_reply_menu' },
                { text: 'الإعدادات', callback_data: 'settings' }
            ],
            
            // الاشتراك
            [{ text: 'اشتراكي', callback_data: 'mysub' }]
        ]
    }
};

// القائمة الرئيسية للأدمن
export const mainAdminKeyboard = {
    reply_markup: {
        inline_keyboard: [
            // إدارة الحسابات
            [{ text: 'إدارة الحسابات', callback_data: 'accounts' }],
            
            // الإرسال والحملات
            [
                { text: 'إرسال', callback_data: 'send' },
                { text: 'حملات', callback_data: 'campaigns' }
            ],
            
            // استخراج ونقل
            [
                { text: 'استخراج داتا', callback_data: 'extract_data' },
                { text: 'نقل أعضاء', callback_data: 'transfer_members' }
            ],
            
            // الأدوات
            [
                { text: 'القوالب', callback_data: 'templates' },
                { text: 'الجدولة', callback_data: 'scheduled' }
            ],
            [
                { text: 'فحص الأرقام', callback_data: 'verify_numbers' },
                { text: 'قوائم الاتصال', callback_data: 'contact_lists' }
            ],
            
            // الإعدادات والتقارير
            [
                { text: 'القائمة السوداء', callback_data: 'blacklist' },
                { text: 'التقارير', callback_data: 'stats' }
            ],
            [
                { text: 'الرد التلقائي', callback_data: 'auto_reply_menu' },
                { text: 'الإعدادات', callback_data: 'settings' }
            ],
            
            // لوحة الأدمن
            [{ text: '━━━ لوحة الأدمن ━━━', callback_data: 'none' }],
            [
                { text: 'المستخدمين', callback_data: 'a_users' },
                { text: 'طلبات الدفع', callback_data: 'a_reqs' }
            ],
            [
                { text: 'الباقات', callback_data: 'a_plans' },
                { text: 'طرق الدفع', callback_data: 'a_payments' }
            ],
            [{ text: 'إحصائيات النظام', callback_data: 'a_system_stats' }]
        ]
    }
};

// الاشتراك
export const subscribeKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'اشترك الآن', callback_data: 'subscribe' }],
            [{ text: 'تواصل معنا', callback_data: 'support' }],
            [{ text: 'المساعدة', callback_data: 'help' }]
        ]
    }
};

// قائمة استخراج البيانات المحسنة
export const extractDataKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'من مجموعة واتساب', callback_data: 'extract_group' }],
            [{ text: 'بحث بكلمات مفتاحية', callback_data: 'extract_keywords' }],
            [{ text: 'من صفحة ويب', callback_data: 'extract_web' }],
            [{ text: 'من ملف', callback_data: 'extract_file' }],
            [{ text: 'قوائمي المحفوظة', callback_data: 'my_lists' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// 🔄 قائمة نقل الأعضاء المحسنة
export const transferMembersKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'بدء نقل جديد', callback_data: 'start_new_transfer' }],
            [{ text: 'إضافة حسابات للنقل', callback_data: 'add_transfer_accounts' }],
            [{ text: 'إعدادات النقل', callback_data: 'transfer_settings' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// 📱 قائمة الحسابات
export function accountsMenuKeyboard(accounts, sessions) {
    const btns = accounts.map(acc => {
        const isOnline = sessions[acc.phone] ? '🟢' : '🔴';
        return [{ text: `${isOnline} ${acc.phone}`, callback_data: `acc_${acc.phone}` }];
    });
    btns.push([{ text: 'إضافة حساب', callback_data: 'add_acc' }]);
    btns.push([{ text: 'رجوع', callback_data: 'main' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// ➕ إضافة حساب
export const addAccountKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🔢 ربط بالكود (الأسهل)', callback_data: 'pair' }],
            [{ text: '📷 ربط بـ QR', callback_data: 'qr' }],
            [{ text: 'رجوع', callback_data: 'accounts' }]
        ]
    }
};

// 📱 إجراءات الحساب
export function accountActionsKeyboard(phone, isOnline) {
    const btns = [];
    if (isOnline) {
        btns.push([{ text: 'الرد التلقائي', callback_data: `autoreply_${phone}` }]);
    } else {
        btns.push([{ text: 'إعادة الاتصال', callback_data: `recon_${phone}` }]);
    }
    btns.push([{ text: 'حذف الحساب', callback_data: `del_${phone}` }]);
    btns.push([{ text: 'رجوع', callback_data: 'accounts' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// 📤 قائمة الإرسال
export const sendMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'إرسال فردي', callback_data: 'single' }],
            [{ text: 'إنشاء حملة جديدة', callback_data: 'new_campaign' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// 📢 قائمة الحملات
export const campaignMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'حملة جديدة', callback_data: 'new_campaign' }],
            [{ text: 'حملاتي', callback_data: 'my_campaigns' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// 🔄 قائمة نقل الأعضاء (القديمة - للتوافق)
export const transferMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'بدء نقل جديد', callback_data: 'start_new_transfer' }],
            [{ text: 'إضافة حسابات للنقل', callback_data: 'add_transfer_accounts' }],
            [{ text: 'إعدادات النقل', callback_data: 'transfer_settings' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// ⚙️ إعدادات النقل
export function transferSettingsKeyboard(settings) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: `⏱️ التأخير: ${settings.min}-${settings.max} ث`, callback_data: 'set_transfer_delay' }],
                [{ text: `👥 الحسابات: ${settings.accountsCount}`, callback_data: 'set_transfer_accounts' }],
                [{ text: 'رجوع', callback_data: 'transfer_members' }]
            ]
        }
    };
}

// 📝 قائمة القوالب
export function templatesMenuKeyboard(templates) {
    const btns = templates.slice(0, 8).map(t => [{
        text: `📝 ${t.name}`,
        callback_data: `tpl_${t.id}`
    }]);
    btns.push([{ text: 'قالب جديد', callback_data: 'new_template' }]);
    btns.push([{ text: 'رجوع', callback_data: 'main' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// 📆 قائمة المجدولة
export const scheduledMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'جدولة رسالة', callback_data: 'new_scheduled' }],
            [{ text: 'المجدولة', callback_data: 'view_scheduled' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// 🚫 قائمة القائمة السوداء
export const blacklistMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'إضافة أرقام', callback_data: 'bl_add' }],
            [{ text: 'عرض القائمة', callback_data: 'bl_view' }],
            [{ text: 'رجوع', callback_data: 'main' }]
        ]
    }
};

// ⚙️ قائمة الإعدادات
export function settingsMenuKeyboard(settings) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: `⏱️ التأخير: ${settings.delayMin}-${settings.delayMax} ث`, callback_data: 'set_delay' }],
                [{ text: `📦 حجم الدفعة: ${settings.batchSize}`, callback_data: 'set_batch' }],
                [{ text: `🔄 إعادة الاتصال: ${settings.autoReconnect ? '✅' : '❌'}`, callback_data: 'set_reconnect' }],
                [{ text: `🔔 إشعار الانقطاع: ${settings.notifyDisconnect ? '✅' : '❌'}`, callback_data: 'set_notify' }],
                [{ text: `💬 إشعار الردود: ${settings.notifyReply ? '✅' : '❌'}`, callback_data: 'set_notify_reply' }],
                [{ text: `🚫 حظر تلقائي: ${settings.autoBlock ? '✅' : '❌'}`, callback_data: 'set_auto_block' }],
                [{ text: 'رجوع', callback_data: 'main' }]
            ]
        }
    };
}

// ⏱️ خيارات التأخير
export const delayOptionsKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '1-3 ث', callback_data: 'd_1_3' },
                { text: '3-5 ث', callback_data: 'd_3_5' },
                { text: '5-10 ث', callback_data: 'd_5_10' }
            ],
            [
                { text: '10-15 ث', callback_data: 'd_10_15' },
                { text: '15-30 ث', callback_data: 'd_15_30' }
            ],
            [{ text: 'رجوع', callback_data: 'settings' }]
        ]
    }
};

// 📦 خيارات حجم الدفعة
export const batchOptionsKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '5', callback_data: 'b_5' },
                { text: '10', callback_data: 'b_10' },
                { text: '20', callback_data: 'b_20' }
            ],
            [
                { text: '50', callback_data: 'b_50' },
                { text: '100', callback_data: 'b_100' }
            ],
            [{ text: 'رجوع', callback_data: 'settings' }]
        ]
    }
};

// ⏱️ خيارات تأخير النقل
export const transferDelayKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '1-2 ث', callback_data: 'td_1_2' },
                { text: '2-5 ث', callback_data: 'td_2_5' },
                { text: '5-10 ث', callback_data: 'td_5_10' }
            ],
            [
                { text: '10-20 ث', callback_data: 'td_10_20' },
                { text: '20-30 ث', callback_data: 'td_20_30' }
            ],
            [{ text: 'رجوع', callback_data: 'transfer_settings' }]
        ]
    }
};

// 🔄 اختيار نوع الـ Rotation
export const rotationModeKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'تبديل بالتناوب', callback_data: 'rot_round_robin' }],
            [{ text: '🎲 تبديل عشوائي', callback_data: 'rot_random' }],
            [{ text: 'حسب الأقل استخداماً', callback_data: 'rot_least_used' }],
            [{ text: 'إلغاء', callback_data: 'cancel' }]
        ]
    }
};

// 📝 قوالب جاهزة
export const predefinedTemplatesKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '👋 ترحيب', callback_data: 'preset_welcome' }],
            [{ text: '🎉 عرض/خصم', callback_data: 'preset_promotion' }],
            [{ text: '⏰ تذكير', callback_data: 'preset_reminder' }],
            [{ text: '🙏 شكر', callback_data: 'preset_thanks' }],
            [{ text: '✏️ قالب مخصص', callback_data: 'custom_template' }],
            [{ text: 'رجوع', callback_data: 'templates' }]
        ]
    }
};

// 💳 طرق الدفع
export function paymentMethodsKeyboard(methods, planId) {
    const btns = methods.filter(m => m.is_active).map(m => [{
        text: `💳 ${m.name}`,
        callback_data: `pay_${m.id}_${planId}`
    }]);
    btns.push([{ text: 'رجوع', callback_data: 'subscribe' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// 📦 الباقات
export function plansKeyboard(plans) {
    const btns = plans.filter(p => p.is_active).map(p => [{
        text: `${p.name} - ${p.price} جنيه`,
        callback_data: `plan_${p.id}`
    }]);
    btns.push([{ text: 'رجوع', callback_data: 'main' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// اختيار حسابات للحملة
export function selectAccountsKeyboard(accounts, sessions, selected = []) {
    const btns = accounts.map(acc => {
        const isSelected = selected.includes(acc.phone);
        const isOnline = sessions[acc.phone] ? '🟢' : '🔴';
        return [{
            text: `${isSelected ? '✅' : '⬜'} ${isOnline} ${acc.phone}`,
            callback_data: `sel_acc_${acc.phone}`
        }];
    });
    btns.push([
        { text: 'تحديد الكل', callback_data: 'sel_all_acc' },
        { text: '⬜ إلغاء الكل', callback_data: 'desel_all_acc' }
    ]);
    btns.push([{ text: '➡️ التالي', callback_data: 'next_step' }]);
    btns.push([{ text: 'إلغاء', callback_data: 'cancel' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// اختيار مجموعات
export function groupsKeyboard(groups, callbackPrefix, backCallback = 'cancel') {
    const btns = groups.slice(0, 15).map(g => [{
        text: `👥 ${g.subject.substring(0, 25)}${g.subject.length > 25 ? '...' : ''} (${g.participants?.length || 0})`,
        callback_data: `${callbackPrefix}_${g.id.split('@')[0].substring(0, 30)}`
    }]);
    btns.push([{ text: 'رجوع', callback_data: backCallback }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// إجراءات الحملة
export function campaignActionsKeyboard(campId, status) {
    const btns = [];
    if (status === 'draft') {
        btns.push([{ text: 'بدء الحملة', callback_data: `camp_start_${campId}` }]);
    } else if (status === 'running') {
        btns.push([{ text: 'إيقاف مؤقت', callback_data: `camp_pause_${campId}` }]);
    } else if (status === 'paused') {
        btns.push([{ text: 'استئناف', callback_data: `camp_resume_${campId}` }]);
    }
    btns.push([{ text: 'تقرير', callback_data: `camp_report_${campId}` }]);
    btns.push([{ text: 'حذف', callback_data: `camp_del_${campId}` }]);
    btns.push([{ text: 'رجوع', callback_data: 'my_campaigns' }]);
    return { reply_markup: { inline_keyboard: btns } };
}

// إجراءات القالب
export function templateActionsKeyboard(tplId) {
    return {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'استخدام', callback_data: `use_tpl_${tplId}` }],
                [{ text: 'حذف', callback_data: `del_tpl_${tplId}` }],
                [{ text: 'رجوع', callback_data: 'templates' }]
            ]
        }
    };
}

// أزرار عامة
export const cancelKeyboard = {
    reply_markup: {
        inline_keyboard: [[{ text: 'إلغاء', callback_data: 'cancel' }]]
    }
};

export const backKeyboard = {
    reply_markup: {
        inline_keyboard: [[{ text: 'رجوع', callback_data: 'main' }]]
    }
};

export function backToKeyboard(callback) {
    return {
        reply_markup: {
            inline_keyboard: [[{ text: 'رجوع', callback_data: callback }]]
        }
    };
}

// تأكيد
export function confirmKeyboard(yesCallback, noCallback = 'cancel') {
    return {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'نعم', callback_data: yesCallback },
                    { text: 'لا', callback_data: noCallback }
                ]
            ]
        }
    };
}
