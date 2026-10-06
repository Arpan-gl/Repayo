'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebaseClient.js';

export default function SignInCard() {
  const [email, setEmail] = useState('reviewer@vitto.money');
  const [password, setPassword] = useState('Vitto@2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error('[Auth Error]:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid credentials. Click "Auto-fill demo test account" below to load the verified reviewer credentials, or toggle "Create new account" to register.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please switch back to "Sign In".');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please check credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('[Google Auth Error]:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Domain not authorized: Please add "repayo.vercel.app" to Firebase Console > Authentication > Settings > Authorized domains.');
      } else if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in Firebase Console (Authentication > Sign-in method). Please sign in using the pre-filled demo email/password.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completion.');
      } else {
        setError(err.message || 'Google Sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillTestCredentials = () => {
    setEmail('reviewer@vitto.money');
    setPassword('Vitto@2026!');
    setIsRegistering(false);
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          border: '1px solid var(--c-sand-border)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            className="brand-logo"
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px auto',
              fontSize: '1.5rem',
            }}
          >
            R
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: '800',
              color: 'var(--c-navy)',
              letterSpacing: '-0.02em',
            }}
          >
            Repayo Operations
          </h1>
          <p
            style={{
              color: 'var(--c-text-muted)',
              fontSize: '0.88rem',
              marginTop: '6px',
            }}
          >
            MSME Loan Repayment & Servicing Engine
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(84, 154, 98, 0.08)',
            border: '1px solid var(--c-moss)',
            color: 'var(--c-moss)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: '0.8rem',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <strong>Demo Account Ready:</strong>
            <div style={{ color: 'var(--c-espresso)', fontSize: '0.75rem', marginTop: '2px' }}>
              reviewer@vitto.money • Vitto@2026!
            </div>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Verified</span>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'var(--c-primary-light)',
              color: 'var(--c-primary)',
              border: '1px solid var(--c-peach)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '20px',
              fontWeight: '500',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: '600',
                color: 'var(--c-espresso)',
                marginBottom: '6px',
              }}
            >
              Staff Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops@vitto.money"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.82rem',
                fontWeight: '600',
                color: 'var(--c-espresso)',
                marginBottom: '6px',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? 'Authenticating...' : isRegistering ? 'Create Staff Account' : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            color: 'var(--c-sand-border)',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--c-line)' }} />
          <span style={{ padding: '0 12px', fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--c-line)' }} />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          type="button"
          className="btn btn-outline"
          style={{ width: '100%' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--c-line)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
          }}
        >
          <button
            type="button"
            onClick={fillTestCredentials}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--c-primary)',
              cursor: 'pointer',
              fontWeight: '600',
              textDecoration: 'underline',
            }}
          >
            Auto-fill demo test account
          </button>

          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--c-navy)',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            {isRegistering ? 'Back to Sign In' : 'Create new account'}
          </button>
        </div>
      </div>
    </div>
  );
}
