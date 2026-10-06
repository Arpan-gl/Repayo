/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata (IST).
 * @returns {string}
 */
export function getTodayIST() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Computes the real-time position of a loan and enriched schedule statuses.
 *
 * @param {Object} params
 * @param {Array<Object>} params.instalments - List of instalments with paidInterestPaise, paidPrincipalPaise
 * @param {string} [params.asOf] - YYYY-MM-DD date string (defaults to today IST)
 * @returns {Object} { position, schedule }
 */
export function computePosition({ instalments, asOf }) {
  const effectiveAsOf = asOf || getTodayIST();
  const sorted = [...instalments].sort((a, b) => a.seq - b.seq);

  let outstandingPrincipalPaise = 0;
  let overdueAmountPaise = 0;
  let oldestOverdueDate = null;
  let nextDue = null;

  const enrichedSchedule = sorted.map((inst) => {
    const paidI = inst.paidInterestPaise || 0;
    const paidP = inst.paidPrincipalPaise || 0;
    const amountPaidPaise = paidI + paidP;
    const totalDuePaise = inst.totalDuePaise;
    const remainingPaise = Math.max(0, totalDuePaise - amountPaidPaise);
    const principalRemaining = Math.max(0, inst.principalPaise - paidP);

    outstandingPrincipalPaise += principalRemaining;

    // Normalised date string YYYY-MM-DD
    const dueDateStr = typeof inst.dueDate === 'string'
      ? inst.dueDate.split('T')[0]
      : new Date(inst.dueDate).toISOString().split('T')[0];

    const isPastDue = dueDateStr < effectiveAsOf;
    const isDueOrFuture = dueDateStr >= effectiveAsOf;

    let status = 'DUE';
    if (remainingPaise === 0) {
      status = 'PAID';
    } else if (amountPaidPaise > 0) {
      status = isPastDue ? 'OVERDUE' : 'PARTIAL';
    } else if (isPastDue) {
      status = 'OVERDUE';
    }

    if (remainingPaise > 0 && isPastDue) {
      overdueAmountPaise += remainingPaise;
      if (!oldestOverdueDate || dueDateStr < oldestOverdueDate) {
        oldestOverdueDate = dueDateStr;
      }
    }

    if (remainingPaise > 0 && isDueOrFuture && !nextDue) {
      nextDue = {
        seq: inst.seq,
        dueDate: dueDateStr,
        amountPaise: remainingPaise,
      };
    }

    return {
      id: inst.id,
      seq: inst.seq,
      dueDate: dueDateStr,
      principalPaise: inst.principalPaise,
      interestPaise: inst.interestPaise,
      totalDuePaise: inst.totalDuePaise,
      paidInterestPaise: paidI,
      paidPrincipalPaise: paidP,
      amountPaidPaise,
      remainingPaise,
      status,
    };
  });

  // Calculate days overdue from oldest overdue instalment
  let daysOverdue = 0;
  if (oldestOverdueDate) {
    const diffTime = new Date(effectiveAsOf) - new Date(oldestOverdueDate);
    daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Determine overall loan status
  let loanStatus = 'CURRENT';
  if (outstandingPrincipalPaise === 0) {
    loanStatus = 'SETTLED';
  } else if (overdueAmountPaise > 0) {
    loanStatus = 'OVERDUE';
  }

  return {
    schedule: enrichedSchedule,
    position: {
      asOf: effectiveAsOf,
      outstandingPrincipalPaise,
      overdueAmountPaise,
      daysOverdue,
      nextDue,
      status: loanStatus,
    },
  };
}
