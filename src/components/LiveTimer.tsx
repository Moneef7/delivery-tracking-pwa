'use client';

import { useState, useEffect } from 'react';

interface LiveTimerProps {
    startTime: Date;
    isRunning: boolean;
    size?: 'sm' | 'md' | 'lg';
    showCar?: boolean;
}

export function LiveTimer({ startTime, isRunning, size = 'md', showCar = true }: LiveTimerProps) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!isRunning) return;

        // Calculate initial elapsed time
        const updateElapsed = () => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            setElapsed(Math.max(0, diff));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [startTime, isRunning]);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Simple inline timer for small size (table rows)
    if (size === 'sm') {
        return (
            <span style={{
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--slate-100)'
            }}>
                {formatTime(elapsed)}
            </span>
        );
    }

    const sizeStyles = {
        sm: { fontSize: '0.875rem', carSize: 16 },
        md: { fontSize: '1.25rem', carSize: 24 },
        lg: { fontSize: '2rem', carSize: 36 }
    };

    const style = sizeStyles[size];

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            background: isRunning ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.1)',
            borderRadius: 'var(--radius-lg)',
            border: `1px solid ${isRunning ? 'rgba(34, 197, 94, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
        }}>
            {showCar && (
                <div style={{
                    position: 'relative',
                    width: 60,
                    height: style.carSize,
                    overflow: 'hidden'
                }}>
                    {/* Animated car */}
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{
                            width: style.carSize,
                            height: style.carSize,
                            color: isRunning ? 'var(--success)' : 'var(--slate-400)',
                            animation: isRunning ? 'carMove 1.5s ease-in-out infinite' : 'none'
                        }}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                    {isRunning && (
                        <>
                            {/* Road lines animation */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 2,
                                background: 'linear-gradient(90deg, transparent 0%, var(--slate-600) 50%, transparent 100%)',
                                animation: 'roadMove 0.5s linear infinite'
                            }} />
                        </>
                    )}
                </div>
            )}

            <div style={{ textAlign: 'center' }}>
                <div style={{
                    fontFamily: 'monospace',
                    fontSize: style.fontSize,
                    fontWeight: 700,
                    color: isRunning ? 'var(--success)' : 'var(--slate-400)',
                    letterSpacing: '0.05em'
                }}>
                    {formatTime(elapsed)}
                </div>
                {isRunning && (
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-xs)'
                    }}>
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--success)',
                            animation: 'pulse 1s ease-in-out infinite'
                        }} />
                        LIVE
                    </div>
                )}
            </div>

            <style>{`
                @keyframes carMove {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(5px); }
                }
                @keyframes roadMove {
                    0% { transform: translateX(-20px); }
                    100% { transform: translateX(20px); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}

// Format duration for display after trip ends
export function formatDuration(startTime: Date, endTime: Date): string {
    const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
