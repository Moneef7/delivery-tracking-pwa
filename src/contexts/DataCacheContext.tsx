'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { User, Invoice, Trip } from '@/lib/types';

interface CacheData {
    users: User[] | null;
    invoices: Invoice[] | null;
    trips: Trip[] | null;
    lastFetch: {
        users: number;
        invoices: number;
        trips: number;
    };
}

interface DataCacheContextType {
    cache: CacheData;
    setUsers: (users: User[]) => void;
    setInvoices: (invoices: Invoice[]) => void;
    setTrips: (trips: Trip[]) => void;
    isCacheValid: (key: 'users' | 'invoices' | 'trips', maxAgeMs?: number) => boolean;
    clearCache: () => void;
}

const DataCacheContext = createContext<DataCacheContextType | null>(null);

const CACHE_DURATION = 30000; // 30 seconds cache validity

export function DataCacheProvider({ children }: { children: ReactNode }) {
    const [cache, setCache] = useState<CacheData>({
        users: null,
        invoices: null,
        trips: null,
        lastFetch: {
            users: 0,
            invoices: 0,
            trips: 0
        }
    });

    const setUsers = (users: User[]) => {
        setCache(prev => ({
            ...prev,
            users,
            lastFetch: { ...prev.lastFetch, users: Date.now() }
        }));
    };

    const setInvoices = (invoices: Invoice[]) => {
        setCache(prev => ({
            ...prev,
            invoices,
            lastFetch: { ...prev.lastFetch, invoices: Date.now() }
        }));
    };

    const setTrips = (trips: Trip[]) => {
        setCache(prev => ({
            ...prev,
            trips,
            lastFetch: { ...prev.lastFetch, trips: Date.now() }
        }));
    };

    const isCacheValid = (key: 'users' | 'invoices' | 'trips', maxAgeMs = CACHE_DURATION) => {
        const lastFetch = cache.lastFetch[key];
        return cache[key] !== null && Date.now() - lastFetch < maxAgeMs;
    };

    const clearCache = () => {
        setCache({
            users: null,
            invoices: null,
            trips: null,
            lastFetch: { users: 0, invoices: 0, trips: 0 }
        });
    };

    return (
        <DataCacheContext.Provider value={{ cache, setUsers, setInvoices, setTrips, isCacheValid, clearCache }}>
            {children}
        </DataCacheContext.Provider>
    );
}

export function useDataCache() {
    const context = useContext(DataCacheContext);
    if (!context) {
        throw new Error('useDataCache must be used within a DataCacheProvider');
    }
    return context;
}
