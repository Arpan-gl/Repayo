'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient.js';
import SignInCard from './SignInCard.js';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--c-line)',
            borderTopColor: 'var(--c-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>
          Loading Repayo Workspace...
        </p>
        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <SignInCard />;
  }

  return (
    <>
      <header className="app-header">
        <div className="container header-content">
          <div className="brand-wrapper">
            <div className="brand-logo">R</div>
            <div>
              <div className="brand-title">Repayo</div>
              <div className="brand-subtitle">MSME Lending Servicing</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="user-badge">
              <span className="user-dot" />
              <span style={{ fontWeight: '500' }}>{user.email || 'Authenticated User'}</span>
            </div>
            <button
              onClick={() => signOut(auth)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '28px', paddingBottom: '60px' }}>
        {children}
      </main>
    </>
  );
}
