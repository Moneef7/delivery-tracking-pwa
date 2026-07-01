// Localization - Arabic & English
export type Language = 'ar' | 'en';

export const translations = {
    // App name
    appName: {
        ar: 'نظام تتبع التوصيل',
        en: 'Delivery Tracking System'
    },

    // Login page
    login: {
        ar: 'تسجيل الدخول',
        en: 'Login'
    },
    selectRole: {
        ar: 'اختر نوع الحساب',
        en: 'Select Account Type'
    },
    phone: {
        ar: 'رقم الهاتف',
        en: 'Phone Number'
    },
    password: {
        ar: 'كلمة المرور',
        en: 'Password'
    },

    // Roles
    admin: {
        ar: 'مدير',
        en: 'Admin'
    },
    seller: {
        ar: 'بائع',
        en: 'Seller'
    },
    driver: {
        ar: 'سائق',
        en: 'Driver'
    },

    // Invoice types
    invoice: {
        ar: 'فاتورة',
        en: 'Invoice'
    },
    deliveryPermit: {
        ar: 'إذن تسليم',
        en: 'Delivery Permit'
    },
    quotation: {
        ar: 'عرض سعر',
        en: 'Quotation'
    },
    transfer: {
        ar: 'مناقلة',
        en: 'Transfer'
    },
    clearance: {
        ar: 'فسح',
        en: 'Clearance'
    },

    // Status options
    delivered: {
        ar: 'تم التسليم',
        en: 'Delivered'
    },
    pending: {
        ar: 'في الانتظار',
        en: 'Pending'
    },
    notReceived: {
        ar: 'لم يستلم',
        en: 'Not Received'
    },
    returned: {
        ar: 'مرتجع',
        en: 'Returned'
    },

    // Branches
    branchMain: {
        ar: 'الرئيسي',
        en: 'Main'
    },
    branchBabSharif: {
        ar: 'باب شريف',
        en: 'Bab Sharif'
    },
    branchSouq7: {
        ar: 'سوق ٧',
        en: 'Souq 7'
    },
    branchRepresentative: {
        ar: 'مندوب',
        en: 'Representative'
    },
    branchHindawiya: {
        ar: 'الهنداوية',
        en: 'Al-Hindawiya'
    },
    branch: {
        ar: 'الفرع',
        en: 'Branch'
    },
    allBranches: {
        ar: 'جميع الفروع',
        en: 'All Branches'
    },

    // Actions
    save: {
        ar: 'حفظ',
        en: 'Save'
    },
    cancel: {
        ar: 'إلغاء',
        en: 'Cancel'
    },
    delete: {
        ar: 'حذف',
        en: 'Delete'
    },
    edit: {
        ar: 'تعديل',
        en: 'Edit'
    },
    search: {
        ar: 'بحث',
        en: 'Search'
    },
    add: {
        ar: 'إضافة',
        en: 'Add'
    },
    logout: {
        ar: 'تسجيل الخروج',
        en: 'Logout'
    },

    // Trip
    createTrip: {
        ar: 'إنشاء رحلة',
        en: 'Create Trip'
    },
    endTrip: {
        ar: 'إنهاء الرحلة',
        en: 'End Trip'
    },
    tripStarted: {
        ar: 'بدأت الرحلة',
        en: 'Trip Started'
    },
    driverLeftWarehouse: {
        ar: 'غادر السائق المستودع',
        en: 'Driver left warehouse'
    },
    activeTrips: {
        ar: 'الرحلات النشطة',
        en: 'Active Trips'
    },
    completedTrips: {
        ar: 'الرحلات المكتملة',
        en: 'Completed Trips'
    },

    // Invoice
    invoiceNumber: {
        ar: 'رقم الفاتورة',
        en: 'Invoice Number'
    },
    invoiceType: {
        ar: 'نوع الفاتورة',
        en: 'Invoice Type'
    },
    addInvoice: {
        ar: 'إضافة فاتورة',
        en: 'Add Invoice'
    },
    note: {
        ar: 'ملاحظة',
        en: 'Note'
    },
    status: {
        ar: 'الحالة',
        en: 'Status'
    },

    // Messages
    invoiceExists: {
        ar: 'رقم الفاتورة موجود مسبقًا وتم تسجيله مع سائق آخر.',
        en: 'Invoice number already exists and is registered with another driver.'
    },
    invoiceAdded: {
        ar: 'تمت إضافة الفاتورة بنجاح',
        en: 'Invoice added successfully'
    },
    statusUpdated: {
        ar: 'تم تحديث الحالة',
        en: 'Status updated'
    },
    imageSaved: {
        ar: 'تم حفظ الصورة',
        en: 'Image saved'
    },
    cameraOnly: {
        ar: 'يرجى التقاط صورة بالكاميرا فقط',
        en: 'Please capture image from camera only'
    },

    // User Management
    users: {
        ar: 'المستخدمين',
        en: 'Users'
    },
    createUser: {
        ar: 'إنشاء مستخدم',
        en: 'Create User'
    },
    activateUser: {
        ar: 'تفعيل',
        en: 'Activate'
    },
    deactivateUser: {
        ar: 'إلغاء التفعيل',
        en: 'Deactivate'
    },
    resetPassword: {
        ar: 'إعادة تعيين كلمة المرور',
        en: 'Reset Password'
    },

    // Dates
    createdAt: {
        ar: 'تاريخ الإنشاء',
        en: 'Created At'
    },
    updatedAt: {
        ar: 'تاريخ التحديث',
        en: 'Updated At'
    },
    startTime: {
        ar: 'وقت البدء',
        en: 'Start Time'
    },
    endTime: {
        ar: 'وقت الانتهاء',
        en: 'End Time'
    },

    // Filters
    filterByType: {
        ar: 'فلتر حسب النوع',
        en: 'Filter by Type'
    },
    filterByDate: {
        ar: 'فلتر حسب التاريخ',
        en: 'Filter by Date'
    },
    filterByDriver: {
        ar: 'فلتر حسب السائق',
        en: 'Filter by Driver'
    },
    allTypes: {
        ar: 'جميع الأنواع',
        en: 'All Types'
    },

    // Dashboard
    dashboard: {
        ar: 'لوحة التحكم',
        en: 'Dashboard'
    },
    logs: {
        ar: 'السجلات',
        en: 'Logs'
    },
    invoices: {
        ar: 'الفواتير',
        en: 'Invoices'
    },
    trips: {
        ar: 'الرحلات',
        en: 'Trips'
    },

    // Common
    loading: {
        ar: 'جاري التحميل...',
        en: 'Loading...'
    },
    noResults: {
        ar: 'لا توجد نتائج',
        en: 'No results found'
    },
    error: {
        ar: 'حدث خطأ',
        en: 'An error occurred'
    },
    success: {
        ar: 'تم بنجاح',
        en: 'Success'
    },
    confirm: {
        ar: 'تأكيد',
        en: 'Confirm'
    },
    name: {
        ar: 'الاسم',
        en: 'Name'
    },
    active: {
        ar: 'نشط',
        en: 'Active'
    },
    inactive: {
        ar: 'غير نشط',
        en: 'Inactive'
    },
    completed: {
        ar: 'مكتمل',
        en: 'Completed'
    }
};

// Helper function to get translation
export function t(key: keyof typeof translations, lang: Language): string {
    return translations[key]?.[lang] || key;
}

// Invoice types array
export const invoiceTypes = [
    { value: 'invoice', labelKey: 'invoice' as keyof typeof translations },
    { value: 'delivery_permit', labelKey: 'deliveryPermit' as keyof typeof translations },
    { value: 'quotation', labelKey: 'quotation' as keyof typeof translations },
    { value: 'transfer', labelKey: 'transfer' as keyof typeof translations },
    { value: 'clearance', labelKey: 'clearance' as keyof typeof translations },
];

// Status options array
export const statusOptions = [
    { value: 'pending', labelKey: 'pending' as keyof typeof translations },
    { value: 'delivered', labelKey: 'delivered' as keyof typeof translations },
    { value: 'not_received', labelKey: 'notReceived' as keyof typeof translations },
    { value: 'returned', labelKey: 'returned' as keyof typeof translations },
];

// Role options
export const roleOptions = [
    { value: 'admin', labelKey: 'admin' as keyof typeof translations },
    { value: 'seller', labelKey: 'seller' as keyof typeof translations },
    { value: 'driver', labelKey: 'driver' as keyof typeof translations },
];

// Branch options
export const branchOptions = [
    { value: 'main', labelKey: 'branchMain' as keyof typeof translations },
    { value: 'bab_sharif', labelKey: 'branchBabSharif' as keyof typeof translations },
    { value: 'souq_7', labelKey: 'branchSouq7' as keyof typeof translations },
    { value: 'representative', labelKey: 'branchRepresentative' as keyof typeof translations },
    { value: 'hindawiya', labelKey: 'branchHindawiya' as keyof typeof translations },
];
