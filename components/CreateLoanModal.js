'use client';

import { useState, useMemo } from 'react';
import { calculateEmiPaise } from '@/lib/core/emi.js';
import { formatINR } from '@/lib/core/money.js';
import { getTodayIST } from '@/lib/core/position.js';
import { auth } from '@/lib/firebaseClient.js';

export default function CreateLoanModal({ isOpen, onClose, onLoanCreated, onError }) {
  const todayIST = getTodayIST();
  const [principalRupees, setPrincipalRupees] = useState('200000');
  const [annualRate, setAnnualRate] = useState('18');
  const [tenure, setTenure] = useState('24');
  const [disbursementDate, setDisbursementDate] = useState(todayIST);
  const [submitting, setSubmitting] = useState(false);

  // Compute live estimated EMI preview
  const estimatedEmi = useMemo(() => {
    const p = parseFloat(principalRupees);
    const r = parseFloat(annualRate);
    const n = parseInt(tenure, 10);
    if (!p || p <= 0 || isNaN(r) || r < 0 || !n || n < 3 || n > 36) {
      return null;
    }
    const paise = Math.round(p * 100);
    return calculateEmiPaise(paise, r, n);
  }, [principalRupees, annualRate, tenure]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const p = parseFloat(principalRupees);
    const r = parseFloat(annualRate);
    const n = parseInt(tenure, 10);

    if (p < 50000 || p > 1000000) {
      onError('Principal must be between ₹50,000 and ₹10,00,000');
      return;
    }
    if (r < 0) {
      onError('Annual rate cannot be negative');
      return;
    }
    if (n < 3 || n > 36) {
      onError('Tenure must be between 3 and 36 months');
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to create a loan');

      const token = await user.getIdToken();
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          principalPaise: Math.round(p * 100),
          annualRatePct: r,
          tenureMonths: n,
          disbursementDate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || 'Failed to create loan');
      }

      onLoanCreated(json.data);
      onClose();
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(32, 48, 84, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-elevated)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--c-navy)' }}>
              Create New MSME Loan
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
              Generates full monthly amortization schedule in PostgreSQL
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: 'var(--c-text-muted)',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '4px', color: 'var(--c-espresso)' }}>
              Principal Amount (₹ 50,000 to ₹ 10,00,000)
            </label>
            <input
              type="number"
              min="50000"
              max="1000000"
              step="1000"
              value={principalRupees}
              onChange={(e) => setPrincipalRupees(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontSize: '0.95rem',
                fontWeight: '600',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '4px', color: 'var(--c-espresso)' }}>
                Annual Rate (% p.a.)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                step="0.1"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--c-sand-border)',
                  fontSize: '0.95rem',
                  backgroundColor: 'var(--c-bg)',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '4px', color: 'var(--c-espresso)' }}>
                Tenure (3 - 36 Months)
              </label>
              <input
                type="number"
                min="3"
                max="36"
                value={tenure}
                onChange={(e) => setTenure(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--c-sand-border)',
                  fontSize: '0.95rem',
                  backgroundColor: 'var(--c-bg)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '4px', color: 'var(--c-espresso)' }}>
              Disbursement Date
            </label>
            <input
              type="date"
              value={disbursementDate}
              onChange={(e) => setDisbursementDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontSize: '0.95rem',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          {estimatedEmi && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--c-sand-tint)',
                border: '1px solid var(--c-sand-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--c-text-muted)', fontWeight: '600' }}>
                Estimated Monthly EMI:
              </span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--c-navy)' }} className="tabular-nums">
                {formatINR(estimatedEmi)}
              </strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {submitting ? 'Creating & Generating...' : 'Create Loan & Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
