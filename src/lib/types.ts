// Type definitions for the Delivery Tracking System

export type UserRole = 'admin' | 'seller' | 'driver';
export type UserStatus = 'active' | 'inactive';
export type TripStatus = 'active' | 'completed';
export type InvoiceType = 'invoice' | 'delivery_permit' | 'quotation' | 'transfer' | 'clearance';
export type InvoiceStatus = 'pending' | 'delivered' | 'not_received' | 'returned';
export type Branch = 'main' | 'bab_sharif' | 'souq_7' | 'representative' | 'hindawiya';
export type LogAction = 'create' | 'update' | 'delete' | 'status_change' | 'reassign';
export type EntityType = 'invoice' | 'trip' | 'user' | 'image';

// User interface
export interface User {
    id: string;
    name: string;
    phone: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
}

// Trip interface
export interface Trip {
    trip_id: string;
    driver_id: string;
    driver_name: string;
    start_time: Date;
    end_time: Date | null;
    status: TripStatus;
    created_at: Date;
    invoice_count?: number;
}

// Invoice interface
export interface Invoice {
    invoice_id: string;
    invoice_number: string;
    invoice_type: InvoiceType;
    branch: Branch;
    note: string;
    status: InvoiceStatus;
    driver_id: string;
    driver_name: string;
    trip_id?: string; // Optional - not used in new invoice-based system
    start_time: Date; // Timer start
    end_time: Date | null; // Timer end (null if pending)
    duration: number | null; // Calculated duration in milliseconds
    created_at: Date;
    updated_at: Date;
    has_image?: boolean;
}

// Image interface
export interface DeliveryImage {
    image_id: string;
    invoice_id: string;
    invoice_number: string;
    driver_id: string;
    trip_id: string;
    captured_at: Date;
    file_path: string;
    file_url?: string;
    source: 'camera_only';
    expires_at: Date;
}

// Log interface
export interface ActivityLog {
    log_id: string;
    action: LogAction;
    entity_type: EntityType;
    entity_id: string;
    user_id: string;
    user_name: string;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    timestamp: Date;
    description?: string;
}

// Auth context types
export interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
}

// Language context types
export interface LanguageContextType {
    language: 'ar' | 'en';
    setLanguage: (lang: 'ar' | 'en') => void;
    isRTL: boolean;
}

// Form types
export interface CreateUserForm {
    name: string;
    phone: string;
    email: string;
    password: string;
    role: UserRole;
}

export interface CreateInvoiceForm {
    invoice_number: string;
    invoice_type: InvoiceType;
    branch: Branch;
    note: string;
    status: InvoiceStatus;
}

export interface SearchFilters {
    invoice_number?: string;
    driver_id?: string;
    invoice_type?: InvoiceType | '';
    branch?: Branch | '';
    status?: InvoiceStatus | '';
    date_from?: Date | null;
    date_to?: Date | null;
}

// API response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
