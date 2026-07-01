'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { UserRole } from '@/lib/types';

// Icons
const HomeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
);

const UsersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);

const InvoiceIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
);

const TripIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
);

const LogsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const LanguageIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
    </svg>
);

const LogoutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
);

interface NavTab {
    href: string;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
    roles: UserRole[];
}

const allTabs: NavTab[] = [
    { href: '/dashboard', labelAr: 'الرئيسية', labelEn: 'Dashboard', icon: <HomeIcon />, roles: ['admin'] },
    { href: '/users', labelAr: 'المستخدمين', labelEn: 'Users', icon: <UsersIcon />, roles: ['admin'] },
    { href: '/invoices', labelAr: 'الفواتير', labelEn: 'Invoices', icon: <InvoiceIcon />, roles: ['admin', 'seller'] },
    { href: '/trips', labelAr: 'الرحلات', labelEn: 'Trips', icon: <TripIcon />, roles: ['admin', 'driver'] },
    { href: '/logs', labelAr: 'السجلات', labelEn: 'Logs', icon: <LogsIcon />, roles: ['admin'] },
];

export function RoleNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { language, setLanguage } = useLanguage();
    const { user, logout } = useAuth();

    // Filter tabs based on user role
    const tabs = allTabs.filter(tab => user?.role && tab.roles.includes(user.role));

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    const handleLogout = async () => {
        await logout();
        router.push('/');
    };

    const toggleLanguage = () => {
        setLanguage(language === 'ar' ? 'en' : 'ar');
    };

    return (
        <>
            {/* Desktop Nav */}
            <nav className="role-nav-desktop">
                <div className="role-nav-brand">
                    <img src="/logo.png" alt="Logo" className="role-nav-logo" />
                    <span className="role-nav-company-name">Delivery Tracking</span>
                </div>
                <div className="role-nav-tabs">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={`role-nav-tab ${isActive(tab.href) ? 'active' : ''}`}
                        >
                            {tab.icon}
                            <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
                        </Link>
                    ))}
                </div>
                <div className="role-nav-actions">
                    <button onClick={toggleLanguage} className="role-nav-btn">
                        <LanguageIcon />
                        <span>{language === 'ar' ? 'EN' : 'ع'}</span>
                    </button>
                    <button onClick={handleLogout} className="role-nav-btn logout">
                        <LogoutIcon />
                        <span>{t('logout', language)}</span>
                    </button>
                </div>
            </nav>

            {/* Mobile Nav - Icon buttons */}
            <nav className="role-nav-mobile">
                {tabs.map((tab) => (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`role-nav-mobile-item ${isActive(tab.href) ? 'active' : ''}`}
                    >
                        {tab.icon}
                    </Link>
                ))}
                <button onClick={toggleLanguage} className="role-nav-mobile-item">
                    <LanguageIcon />
                </button>
                <button onClick={handleLogout} className="role-nav-mobile-item logout">
                    <LogoutIcon />
                </button>
            </nav>

            <style>{`
                .role-nav-desktop {
                    display: none;
                    align-items: center;
                    justify-content: space-between;
                    background: #ffffff;
                    padding: var(--spacing-xs);
                    border-radius: var(--radius-xl);
                    margin-bottom: var(--spacing-lg);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                @media (min-width: 768px) {
                    .role-nav-desktop {
                        display: flex;
                    }
                    .role-nav-mobile {
                        display: none !important;
                    }
                }

                .role-nav-brand {
                    display: flex;
                    align-items: center;
                    padding: 0 var(--spacing-md);
                    border-left: 1px solid rgba(0, 0, 0, 0.08);
                }

                [dir="rtl"] .role-nav-brand {
                    border-left: none;
                    border-right: 1px solid rgba(0, 0, 0, 0.08);
                }

                .role-nav-logo {
                    height: 42px;
                    width: auto;
                    object-fit: contain;
                }

                .role-nav-company-name {
                    display: none;
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: #5a5247;
                    white-space: nowrap;
                    margin-inline-start: 12px;
                }

                @media (min-width: 1024px) {
                    .role-nav-company-name {
                        display: block;
                    }
                }

                .role-nav-tabs {
                    display: flex;
                    gap: var(--spacing-xs);
                }

                .role-nav-tab {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--slate-400);
                    text-decoration: none;
                    border-radius: var(--radius-lg);
                    transition: all var(--transition-fast);
                    white-space: nowrap;
                }

                .role-nav-tab:hover {
                    background: var(--slate-800);
                    color: var(--slate-200);
                }

                .role-nav-tab.active {
                    background: var(--primary-500);
                    color: white;
                }

                .role-nav-actions {
                    display: flex;
                    gap: var(--spacing-xs);
                }

                .role-nav-btn {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing-xs);
                    padding: var(--spacing-sm) var(--spacing-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--slate-400);
                    background: transparent;
                    border: none;
                    border-radius: var(--radius-lg);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }

                .role-nav-btn:hover {
                    background: var(--slate-800);
                    color: var(--slate-200);
                }

                .role-nav-btn.logout:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: var(--error-400);
                }

                /* Mobile Nav */
                .role-nav-mobile {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    background: #ffffff;
                    padding: var(--spacing-sm);
                    border-radius: var(--radius-xl);
                    margin-bottom: var(--spacing-md);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                }

                .role-nav-mobile-item {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    color: var(--slate-400);
                    text-decoration: none;
                    border-radius: var(--radius-md);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }

                .role-nav-mobile-item:hover,
                .role-nav-mobile-item.active {
                    background: var(--primary-500);
                    color: white;
                }

                .role-nav-mobile-item.logout:hover {
                    background: rgba(239, 68, 68, 0.2);
                    color: var(--error-400);
                }
            `}</style>
        </>
    );
}
