'use client';

import { useState, useEffect, useCallback } from 'react';
import AuthGate from '@/components/AuthGate.js';
import LoanSelector, { SEEDED_LOANS } from '@/components/LoanSelector.js';
import PositionCards from '@/components/PositionCards.js';
import ScheduleTable from '@/components/ScheduleTable.js';
import PaymentForm from '@/components/PaymentForm.js';
import Toast from '@/components/Toast.js';
import { formatINR } from '@/lib/core/money.js';
import { auth } from '@/lib/firebaseClient.js';

function LoanDashboard() {
  const [selectedLoanId, setSelectedLoanId] = useState(SEEDED_LOANS[1].id); // Defaults to Overdue loan for reviewer
  const [loanView, setLoanView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchLoanData = useCallback(async (id) => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const res = await fetch(`/api/loans/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || 'Failed to fetch loan details');
      }

      setLoanView(json.data);
    } catch (err) {
      console.error('[Fetch Loan Error]:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanData(selectedLoanId);
  }, [selectedLoanId, fetchLoanData]);

  // Zero-refresh update when payment succeeds
  const handlePaymentSuccess = (paymentResult) => {
    if (paymentResult?.loanView) {
      setLoanView(paymentResult.loanView);
      setToast({
        type: 'success',
        message: `Payment of ${formatINR(paymentResult.payment.amountPaise)} successfully allocated!`,
      });
    } else {
      fetchLoanData(selectedLoanId);
    }
  };

  const handleError = (errMsg) => {
    setToast({
      type: 'error',
      message: errMsg,
    });
  };

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Loan Switcher */}
      <LoanSelector
        selectedLoanId={selectedLoanId}
        onSelectLoan={setSelectedLoanId}
        loanDetails={loanView?.loan}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              margin: '0 auto 12px auto',
              border: '3px solid var(--c-line)',
              borderTopColor: 'var(--c-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>
            Retrieving loan schedule & position...
          </p>
          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      ) : error ? (
        <div
          className="card"
          style={{
            borderColor: 'var(--c-peach)',
            backgroundColor: 'var(--c-primary-light)',
            textAlign: 'center',
            padding: '36px',
          }}
        >
          <h3 style={{ color: 'var(--c-primary)', marginBottom: '8px' }}>
            ⚠️ Error Loading Loan
          </h3>
          <p style={{ color: 'var(--c-espresso)', fontSize: '0.9rem', marginBottom: '16px' }}>
            {error}
          </p>
          <button
            onClick={() => fetchLoanData(selectedLoanId)}
            className="btn btn-primary"
            style={{ padding: '8px 16px' }}
          >
            Retry Fetch
          </button>
        </div>
      ) : loanView ? (
        <div className="animate-fade-in">
          {/* Position Cards */}
          <PositionCards position={loanView.position} />

          {/* Main Grid: Schedule + Payment Form */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 380px',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            <div>
              <ScheduleTable
                schedule={loanView.schedule}
                nextDueSeq={loanView.position?.nextDue?.seq}
              />
            </div>

            <div>
              <PaymentForm
                loanId={selectedLoanId}
                schedule={loanView.schedule}
                position={loanView.position}
                onPaymentSuccess={handlePaymentSuccess}
                onError={handleError}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <LoanDashboard />
    </AuthGate>
  );
}
