'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    increment
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t, invoiceTypes, branchOptions } from '@/lib/i18n';
import { Trip, Invoice, InvoiceStatus, InvoiceType, Branch } from '@/lib/types';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';

// Icons
const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const TruckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

const ChevronRightIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

interface TripWithInvoices extends Trip {
    invoices: Invoice[];
    trip_number: number;
}

function TripsContent() {
    const router = useRouter();
    const { user } = useAuth();
    const { language, isRTL } = useLanguage();
    const isDriver = user?.role === 'driver';
    const isAdmin = user?.role === 'admin';
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [trips, setTrips] = useState<TripWithInvoices[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
    const [tripCounter, setTripCounter] = useState(0);
    const [selectedTrip, setSelectedTrip] = useState<TripWithInvoices | null>(null);

    // Driver invoice management state
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [originalInvoice, setOriginalInvoice] = useState<Invoice | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [newInvoice, setNewInvoice] = useState({
        invoice_number: '',
        invoice_type: 'invoice' as InvoiceType,
        branch: 'main' as Branch,
        note: ''
    });

    // Confirmation states for trip actions
    const [showStartTripConfirm, setShowStartTripConfirm] = useState(false);
    const [showEndTripConfirm, setShowEndTripConfirm] = useState<{ tripId: string; pendingCount: number } | null>(null);

    // State for pending status updates that require camera
    const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ invoice: Invoice; status: InvoiceStatus } | null>(null);

    // Real-time listener for trips
    useEffect(() => {
        if (!user) return;

        let tripsQuery;
        if (isDriver) {
            tripsQuery = query(
                collection(db, 'trips'),
                where('driver_id', '==', user.id),
                orderBy('created_at', 'desc')
            );
        } else {
            // Admin sees all trips ordered by creation for sequential numbering
            tripsQuery = query(
                collection(db, 'trips'),
                orderBy('created_at', 'asc') // Ascending for trip numbering
            );
        }

        const unsubscribe = onSnapshot(tripsQuery, async (snapshot) => {
            const tripsData: TripWithInvoices[] = [];
            let counter = 0;

            for (const tripDoc of snapshot.docs) {
                const tripData = tripDoc.data();
                counter++;

                // Fetch invoices for each trip
                const invoicesQuery = query(
                    collection(db, 'invoices'),
                    where('trip_id', '==', tripDoc.id),
                    orderBy('created_at', 'desc')
                );
                const invoicesSnap = await getDocs(invoicesQuery);
                const invoices = invoicesSnap.docs.map(inv => ({
                    invoice_id: inv.id,
                    ...inv.data(),
                    start_time: inv.data().start_time?.toDate() || inv.data().created_at?.toDate() || new Date(),
                    end_time: inv.data().end_time?.toDate() || null,
                    created_at: inv.data().created_at?.toDate() || new Date(),
                    updated_at: inv.data().updated_at?.toDate() || new Date()
                })) as Invoice[];

                tripsData.push({
                    trip_id: tripDoc.id,
                    driver_id: tripData.driver_id,
                    driver_name: tripData.driver_name,
                    status: tripData.status,
                    start_time: tripData.start_time?.toDate() || new Date(),
                    end_time: tripData.end_time?.toDate() || null,
                    created_at: tripData.created_at?.toDate() || new Date(),
                    invoices,
                    trip_number: counter
                });
            }

            setTripCounter(counter);
            // Reverse for display (newest first) but keep trip numbers
            if (isAdmin) {
                tripsData.reverse();
            }
            setTrips(tripsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, isDriver, isAdmin]);

    // Real-time listener for invoices (driver only, for active trip)
    useEffect(() => {
        if (!user || !isDriver) return;

        // Find active trip from current state
        const activeTrip = trips.find(t => t.status === 'active');
        if (!activeTrip) return;

        const invoicesQuery = query(
            collection(db, 'invoices'),
            where('trip_id', '==', activeTrip.trip_id),
            orderBy('created_at', 'desc')
        );

        const unsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
            const invoices = snapshot.docs.map(inv => ({
                invoice_id: inv.id,
                ...inv.data(),
                start_time: inv.data().start_time?.toDate() || inv.data().created_at?.toDate() || new Date(),
                end_time: inv.data().end_time?.toDate() || null,
                created_at: inv.data().created_at?.toDate() || new Date(),
                updated_at: inv.data().updated_at?.toDate() || new Date()
            })) as Invoice[];

            // Update the trips state with new invoices
            setTrips(prevTrips => prevTrips.map(t =>
                t.trip_id === activeTrip.trip_id ? { ...t, invoices } : t
            ));
        });

        return () => unsubscribe();
    }, [user, isDriver, trips.find(t => t.status === 'active')?.trip_id]);

    const createNewTrip = async () => {
        if (!user || !isDriver) return;

        setCreating(true);
        try {
            const tripRef = doc(collection(db, 'trips'));
            await setDoc(tripRef, {
                driver_id: user.id,
                driver_name: user.name,
                start_time: serverTimestamp(),
                end_time: null,
                status: 'active',
                invoice_count: 0,
                created_at: serverTimestamp()
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'create',
                entity_type: 'trip',
                entity_id: tripRef.id,
                user_id: user.id,
                user_name: user.name,
                old_value: null,
                new_value: { status: 'active' },
                timestamp: serverTimestamp()
            });
            setShowStartTripConfirm(false);
            showToast(language === 'ar' ? 'تم بدء الرحلة' : 'Trip started', 'success');
        } catch (error) {
            console.error('Error creating trip:', error);
        } finally {
            setCreating(false);
        }
    };

    const toggleExpand = (tripId: string) => {
        setExpandedTrips(prev => {
            const next = new Set(prev);
            if (next.has(tripId)) {
                next.delete(tripId);
            } else {
                next.add(tripId);
            }
            return next;
        });
    };

    // Always use Gregorian calendar (en-US) to avoid Hijri on Arabic phones
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusBadge = (status: InvoiceStatus) => {
        const map: Record<string, string> = {
            'delivered': 'badge-success', 'pending': 'badge-warning',
            'not_received': 'badge-error', 'returned': 'badge-info'
        };
        return map[status] || 'badge-neutral';
    };

    const getStatusText = (status: InvoiceStatus) => {
        const map: Record<string, { ar: string; en: string }> = {
            'delivered': { ar: 'تم التسليم', en: 'Delivered' },
            'pending': { ar: 'في الانتظار', en: 'Pending' },
            'not_received': { ar: 'لم يستلم', en: 'Not Received' },
            'returned': { ar: 'مرتجع', en: 'Returned' }
        };
        return map[status]?.[language] || status;
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddInvoice = async (e: React.FormEvent, tripId: string) => {
        e.preventDefault();
        if (!user || !newInvoice.invoice_number.trim() || !isDriver) return;

        setFormLoading(true);
        try {
            // Removed duplicate check - invoice numbers can repeat now

            const invoiceRef = doc(collection(db, 'invoices'));
            const now = serverTimestamp();

            await setDoc(invoiceRef, {
                invoice_number: newInvoice.invoice_number.trim(),
                invoice_type: newInvoice.invoice_type,
                branch: newInvoice.branch,
                status: 'pending',
                trip_id: tripId,
                driver_id: user.id,
                driver_name: user.name,
                note: newInvoice.note || '',
                has_image: false,
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
                new_value: { invoice_number: newInvoice.invoice_number.trim(), status: 'pending', branch: newInvoice.branch },
                timestamp: now
            });

            // Increment invoice_count on trip for faster Dashboard queries
            await updateDoc(doc(db, 'trips', tripId), { invoice_count: increment(1) });

            showToast(language === 'ar' ? 'تمت إضافة الفاتورة' : 'Invoice added', 'success');
            setNewInvoice({ invoice_number: '', invoice_type: 'invoice', branch: 'main', note: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding invoice:', error);
            showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEditInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !editingInvoice || !isDriver) return;

        setFormLoading(true);
        try {
            await updateDoc(doc(db, 'invoices', editingInvoice.invoice_id), {
                invoice_number: editingInvoice.invoice_number.trim(),
                invoice_type: editingInvoice.invoice_type,
                branch: editingInvoice.branch,
                note: editingInvoice.note || '',
                updated_at: serverTimestamp()
            });

            // Build accurate log of what changed
            const oldValues: Record<string, unknown> = {};
            const newValues: Record<string, unknown> = {};

            if (originalInvoice?.invoice_number !== editingInvoice.invoice_number.trim()) {
                oldValues.invoice_number = originalInvoice?.invoice_number;
                newValues.invoice_number = editingInvoice.invoice_number.trim();
            }
            if (originalInvoice?.invoice_type !== editingInvoice.invoice_type) {
                oldValues.invoice_type = originalInvoice?.invoice_type;
                newValues.invoice_type = editingInvoice.invoice_type;
            }
            if (originalInvoice?.branch !== editingInvoice.branch) {
                oldValues.branch = originalInvoice?.branch;
                newValues.branch = editingInvoice.branch;
            }
            if ((originalInvoice?.note || '') !== (editingInvoice.note || '')) {
                oldValues.note = originalInvoice?.note || '';
                newValues.note = editingInvoice.note || '';
            }

            await setDoc(doc(collection(db, 'logs')), {
                action: 'update',
                entity_type: 'invoice',
                entity_id: editingInvoice.invoice_id,
                user_id: user.id,
                user_name: user.name,
                old_value: oldValues,
                new_value: newValues,
                timestamp: serverTimestamp()
            });

            showToast(language === 'ar' ? 'تم تحديث الفاتورة' : 'Invoice updated', 'success');
            setEditingInvoice(null);
            setOriginalInvoice(null);
        } catch (error) {
            console.error('Error updating invoice:', error);
            showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdateStatus = (invoice: Invoice, newStatus: InvoiceStatus) => {
        // ALL status changes require camera capture
        setSelectedInvoice(invoice);
        setPendingStatusUpdate({ invoice, status: newStatus });
        cameraInputRef.current?.click();
    };

    const updateInvoiceStatus = async (invoice: Invoice, newStatus: InvoiceStatus) => {
        if (!user || !isDriver) return;

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
        } catch (error) {
            console.error('Error updating status:', error);
            showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>, tripId: string) => {
        const file = e.target.files?.[0];
        if (!file || !selectedInvoice || !user || !pendingStatusUpdate) return;

        const targetStatus = pendingStatusUpdate.status;

        setFormLoading(true);
        try {
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

            // Log image capture
            await setDoc(doc(collection(db, 'logs')), {
                action: 'create',
                entity_type: 'image',
                entity_id: imageDoc.id,
                user_id: user.id,
                user_name: user.name,
                old_value: null,
                new_value: { invoice_number: selectedInvoice.invoice_number, file_path: imageRef.fullPath },
                timestamp: serverTimestamp()
            });

            const now = new Date();
            const duration = now.getTime() - selectedInvoice.start_time.getTime();

            await updateDoc(doc(db, 'invoices', selectedInvoice.invoice_id), {
                status: targetStatus,
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
                new_value: { status: targetStatus, has_image: true },
                timestamp: serverTimestamp()
            });

            const statusMessages: Record<InvoiceStatus, { ar: string; en: string }> = {
                'delivered': { ar: 'تم التسليم وحفظ الصورة', en: 'Delivered and image saved' },
                'not_received': { ar: 'تم التسجيل كـ لم يستلم', en: 'Marked as not received' },
                'returned': { ar: 'تم التسجيل كـ مرتجع', en: 'Marked as returned' },
                'pending': { ar: 'تم التحديث', en: 'Updated' }
            };
            showToast(statusMessages[targetStatus][language], 'success');
            setSelectedInvoice(null);
            setPendingStatusUpdate(null);
        } catch (error) {
            console.error('Error uploading image:', error);
            showToast(language === 'ar' ? 'حدث خطأ في رفع الصورة' : 'Error uploading image', 'error');
        } finally {
            setFormLoading(false);
            if (cameraInputRef.current) { cameraInputRef.current.value = ''; }
        }
    };

    const handleEndTrip = async (tripId: string, pendingCount: number) => {
        if (!user || !isDriver) return;

        if (pendingCount > 0) {
            showToast(
                language === 'ar'
                    ? `لديك ${pendingCount} فواتير معلقة`
                    : `You have ${pendingCount} pending invoices`,
                'error'
            );
            setShowEndTripConfirm(null);
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

            setShowEndTripConfirm(null);
            showToast(language === 'ar' ? 'تم إنهاء الرحلة' : 'Trip ended', 'success');
        } catch (error) {
            console.error('Error ending trip:', error);
        } finally {
            setFormLoading(false);
        }
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

    const activeTrips = trips.filter(trip => trip.status === 'active');
    const completedTrips = trips.filter(trip => trip.status === 'completed');

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

    return (
        <div className="page">
            <RoleNav />

            {/* Header */}
            <div className="flex justify-between items-center mb-lg" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                <div>
                    <h1 className="page-title">
                        {isDriver
                            ? (language === 'ar' ? `مرحباً، ${user?.name}` : `Welcome, ${user?.name}`)
                            : (language === 'ar' ? 'الرحلات المباشرة' : 'Live Trips')}
                    </h1>
                    <p className="page-subtitle">
                        {isDriver
                            ? (language === 'ar' ? 'إدارة رحلاتك وفواتيرك' : 'Manage your trips and invoices')
                            : (language === 'ar' ? `${activeTrips.length} رحلات نشطة الآن` : `${activeTrips.length} active trips now`)}
                    </p>
                </div>
            </div>

            {/* Create Trip Button (Driver only) */}
            {isDriver && (
                <>
                    <button
                        onClick={() => setShowStartTripConfirm(true)}
                        disabled={creating || activeTrips.length > 0}
                        className="btn btn-primary btn-lg w-full mb-lg"
                        style={{
                            padding: 'var(--spacing-lg)',
                            fontSize: '1.125rem',
                            opacity: activeTrips.length > 0 ? 0.5 : 1
                        }}
                    >
                        {creating ? (
                            <span className="loader" style={{ width: 24, height: 24 }}></span>
                        ) : (
                            <>
                                <PlusIcon />
                                {language === 'ar' ? 'بدء رحلة جديدة' : 'Start New Trip'}
                            </>
                        )}
                    </button>
                    {activeTrips.length > 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem', marginTop: '-12px', marginBottom: 'var(--spacing-md)' }}>
                            {language === 'ar' ? 'لديك رحلة نشطة بالفعل' : 'You already have an active trip'}
                        </p>
                    )}
                </>
            )}

            {/* Active Trips Section */}
            <div className="mb-lg">
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--success-400)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <span style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: activeTrips.length > 0 ? 'var(--success)' : 'var(--slate-500)'
                    }} />
                    {language === 'ar' ? 'الرحلات النشطة' : 'Active Trips'} ({activeTrips.length})
                </h2>

                {activeTrips.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
                            <TruckIcon />
                            <p style={{ color: 'var(--slate-400)' }}>
                                {language === 'ar' ? 'لا توجد رحلات نشطة' : 'No active trips'}
                            </p>
                            {isDriver && (
                                <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
                                    {language === 'ar' ? 'ابدأ رحلة جديدة للخروج من المستودع' : 'Start a new trip to leave the warehouse'}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {activeTrips.map((trip) => {
                            const isExpanded = expandedTrips.has(trip.trip_id);
                            const pendingCount = trip.invoices.filter(i => i.status === 'pending').length;
                            const deliveredCount = trip.invoices.filter(i => i.status === 'delivered').length;

                            return (
                                <div key={trip.trip_id} className="card" style={{ borderColor: 'var(--success-500)', borderWidth: '2px', overflow: 'hidden' }}>
                                    {/* Trip Header */}
                                    <div
                                        onClick={() => isAdmin ? setSelectedTrip(trip) : null}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: isAdmin ? 'pointer' : 'default',
                                            marginBottom: isDriver ? 'var(--spacing-md)' : undefined
                                        }}
                                    >
                                        <div className="flex items-center gap-md">
                                            <div style={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: 'var(--radius-lg)',
                                                background: 'linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexDirection: 'column',
                                                color: 'white'
                                            }}>
                                                <span style={{ fontSize: '0.625rem', fontWeight: 500, opacity: 0.9 }}>
                                                    {language === 'ar' ? 'رحلة' : 'Trip'}
                                                </span>
                                                <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>
                                                    {trip.trip_number}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--slate-100)', fontSize: '1.0625rem' }}>
                                                    {isAdmin ? trip.driver_name : (language === 'ar' ? 'رحلة نشطة' : 'Active Trip')}
                                                </div>
                                                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: '2px' }}>
                                                    {language === 'ar' ? 'بدأ في' : 'Started at'} {formatTime(trip.start_time)}
                                                </div>
                                                <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: '4px', fontSize: '0.75rem' }}>
                                                    <span style={{ color: 'var(--success-400)' }}>✓ {deliveredCount}</span>
                                                    <span style={{ color: 'var(--warning-400)' }}>⏳ {pendingCount}</span>
                                                    <span style={{ color: 'var(--slate-500)' }}>📦 {trip.invoices.length}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--success-400)' }}>
                                            {(() => {
                                                const elapsed = Date.now() - trip.start_time.getTime();
                                                const hours = Math.floor(elapsed / 3600000);
                                                const minutes = Math.floor((elapsed % 3600000) / 60000);
                                                return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                            })()}
                                        </div>
                                    </div>

                                    {/* Driver: Inline Invoice Management */}
                                    {isDriver && (
                                        <>
                                            {/* Hidden Camera Input */}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                ref={cameraInputRef}
                                                onChange={(e) => handleCameraCapture(e, trip.trip_id)}
                                                style={{ display: 'none' }}
                                            />

                                            {/* Add Invoice Button */}
                                            <button
                                                onClick={() => setShowAddModal(true)}
                                                className="btn btn-primary w-full mb-md"
                                                style={{ fontSize: '0.875rem' }}
                                            >
                                                + {language === 'ar' ? 'إضافة فاتورة' : 'Add Invoice'}
                                            </button>

                                            {/* Invoices List */}
                                            {trip.invoices.length === 0 ? (
                                                <p style={{ textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem', padding: 'var(--spacing-md)' }}>
                                                    {language === 'ar' ? 'لا توجد فواتير - أضف فاتورة للبدء' : 'No invoices - add an invoice to start'}
                                                </p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                                                    {trip.invoices.map((invoice) => (
                                                        <div key={invoice.invoice_id} style={{
                                                            padding: 'var(--spacing-sm)',
                                                            paddingTop: 'var(--spacing-md)',
                                                            background: 'var(--slate-800)',
                                                            borderRadius: 'var(--radius-md)',
                                                            position: 'relative'
                                                        }}>
                                                            {/* Type Badge - Top Left (RTL-aware, like invoices page) */}
                                                            <span style={{
                                                                position: 'absolute',
                                                                top: 'var(--spacing-xs)',
                                                                insetInlineStart: 'var(--spacing-xs)',
                                                                fontSize: '0.6rem',
                                                                padding: '2px 6px',
                                                                borderRadius: 'var(--radius-sm)',
                                                                background: 'var(--slate-700)',
                                                                color: 'var(--slate-400)'
                                                            }}>
                                                                {getTypeText(invoice.invoice_type)}
                                                            </span>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: invoice.status === 'pending' ? 'var(--spacing-xs)' : 0, marginTop: 'var(--spacing-xs)' }}>
                                                                <span style={{ fontWeight: 600, color: 'var(--slate-200)', fontSize: '1rem' }}>{invoice.invoice_number}</span>
                                                                <span className={`badge ${getStatusBadge(invoice.status)}`} style={{ fontSize: '0.7rem' }}>{getStatusText(invoice.status)}</span>
                                                            </div>
                                                            {invoice.note && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginBottom: 'var(--spacing-xs)' }}>📝 {invoice.note}</div>
                                                            )}
                                                            {/* Action buttons for pending invoices */}
                                                            {invoice.status === 'pending' && (
                                                                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                                                                    <button onClick={() => { setEditingInvoice(invoice); setOriginalInvoice(invoice); }} disabled={formLoading} style={{ padding: '6px 8px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--slate-600)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                                                        ✏️
                                                                    </button>
                                                                    <button onClick={() => handleUpdateStatus(invoice, 'delivered')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--success-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                                                        {language === 'ar' ? 'تم' : 'Done'}
                                                                    </button>
                                                                    <button onClick={() => handleUpdateStatus(invoice, 'not_received')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--error-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                                                        {language === 'ar' ? 'لم يستلم' : 'No'}
                                                                    </button>
                                                                    <button onClick={() => handleUpdateStatus(invoice, 'returned')} disabled={formLoading} style={{ flex: 1, padding: '6px', fontSize: '0.7rem', fontWeight: 600, background: 'var(--info-500)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                                                        {language === 'ar' ? 'إرجاع' : 'Ret'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {invoice.has_image && invoice.status === 'delivered' && (
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--primary-400)', marginTop: '4px' }}>📷 {language === 'ar' ? 'تم حفظ الصورة' : 'Image saved'}</div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* End Trip Button */}
                                            <button
                                                onClick={() => setShowEndTripConfirm({ tripId: trip.trip_id, pendingCount })}
                                                disabled={formLoading || pendingCount > 0}
                                                className="btn btn-secondary w-full"
                                                style={{ opacity: pendingCount > 0 ? 0.5 : 1 }}
                                            >
                                                {language === 'ar' ? 'إنهاء الرحلة' : 'End Trip'}
                                            </button>
                                            {pendingCount > 0 && (
                                                <p style={{ textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.75rem', marginTop: '4px' }}>
                                                    {language === 'ar' ? `لديك ${pendingCount} فواتير معلقة` : `You have ${pendingCount} pending invoices`}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Completed Trips */}
            <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--slate-400)' }}>
                    {language === 'ar' ? 'الرحلات المكتملة' : 'Completed Trips'} ({completedTrips.length})
                </h2>

                {completedTrips.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: 'var(--spacing-lg)' }}>
                            <p style={{ color: 'var(--slate-500)' }}>
                                {language === 'ar' ? 'لا توجد رحلات مكتملة' : 'No completed trips'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {completedTrips.slice(0, 20).map((trip) => (
                            isAdmin ? (
                                <div
                                    key={trip.trip_id}
                                    onClick={() => setSelectedTrip(trip)}
                                    className="card"
                                    style={{
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        opacity: 0.8,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div className="flex items-center gap-md">
                                        <div style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 'var(--radius-lg)',
                                            background: 'var(--slate-700)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            color: 'var(--slate-400)'
                                        }}>
                                            <span style={{ fontSize: '0.5rem', fontWeight: 500 }}>
                                                {language === 'ar' ? 'رحلة' : 'Trip'}
                                            </span>
                                            <span style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>
                                                {trip.trip_number}
                                            </span>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'var(--slate-300)' }}>
                                                {trip.driver_name}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                                                {formatDate(trip.start_time)} • {formatTime(trip.start_time)} - {trip.end_time ? formatTime(trip.end_time) : '...'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                                                {trip.invoices.length} {language === 'ar' ? 'فاتورة' : 'invoices'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    key={trip.trip_id}
                                    onClick={() => setSelectedTrip(trip)}
                                    className="card"
                                    style={{
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        opacity: 0.8,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div className="flex items-center gap-md">
                                        <div style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 'var(--radius-lg)',
                                            background: 'var(--slate-700)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexDirection: 'column',
                                            color: 'var(--slate-400)'
                                        }}>
                                            <span style={{ fontSize: '0.5rem', fontWeight: 500 }}>
                                                {language === 'ar' ? 'رحلة' : 'Trip'}
                                            </span>
                                            <span style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>
                                                {trip.trip_number}
                                            </span>
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'var(--slate-300)' }}>
                                                {formatDate(trip.start_time)}
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>
                                                {formatTime(trip.start_time)} - {trip.end_time ? formatTime(trip.end_time) : '...'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                                                {trip.invoices.length} {language === 'ar' ? 'فاتورة' : 'invoices'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                )}
            </div>

            {/* Toast Notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: toast.type === 'success' ? 'var(--success-500)' : 'var(--error-500)',
                    color: 'white',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    zIndex: 1001,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    {toast.message}
                </div>
            )}

            {/* Add Invoice Modal (Driver only) */}
            {showAddModal && activeTrips.length > 0 && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'إضافة فاتورة' : 'Add Invoice'}</h3>
                            <button onClick={() => setShowAddModal(false)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <form onSubmit={(e) => handleAddInvoice(e, activeTrips[0].trip_id)}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'} *
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={newInvoice.invoice_number}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                            setNewInvoice({ ...newInvoice, invoice_number: value });
                                        }}
                                        className="form-input"
                                        required
                                        placeholder={language === 'ar' ? 'أدخل رقم الفاتورة' : 'Enter invoice number'}
                                        dir="ltr"
                                        style={{ textAlign: 'left' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'الفرع' : 'Branch'} *
                                    </label>
                                    <select
                                        value={newInvoice.branch}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, branch: e.target.value as Branch })}
                                        className="form-select"
                                    >
                                        {branchOptions.map((branch) => (
                                            <option key={branch.value} value={branch.value}>{t(branch.labelKey, language)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'النوع' : 'Type'}
                                    </label>
                                    <select
                                        value={newInvoice.invoice_type}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, invoice_type: e.target.value as InvoiceType })}
                                        className="form-select"
                                    >
                                        {invoiceTypes.map((type) => (
                                            <option key={type.value} value={type.value}>{t(type.labelKey, language)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                                    </label>
                                    <input
                                        type="text"
                                        value={newInvoice.note}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, note: e.target.value })}
                                        className="form-input"
                                        placeholder={language === 'ar' ? 'أضف ملاحظة' : 'Add a note'}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading || !newInvoice.invoice_number.trim()}>
                                    {formLoading ? '...' : (language === 'ar' ? 'إضافة' : 'Add')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Invoice Modal (Driver only) */}
            {editingInvoice && (
                <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'}</h3>
                            <button onClick={() => setEditingInvoice(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleEditInvoice}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'} *
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={editingInvoice.invoice_number}
                                        onChange={(e) => {
                                            const value = e.target.value.replace(/[^0-9]/g, '');
                                            setEditingInvoice({ ...editingInvoice, invoice_number: value });
                                        }}
                                        className="form-input"
                                        required
                                        dir="ltr"
                                        style={{ textAlign: 'left' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'الفرع' : 'Branch'} *
                                    </label>
                                    <select
                                        value={editingInvoice.branch}
                                        onChange={(e) => setEditingInvoice({ ...editingInvoice, branch: e.target.value as Branch })}
                                        className="form-select"
                                    >
                                        {branchOptions.map((branch) => (
                                            <option key={branch.value} value={branch.value}>{t(branch.labelKey, language)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'النوع' : 'Type'}
                                    </label>
                                    <select
                                        value={editingInvoice.invoice_type}
                                        onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_type: e.target.value as InvoiceType })}
                                        className="form-select"
                                    >
                                        {invoiceTypes.map((type) => (
                                            <option key={type.value} value={type.value}>{t(type.labelKey, language)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {language === 'ar' ? 'ملاحظة' : 'Note'}
                                    </label>
                                    <input
                                        type="text"
                                        value={editingInvoice.note || ''}
                                        onChange={(e) => setEditingInvoice({ ...editingInvoice, note: e.target.value })}
                                        className="form-input"
                                        placeholder={language === 'ar' ? 'أضف ملاحظة' : 'Add a note'}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setEditingInvoice(null)} className="btn btn-secondary">
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading || !editingInvoice.invoice_number.trim()}>
                                    {formLoading ? '...' : (language === 'ar' ? 'حفظ' : 'Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Trip Detail Modal */}
            {selectedTrip && (() => {
                const tripDuration = selectedTrip.end_time
                    ? selectedTrip.end_time.getTime() - selectedTrip.start_time.getTime()
                    : Date.now() - selectedTrip.start_time.getTime();
                const hours = Math.floor(tripDuration / 3600000);
                const minutes = Math.floor((tripDuration % 3600000) / 60000);
                const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                const deliveredCount = selectedTrip.invoices.filter(i => i.status === 'delivered').length;
                const pendingCount = selectedTrip.invoices.filter(i => i.status === 'pending').length;

                return (
                    <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
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
                                            background: selectedTrip.status === 'active' ? 'var(--success-500)' : 'var(--slate-600)',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            fontWeight: 700
                                        }}>
                                            {selectedTrip.trip_number}
                                        </span>
                                        {selectedTrip.driver_name}
                                    </h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: '4px' }}>
                                        {selectedTrip.status === 'active'
                                            ? (language === 'ar' ? 'رحلة نشطة' : 'Active Trip')
                                            : formatDate(selectedTrip.start_time)}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedTrip(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                            </div>
                            <div className="modal-body" style={{ padding: 'var(--spacing-md)' }}>
                                {/* Trip Time Details */}
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
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'بداية الرحلة' : 'Start Time'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-200)' }}>
                                            {formatTime(selectedTrip.start_time)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'نهاية الرحلة' : 'End Time'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-200)' }}>
                                            {selectedTrip.end_time ? formatTime(selectedTrip.end_time) : '—'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'المدة' : 'Duration'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success-400)' }}>
                                            {durationText}
                                        </div>
                                    </div>
                                </div>

                                {/* Invoice Stats */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-around',
                                    marginBottom: 'var(--spacing-lg)',
                                    padding: 'var(--spacing-md)',
                                    background: 'var(--slate-800)',
                                    borderRadius: 'var(--radius-md)'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{deliveredCount}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{language === 'ar' ? 'تم التسليم' : 'Delivered'}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{pendingCount}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{language === 'ar' ? 'في الانتظار' : 'Pending'}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-300)' }}>{selectedTrip.invoices.length}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>{language === 'ar' ? 'إجمالي' : 'Total'}</div>
                                    </div>
                                </div>

                                {/* Invoices List */}
                                <div>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-300)', marginBottom: 'var(--spacing-sm)' }}>
                                        {language === 'ar' ? 'الفواتير' : 'Invoices'}
                                    </h4>
                                    {selectedTrip.invoices.length === 0 ? (
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', textAlign: 'center' }}>
                                            {language === 'ar' ? 'لا توجد فواتير' : 'No invoices'}
                                        </p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', maxHeight: '200px', overflowY: 'auto' }}>
                                            {selectedTrip.invoices.map((invoice) => (
                                                <div key={invoice.invoice_id} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                    background: 'var(--slate-800)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.8125rem'
                                                }}>
                                                    <span style={{ fontWeight: 500, color: 'var(--slate-200)' }}>
                                                        {invoice.invoice_number}
                                                        {invoice.has_image && <span style={{ marginInlineStart: '4px' }}>📷</span>}
                                                    </span>
                                                    <span className={`badge ${getStatusBadge(invoice.status)}`} style={{ fontSize: '0.6875rem' }}>
                                                        {getStatusText(invoice.status)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Start Trip Confirmation Modal */}
            {showStartTripConfirm && (
                <div className="modal-overlay" onClick={() => setShowStartTripConfirm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {language === 'ar' ? 'تأكيد بدء الرحلة' : 'Confirm Start Trip'}
                            </h3>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--slate-300)', textAlign: 'center' }}>
                                {language === 'ar'
                                    ? 'هل أنت متأكد من بدء رحلة جديدة؟'
                                    : 'Are you sure you want to start a new trip?'}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowStartTripConfirm(false)} className="btn btn-secondary">
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={createNewTrip}
                                disabled={creating}
                                className="btn btn-primary"
                            >
                                {creating ? '...' : (language === 'ar' ? 'نعم، ابدأ' : 'Yes, Start')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* End Trip Confirmation Modal */}
            {showEndTripConfirm && (
                <div className="modal-overlay" onClick={() => setShowEndTripConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {language === 'ar' ? 'تأكيد إنهاء الرحلة' : 'Confirm End Trip'}
                            </h3>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--slate-300)', textAlign: 'center' }}>
                                {language === 'ar'
                                    ? 'هل أنت متأكد من إنهاء هذه الرحلة؟'
                                    : 'Are you sure you want to end this trip?'}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEndTripConfirm(null)} className="btn btn-secondary">
                                {language === 'ar' ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => handleEndTrip(showEndTripConfirm.tripId, showEndTripConfirm.pendingCount)}
                                disabled={formLoading}
                                className="btn btn-primary"
                            >
                                {formLoading ? '...' : (language === 'ar' ? 'نعم، أنهِ' : 'Yes, End')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TripsPage() {
    return (
        <RoleGuard allowedRoles={['admin', 'driver']}>
            <TripsContent />
        </RoleGuard>
    );
}
