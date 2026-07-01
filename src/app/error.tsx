'use client';

import { useEffect, useState } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const [isArabic, setIsArabic] = useState(false);

    useEffect(() => {
        // Detect language from document direction
        setIsArabic(document.documentElement.dir === 'rtl');
        // Log error to console
        console.error('Application error:', error);
    }, [error]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
            textAlign: 'center',
            background: '#0f172a',
            color: '#f1f5f9'
        }}>
            <div style={{
                width: 80,
                height: 80,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                fontSize: '2.5rem'
            }}>
                ⚠️
            </div>

            <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                marginBottom: '8px'
            }}>
                {isArabic ? 'حدث خطأ غير متوقع' : 'Something went wrong'}
            </h1>

            <p style={{
                fontSize: '0.875rem',
                color: '#94a3b8',
                marginBottom: '24px',
                maxWidth: 400
            }}>
                {isArabic
                    ? 'نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.'
                    : 'We apologize for this error. Please try again.'}
            </p>

            {process.env.NODE_ENV === 'development' && (
                <div style={{
                    padding: '16px',
                    background: '#1e293b',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    maxWidth: 500,
                    overflow: 'auto',
                    textAlign: 'left'
                }}>
                    <code style={{ fontSize: '0.75rem', color: '#f87171' }}>
                        {error.message}
                    </code>
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={reset}
                    style={{
                        padding: '12px 24px',
                        background: '#6366f1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    {isArabic ? 'حاول مرة أخرى' : 'Try Again'}
                </button>
                <button
                    onClick={() => window.location.href = '/'}
                    style={{
                        padding: '12px 24px',
                        background: '#334155',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    {isArabic ? 'العودة للرئيسية' : 'Go Home'}
                </button>
            </div>
        </div>
    );
}
