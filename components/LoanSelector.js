'use client';

import { formatINR } from '@/lib/core/money.js';

export const SEEDED_LOANS = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Loan 2 — Overdue (Required Case)',
    tag: 'OVERDUE',
    tagClass: 'badge-overdue',
  },
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Loan 1 — Healthy Active (2 Paid)',
    tag: 'HEALTHY',
    tagClass: 'badge-paid',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Loan 3 — Partially Paid',
    tag: 'PARTIAL',
    tagClass: 'badge-partial',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Loan 4 — Fully Settled',
    tag: 'SETTLED',
    tagClass: 'badge-due',
  },
];

export default function LoanSelector({ selectedLoanId, onSelectLoan, loanDetails }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--c-line)',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label
          htmlFor="loan-select"
          style={{
            fontSize: '0.88rem',
            fontWeight: '700',
            color: 'var(--c-navy)',
          }}
        >
          Select Loan:
        </label>
        <select
          id="loan-select"
          value={selectedLoanId}
          onChange={(e) => onSelectLoan(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--c-sand-border)',
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'var(--c-espresso)',
            backgroundColor: 'var(--c-bg)',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {SEEDED_LOANS.map((loan) => (
            <option key={loan.id} value={loan.id}>
              {loan.name}
            </option>
          ))}
        </select>
      </div>

      {loanDetails && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.83rem',
            color: 'var(--c-text-muted)',
          }}
        >
          <span>Principal: <strong style={{ color: 'var(--c-espresso)' }}>{formatINR(loanDetails.principalPaise)}</strong></span>
          <span>•</span>
          <span>Rate: <strong style={{ color: 'var(--c-espresso)' }}>{loanDetails.annualRatePct}% p.a.</strong></span>
          <span>•</span>
          <span>Tenure: <strong style={{ color: 'var(--c-espresso)' }}>{loanDetails.tenureMonths} Mo</strong></span>
          <span>•</span>
          <span>Disbursed: <strong style={{ color: 'var(--c-espresso)' }}>{loanDetails.disbursementDate}</strong></span>
        </div>
      )}
    </div>
  );
}
