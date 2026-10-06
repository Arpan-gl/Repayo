'use client';

import { formatINR } from '@/lib/core/money.js';

export default function PositionCards({ position }) {
  if (!position) return null;

  const {
    outstandingPrincipalPaise,
    overdueAmountPaise,
    daysOverdue,
    nextDue,
  } = position;

  const isOverdue = overdueAmountPaise > 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {/* 1. Outstanding Principal */}
      <div
        className="card"
        style={{
          padding: '20px',
          borderLeft: '4px solid var(--c-navy)',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: 'var(--c-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Outstanding Principal
        </span>
        <div
          className="tabular-nums"
          style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            color: 'var(--c-navy)',
            marginTop: '6px',
          }}
        >
          {formatINR(outstandingPrincipalPaise)}
        </div>
      </div>

      {/* 2. Next Due */}
      <div
        className="card"
        style={{
          padding: '20px',
          borderLeft: '4px solid var(--c-espresso)',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: 'var(--c-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Next Due {nextDue ? `(#${nextDue.seq})` : ''}
        </span>
        <div
          className="tabular-nums"
          style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            color: 'var(--c-espresso)',
            marginTop: '6px',
          }}
        >
          {nextDue ? formatINR(nextDue.amountPaise) : '₹0.00'}
        </div>
        {nextDue && (
          <span style={{ fontSize: '0.78rem', color: 'var(--c-text-muted)' }}>
            Due Date: {nextDue.dueDate}
          </span>
        )}
      </div>

      {/* 3. Overdue Amount */}
      <div
        className="card"
        style={{
          padding: '20px',
          backgroundColor: isOverdue ? 'var(--c-peach-tint)' : '#FFFFFF',
          borderColor: isOverdue ? 'var(--c-peach)' : 'var(--c-line)',
          borderLeft: `4px solid ${isOverdue ? 'var(--c-primary)' : 'var(--c-sage)'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: '700',
              color: isOverdue ? 'var(--c-primary)' : 'var(--c-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Overdue Amount
          </span>
          <span className={`badge ${isOverdue ? 'badge-overdue' : 'badge-paid'}`}>
            {isOverdue ? `${daysOverdue} Days Late` : 'All Clear'}
          </span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '1.8rem',
            fontWeight: '800',
            color: isOverdue ? 'var(--c-primary)' : 'var(--c-sage-dark)',
            marginTop: '6px',
          }}
        >
          {formatINR(overdueAmountPaise)}
        </div>
      </div>
    </div>
  );
}
