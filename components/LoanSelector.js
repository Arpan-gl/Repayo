'use client';

import { formatINR } from '@/lib/core/money.js';

export const SEEDED_LOANS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    label: 'Loan #1: Healthy Active',
    description: '₹2,00,000 @ 18% (24m) · 2 instalments paid on time',
    tag: 'HEALTHY',
    tagClass: 'badge-paid',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    label: 'Loan #2: Overdue (Required Case)',
    description: '₹1,50,000 @ 16% (12m) · 1 overdue instalment (11+ days)',
    tag: 'OVERDUE',
    tagClass: 'badge-overdue',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    label: 'Loan #3: Partially Paid',
    description: '₹1,00,000 @ 15% (12m) · Partial payment of ₹5,000 received',
    tag: 'PARTIAL',
    tagClass: 'badge-partial',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    label: 'Loan #4: Fully Settled',
    description: '₹50,000 @ 12% (6m) · Completely cleared',
    tag: 'SETTLED',
    tagClass: 'badge-due',
  },
];

export default function LoanSelector({ selectedLoanId, onSelectLoan, loanDetails }) {
  return (
    <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--c-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select MSME Portfolio Loan
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--c-navy)' }}>
            Active Loan File
          </h2>
        </div>

        {loanDetails && (
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--c-text-muted)' }}>Principal: </span>
              <strong>{formatINR(loanDetails.principalPaise)}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--c-text-muted)' }}>Rate: </span>
              <strong>{loanDetails.annualRatePct}% p.a.</strong>
            </div>
            <div>
              <span style={{ color: 'var(--c-text-muted)' }}>Tenure: </span>
              <strong>{loanDetails.tenureMonths} Months</strong>
            </div>
            <div>
              <span style={{ color: 'var(--c-text-muted)' }}>Disbursed: </span>
              <strong>{loanDetails.disbursementDate}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Preset Loan Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
        {SEEDED_LOANS.map((item) => {
          const isSelected = selectedLoanId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectLoan(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: isSelected
                  ? '2px solid var(--c-navy)'
                  : '1px solid var(--c-sand-border)',
                backgroundColor: isSelected ? 'var(--c-sand-tint)' : 'var(--c-surface)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: isSelected ? 'var(--c-navy)' : 'var(--c-espresso)' }}>
                  {item.label}
                </span>
                <span className={`badge ${item.tagClass}`}>{item.tag}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
