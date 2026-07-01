'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { User, Invoice, Trip } from '@/lib/types';
import { LiveTimer } from '@/components/LiveTimer';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';

// Icons
const UsersIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
);

const InvoiceIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
);

const TripIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

function DashboardContent() {
    const { user } = useAuth();
    const { language } = useLanguage();

    const [stats, setStats] = useState({
        users: 0,
        drivers: 0,
        activeTrips: 0,
        todayInvoices: 0,
        totalInvoices: 0,
        delivered: 0,
        pending: 0,
        notReceived: 0,
        returned: 0
    });
    const [liveTrips, setLiveTrips] = useState<(Trip & { invoice_count: number })[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrip, setSelectedTrip] = useState<(Trip & { invoice_count: number }) | null>(null);

    useEffect(() => {
        // Set up real-time listener for active trips
        const tripsQuery = query(
            collection(db, 'trips'),
            where('status', '==', 'active'),
            orderBy('start_time', 'desc')
        );

        const unsubscribeTrips = onSnapshot(tripsQuery, (snapshot) => {
            // Map trips directly without nested queries (invoice_count stored in trip doc)
            const tripsWithCounts = snapshot.docs.map(tripDoc => ({
                trip_id: tripDoc.id,
                ...tripDoc.data(),
                start_time: tripDoc.data().start_time?.toDate() || new Date(),
                end_time: tripDoc.data().end_time?.toDate() || null,
                created_at: tripDoc.data().created_at?.toDate() || new Date(),
                invoice_count: tripDoc.data().invoice_count || 0
            } as Trip & { invoice_count: number }));
            setLiveTrips(tripsWithCounts);
            setStats(prev => ({ ...prev, activeTrips: snapshot.size }));
        });

        // Real-time listener for users
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const driversCount = snapshot.docs.filter(doc => doc.data().role === 'driver').length;
            setStats(prev => ({ ...prev, users: snapshot.size, drivers: driversCount }));
        });

        // Real-time listener for invoices
        const invoicesQuery = query(
            collection(db, 'invoices'),
            orderBy('created_at', 'desc')
        );
        const unsubscribeInvoices = onSnapshot(invoicesQuery, (snapshot) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const todayInvoices = snapshot.docs.filter(doc => {
                const createdAt = doc.data().created_at?.toDate();
                return createdAt && createdAt >= today;
            });

            // Count by status
            const statusCounts = {
                delivered: 0,
                pending: 0,
                notReceived: 0,
                returned: 0
            };
            snapshot.docs.forEach(doc => {
                const status = doc.data().status;
                if (status === 'delivered') statusCounts.delivered++;
                else if (status === 'pending') statusCounts.pending++;
                else if (status === 'not_received') statusCounts.notReceived++;
                else if (status === 'returned') statusCounts.returned++;
            });

            setStats(prev => ({
                ...prev,
                todayInvoices: todayInvoices.length,
                totalInvoices: snapshot.size,
                ...statusCounts
            }));
            setLoading(false);
        });

        return () => {
            unsubscribeTrips();
            unsubscribeUsers();
            unsubscribeInvoices();
        };
    }, []);

    const getStatusText = (status: string) => {
        const statusTextMap: Record<string, { ar: string; en: string }> = {
            'delivered': { ar: 'تم التسليم', en: 'Delivered' },
            'pending': { ar: 'قيد الانتظار', en: 'Pending' },
            'not_received': { ar: 'لم يستلم', en: 'Not Received' },
            'returned': { ar: 'مرتجع', en: 'Returned' }
        };
        return statusTextMap[status]?.[language] || status;
    };

    return (
        <div className="page">
            <RoleNav />

            {/* Header */}
            <div className="mb-lg">
                <h1 className="page-title">{t('dashboard', language)}</h1>
                <p className="page-subtitle">
                    {language === 'ar' ? `مرحباً، ${user?.name}` : `Welcome, ${user?.name}`}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <Link href="/users" className="stat-card" style={{ textDecoration: 'none' }}>
                    <div className="stat-icon">
                        <UsersIcon />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{loading ? '-' : stats.users}</div>
                        <div className="stat-label">{t('users', language)}</div>
                    </div>
                </Link>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%)' }}>
                        <TripIcon />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{loading ? '-' : stats.activeTrips}</div>
                        <div className="stat-label">{t('activeTrips', language)}</div>
                    </div>
                </div>

                <Link href="/invoices" className="stat-card" style={{ textDecoration: 'none' }}>
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--warning-500) 0%, var(--warning-600) 100%)' }}>
                        <InvoiceIcon />
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{loading ? '-' : stats.todayInvoices}</div>
                        <div className="stat-label">{language === 'ar' ? 'فواتير اليوم' : "Today's Invoices"}</div>
                    </div>
                </Link>

                <div className="stat-card">
                    <div className="stat-icon" style={{ background: 'linear-gradient(135deg, var(--info-500) 0%, var(--info-600) 100%)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24, color: 'white' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                    </div>
                    <div className="stat-content">
                        <div className="stat-value">{loading ? '-' : stats.drivers}</div>
                        <div className="stat-label">{language === 'ar' ? 'السائقين' : 'Drivers'}</div>
                    </div>
                </div>
            </div>

            {/* Invoice Statistics */}
            <div className="card mb-lg">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                    {language === 'ar' ? 'إحصائيات الفواتير' : 'Invoice Statistics'}
                </h2>
                {loading ? (
                    <div className="text-center" style={{ padding: 'var(--spacing-md)' }}>
                        <div className="loader"></div>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <p style={{ color: 'var(--slate-400)', marginBottom: 'var(--spacing-sm)' }}>
                                {language === 'ar' ? 'إجمالي الفواتير:' : 'Total Invoices:'} <strong style={{ color: 'var(--slate-100)' }}>{stats.totalInvoices}</strong>
                            </p>
                            {stats.totalInvoices > 0 && (
                                <p style={{ color: 'var(--success)', fontWeight: 600 }}>
                                    {language === 'ar' ? 'نسبة التسليم:' : 'Delivery Rate:'} {Math.round((stats.delivered / stats.totalInvoices) * 100)}%
                                </p>
                            )}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: 'var(--spacing-sm)'
                        }}>
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center',
                                border: '1px solid rgba(34, 197, 94, 0.2)'
                            }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{stats.delivered}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                    {language === 'ar' ? 'تم التسليم' : 'Delivered'}
                                </div>
                            </div>
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(245, 158, 11, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center',
                                border: '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{stats.pending}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                    {language === 'ar' ? 'في الانتظار' : 'Pending'}
                                </div>
                            </div>
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center',
                                border: '1px solid rgba(239, 68, 68, 0.2)'
                            }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--error)' }}>{stats.notReceived}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                    {language === 'ar' ? 'لم يستلم' : 'Not Received'}
                                </div>
                            </div>
                            <div style={{
                                padding: 'var(--spacing-md)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                textAlign: 'center',
                                border: '1px solid rgba(99, 102, 241, 0.2)'
                            }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>{stats.returned}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                    {language === 'ar' ? 'مرتجع' : 'Returned'}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* الرحلات المباشرة - Live Trips */}
            <div className="card">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: liveTrips.length > 0 ? 'var(--success)' : 'var(--slate-500)',
                        animation: liveTrips.length > 0 ? 'pulse 1s ease-in-out infinite' : 'none'
                    }} />
                    {language === 'ar' ? 'الرحلات المباشرة' : 'Live Trips'}
                    <span style={{ fontSize: '0.875rem', color: 'var(--slate-500)', fontWeight: 400 }}>
                        ({liveTrips.length})
                    </span>
                </h2>

                {liveTrips.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                        {language === 'ar' ? 'لا توجد رحلات نشطة حالياً' : 'No active trips currently'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {liveTrips.map((trip) => (
                            <div
                                key={trip.trip_id}
                                onClick={() => setSelectedTrip(trip)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: 'var(--spacing-md)',
                                    background: '#ffffff',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '2px solid var(--success-500)',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 'var(--radius-md)',
                                        background: 'linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white'
                                    }}>
                                        <TripIcon />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--slate-100)' }}>
                                            {trip.driver_name}
                                        </div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-400)' }}>
                                            {language === 'ar' ? 'خرج من المستودع' : 'Left warehouse'} - {trip.start_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div style={{ fontSize: '0.8125rem', color: 'var(--success-400)', marginTop: '2px' }}>
                                            {trip.invoice_count} {language === 'ar' ? 'فاتورة' : 'invoices'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'end' }}>
                                    <LiveTimer startTime={trip.start_time} isRunning={true} size="sm" showCar={false} />
                                    <div style={{ fontSize: '0.6875rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                                        {language === 'ar' ? 'اضغط للتفاصيل' : 'Click for details'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Trip Detail Modal */}
            {selectedTrip && (() => {
                const tripDuration = Date.now() - selectedTrip.start_time.getTime();
                const hours = Math.floor(tripDuration / 3600000);
                const minutes = Math.floor((tripDuration % 3600000) / 60000);
                const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                return (
                    <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                            <div className="modal-header">
                                <div>
                                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 32,
                                            height: 32,
                                            borderRadius: 'var(--radius-md)',
                                            background: 'var(--success-500)',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            fontWeight: 700
                                        }}>
                                            🚚
                                        </span>
                                        {selectedTrip.driver_name}
                                    </h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: '4px' }}>
                                        {language === 'ar' ? 'رحلة نشطة' : 'Active Trip'}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedTrip(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                            </div>
                            <div className="modal-body" style={{ padding: 'var(--spacing-md)' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 'var(--spacing-sm)',
                                    marginBottom: 'var(--spacing-lg)',
                                    background: 'var(--slate-800)',
                                    padding: 'var(--spacing-md)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'وقت الخروج' : 'Start Time'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-200)' }}>
                                            {selectedTrip.start_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'المدة' : 'Duration'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success-400)' }}>
                                            {durationText}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'الفواتير' : 'Invoices'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary-400)' }}>
                                            {selectedTrip.invoice_count}
                                        </div>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)', textAlign: 'center' }}>
                                    {language === 'ar' ? 'السائق حالياً في الطريق' : 'Driver is currently on the road'}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Pulse Animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <RoleGuard allowedRoles={['admin']}>
            <DashboardContent />
        </RoleGuard>
    );
}
