'use client';

import { useState, useMemo } from 'react';
import { allocatePayment } from '@/lib/core/allocate.js';
import { formatINR } from '@/lib/core/money.js';
import { getTodayIST } from '@/lib/core/position.js';
import { auth } from '@/lib/firebaseClient.js';

export default function PaymentForm({ loanId, schedule, position, onPaymentSuccess, onError }) {
  const todayIST = getTodayIST();
  const [rupeesInput, setRupeesInput] = useState('');
  const [paidOn, setPaidOn] = useState(todayIST);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const inputPaise = useMemo(() => {
    const num = parseFloat(rupeesInput);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [rupeesInput]);

  const allocationPreview = useMemo(() => {
    if (!inputPaise || !schedule || schedule.length === 0) return null;
    try {
      const res = allocatePayment({
        instalments: schedule,
        amountPaise: inputPaise,
      });
      return { success: true, count: res.allocations.length, allocations: res.allocations };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, [inputPaise, schedule]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputPaise <= 0 || submitting) return;

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to record a payment');

      const token = await user.getIdToken();
      const res = await fetch(`/api/loans/${loanId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amountPaise: inputPaise,
          paidOn,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || 'Payment submission failed');
      }

      setIdempotencyKey(crypto.randomUUID());
      setRupeesInput('');
      onPaymentSuccess(json.data);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        marginBottom: '24px',
        backgroundColor: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--c-navy)' }}>
            Record Payment
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
            Allocates across schedule automatically (interest before principal, oldest first)
          </p>
        </div>

        {/* Quick fill chips */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {position?.overdueAmountPaise > 0 && (
            <button
              type="button"
              onClick={() => setRupeesInput((position.overdueAmountPaise / 100).toString())}
              className="badge badge-overdue"
              style={{ cursor: 'pointer', border: '1px solid var(--c-primary)' }}
            >
              Pay Overdue ({formatINR(position.overdueAmountPaise)})
            </button>
          )}
          {position?.nextDue?.amountPaise > 0 && (
            <button
              type="button"
              onClick={() => setRupeesInput((position.nextDue.amountPaise / 100).toString())}
              className="badge badge-due"
              style={{ cursor: 'pointer', border: '1px solid var(--c-navy)' }}
            >
              Pay Next Due ({formatINR(position.nextDue.amountPaise)})
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px', color: 'var(--c-espresso)' }}>
              Amount (₹ INR)
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="e.g. 9986.00"
              value={rupeesInput}
              onChange={(e) => setRupeesInput(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontSize: '0.92rem',
                fontWeight: '600',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px', color: 'var(--c-espresso)' }}>
              Payment Date
            </label>
            <input
              type="date"
              max={todayIST}
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--c-sand-border)',
                fontSize: '0.92rem',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting || inputPaise <= 0 || (allocationPreview && !allocationPreview.success)}
              className="btn btn-primary"
              style={{ height: '44px', minWidth: '150px' }}
            >
              {submitting ? 'Allocating...' : 'Submit Payment'}
            </button>
          </div>
        </div>

        {/* Live Allocation Preview */}
        {allocationPreview && (
          <div style={{ marginTop: '12px', fontSize: '0.82rem' }}>
            {allocationPreview.success ? (
              <span style={{ color: 'var(--c-sage-dark)' }}>
                ✓ Will allocate across <strong>{allocationPreview.count}</strong> instalment(s) upon submission.
              </span>
            ) : (
              <span style={{ color: 'var(--c-primary)' }}>
                ⚠️ {allocationPreview.message}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
