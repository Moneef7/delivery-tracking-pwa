'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    query,
    orderBy,
    serverTimestamp,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { t } from '@/lib/i18n';
import { User, UserRole } from '@/lib/types';
import { RoleNav } from '@/components/RoleNav';
import { RoleGuard } from '@/components/RoleGuard';
import { TableSkeleton } from '@/components/LoadingSkeletons';

// Firebase config for secondary app (uses env vars)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string
};

// Icons
const PlusIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

function UsersContent() {
    const { user: currentUser } = useAuth();
    const { language } = useLanguage();
    const { cache, setUsers: cacheUsers, isCacheValid } = useDataCache();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPasswordFor, setShowPasswordFor] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        password: '',
        role: 'driver' as UserRole
    });

    useEffect(() => {
        // Check cache first for instant load
        if (isCacheValid('users')) {
            setUsers(cache.users!);
            setLoading(false);
            // Refresh in background
            fetchUsers(true);
        } else {
            fetchUsers(false);
        }
    }, []);

    const fetchUsers = async (background = false) => {
        if (!background) setLoading(true);
        try {
            const usersQuery = query(collection(db, 'users'), orderBy('created_at', 'desc'));
            const snapshot = await getDocs(usersQuery);
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                created_at: doc.data().created_at?.toDate() || new Date(),
                updated_at: doc.data().updated_at?.toDate() || new Date()
            })) as User[];
            setUsers(usersData);
            cacheUsers(usersData);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setFormLoading(true);

        const userPassword = formData.password;
        let secondaryApp: ReturnType<typeof initializeApp> | null = null;
        const appName = `SecondaryApp_${Date.now()}`;

        try {
            secondaryApp = initializeApp(firebaseConfig, appName);
            const secondaryAuth = getAuth(secondaryApp);

            const userCredential = await createUserWithEmailAndPassword(
                secondaryAuth,
                formData.email,
                formData.password
            );

            const userId = userCredential.user.uid;
            await secondaryAuth.signOut();

            await setDoc(doc(db, 'users', userId), {
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                role: formData.role,
                password: formData.password,
                status: 'active',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });

            await setDoc(doc(collection(db, 'logs')), {
                action: 'create',
                entity_type: 'user',
                entity_id: userId,
                user_id: currentUser?.id,
                user_name: currentUser?.name,
                old_value: null,
                new_value: { name: formData.name, email: formData.email, role: formData.role },
                timestamp: serverTimestamp()
            });

            if (secondaryApp) {
                try { await deleteApp(secondaryApp); } catch { }
            }

            const successMsg = language === 'ar'
                ? `تم إنشاء المستخدم بنجاح!\n\nالبريد: ${formData.email}\nكلمة المرور: ${userPassword}`
                : `User created successfully!\n\nEmail: ${formData.email}\nPassword: ${userPassword}`;
            setSuccess(successMsg);
            setFormData({ name: '', phone: '', email: '', password: '', role: 'driver' });
            setShowModal(false);
            fetchUsers();
        } catch (err: unknown) {
            if (secondaryApp) {
                try { await deleteApp(secondaryApp); } catch { }
            }
            const errorMessage = err instanceof Error ? err.message : 'Error creating user';
            if (errorMessage.includes('email-already-in-use')) {
                setError(language === 'ar' ? 'البريد الإلكتروني مستخدم بالفعل' : 'Email already in use');
            } else if (errorMessage.includes('weak-password')) {
                setError(language === 'ar' ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)' : 'Password too weak (min 6 characters)');
            } else {
                setError(language === 'ar' ? 'حدث خطأ في إنشاء المستخدم' : 'Error creating user');
            }
        } finally {
            setFormLoading(false);
        }
    };

    const toggleUserStatus = async (userId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await updateDoc(doc(db, 'users', userId), {
                status: newStatus,
                updated_at: serverTimestamp()
            });
            await setDoc(doc(collection(db, 'logs')), {
                action: 'update',
                entity_type: 'user',
                entity_id: userId,
                user_id: currentUser?.id,
                user_name: currentUser?.name,
                old_value: { status: currentStatus },
                new_value: { status: newStatus },
                timestamp: serverTimestamp()
            });
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus as 'active' | 'inactive' } : u));
            setSuccess(language === 'ar' ? 'تم تحديث الحالة' : 'Status updated');
        } catch (error) {
            setError(language === 'ar' ? 'حدث خطأ' : 'An error occurred');
        }
    };

    const getRoleBadge = (role: UserRole) => {
        const roleColors: Record<UserRole, string> = {
            admin: 'badge-error',
            seller: 'badge-info',
            driver: 'badge-success'
        };
        return roleColors[role];
    };

    const getRoleText = (role: UserRole) => {
        const roleTexts: Record<UserRole, { ar: string; en: string }> = {
            admin: { ar: 'مدير', en: 'Admin' },
            seller: { ar: 'بائع', en: 'Seller' },
            driver: { ar: 'سائق', en: 'Driver' }
        };
        return roleTexts[role][language];
    };

    return (
        <div className="page">
            <RoleNav />

            <div className="flex justify-between items-center mb-lg" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
                <div>
                    <h1 className="page-title">{t('users', language)}</h1>
                    <p className="page-subtitle">
                        {language === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Manage users and permissions'}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-primary">
                    <PlusIcon />
                    {t('createUser', language)}
                </button>
            </div>

            {success && (
                <div className="toast-container">
                    <div className="toast toast-success">
                        <span>{success}</span>
                        <button onClick={() => setSuccess('')} className="btn btn-ghost btn-sm"><CloseIcon /></button>
                    </div>
                </div>
            )}

            {error && (
                <div className="toast-container">
                    <div className="toast toast-error">
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="btn btn-ghost btn-sm"><CloseIcon /></button>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? (
                    <TableSkeleton rows={5} />
                ) : users.length === 0 ? (
                    <div className="empty-state">
                        <p className="empty-state-title">{t('noResults', language)}</p>
                        <p className="empty-state-text">{language === 'ar' ? 'لا يوجد مستخدمين بعد' : 'No users yet'}</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('name', language)}</th>
                                    <th>{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                                    <th>{t('phone', language)}</th>
                                    <th>{language === 'ar' ? 'الدور' : 'Role'}</th>
                                    <th>{t('status', language)}</th>
                                    <th>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: 500 }}>{user.name}</td>
                                        <td dir="ltr" style={{ color: 'var(--slate-400)', textAlign: 'left' }}>{user.email}</td>
                                        <td dir="ltr" style={{ textAlign: 'left' }}>{user.phone}</td>
                                        <td><span className={`badge ${getRoleBadge(user.role)}`}>{getRoleText(user.role)}</span></td>
                                        <td>
                                            <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                                                {user.status === 'active' ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'معطل' : 'Inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => toggleUserStatus(user.id, user.status)}
                                                    className={`btn btn-sm ${user.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                                    disabled={user.id === currentUser?.id}
                                                >
                                                    {user.status === 'active' ? t('deactivateUser', language) : t('activateUser', language)}
                                                </button>
                                                <button
                                                    onClick={() => setShowPasswordFor(showPasswordFor === user.id ? null : user.id)}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    {showPasswordFor === user.id ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'كلمة المرور' : 'Password')}
                                                </button>
                                            </div>
                                            {showPasswordFor === user.id && (
                                                <div style={{ marginTop: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', background: 'var(--slate-800)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--warning)' }}>
                                                    {(user as unknown as { password?: string }).password || (language === 'ar' ? 'غير متوفر' : 'Not available')}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{t('createUser', language)}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon"><CloseIcon /></button>
                        </div>
                        <form onSubmit={handleCreateUser}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">{t('name', language)}</label>
                                    <input type="text" className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
                                    <input type="email" className="form-input" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required dir="ltr" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('phone', language)}</label>
                                    <input type="tel" className="form-input" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} dir="ltr" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('password', language)}</label>
                                    <input type="password" className="form-input" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={6} dir="ltr" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{language === 'ar' ? 'الدور' : 'Role'}</label>
                                    <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}>
                                        <option value="driver">{language === 'ar' ? 'سائق' : 'Driver'}</option>
                                        <option value="seller">{language === 'ar' ? 'بائع' : 'Seller'}</option>
                                        <option value="admin">{language === 'ar' ? 'مدير' : 'Admin'}</option>
                                    </select>
                                </div>
                                {error && (
                                    <div className="form-error" style={{ padding: 'var(--spacing-sm) var(--spacing-md)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
                                        {error}
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">{t('cancel', language)}</button>
                                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                                    {formLoading ? <span className="loader" style={{ width: 20, height: 20 }}></span> : t('save', language)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function UsersPage() {
    return (
        <RoleGuard allowedRoles={['admin']}>
            <UsersContent />
        </RoleGuard>
    );
}
