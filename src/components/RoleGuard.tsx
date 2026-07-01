'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                // Not logged in, redirect to login
                router.push('/');
            } else if (!allowedRoles.includes(user.role)) {
                // Not authorized for this page, redirect to their home
                const homeRoutes: Record<UserRole, string> = {
                    admin: '/dashboard',
                    seller: '/invoices',
                    driver: '/trips'
                };
                router.push(homeRoutes[user.role]);
            } else {
                setAuthorized(true);
            }
        }
    }, [user, loading, allowedRoles, router]);

    // Show loading while checking auth
    if (loading || !authorized) {
        return (
            <div className="loading-overlay">
                <div className="loader loader-lg"></div>
            </div>
        );
    }

    return <>{children}</>;
}
