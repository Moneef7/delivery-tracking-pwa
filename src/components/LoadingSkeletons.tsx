'use client';

// Loading Skeleton Components for smooth page transitions

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
    <div className="table-container" style={{ padding: 'var(--spacing-md)' }}>
        <div className="skeleton-row skeleton-header" style={{ marginBottom: 'var(--spacing-md)' }} />
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="skeleton-row" style={{ marginBottom: 'var(--spacing-sm)' }} />
        ))}
        <style>{`
            .skeleton-row {
                height: 48px;
                background: #f0f0f0;
                border-radius: var(--radius-md);
            }
            .skeleton-header {
                height: 40px;
                background: #e8e4dc;
            }
        `}</style>
    </div>
);

export const CardsSkeleton = ({ count = 4 }: { count?: number }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-md)' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="skeleton-card" />
        ))}
        <style>{`
            .skeleton-card {
                height: 100px;
                background: #f0f0f0;
                border-radius: var(--radius-xl);
            }
        `}</style>
    </div>
);

export const ListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="skeleton-list-item" />
        ))}
        <style>{`
            .skeleton-list-item {
                height: 72px;
                background: #f0f0f0;
                border-radius: var(--radius-lg);
            }
        `}</style>
    </div>
);
