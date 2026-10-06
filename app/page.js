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
  const [selectedLoanId, setSelectedLoanId] = useState(SEEDED_LOANS[0].id); // Defaults to Overdue loan
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
        message: `Payment of ${formatINR(paymentResult.payment.amountPaise)} successfully recorded!`,
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
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* 1. Loan Switcher */}
      <LoanSelector
        selectedLoanId={selectedLoanId}
        onSelectLoan={setSelectedLoanId}
        loanDetails={loanView?.loan}
      />

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '50px' }}>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>
            Loading loan data...
          </p>
        </div>
      ) : error ? (
        <div
          className="card"
          style={{
            borderColor: 'var(--c-peach)',
            backgroundColor: 'var(--c-peach-tint)',
            textAlign: 'center',
            padding: '30px',
            marginBottom: '20px',
          }}
        >
          <p style={{ color: 'var(--c-primary)', fontWeight: '600', marginBottom: '12px' }}>
            ⚠️ {error}
          </p>
          <button
            onClick={() => fetchLoanData(selectedLoanId)}
            className="btn btn-primary"
            style={{ padding: '6px 16px' }}
          >
            Retry
          </button>
        </div>
      ) : loanView ? (
        <div className="animate-fade-in">
          {/* 2. Position Cards (Outstanding, Next Due, Overdue) */}
          <PositionCards position={loanView.position} />

          {/* 3. Record Payment Form */}
          <PaymentForm
            loanId={selectedLoanId}
            schedule={loanView.schedule}
            position={loanView.position}
            onPaymentSuccess={handlePaymentSuccess}
            onError={handleError}
          />

          {/* 4. Schedule Table */}
          <ScheduleTable
            schedule={loanView.schedule}
            nextDueSeq={loanView.position?.nextDue?.seq}
          />
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
