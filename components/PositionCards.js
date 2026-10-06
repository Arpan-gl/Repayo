'use client';

import { formatINR } from '@/lib/core/money.js';

export default function PositionCards({ position }) {
  if (!position) return null;

  const {
    outstandingPrincipalPaise,
    overdueAmountPaise,
    daysOverdue,
    nextDue,
    status,
  } = position;

  const isOverdue = overdueAmountPaise > 0;
  const isSettled = status === 'SETTLED';

  return (
    <div className="grid-cards">
      {/* 1. Outstanding Principal */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Outstanding Principal
          </span>
          <span
            className={`badge ${
              isSettled ? 'badge-paid' : isOverdue ? 'badge-overdue' : 'badge-due'
            }`}
          >
            {status}
          </span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: 'var(--c-navy)',
            marginTop: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          {formatINR(outstandingPrincipalPaise)}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--c-text-light)', marginTop: '6px' }}>
          Excludes unaccrued interest components
        </p>
      </div>

      {/* 2. Next Due */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Next Due
          </span>
          {nextDue && (
            <span className="badge badge-due">
              Instalment #{nextDue.seq}
            </span>
          )}
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: 'var(--c-espresso)',
            marginTop: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          {nextDue ? formatINR(nextDue.amountPaise) : '₹0.00'}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)', marginTop: '6px' }}>
          {nextDue ? (
            <>
              Due on <strong>{nextDue.dueDate}</strong>
            </>
          ) : (
            'No upcoming instalments due'
          )}
        </p>
      </div>

      {/* 3. Overdue Amount & Days */}
      <div
        className="card"
        style={{
          backgroundColor: isOverdue ? 'var(--c-peach-tint)' : 'var(--c-surface)',
          borderColor: isOverdue ? 'var(--c-peach)' : 'var(--c-line)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: isOverdue ? 'var(--c-primary)' : 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Overdue Amount
          </span>
          <span
            className={`badge ${isOverdue ? 'badge-overdue' : 'badge-paid'}`}
          >
            {isOverdue ? `${daysOverdue} Days Overdue` : 'All Clear'}
          </span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '2rem',
            fontWeight: '800',
            color: isOverdue ? 'var(--c-primary)' : 'var(--c-sage-dark)',
            marginTop: '12px',
            letterSpacing: '-0.02em',
          }}
        >
          {formatINR(overdueAmountPaise)}
        </div>
        <p style={{ fontSize: '0.8rem', color: isOverdue ? 'var(--c-primary)' : 'var(--c-text-muted)', marginTop: '6px' }}>
          {isOverdue
            ? `Past due date — immediate collection required`
            : `All instalments up to date`}
        </p>
      </div>
    </div>
  );
}
