'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

// Icons
const LanguageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 20, height: 20 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C13.184 6.956 14.117 8.65 14.82 10.5m-3.486-5.136A48.63 48.63 0 0112 5.25" />
  </svg>
);


export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Rate limiting
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 30000; // 30 seconds

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      // Redirect to role-appropriate home page
      const homeRoutes: Record<string, string> = {
        admin: '/dashboard',
        seller: '/invoices',
        driver: '/trips'
      };
      router.push(homeRoutes[user.role] || '/');
    }
  }, [user, loading, router]);

  // Check lockout timer
  useEffect(() => {
    if (lockoutUntil && Date.now() >= lockoutUntil) {
      setLockoutUntil(null);
      setLoginAttempts(0);
    }
  }, [lockoutUntil]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setError(language === 'ar'
        ? `محاولات كثيرة. انتظر ${secondsLeft} ثانية`
        : `Too many attempts. Wait ${secondsLeft} seconds`);
      return;
    }

    if (!email || !password) {
      setError(language === 'ar' ? 'يرجى إدخال البريد وكلمة المرور' : 'Please enter email and password');
      return;
    }

    setError('');
    setIsLoggingIn(true);

    try {
      await login(email, password);
      // Reset attempts on success
      setLoginAttempts(0);
      // Redirect happens automatically via useEffect when user state updates
    } catch (err: unknown) {
      // Increment failed attempts
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      // Lock out after max attempts
      if (newAttempts >= MAX_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION);
        setError(language === 'ar'
          ? 'محاولات كثيرة. انتظر 30 ثانية'
          : 'Too many attempts. Wait 30 seconds');
        setIsLoggingIn(false);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      if (errorMessage.includes('invalid-credential') || errorMessage.includes('wrong-password')) {
        setError(language === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid email or password');
      } else if (errorMessage.includes('user-not-found')) {
        setError(language === 'ar' ? 'الحساب غير موجود' : 'Account not found');
      } else if (errorMessage.includes('deactivated')) {
        setError(language === 'ar' ? 'الحساب معطل' : 'Account is deactivated');
      } else {
        setError(language === 'ar' ? 'حدث خطأ في تسجيل الدخول' : 'Login error occurred');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  // Show loading or redirect if logged in
  if (loading || user) {
    return (
      <div className="loading-overlay">
        <div className="loader loader-lg"></div>
      </div>
    );
  }

  return (
    <div className="page" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 'var(--spacing-lg)',
      background: '#ffffff'
    }}>
      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="btn btn-ghost"
        style={{ position: 'absolute', top: 'var(--spacing-md)', right: 'var(--spacing-md)' }}
      >
        <LanguageIcon />
        <span style={{ marginInlineStart: '4px' }}>{language === 'ar' ? 'EN' : 'عربي'}</span>
      </button>

      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          height: 120,
          width: 'auto',
          marginBottom: 'var(--spacing-lg)',
          objectFit: 'contain'
        }}
      />

      {/* Title */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-100)', marginBottom: 'var(--spacing-xs)', textAlign: 'center' }}>
        {language === 'ar' ? 'نظام تتبع التوصيل' : 'Delivery Tracking System'}
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)', marginBottom: 'var(--spacing-xl)', textAlign: 'center' }}>
        {language === 'ar' ? 'سجل دخولك للمتابعة' : 'Sign in to continue'}
      </p>

      {/* Login Form */}
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '360px' }}>
        <div className="card" style={{ padding: 'var(--spacing-lg)' }}>
          {error && (
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--error-500)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-md)',
              fontSize: '0.875rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
              autoComplete="email"
              disabled={isLoggingIn}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{language === 'ar' ? 'كلمة المرور' : 'Password'}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
              autoComplete="current-password"
              disabled={isLoggingIn}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoggingIn}
            style={{ width: '100%', marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-md)' }}
          >
            {isLoggingIn ? (
              <span className="loader" style={{ width: 20, height: 20 }}></span>
            ) : (
              language === 'ar' ? 'تسجيل الدخول' : 'Sign In'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
