'use client';

import { useState, useEffect } from 'react';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    deleteDoc,
    updateDoc,
    doc,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t, invoiceTypes, statusOptions, branchOptions } from '@/lib/i18n';
import { User, Trip, Invoice, InvoiceStatus, InvoiceType, Branch } from '@/lib/types';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';
import Link from 'next/link';

// Icons
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

const DriverIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 24, height: 24 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);

const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
);

const DeleteIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
);

type ViewMode = 'invoices' | 'trips' | 'drivers';

interface DriverWithStats extends User {
    tripCount: number;
    invoiceCount: number;
}

interface TripWithStats extends Trip {
    invoiceCount: number;
    trip_number: number;
    invoices: Invoice[];
}

function InvoicesContent() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const isAdmin = user?.role === 'admin';

    const [viewMode, setViewMode] = useState<ViewMode>('invoices');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [trips, setTrips] = useState<TripWithStats[]>([]);
    const [drivers, setDrivers] = useState<DriverWithStats[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDriver, setFilterDriver] = useState('');
    const [filterBranch, setFilterBranch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [tripsPage, setTripsPage] = useState(1);
    const itemsPerPage = 10;

    // Sorting
    const [sortBy, setSortBy] = useState<'date' | 'status' | 'driver' | 'type'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Edit/Delete
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [allDrivers, setAllDrivers] = useState<User[]>([]);
    const [formLoading, setFormLoading] = useState(false);

    // Image Preview
    const [imagePreview, setImagePreview] = useState<{ url: string; invoiceNumber: string } | null>(null);
    const [loadingImageId, setLoadingImageId] = useState<string | null>(null);

    // Trip Detail Modal
    const [selectedTrip, setSelectedTrip] = useState<TripWithStats | null>(null);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch all invoices in one query (optimized)
            const invoicesQuery = query(collection(db, 'invoices'), orderBy('created_at', 'desc'));
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

            // Group invoices by trip_id for efficient lookup
            const invoicesByTrip = new Map<string, Invoice[]>();
            invoicesData.forEach(inv => {
                if (inv.trip_id) {
                    const existing = invoicesByTrip.get(inv.trip_id) || [];
                    existing.push(inv);
                    invoicesByTrip.set(inv.trip_id, existing);
                }
            });

            // Fetch trips in one query (optimized - no more N+1)
            const tripsQueryAsc = query(collection(db, 'trips'), orderBy('created_at', 'asc'));
            const tripsSnap = await getDocs(tripsQueryAsc);
            let tripCounter = 0;
            const tripsData: TripWithStats[] = tripsSnap.docs.map(tripDoc => {
                tripCounter++;
                const tripData = tripDoc.data();
                const tripInvoices = invoicesByTrip.get(tripDoc.id) || [];
                return {
                    trip_id: tripDoc.id,
                    driver_id: tripData.driver_id,
                    driver_name: tripData.driver_name,
                    status: tripData.status,
                    start_time: tripData.start_time?.toDate() || new Date(),
                    end_time: tripData.end_time?.toDate() || null,
                    created_at: tripData.created_at?.toDate() || new Date(),
                    invoiceCount: tripInvoices.length,
                    trip_number: tripCounter,
                    invoices: tripInvoices
                };
            });
            // Reverse for display (newest first)
            tripsData.reverse();
            setTrips(tripsData);

            // Compute driver stats from already-fetched data (eliminates N+1 queries)
            const driverTripCounts = new Map<string, number>();
            const driverInvoiceCounts = new Map<string, number>();

            tripsData.forEach(trip => {
                driverTripCounts.set(trip.driver_id, (driverTripCounts.get(trip.driver_id) || 0) + 1);
            });

            invoicesData.forEach(inv => {
                driverInvoiceCounts.set(inv.driver_id, (driverInvoiceCounts.get(inv.driver_id) || 0) + 1);
            });

            const driversQuery = query(collection(db, 'users'), where('role', '==', 'driver'));
            const driversSnap = await getDocs(driversQuery);
            const driversData = driversSnap.docs.map(driverDoc => {
                const driverData = driverDoc.data();
                return {
                    id: driverDoc.id,
                    name: driverData.name,
                    phone: driverData.phone,
                    email: driverData.email || '',
                    role: driverData.role,
                    status: driverData.status,
                    created_at: driverData.created_at?.toDate() || new Date(),
                    updated_at: driverData.updated_at?.toDate() || new Date(),
                    tripCount: driverTripCounts.get(driverDoc.id) || 0,
                    invoiceCount: driverInvoiceCounts.get(driverDoc.id) || 0
                } as DriverWithStats;
            });
            setDrivers(driversData);
            setAllDrivers(driversData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewImage = async (invoiceId: string, invoiceNumber: string) => {
        setLoadingImageId(invoiceId);
        try {
            // Query images collection for this invoice
            const imagesQuery = query(
                collection(db, 'images'),
                where('invoice_id', '==', invoiceId),
                orderBy('captured_at', 'desc')
            );
            const imagesSnap = await getDocs(imagesQuery);

            if (imagesSnap.empty) {
                alert(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found');
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
                alert(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found');
            }
        } catch (error) {
            console.error('Error loading image:', error);
            alert(language === 'ar' ? 'لم يتم العثور على الصورة' : 'Image not found');
        } finally {
            setLoadingImageId(null);
        }
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setFilterType('');
        setFilterStatus('');
        setFilterDriver('');
        setFilterBranch('');
        setDateFrom('');
        setDateTo('');
        setSortBy('date');
        setSortOrder('desc');
        setCurrentPage(1);
    };

    const hasActiveFilters = searchQuery || filterType || filterStatus || filterDriver || filterBranch || dateFrom || dateTo;

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = searchQuery === '' ||
            inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inv.note && inv.note.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = filterType === '' || inv.invoice_type === filterType;
        const matchesStatus = filterStatus === '' || inv.status === filterStatus;
        const matchesDriver = filterDriver === '' || inv.driver_id === filterDriver;
        const matchesBranch = filterBranch === '' || inv.branch === filterBranch;
        const matchesDateFrom = !dateFrom || inv.created_at >= new Date(dateFrom);
        const matchesDateTo = !dateTo || inv.created_at <= new Date(dateTo + 'T23:59:59');
        return matchesSearch && matchesType && matchesStatus && matchesDriver && matchesBranch && matchesDateFrom && matchesDateTo;
    });

    // Sort filtered invoices
    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'date':
                comparison = a.created_at.getTime() - b.created_at.getTime();
                break;
            case 'status':
                comparison = a.status.localeCompare(b.status);
                break;
            case 'driver':
                comparison = a.driver_name.localeCompare(b.driver_name);
                break;
            case 'type':
                comparison = a.invoice_type.localeCompare(b.invoice_type);
                break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    const totalPages = Math.ceil(sortedInvoices.length / itemsPerPage);
    const paginatedInvoices = sortedInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Trips pagination
    const totalTripsPages = Math.ceil(trips.length / itemsPerPage);
    const paginatedTrips = trips.slice((tripsPage - 1) * itemsPerPage, tripsPage * itemsPerPage);

    const handleEditSave = async () => {
        if (!editingInvoice || !user || !isAdmin) return;

        // Validation
        if (!editingInvoice.invoice_number.trim()) {
            alert(language === 'ar' ? 'رقم الفاتورة مطلوب' : 'Invoice number is required');
            return;
        }

        setFormLoading(true);
        try {
            await updateDoc(doc(db, 'invoices', editingInvoice.invoice_id), {
                invoice_number: editingInvoice.invoice_number,
                invoice_type: editingInvoice.invoice_type,
                status: editingInvoice.status,
                note: editingInvoice.note,
                updated_at: serverTimestamp()
            });
            await setDoc(doc(collection(db, 'logs')), {
                action: 'update',
                entity_type: 'invoice',
                entity_id: editingInvoice.invoice_id,
                user_id: user.id,
                user_name: user.name,
                old_value: null,
                new_value: { status: editingInvoice.status },
                timestamp: serverTimestamp()
            });
            setEditingInvoice(null);
            fetchAllData();
        } catch (error) {
            console.error('Error updating:', error);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (invoiceId: string) => {
        if (!user || !isAdmin) return;
        try {
            await deleteDoc(doc(db, 'invoices', invoiceId));
            await setDoc(doc(collection(db, 'logs')), {
                action: 'delete',
                entity_type: 'invoice',
                entity_id: invoiceId,
                user_id: user.id,
                user_name: user.name,
                old_value: { invoice_id: invoiceId },
                new_value: null,
                timestamp: serverTimestamp()
            });
            setDeleteConfirm(null);
            fetchAllData();
        } catch (error) {
            console.error('Error deleting:', error);
        }
    };

    const getStatusBadge = (status: InvoiceStatus) => {
        const map: Record<string, string> = { 'delivered': 'badge-success', 'pending': 'badge-warning', 'not_received': 'badge-error', 'returned': 'badge-info' };
        return map[status] || 'badge-neutral';
    };

    const getStatusText = (status: InvoiceStatus) => {
        const map: Record<string, { ar: string; en: string }> = {
            'delivered': { ar: 'تم التسليم', en: 'Delivered' },
            'pending': { ar: 'في الانتظار', en: 'Pending' },
            'not_received': { ar: 'لم يستلم', en: 'Not Received' },
            'returned': { ar: 'إرجاع', en: 'Returned' }
        };
        return map[status]?.[language] || status;
    };

    const getTypeText = (type: InvoiceType) => {
        const map: Record<string, { ar: string; en: string }> = {
            'invoice': { ar: 'فاتورة', en: 'Invoice' },
            'delivery_permit': { ar: 'إذن تسليم', en: 'Delivery Permit' },
            'quotation': { ar: 'عرض سعر', en: 'Quotation' },
            'transfer': { ar: 'مناقلة', en: 'Transfer' },
            'clearance': { ar: 'فسح', en: 'Clearance' }
        };
        return map[type]?.[language] || type;
    };

    const formatDuration = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        const hrs = Math.floor(mins / 60);
        return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    };

    const getBranchText = (branch: Branch | string | undefined) => {
        const map: Record<string, { ar: string; en: string }> = {
            'main': { ar: 'الرئيسي', en: 'Main' },
            'bab_sharif': { ar: 'باب شريف', en: 'Bab Sharif' },
            'souq_7': { ar: 'سوق ٧', en: 'Souq 7' },
            'representative': { ar: 'مندوب', en: 'Representative' },
            'hindawiya': { ar: 'الهنداوية', en: 'Al-Hindawiya' }
        };
        return map[branch || 'main']?.[language] || branch || 'Main';
    };

    const getBranchBadgeColor = (branch: Branch | string | undefined) => {
        const map: Record<string, string> = {
            'main': 'badge-success',
            'bab_sharif': 'badge-info',
            'souq_7': 'badge-warning',
            'representative': 'badge-error',
            'hindawiya': 'badge-neutral'
        };
        return map[branch || 'main'] || 'badge-neutral';
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

    return (
        <div className="page">
            <RoleNav />

            <h1 className="page-title mb-md">{language === 'ar' ? 'الفواتير' : 'Invoices'}</h1>

            {/* View Mode Buttons */}
            <div className="flex gap-sm mb-lg" style={{ overflowX: 'auto' }}>
                <button
                    onClick={() => { setViewMode('invoices'); setCurrentPage(1); }}
                    className={`btn ${viewMode === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                >
                    <InvoiceIcon />
                    {language === 'ar' ? 'الفواتير' : 'Invoices'} ({invoices.length})
                </button>
                <button
                    onClick={() => setViewMode('trips')}
                    className={`btn ${viewMode === 'trips' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                >
                    <TripIcon />
                    {language === 'ar' ? 'الرحلات' : 'Trips'} ({trips.length})
                </button>
                <button
                    onClick={() => setViewMode('drivers')}
                    className={`btn ${viewMode === 'drivers' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                >
                    <DriverIcon />
                    {language === 'ar' ? 'السائقين' : 'Drivers'} ({drivers.length})
                </button>
            </div>

            {/* INVOICES VIEW */}
            {viewMode === 'invoices' && (
                <>
                    <div className="card mb-md" style={{ padding: 'var(--spacing-md)' }}>
                        {/* Search + Sort Row */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder={language === 'ar' ? 'بحث برقم الفاتورة، السائق...' : 'Search invoice #, driver...'}
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                style={{ flex: 1, minWidth: 150 }}
                            />
                            <select
                                className="form-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'date' | 'status' | 'driver' | 'type')}
                                style={{ width: 'auto', minWidth: 90 }}
                            >
                                <option value="date">{language === 'ar' ? 'التاريخ' : 'Date'}</option>
                                <option value="status">{language === 'ar' ? 'الحالة' : 'Status'}</option>
                                <option value="driver">{language === 'ar' ? 'السائق' : 'Driver'}</option>
                                <option value="type">{language === 'ar' ? 'النوع' : 'Type'}</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="btn btn-ghost btn-icon"
                                style={{ padding: '6px 10px', fontSize: '1rem' }}
                                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                        {/* Filters Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--spacing-sm)' }}>
                            <select className="form-select" value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}>
                                <option value="">{language === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
                                {invoiceTypes.map(type => <option key={type.value} value={type.value}>{t(type.labelKey, language)}</option>)}
                            </select>
                            <select className="form-select" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}>
                                <option value="">{language === 'ar' ? 'كل الحالات' : 'All Status'}</option>
                                {statusOptions.map(s => <option key={s.value} value={s.value}>{t(s.labelKey, language)}</option>)}
                            </select>
                            <select className="form-select" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setCurrentPage(1); }}>
                                <option value="">{language === 'ar' ? 'كل الفروع' : 'All Branches'}</option>
                                {branchOptions.map(b => <option key={b.value} value={b.value}>{t(b.labelKey, language)}</option>)}
                            </select>
                            <select className="form-select" value={filterDriver} onChange={(e) => { setFilterDriver(e.target.value); setCurrentPage(1); }}>
                                <option value="">{language === 'ar' ? 'كل السائقين' : 'All Drivers'}</option>
                                {allDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <input type="date" className="form-input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} style={{ minWidth: '120px', maxWidth: '150px' }} />
                            <input type="date" className="form-input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} style={{ minWidth: '120px', maxWidth: '150px' }} />
                        </div>
                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <div style={{ marginTop: 'var(--spacing-sm)', textAlign: language === 'ar' ? 'left' : 'right' }}>
                                <button
                                    onClick={clearAllFilters}
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.8125rem', color: 'var(--error-400)' }}
                                >
                                    ✕ {language === 'ar' ? 'مسح الفلاتر' : 'Clear Filters'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-400)', marginBottom: 'var(--spacing-sm)' }}>
                        {language === 'ar' ? `${sortedInvoices.length} نتيجة` : `${sortedInvoices.length} results`}
                    </div>

                    {paginatedInvoices.length === 0 ? (
                        <div className="card"><div className="empty-state"><p>{language === 'ar' ? 'لا توجد فواتير' : 'No invoices'}</p></div></div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            {paginatedInvoices.map(inv => {
                                const invoiceTrip = trips.find(t => t.trip_id === inv.trip_id);
                                const tripNumber = invoiceTrip?.trip_number;

                                return (
                                    <div key={inv.invoice_id} className="card" style={{ padding: 'var(--spacing-md)', position: 'relative' }}>
                                        {/* Type & Branch Badges - Top Corner (RTL-aware) */}
                                        <div style={{
                                            position: 'absolute',
                                            top: 'var(--spacing-sm)',
                                            insetInlineStart: 'var(--spacing-sm)',
                                            display: 'flex',
                                            gap: '4px'
                                        }}>
                                            <span style={{
                                                fontSize: '0.6875rem',
                                                color: 'var(--slate-400)',
                                                padding: '2px 8px',
                                                background: 'var(--slate-700)',
                                                borderRadius: 'var(--radius-sm)'
                                            }}>
                                                {getTypeText(inv.invoice_type)}
                                            </span>
                                            <span className={`badge ${getBranchBadgeColor(inv.branch)}`} style={{ fontSize: '0.6875rem', padding: '2px 8px' }}>
                                                {getBranchText(inv.branch)}
                                            </span>
                                        </div>

                                        {/* Row 1: Invoice Number + Status + Actions */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-xs)', marginTop: '24px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--slate-100)' }}>
                                                {inv.invoice_number}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                                                <span className={`badge ${getStatusBadge(inv.status)}`}>
                                                    {getStatusText(inv.status)}
                                                </span>
                                                {isAdmin && (
                                                    <>
                                                        <button onClick={() => setEditingInvoice({ ...inv })} className="btn btn-ghost btn-icon" style={{ padding: '4px' }}><EditIcon /></button>
                                                        <button onClick={() => setDeleteConfirm(inv.invoice_id)} className="btn btn-ghost btn-icon" style={{ padding: '4px', color: 'var(--error-400)' }}><DeleteIcon /></button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 2: Driver & Trip */}
                                        <div style={{ fontSize: '0.875rem', color: 'var(--slate-300)', marginBottom: 'var(--spacing-xs)' }}>
                                            {language === 'ar' ? 'السائق:' : 'Driver:'} <strong>{inv.driver_name}</strong>
                                            {tripNumber && (
                                                <>
                                                    <span style={{ margin: '0 8px', color: 'var(--slate-600)' }}>|</span>
                                                    <Link href={`/trips/${inv.trip_id}`} style={{ color: 'var(--primary-400)', textDecoration: 'none' }}>
                                                        {language === 'ar' ? `رحلة #${tripNumber}` : `Trip #${tripNumber}`}
                                                    </Link>
                                                </>
                                            )}
                                        </div>

                                        {/* Row 3: Timestamps - Added & Updated */}
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: 'var(--spacing-xs)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            <span>
                                                {language === 'ar' ? 'أضيف:' : 'Added:'} {inv.created_at.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} {inv.created_at.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            {inv.updated_at && inv.updated_at.getTime() !== inv.created_at.getTime() && (
                                                <span>
                                                    {language === 'ar' ? 'تحديث:' : 'Updated:'} {inv.updated_at.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} {inv.updated_at.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>

                                        {/* Row 4: View Image */}
                                        {inv.has_image && (
                                            <div style={{ fontSize: '0.8125rem', marginBottom: inv.note ? 'var(--spacing-xs)' : 0 }}>
                                                <button
                                                    onClick={() => handleViewImage(inv.invoice_id, inv.invoice_number)}
                                                    disabled={loadingImageId === inv.invoice_id}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--primary-400)',
                                                        cursor: loadingImageId === inv.invoice_id ? 'wait' : 'pointer',
                                                        padding: 0,
                                                        fontSize: '0.8125rem',
                                                        textDecoration: 'underline',
                                                        opacity: loadingImageId === inv.invoice_id ? 0.6 : 1
                                                    }}
                                                >
                                                    {loadingImageId === inv.invoice_id ? '⏳' : '📷'} {language === 'ar' ? 'عرض الصورة' : 'View Image'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Row 5: Note */}
                                        {inv.note && (
                                            <div style={{
                                                fontSize: '0.8125rem',
                                                color: 'var(--slate-400)',
                                                fontStyle: 'italic',
                                                paddingTop: 'var(--spacing-xs)',
                                                borderTop: '1px dashed var(--slate-700)'
                                            }}>
                                                📝 {inv.note}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-xs mt-lg" style={{ flexWrap: 'wrap' }}>
                            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`btn ${page === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minWidth: 40, padding: '8px' }}
                                >
                                    {page}
                                </button>
                            ))}
                            {totalPages > 10 && <span style={{ padding: '8px', color: 'var(--slate-500)' }}>...</span>}
                        </div>
                    )}
                </>
            )}

            {/* TRIPS VIEW */}
            {viewMode === 'trips' && (
                <>
                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-400)', marginBottom: 'var(--spacing-sm)' }}>
                        {language === 'ar' ? `${trips.length} رحلة` : `${trips.length} trips`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {trips.length === 0 ? (
                            <div className="card"><div className="empty-state"><p>{language === 'ar' ? 'لا توجد رحلات' : 'No trips'}</p></div></div>
                        ) : (
                            paginatedTrips.map(trip => {
                                const tripDuration = trip.end_time
                                    ? trip.end_time.getTime() - trip.start_time.getTime()
                                    : Date.now() - trip.start_time.getTime();
                                const hours = Math.floor(tripDuration / 3600000);
                                const minutes = Math.floor((tripDuration % 3600000) / 60000);
                                const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

                                return (
                                    <div
                                        key={trip.trip_id}
                                        className="card"
                                        onClick={() => setSelectedTrip(trip)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="flex items-center gap-md">
                                                {/* Trip Number Badge */}
                                                <div style={{
                                                    width: 52,
                                                    height: 52,
                                                    borderRadius: 'var(--radius-lg)',
                                                    background: trip.status === 'active'
                                                        ? 'linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%)'
                                                        : 'var(--slate-700)',
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
                                                {/* Trip Info */}
                                                <div>
                                                    <div style={{ fontWeight: 600, color: 'var(--slate-100)', fontSize: '1rem' }}>
                                                        {trip.driver_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: '2px' }}>
                                                        {trip.end_time
                                                            ? trip.end_time.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }) + ' • ' + trip.end_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                                            : (language === 'ar' ? 'نشط الآن' : 'Active now')}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: '4px', fontSize: '0.75rem' }}>
                                                        <span style={{ color: 'var(--primary-400)' }}>⏱ {durationText}</span>
                                                        <span style={{ color: 'var(--slate-500)' }}>📦 {trip.invoiceCount} {language === 'ar' ? 'فاتورة' : 'invoices'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronDownIcon />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {totalTripsPages > 1 && (
                        <div className="flex justify-center gap-xs mt-lg" style={{ flexWrap: 'wrap' }}>
                            {Array.from({ length: Math.min(totalTripsPages, 10) }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setTripsPage(page)}
                                    className={`btn ${page === tripsPage ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ minWidth: 40, padding: '8px' }}
                                >
                                    {page}
                                </button>
                            ))}
                            {totalTripsPages > 10 && <span style={{ padding: '8px', color: 'var(--slate-500)' }}>...</span>}
                        </div>
                    )}
                </>
            )}

            {/* DRIVERS VIEW */}
            {viewMode === 'drivers' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    {drivers.length === 0 ? (
                        <div className="card"><div className="empty-state"><p>{language === 'ar' ? 'لا يوجد سائقين' : 'No drivers'}</p></div></div>
                    ) : (
                        drivers.map(driver => (
                            <div key={driver.id} className="card" style={{ padding: 'var(--spacing-md)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-600) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <DriverIcon />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--slate-100)' }}>{driver.name}</div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--slate-400)' }}>{driver.phone}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-400)' }}>{driver.tripCount}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--slate-500)' }}>{language === 'ar' ? 'رحلات' : 'Trips'}</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-400)' }}>{driver.invoiceCount}</div>
                                        <div style={{ fontSize: '0.6875rem', color: 'var(--slate-500)' }}>{language === 'ar' ? 'فواتير' : 'Invoices'}</div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Image Preview Modal */}
            {imagePreview && (
                <div className="modal-overlay" onClick={() => setImagePreview(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'صورة الفاتورة' : 'Invoice Image'}: {imagePreview.invoiceNumber}</h3>
                            <button onClick={() => setImagePreview(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <div className="modal-body" style={{ padding: 0 }}>
                            <img src={imagePreview.url} alt="Invoice proof" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Trip Detail Modal */}
            {selectedTrip && (() => {
                const trip = selectedTrip;
                const tripDuration = trip.end_time
                    ? trip.end_time.getTime() - trip.start_time.getTime()
                    : Date.now() - trip.start_time.getTime();
                const hours = Math.floor(tripDuration / 3600000);
                const minutes = Math.floor((tripDuration % 3600000) / 60000);
                const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

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
                                            background: trip.status === 'active' ? 'var(--success-500)' : 'var(--slate-600)',
                                            color: 'white',
                                            fontSize: '0.875rem',
                                            fontWeight: 700
                                        }}>
                                            {trip.trip_number}
                                        </span>
                                        {trip.driver_name}
                                    </h3>
                                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: '4px' }}>
                                        {trip.end_time
                                            ? trip.end_time.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }) + ' • ' + trip.end_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                            : (language === 'ar' ? 'نشط الآن' : 'Active now')}
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
                                            {trip.start_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'نهاية الرحلة' : 'End Time'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-200)' }}>
                                            {trip.end_time
                                                ? trip.end_time.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>{language === 'ar' ? 'المدة الكلية' : 'Total Duration'}</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success-400)' }}>
                                            {durationText}
                                        </div>
                                    </div>
                                </div>

                                {/* Invoices Section */}
                                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-200)', marginBottom: 'var(--spacing-sm)' }}>
                                        {language === 'ar' ? 'الفواتير' : 'Invoices'} ({trip.invoices.length})
                                    </h4>
                                    {trip.invoices.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--slate-500)' }}>
                                            {language === 'ar' ? 'لا توجد فواتير في هذه الرحلة' : 'No invoices in this trip'}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                                            {trip.invoices.map((inv) => (
                                                <div key={inv.invoice_id} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: 'var(--spacing-sm) var(--spacing-md)',
                                                    background: 'var(--slate-800)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--slate-700)'
                                                }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--slate-100)', fontSize: '0.9375rem' }}>
                                                            {inv.invoice_number}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                                                            {getTypeText(inv.invoice_type)}
                                                        </div>
                                                    </div>
                                                    {inv.has_image && (
                                                        <button
                                                            onClick={() => handleViewImage(inv.invoice_id, inv.invoice_number)}
                                                            disabled={loadingImageId === inv.invoice_id}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--primary-400)',
                                                                cursor: loadingImageId === inv.invoice_id ? 'wait' : 'pointer',
                                                                fontSize: '0.75rem',
                                                                padding: '4px 8px',
                                                                textDecoration: 'underline',
                                                                opacity: loadingImageId === inv.invoice_id ? 0.6 : 1
                                                            }}
                                                        >
                                                            {loadingImageId === inv.invoice_id ? '⏳' : '📷'} {language === 'ar' ? 'عرض الصورة' : 'View Photo'}
                                                        </button>
                                                    )}
                                                    <span className={`badge ${getStatusBadge(inv.status)}`}>
                                                        {getStatusText(inv.status)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setSelectedTrip(null)} className="btn btn-primary">
                                    {language === 'ar' ? 'إغلاق' : 'Close'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Edit Modal */}
            {editingInvoice && (
                <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{language === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'}</h3>
                            <button onClick={() => setEditingInvoice(null)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}</label>
                                <input type="text" className="form-input" value={editingInvoice.invoice_number} onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('invoiceType', language)}</label>
                                <select className="form-select" value={editingInvoice.invoice_type} onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_type: e.target.value as InvoiceType })}>
                                    {invoiceTypes.map(type => <option key={type.value} value={type.value}>{t(type.labelKey, language)}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('status', language)}</label>
                                <select className="form-select" value={editingInvoice.status} onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value as InvoiceStatus })}>
                                    {statusOptions.map(s => <option key={s.value} value={s.value}>{t(s.labelKey, language)}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('note', language)}</label>
                                <textarea className="form-textarea" value={editingInvoice.note} onChange={(e) => setEditingInvoice({ ...editingInvoice, note: e.target.value })} rows={2} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setEditingInvoice(null)} className="btn btn-secondary">{t('cancel', language)}</button>
                            <button onClick={handleEditSave} className="btn btn-primary" disabled={formLoading}>
                                {formLoading ? <span className="loader" style={{ width: 20, height: 20 }}></span> : t('save', language)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header"><h3 className="modal-title">{t('confirm', language)}</h3></div>
                        <div className="modal-body text-center">
                            <p>{language === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?'}</p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setDeleteConfirm(null)} className="btn btn-secondary">{t('cancel', language)}</button>
                            <button onClick={() => handleDelete(deleteConfirm)} className="btn btn-danger">{t('delete', language)}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function InvoicesPage() {
    return (
        <RoleGuard allowedRoles={['admin', 'seller']}>
            <InvoicesContent />
        </RoleGuard>
    );
}
