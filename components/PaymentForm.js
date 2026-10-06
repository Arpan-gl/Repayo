'use client';

import { useState, useMemo } from 'react';
import { allocatePayment } from '@/lib/core/allocate.js';
import { toPaise, formatINR } from '@/lib/core/money.js';
import { getTodayIST } from '@/lib/core/position.js';
import { auth } from '@/lib/firebaseClient.js';

export default function PaymentForm({ loanId, schedule, position, onPaymentSuccess, onError }) {
  const todayIST = getTodayIST();
  const [rupeesInput, setRupeesInput] = useState('');
  const [paidOn, setPaidOn] = useState(todayIST);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Parse input amount to paise
  const inputPaise = useMemo(() => {
    const num = parseFloat(rupeesInput);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round(num * 100);
  }, [rupeesInput]);

  // Client-side pure live allocation preview
  const allocationPreview = useMemo(() => {
    if (!inputPaise || !schedule || schedule.length === 0) return null;

    try {
      const result = allocatePayment({
        instalments: schedule,
        amountPaise: inputPaise,
      });
      return { success: true, allocations: result.allocations };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, [inputPaise, schedule]);

  // Quick fill handlers
  const handleQuickFillOverdue = () => {
    if (position?.overdueAmountPaise > 0) {
      setRupeesInput((position.overdueAmountPaise / 100).toString());
    }
  };

  const handleQuickFillNextEmi = () => {
    if (position?.nextDue?.amountPaise > 0) {
      setRupeesInput((position.nextDue.amountPaise / 100).toString());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (inputPaise <= 0 || submitting) return;

    setSubmitting(true);

    try {
      // Get Firebase auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be signed in to record a payment');
      }
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
        throw new Error(json.error?.message || 'Payment processing failed');
      }

      // Generate a new idempotency key for the next attempt
      setIdempotencyKey(crypto.randomUUID());
      setRupeesInput('');

      // Notify parent to update state in-place without page refresh
      onPaymentSuccess(json.data);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: 'var(--c-sand-border)' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--c-navy)' }}>
          Record Payment
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
          Simulates receiving collections from borrower (MSME ledger)
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Quick action chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {position?.overdueAmountPaise > 0 && (
            <button
              type="button"
              onClick={handleQuickFillOverdue}
              className="badge badge-overdue"
              style={{ cursor: 'pointer', border: '1px solid var(--c-primary)' }}
            >
              Pay Overdue ({formatINR(position.overdueAmountPaise)})
            </button>
          )}

          {position?.nextDue?.amountPaise > 0 && (
            <button
              type="button"
              onClick={handleQuickFillNextEmi}
              className="badge badge-due"
              style={{ cursor: 'pointer', border: '1px solid var(--c-navy)' }}
            >
              Pay Next Due ({formatINR(position.nextDue.amountPaise)})
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Amount input */}
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
              Amount (₹ INR)
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: '700',
                  color: 'var(--c-text-muted)',
                }}
              >
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="9986.00"
                value={rupeesInput}
                onChange={(e) => setRupeesInput(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 30px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--c-sand-border)',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  backgroundColor: 'var(--c-bg)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Paid on date */}
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
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                backgroundColor: 'var(--c-bg)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Live Allocation Preview */}
        {allocationPreview && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: allocationPreview.success ? 'var(--c-sand-tint)' : 'var(--c-primary-light)',
              border: `1px solid ${allocationPreview.success ? 'var(--c-sand-border)' : 'var(--c-peach)'}`,
              fontSize: '0.83rem',
            }}
          >
            <div style={{ fontWeight: '700', marginBottom: '6px', color: allocationPreview.success ? 'var(--c-navy)' : 'var(--c-primary)' }}>
              {allocationPreview.success ? '⚡ Real-time Allocation Preview' : '⚠️ Allocation Warning'}
            </div>

            {allocationPreview.success ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {allocationPreview.allocations.map((a, idx) => {
                  const inst = schedule.find((s) => s.id === a.instalmentId);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Instalment #{inst?.seq || '?'}:</span>
                      <span className="tabular-nums">
                        Interest: <strong>{formatINR(a.interestPaidPaise)}</strong>, Principal: <strong>{formatINR(a.principalPaidPaise)}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--c-primary)' }}>{allocationPreview.message}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || inputPaise <= 0 || (allocationPreview && !allocationPreview.success)}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px' }}
        >
          {submitting ? 'Allocating & Processing...' : `Confirm Payment of ${formatINR(inputPaise)}`}
        </button>
      </form>
    </div>
  );
}
