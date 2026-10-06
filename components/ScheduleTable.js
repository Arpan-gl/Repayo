'use client';

import { formatINR } from '@/lib/core/money.js';

export default function ScheduleTable({ schedule, nextDueSeq }) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--c-text-muted)' }}>No repayment schedule found.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--c-line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--c-sand-tint)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--c-navy)' }}>
            Repayment Schedule
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
            {schedule.length} monthly instalments (EMI schedule & live settlement ledger)
          </p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.88rem',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--c-bg)',
                color: 'var(--c-text-muted)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--c-line)',
              }}
            >
              <th style={{ padding: '12px 18px', fontWeight: '700' }}>#</th>
              <th style={{ padding: '12px 18px', fontWeight: '700' }}>Due Date</th>
              <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'right' }}>Principal</th>
              <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'right' }}>Interest</th>
              <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'right' }}>Total Due</th>
              <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'right' }}>Paid Amount</th>
              <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((inst) => {
              const isOverdue = inst.status === 'OVERDUE';
              const isNextDue = inst.seq === nextDueSeq;
              const isPaid = inst.status === 'PAID';
              const isPartial = inst.status === 'PARTIAL';

              const progressPct =
                inst.totalDuePaise > 0
                  ? Math.min(100, Math.round((inst.amountPaidPaise / inst.totalDuePaise) * 100))
                  : 0;

              return (
                <tr
                  key={inst.seq}
                  style={{
                    borderBottom: '1px solid var(--c-line)',
                    backgroundColor: isOverdue
                      ? 'var(--c-primary-light)'
                      : isNextDue
                      ? 'var(--c-peach-tint)'
                      : isPaid
                      ? '#FFFFFF'
                      : 'var(--c-surface)',
                    borderLeft: isOverdue
                      ? '4px solid var(--c-primary)'
                      : isNextDue
                      ? '4px solid var(--c-navy)'
                      : '4px solid transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--c-text-muted)' }}>
                    {inst.seq}
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: '600', color: 'var(--c-espresso)' }}>
                    {inst.dueDate}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--c-text-muted)' }}
                  >
                    {formatINR(inst.principalPaise)}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--c-text-muted)' }}
                  >
                    {formatINR(inst.interestPaise)}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{
                      padding: '14px 18px',
                      textAlign: 'right',
                      fontWeight: '700',
                      color: 'var(--c-espresso)',
                    }}
                  >
                    {formatINR(inst.totalDuePaise)}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{
                      padding: '14px 18px',
                      textAlign: 'right',
                      fontWeight: '700',
                      color: isPaid ? 'var(--c-sage-dark)' : isPartial ? '#b45309' : 'var(--c-text-light)',
                    }}
                  >
                    {formatINR(inst.amountPaidPaise)}
                    {isPartial && (
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          backgroundColor: 'var(--c-line)',
                          borderRadius: '2px',
                          marginTop: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            backgroundColor: '#f59e0b',
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                    <span
                      className={`badge ${
                        isPaid
                          ? 'badge-paid'
                          : isPartial
                          ? 'badge-partial'
                          : isOverdue
                          ? 'badge-overdue'
                          : 'badge-due'
                      }`}
                    >
                      {inst.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
