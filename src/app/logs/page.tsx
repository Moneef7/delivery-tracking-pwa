'use client';

import React, { useState, useEffect } from 'react';
import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    writeBatch,
    doc
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/i18n';
import { ActivityLog } from '@/lib/types';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';

// Icons
const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const SearchIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
);

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
);

const ImageIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

function LogsContent() {
    const { user } = useAuth();
    const { language } = useLanguage();

    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Delete states
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Age-based invoice deletion
    const [daysOld, setDaysOld] = useState('');
    const [invoicesToDelete, setInvoicesToDelete] = useState<{ id: string; invoice_number: string; created_at: Date; has_image: boolean; driver_name: string }[]>([]);
    const [imagesToDelete, setImagesToDelete] = useState<{ id: string; file_path: string }[]>([]);
    const [showInvoicePreview, setShowInvoicePreview] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const logsQuery = query(
                collection(db, 'logs'),
                orderBy('timestamp', 'desc'),
                limit(500)
            );
            const snapshot = await getDocs(logsQuery);
            const logsData = snapshot.docs.map(doc => ({
                log_id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            })) as ActivityLog[];
            setLogs(logsData);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllLogs = async () => {
        if (!user) return;
        setDeleteLoading(true);
        try {
            const logsRef = collection(db, 'logs');
            const snapshot = await getDocs(logsRef);

            const batchSize = 500;
            let batch = writeBatch(db);
            let count = 0;

            for (const docSnap of snapshot.docs) {
                batch.delete(docSnap.ref);
                count++;
                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
            if (count % batchSize !== 0) {
                await batch.commit();
            }

            setLogs([]);
            setShowDeleteConfirm(false);
            alert(language === 'ar' ? `تم حذف ${count} سجل` : `Deleted ${count} logs`);
        } catch (error) {
            console.error('Error deleting logs:', error);
            alert(language === 'ar' ? 'حدث خطأ في الحذف' : 'Error deleting logs');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSearchOldInvoices = async () => {
        if (!daysOld || parseInt(daysOld) <= 0) return;
        setSearchLoading(true);
        try {
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - parseInt(daysOld));

            // Get invoices
            const invoicesRef = collection(db, 'invoices');
            const snapshot = await getDocs(query(invoicesRef, where('created_at', '<', daysAgo), orderBy('created_at', 'desc')));

            const invoices = snapshot.docs.map(doc => ({
                id: doc.id,
                invoice_number: doc.data().invoice_number,
                created_at: doc.data().created_at?.toDate() || new Date(),
                has_image: doc.data().has_image || false,
                driver_name: doc.data().driver_name || '-'
            }));

            // Get related images
            const invoiceIds = invoices.map(i => i.id);
            const images: { id: string; file_path: string }[] = [];

            if (invoiceIds.length > 0) {
                // Batch query images in chunks of 10 (Firestore limit for 'in' queries)
                for (let i = 0; i < invoiceIds.length; i += 10) {
                    const chunk = invoiceIds.slice(i, i + 10);
                    const imagesSnapshot = await getDocs(query(collection(db, 'images'), where('invoice_id', 'in', chunk)));
                    imagesSnapshot.docs.forEach(doc => {
                        images.push({ id: doc.id, file_path: doc.data().file_path });
                    });
                }
            }

            setInvoicesToDelete(invoices);
            setImagesToDelete(images);
            setShowInvoicePreview(true);
        } catch (error) {
            console.error('Error searching invoices:', error);
            alert(language === 'ar' ? 'حدث خطأ في البحث' : 'Error searching invoices');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleDeleteOldInvoices = async () => {
        if (invoicesToDelete.length === 0) return;
        setDeleteLoading(true);
        try {
            // Delete images from Storage first
            for (const img of imagesToDelete) {
                try {
                    const imageRef = ref(storage, img.file_path);
                    await deleteObject(imageRef);
                } catch (err) {
                    console.log('Image not found in storage:', img.file_path);
                }
            }

            // Delete image documents
            const batchSize = 500;
            let batch = writeBatch(db);
            let count = 0;

            for (const img of imagesToDelete) {
                batch.delete(doc(db, 'images', img.id));
                count++;
                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
            if (count % batchSize !== 0 && count > 0) {
                await batch.commit();
            }

            // Delete invoices
            batch = writeBatch(db);
            let invoiceCount = 0;

            for (const inv of invoicesToDelete) {
                batch.delete(doc(db, 'invoices', inv.id));
                invoiceCount++;
                if (invoiceCount % batchSize === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
            if (invoiceCount % batchSize !== 0) {
                await batch.commit();
            }

            setInvoicesToDelete([]);
            setImagesToDelete([]);
            setShowInvoicePreview(false);
            setDaysOld('');
            alert(language === 'ar'
                ? `تم حذف ${invoiceCount} فاتورة و ${imagesToDelete.length} صورة`
                : `Deleted ${invoiceCount} invoices and ${imagesToDelete.length} images`);
        } catch (error) {
            console.error('Error deleting invoices:', error);
            alert(language === 'ar' ? 'حدث خطأ في الحذف' : 'Error deleting invoices');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Pagination
    const totalPages = Math.ceil(logs.length / itemsPerPage);
    const paginatedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getActionBadge = (action: string) => {
        const actionMap: Record<string, string> = {
            'create': 'badge-success',
            'update': 'badge-warning',
            'delete': 'badge-error',
            'status_change': 'badge-info',
            'reassign': 'badge-info',
            'auto_delete': 'badge-error'
        };
        return actionMap[action] || 'badge-neutral';
    };

    const getActionText = (action: string) => {
        const actionTextMap: Record<string, { ar: string; en: string }> = {
            'create': { ar: 'إنشاء', en: 'Create' },
            'update': { ar: 'تحديث', en: 'Update' },
            'delete': { ar: 'حذف', en: 'Delete' },
            'status_change': { ar: 'تغيير الحالة', en: 'Status Change' },
            'reassign': { ar: 'إعادة تعيين', en: 'Reassign' },
            'auto_delete': { ar: 'حذف تلقائي', en: 'Auto Delete' }
        };
        return actionTextMap[action]?.[language] || action;
    };

    const getEntityText = (entity: string) => {
        const entityTextMap: Record<string, { ar: string; en: string }> = {
            'invoice': { ar: 'فاتورة', en: 'Invoice' },
            'trip': { ar: 'رحلة', en: 'Trip' },
            'user': { ar: 'مستخدم', en: 'User' },
            'image': { ar: 'صورة', en: 'Image' }
        };
        return entityTextMap[entity]?.[language] || entity;
    };

    const formatChanges = (log: ActivityLog) => {
        if (!log.old_value && log.new_value) {
            return Object.entries(log.new_value).map(([key, value]) => (
                <div key={key} style={{ fontSize: '0.8125rem', color: 'var(--success-400)' }}>
                    + {key}: {String(value)}
                </div>
            ));
        }

        if (log.old_value && !log.new_value) {
            return Object.entries(log.old_value).map(([key, value]) => (
                <div key={key} style={{ fontSize: '0.8125rem', color: 'var(--error-400)' }}>
                    - {key}: {String(value)}
                </div>
            ));
        }

        if (log.old_value && log.new_value) {
            const changes: React.ReactElement[] = [];
            Object.keys(log.new_value).forEach((key) => {
                const oldVal = (log.old_value as Record<string, unknown>)?.[key];
                const newVal = (log.new_value as Record<string, unknown>)?.[key];
                if (oldVal !== newVal) {
                    changes.push(
                        <div key={key} style={{ fontSize: '0.8125rem' }}>
                            <span style={{ color: 'var(--slate-400)' }}>{key}: </span>
                            <span style={{ color: 'var(--error-400)', textDecoration: 'line-through' }}>{String(oldVal)}</span>
                            <span style={{ color: 'var(--slate-400)' }}> → </span>
                            <span style={{ color: 'var(--success-400)' }}>{String(newVal)}</span>
                        </div>
                    );
                }
            });
            return changes;
        }

        return null;
    };

    const invoicesWithImages = invoicesToDelete.filter(i => i.has_image).length;

    return (
        <div className="page">
            <RoleNav />

            <div className="mb-lg">
                <h1 className="page-title">{t('logs', language)}</h1>
                <p className="page-subtitle">
                    {language === 'ar' ? 'سجل الأنشطة والتغييرات' : 'Activity and change history'}
                    {!loading && ` (${logs.length} ${language === 'ar' ? 'سجل' : 'records'})`}
                </p>
            </div>

            {/* Storage Cleanup Section */}
            <div className="card mb-md" style={{
                padding: 'var(--spacing-lg)',
                background: 'linear-gradient(135deg, var(--slate-800) 0%, var(--slate-900) 100%)',
                border: '1px solid var(--primary-500/30)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--primary-500/20)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <TrashIcon />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--slate-100)', margin: 0 }}>
                            {language === 'ar' ? 'تنظيف التخزين' : 'Storage Cleanup'}
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)', margin: 0 }}>
                            {language === 'ar' ? 'حذف الفواتير والصور القديمة لتوفير المساحة' : 'Delete old invoices and images to free up space'}
                        </p>
                    </div>
                </div>

                {/* Delete Old Invoices */}
                <div style={{
                    padding: 'var(--spacing-md)',
                    background: 'var(--slate-800/50)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--slate-300)', marginBottom: 'var(--spacing-xs)' }}>
                        {language === 'ar' ? 'حذف الفواتير الأقدم من:' : 'Delete invoices older than:'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', width: '120px' }}>
                            <input
                                type="number"
                                value={daysOld}
                                onChange={(e) => setDaysOld(e.target.value)}
                                placeholder="30"
                                className="form-input"
                                style={{
                                    paddingInlineEnd: '50px',
                                    background: 'var(--slate-900)',
                                    border: '1px solid var(--slate-600)'
                                }}
                                min="1"
                            />
                            <span style={{
                                position: 'absolute',
                                insetInlineEnd: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '0.875rem',
                                color: 'var(--slate-400)'
                            }}>
                                {language === 'ar' ? 'يوم' : 'days'}
                            </span>
                        </div>
                        <button
                            onClick={handleSearchOldInvoices}
                            disabled={searchLoading || !daysOld}
                            className="btn btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px'
                            }}
                        >
                            <SearchIcon />
                            {searchLoading ? '...' : (language === 'ar' ? 'بحث' : 'Search')}
                        </button>
                    </div>
                </div>

                {/* Delete All Logs */}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn btn-ghost"
                    style={{
                        color: 'var(--error-400)',
                        border: '1px solid var(--error-500/30)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <TrashIcon />
                    {language === 'ar' ? 'حذف جميع السجلات' : 'Delete All Logs'}
                </button>
            </div>

            {/* Invoice Preview Modal */}
            {showInvoicePreview && (
                <div className="modal-overlay" onClick={() => setShowInvoicePreview(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--error-500/20) 0%, var(--slate-800) 100%)' }}>
                            <div>
                                <h3 className="modal-title" style={{ marginBottom: '4px' }}>
                                    {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Deletion'}
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)', margin: 0 }}>
                                    {language === 'ar'
                                        ? `الفواتير الأقدم من ${daysOld} يوم`
                                        : `Invoices older than ${daysOld} days`}
                                </p>
                            </div>
                        </div>

                        <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
                            {invoicesToDelete.length === 0 ? (
                                <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>✓</div>
                                    <p style={{ color: 'var(--success-400)', fontWeight: 500 }}>
                                        {language === 'ar' ? 'لا توجد فواتير قديمة!' : 'No old invoices found!'}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Stats */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: 'var(--spacing-sm)',
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--slate-800/50)'
                                    }}>
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--error-500/10)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--error-500/20)'
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--error-400)' }}>
                                                {invoicesToDelete.length}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                                {language === 'ar' ? 'فاتورة' : 'Invoices'}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: 'var(--spacing-md)',
                                            background: 'var(--warning-500/10)',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--warning-500/20)'
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning-400)' }}>
                                                {imagesToDelete.length}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                                                {language === 'ar' ? 'صورة' : 'Images'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoice List */}
                                    <div style={{ padding: 'var(--spacing-md)' }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--slate-500)',
                                            marginBottom: 'var(--spacing-sm)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            {language === 'ar' ? 'قائمة الفواتير' : 'Invoice List'}
                                        </div>
                                        <div style={{ maxHeight: '280px', overflow: 'auto' }}>
                                            {invoicesToDelete.map((inv, index) => (
                                                <div
                                                    key={inv.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '12px 16px',
                                                        background: index % 2 === 0 ? 'var(--slate-800)' : 'var(--slate-800/50)',
                                                        borderRadius: 'var(--radius-md)',
                                                        marginBottom: '4px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                        <div style={{
                                                            width: 36,
                                                            height: 36,
                                                            borderRadius: 'var(--radius-md)',
                                                            background: 'var(--primary-500/20)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontWeight: 700,
                                                            fontSize: '0.875rem',
                                                            color: 'var(--primary-400)'
                                                        }}>
                                                            #{index + 1}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'var(--slate-100)', fontSize: '0.9375rem' }}>
                                                                {inv.invoice_number}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                                                                {inv.driver_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                                                        {inv.has_image && (
                                                            <span style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                padding: '4px 8px',
                                                                background: 'var(--warning-500/20)',
                                                                color: 'var(--warning-400)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                fontSize: '0.6875rem'
                                                            }}>
                                                                <ImageIcon /> {language === 'ar' ? 'صورة' : 'Image'}
                                                            </span>
                                                        )}
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.75rem',
                                                            color: 'var(--slate-400)'
                                                        }}>
                                                            <CalendarIcon />
                                                            {inv.created_at.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="modal-footer" style={{ borderTop: '1px solid var(--slate-700)' }}>
                            <button onClick={() => setShowInvoicePreview(false)} className="btn btn-secondary">
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            {invoicesToDelete.length > 0 && (
                                <button
                                    onClick={handleDeleteOldInvoices}
                                    disabled={deleteLoading}
                                    className="btn btn-primary"
                                    style={{
                                        background: 'var(--error-500)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <TrashIcon />
                                    {deleteLoading ? '...' : (language === 'ar' ? 'حذف الكل' : 'Delete All')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Logs Confirm Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ color: 'var(--error-400)' }}>
                                {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                            </h3>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--slate-300)' }}>
                                {language === 'ar'
                                    ? `هل أنت متأكد من حذف جميع السجلات (${logs.length})؟ هذا الإجراء لا يمكن التراجع عنه.`
                                    : `Are you sure you want to delete all ${logs.length} logs? This cannot be undone.`}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary">
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={handleDeleteAllLogs}
                                disabled={deleteLoading}
                                className="btn btn-primary"
                                style={{ background: 'var(--error-500)' }}
                            >
                                {deleteLoading ? '...' : (language === 'ar' ? 'حذف الكل' : 'Delete All')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <div className="text-center" style={{ padding: 'var(--spacing-xl)' }}>
                        <div className="loader"></div>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-state-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="empty-state-text">{t('noResults', language)}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {paginatedLogs.map((log) => (
                            <div
                                key={log.log_id}
                                style={{
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--slate-800)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--slate-700)'
                                }}
                            >
                                <div className="flex justify-between items-start mb-sm" style={{ flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                                    <div className="flex items-center gap-sm">
                                        <span className={`badge ${getActionBadge(log.action)}`}>
                                            {getActionText(log.action)}
                                        </span>
                                        <span style={{ color: 'var(--slate-400)', fontSize: '0.875rem' }}>
                                            {getEntityText(log.entity_type)}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                                        {log.timestamp.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.875rem', color: 'var(--slate-300)', marginBottom: 'var(--spacing-sm)' }}>
                                    {language === 'ar' ? 'بواسطة' : 'By'}: <strong>{log.user_name}</strong>
                                </div>

                                <div style={{
                                    padding: 'var(--spacing-sm)',
                                    background: 'var(--slate-900)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontFamily: 'monospace'
                                }}>
                                    {formatChanges(log)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-xs mt-lg" style={{ flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn btn-ghost"
                        style={{ padding: '8px 12px' }}
                    >
                        ←
                    </button>
                    {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 10) {
                            pageNum = i + 1;
                        } else if (currentPage <= 5) {
                            pageNum = i + 1;
                        } else if (currentPage >= totalPages - 4) {
                            pageNum = totalPages - 9 + i;
                        } else {
                            pageNum = currentPage - 4 + i;
                        }
                        return (
                            <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`btn ${pageNum === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ minWidth: 40, padding: '8px' }}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="btn btn-ghost"
                        style={{ padding: '8px 12px' }}
                    >
                        →
                    </button>
                </div>
            )}
        </div>
    );
}

export default function LogsPage() {
    return (
        <RoleGuard allowedRoles={['admin']}>
            <LogsContent />
        </RoleGuard>
    );
}
