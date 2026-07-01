'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t, invoiceTypes } from '@/lib/i18n';
import { Trip, Invoice, InvoiceType, InvoiceStatus } from '@/lib/types';
import { LiveTimer } from '@/components/LiveTimer';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';

// Icons
const BackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

function TripDetailContent() {
    const router = useRouter();
    const params = useParams();
    const tripId = params.id as string;
    const { user } = useAuth();
    const { language, isRTL } = useLanguage();
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const isDriver = user?.role === 'driver';
    const isAdmin = user?.role === 'admin';

    const [trip, setTrip] = useState<Trip | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [imagePreview, setImagePreview] = useState<{ url: string; invoiceNumber: string } | null>(null);

    const [newInvoice, setNewInvoice] = useState({
        invoice_number: '',
        invoice_type: 'invoice' as InvoiceType,
        note: ''
    });

    useEffect(() => {
        if (tripId) {
            fetchTripData();
        }
    }, [tripId]);

    const fetchTripData = async () => {
        try {
            const tripDoc = await getDoc(doc(db, 'trips', tripId));
            if (!tripDoc.exists()) {
                router.push('/trips');
                return;
            }

            const tripData = tripDoc.data();

            // Check access: Driver can only view their own trips
            if (isDriver && tripData.driver_id !== user?.id) {
                router.push('/trips');
                return;
            }

            setTrip({
                trip_id: tripDoc.id,
                driver_id: tripData.driver_id,
                driver_name: tripData.driver_name,
                status: tripData.status,
                start_time: tripData.start_time?.toDate() || new Date(),
                end_time: tripData.end_time?.toDate() || null,
                created_at: tripData.created_at?.toDate() || new Date()
            });

            const invoicesQuery = query(
                collection(db, 'invoices'),
                where('trip_id', '==', tripId),
                orderBy('created_at', 'desc')
            );
            const invoicesSnap = await getDocs(invoicesQuery);

            const invoicesData = invoicesSnap.docs.map(inv => ({
                invoice_id: inv.id,
                ...inv.data(),
                start_time: inv.data().start_time?.toDate() || inv.data().created_at?.toDate() || new Date(),
                end_time: inv.data().end_time?.toDate() || null,
                created_at: inv.data().created_at?.toDate() || new Date(),
                updated_at: inv.data().updated_at?.toDate() || new Date()
            })) as Invoice[];

            setInvoices(invoicesData);
        } catch (error) {
            console.error('Error fetching trip data:', error);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleViewImage = async (invoiceId: string, invoiceNumber: string) => {
        try {
            // Query images collection for this invoice
            const imagesQuery = query(
                collection(db, 'images'),
                where('invoice_id', '==', invoiceId),
                orderBy('captured_at', 'desc')
            );
            const imagesSnap = await getDocs(imagesQuery);

            if (imagesSnap.empty) {
                showToast(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found', 'error');
                return;
            }

            const imageData = imagesSnap.docs[0].data();

            // Try file_url first (stored during upload), fallback to getDownloadURL
            let url = imageData.file_url;
            if (!url && imageData.file_path) {
                const imageRef = ref(storage, imageData.file_path);
                url = await getDownloadURL(imageRef);
            }

            if (url) {
                setImagePreview({ url, invoiceNumber });
            } else {
                showToast(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found', 'error');
            }
        } catch (error) {
            console.error('Error loading image:', error);
            showToast(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found', 'error');
        }
    };

    const handleAddInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !trip || !newInvoice.invoice_number.trim() || !isDriver) return;

        setFormLoading(true);
        try {
            const duplicateQuery = query(
                collection(db, 'invoices'),
                where('invoice_number', '==', newInvoice.invoice_number.trim())
            );
            const duplicateSnap = await getDocs(duplicateQuery);

            if (!duplicateSnap.empty) {
                const existingInvoice = duplicateSnap.docs[0].data();
                showToast(
                    language === 'ar'
                        ? `رقم الفاتورة موجود مسبقاً مع السائق: ${existingInvoice.driver_name}`
                        : `Invoice number already exists with driver: ${existingInvoice.driver_name}`,
                    'error'
                );
                setFormLoading(false);
                return;
            }

            const invoiceRef = doc(collection(db, 'invoices'));
            const now = serverTimestamp();

            await setDoc(invoiceRef, {
                invoice_number: newInvoice.invoice_number.trim(),
                invoice_type: newInvoice.invoice_type,
                status: 'pending',
                note: newInvoice.note,
                driver_id: user.id,
                driver_name: user.name,
                trip_id: tripId,
                start_time: now,
                end_time: null,
                duration: null,
                created_at: now,
                updated_at: now
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'create',
                entity_type: 'invoice',
                entity_id: invoiceRef.id,
                user_id: user.id,
                user_name: user.name,
                old_value: null,
                new_value: { invoice_number: newInvoice.invoice_number, status: 'pending', trip_id: tripId },
                timestamp: now
            });

            showToast(language === 'ar' ? 'تم إضافة الفاتورة' : 'Invoice added', 'success');
            setNewInvoice({ invoice_number: '', invoice_type: 'invoice', note: '' });
            setShowAddModal(false);
            fetchTripData();
        } catch (error) {
            console.error('Error adding invoice:', error);
            showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateStatus = async (invoice: Invoice, newStatus: InvoiceStatus) => {
        if (!user || !isDriver) return;

        if (newStatus === 'delivered') {
            setSelectedInvoice(invoice);
            if (cameraInputRef.current) {
                cameraInputRef.current.click();
            }
            return;
        }

        setFormLoading(true);
        try {
            const now = new Date();
            const duration = now.getTime() - invoice.start_time.getTime();

            await updateDoc(doc(db, 'invoices', invoice.invoice_id), {
                status: newStatus,
                end_time: serverTimestamp(),
                duration: duration,
                updated_at: serverTimestamp()
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'status_change',
                entity_type: 'invoice',
                entity_id: invoice.invoice_id,
                user_id: user.id,
                user_name: user.name,
                old_value: { status: invoice.status },
                new_value: { status: newStatus },
                timestamp: serverTimestamp()
            });

            showToast(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated', 'success');
            fetchTripData();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedInvoice || !user) return;

        setFormLoading(true);
        try {
            // Compress image before upload
            const { compressImage } = await import('@/lib/imageUtils');
            const compressedBlob = await compressImage(file, 1200, 0.7);

            const imageRef = ref(storage, `invoices/${selectedInvoice.invoice_id}/${Date.now()}.jpg`);
            await uploadBytes(imageRef, compressedBlob);
            const imageUrl = await getDownloadURL(imageRef);

            const imageDoc = doc(collection(db, 'images'));
            await setDoc(imageDoc, {
                invoice_id: selectedInvoice.invoice_id,
                invoice_number: selectedInvoice.invoice_number,
                driver_id: user.id,
                trip_id: tripId,
                captured_at: serverTimestamp(),
                file_path: imageRef.fullPath,
                file_url: imageUrl,
                source: 'camera_only',
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });

            const now = new Date();
            const duration = now.getTime() - selectedInvoice.start_time.getTime();

            await updateDoc(doc(db, 'invoices', selectedInvoice.invoice_id), {
                status: 'delivered',
                end_time: serverTimestamp(),
                duration: duration,
                has_image: true,
                updated_at: serverTimestamp()
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'status_change',
                entity_type: 'invoice',
                entity_id: selectedInvoice.invoice_id,
                user_id: user.id,
                user_name: user.name,
                old_value: { status: selectedInvoice.status },
                new_value: { status: 'delivered', has_image: true },
                timestamp: serverTimestamp()
            });

            showToast(language === 'ar' ? 'تم التسليم وحفظ الصورة' : 'Delivered and image saved', 'success');
            setSelectedInvoice(null);
            fetchTripData();
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast(language === 'ar' ? 'حدث خطأ في رفع الصورة' : 'Error uploading image', 'error');
        } finally {
            setFormLoading(false);
            if (cameraInputRef.current) { cameraInputRef.current.value = ''; }
        }
    };

    const handleEndTrip = async () => {
        if (!user || !trip || !isDriver) return;

        const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
        if (pendingInvoices.length > 0) {
            showToast(
                language === 'ar'
                    ? `لديك ${pendingInvoices.length} فواتير معلقة`
                    : `You have ${pendingInvoices.length} pending invoices`,
                'error'
            );
            return;
        }

        setFormLoading(true);
        try {
            await updateDoc(doc(db, 'trips', tripId), {
                status: 'completed',
                end_time: serverTimestamp()
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'status_change',
                entity_type: 'trip',
                entity_id: tripId,
                user_id: user.id,
                user_name: user.name,
                old_value: { status: 'active' },
                new_value: { status: 'completed' },
                timestamp: serverTimestamp()
            });

            showToast(language === 'ar' ? 'تم إنهاء الرحلة' : 'Trip ended', 'success');
            router.push('/trips');
        } catch (error) {
            console.error('Error ending trip:', error);
        } finally {
            setFormLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, string> = {
            'delivered': 'badge-success', 'pending': 'badge-warning',
            'not_received': 'badge-error', 'returned': 'badge-info'
        };
        return statusMap[status] || 'badge-neutral';
    };

    const getStatusText = (status: string) => {
        const statusTextMap: Record<string, { ar: string; en: string }> = {
            'delivered': { ar: 'تم التسليم', en: 'Delivered' },
            'pending': { ar: 'في الانتظار', en: 'Pending' },
            'not_received': { ar: 'لم يستلم', en: 'Not Received' },
            'returned': { ar: 'إرجاع', en: 'Returned' }
        };
        return statusTextMap[status]?.[language] || status;
    };

    const getTypeText = (type: string) => {
        const typeTextMap: Record<string, { ar: string; en: string }> = {
            'invoice': { ar: 'فاتورة', en: 'Invoice' },
            'delivery_permit': { ar: 'إذن تسليم', en: 'Delivery Permit' },
            'quotation': { ar: 'عرض سعر', en: 'Quotation' },
            'transfer': { ar: 'مناقلة', en: 'Transfer' },
            'clearance': { ar: 'فسح', en: 'Clearance' }
        };
        return typeTextMap[type]?.[language] || type;
    };

    if (loading) {
        return (
            <div className="page">
                <RoleNav />
                <div className="text-center" style={{ padding: 'var(--spacing-xl)' }}>
                    <div className="loader"></div>
                </div>
            </div>
        );
    }

    if (!trip) return null;

    const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
    const deliveredCount = invoices.filter(inv => inv.status === 'delivered').length;
    const canModify = isDriver && trip.driver_id === user?.id && trip.status === 'active';

    return (
        <div className="page">
            <RoleNav />

            {/* Hidden camera input */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCameraCapture} />

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', top: 'var(--spacing-lg)', left: '50%', transform: 'translateX(-50%)', padding: 'var(--spacing-md) var(--spacing-lg)', borderRadius: 'var(--radius-lg)', background: toast.type === 'success' ? 'var(--success-500)' : 'var(--error-500)', color: 'white', fontWeight: 500, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-md mb-lg">
                <Link href="/trips" className="btn btn-ghost btn-icon"><BackIcon /></Link>
                <div style={{ flex: 1 }}>
                    <h1 className="page-title" style={{ fontSize: '1.25rem' }}>
                        {isAdmin ? trip.driver_name : (trip.status === 'active' ? (language === 'ar' ? 'رحلة نشطة' : 'Active Trip') : (language === 'ar' ? 'رحلة مكتملة' : 'Completed Trip'))}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: '4px' }}>
                        {trip.status === 'active' && <LiveTimer startTime={trip.start_time} isRunning={true} size="sm" showCar={false} />}
                        <span style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                            {language === 'ar' ? 'منذ' : 'since'} {trip.start_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                <div className="card" style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-100)' }}>{invoices.length}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{language === 'ar' ? 'الكل' : 'Total'}</div>
                </div>
                <div className="card" style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning-400)' }}>{pendingCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{language === 'ar' ? 'في الانتظار' : 'Pending'}</div>
                </div>
                <div className="card" style={{ padding: 'var(--spacing-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success-400)' }}>{deliveredCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{language === 'ar' ? 'تم' : 'Done'}</div>
                </div>
            </div>

            {/* Add Invoice Button (Driver only for active trips) */}
            {canModify && (
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary w-full mb-md">
                    <PlusIcon />
                    {language === 'ar' ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
            )}

            {/* Invoices List */}
            <div className="card">
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                    {language === 'ar' ? 'الفواتير' : 'Invoices'} ({invoices.length})
                </h2>

                {invoices.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
                        <p style={{ color: 'var(--slate-500)' }}>{language === 'ar' ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {invoices.map((invoice) => (
                            <div key={invoice.invoice_id} style={{ padding: 'var(--spacing-sm) var(--spacing-md)', background: 'var(--slate-800)', borderRadius: 'var(--radius-md)', border: invoice.status === 'pending' ? '1px solid var(--warning-500)' : '1px solid var(--slate-700)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                                    <div>
                                        <span style={{ fontWeight: 600, color: 'var(--slate-100)' }}>{invoice.invoice_number}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginLeft: 'var(--spacing-sm)' }}>{getTypeText(invoice.invoice_type)}</span>
                                    </div>
                                    <span className={`badge ${getStatusBadge(invoice.status)}`} style={{ fontSize: '0.7rem' }}>{getStatusText(invoice.status)}</span>
                                </div>

                                {invoice.note && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginBottom: 'var(--spacing-xs)' }}>📝 {invoice.note}</div>
                                )}

                                {/* Action buttons for pending invoices (Driver only) */}
                                {canModify && invoice.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-sm)' }}>
                                        <button onClick={() => handleUpdateStatus(invoice, 'delivered')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--success-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <CameraIcon /> {language === 'ar' ? 'تم' : 'Done'}
                                        </button>
                                        <button onClick={() => handleUpdateStatus(invoice, 'not_received')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--error-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                            {language === 'ar' ? 'لم يستلم' : 'No'}
                                        </button>
                                        <button onClick={() => handleUpdateStatus(invoice, 'returned')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--info-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                            {language === 'ar' ? 'إرجاع' : 'Ret'}
                                        </button>
                                    </div>
                                )}

                                {invoice.has_image && (
                                    <button onClick={() => handleViewImage(invoice.invoice_id, invoice.invoice_number)} style={{ fontSize: '0.7rem', color: 'var(--primary-400)', marginTop: 'var(--spacing-xs)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        📷 {language === 'ar' ? 'عرض الصورة' : 'View Image'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* End Trip Button (Driver only for active trips with no pending invoices) */}
            {canModify && (
                <button onClick={handleEndTrip} disabled={formLoading || pendingCount > 0} className="btn btn-secondary w-full mt-lg" style={{ opacity: pendingCount > 0 ? 0.5 : 1 }}>
                    {language === 'ar' ? 'إنهاء الرحلة' : 'End Trip'}
                </button>
            )}

            {/* Image Preview Modal */}
            {imagePreview && (
                <div className="modal-overlay" onClick={() => setImagePreview(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'صورة التسليم' : 'Delivery Image'}: {imagePreview.invoiceNumber}</h3>
                            <button onClick={() => setImagePreview(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <div className="modal-body" style={{ padding: 0 }}>
                            <img src={imagePreview.url} alt="Delivery proof" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Add Invoice Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'إضافة فاتورة' : 'Add Invoice'}</h3>
                            <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleAddInvoice}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">{language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}</label>
                                    <select className="form-select" value={newInvoice.invoice_type} onChange={(e) => setNewInvoice({ ...newInvoice, invoice_type: e.target.value as InvoiceType })}>
                                        {invoiceTypes.map((type) => <option key={type.value} value={type.value}>{t(type.labelKey, language)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'} *</label>
                                    <input type="text" className="form-input" value={newInvoice.invoice_number} onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })} placeholder={language === 'ar' ? 'أدخل رقم الفاتورة' : 'Enter invoice number'} required dir="ltr" autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{language === 'ar' ? 'ملاحظة' : 'Note'}</label>
                                    <textarea className="form-textarea" value={newInvoice.note} onChange={(e) => setNewInvoice({ ...newInvoice, note: e.target.value })} placeholder={language === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'} rows={2} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">{t('cancel', language)}</button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading || !newInvoice.invoice_number.trim()}>
                                    {formLoading ? <span className="loader" style={{ width: 20, height: 20 }}></span> : (language === 'ar' ? 'إضافة' : 'Add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TripDetailPage() {
    return (
        <RoleGuard allowedRoles={['admin', 'driver']}>
            <TripDetailContent />
        </RoleGuard>
    );
}
