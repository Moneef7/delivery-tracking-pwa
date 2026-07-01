'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LanguageContextType } from '@/lib/types';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<'ar' | 'en'>('ar');

    useEffect(() => {
        // Load saved language preference
        const savedLang = localStorage.getItem('language') as 'ar' | 'en' | null;
        if (savedLang && (savedLang === 'ar' || savedLang === 'en')) {
            setLanguageState(savedLang);
        }
    }, []);

    const setLanguage = (lang: 'ar' | 'en') => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
        // Update document direction
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    };

    // Set initial direction
    useEffect(() => {
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
    }, [language]);

    return (
        <LanguageContext.Provider value={{
            language,
            setLanguage,
            isRTL: language === 'ar'
        }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
