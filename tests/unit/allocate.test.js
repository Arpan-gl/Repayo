import { allocatePayment } from '../../lib/core/allocate.js';

describe('Payment Allocation Rules', () => {
  const sampleInstalments = [
    {
      id: 'inst-1',
      seq: 1,
      dueDate: '2026-10-01',
      interestPaise: 300000,   // ₹3,000
      principalPaise: 698600,  // ₹6,986
      totalDuePaise: 998600,   // ₹9,986
      paidInterestPaise: 0,
      paidPrincipalPaise: 0,
    },
    {
      id: 'inst-2',
      seq: 2,
      dueDate: '2026-11-01',
      interestPaise: 290000,
      principalPaise: 708600,
      totalDuePaise: 998600,
      paidInterestPaise: 0,
      paidPrincipalPaise: 0,
    },
    {
      id: 'inst-3',
      seq: 3,
      dueDate: '2026-12-01',
      interestPaise: 280000,
      principalPaise: 718600,
      totalDuePaise: 998600,
      paidInterestPaise: 0,
      paidPrincipalPaise: 0,
    },
  ];

  // Test 6: Underpayment settles interest first, then principal
  test('Underpayment: ₹5,000 against ₹9,986 settles interest (₹3,000) then principal (₹2,000)', () => {
    const result = allocatePayment({
      instalments: sampleInstalments,
      amountPaise: 500000, // ₹5,000
    });

    expect(result.unallocatedPaise).toBe(0);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({
      instalmentId: 'inst-1',
      interestPaidPaise: 300000,  // ₹3,000 interest cleared
      principalPaidPaise: 200000, // ₹2,000 principal settled
    });
  });

  // Test 7: Overpayment (2x EMI) rolls forward to next instalment without schedule re-calculation
  test('Overpayment: 2x EMI settles instalment 1 completely and rolls excess into instalment 2', () => {
    const doubleEmi = 998600 * 2; // 1,997,200 paise
    const result = allocatePayment({
      instalments: sampleInstalments,
      amountPaise: doubleEmi,
    });

    expect(result.unallocatedPaise).toBe(0);
    expect(result.allocations).toHaveLength(2);

    // Instalment 1 fully paid
    expect(result.allocations[0]).toEqual({
      instalmentId: 'inst-1',
      interestPaidPaise: 300000,
      principalPaidPaise: 698600,
    });

    // Instalment 2 fully paid
    expect(result.allocations[1]).toEqual({
      instalmentId: 'inst-2',
      interestPaidPaise: 290000,
      principalPaidPaise: 708600,
    });
  });

  // Test 8: Overpayment exceeding total outstanding is rejected with 422
  test('Payment exceeding total loan outstanding throws OVERPAYMENT_EXCEEDS_OUTSTANDING (422)', () => {
    const totalOutstanding = 998600 * 3; // 2,995,800
    const excessiveAmount = totalOutstanding + 50000; // ₹500 extra

    expect(() => {
      allocatePayment({
        instalments: sampleInstalments,
        amountPaise: excessiveAmount,
      });
    }).toThrow();

    try {
      allocatePayment({
        instalments: sampleInstalments,
        amountPaise: excessiveAmount,
      });
    } catch (err) {
      expect(err.code).toBe('OVERPAYMENT_EXCEEDS_OUTSTANDING');
      expect(err.statusCode).toBe(422);
    }
  });

  // Test 9: Invariant: Money conservation - sum(allocations) === amountPaise
  test('Invariant: sum of all allocation amounts strictly equals the payment amount', () => {
    const amounts = [100000, 350000, 998600, 1500000, 2500000];

    for (const amt of amounts) {
      const res = allocatePayment({
        instalments: sampleInstalments,
        amountPaise: amt,
      });

      const totalAllocated = res.allocations.reduce(
        (sum, a) => sum + a.interestPaidPaise + a.principalPaidPaise,
        0
      );

      expect(totalAllocated).toBe(amt);
    }
  });

  // Test 10: Settle partially paid instalment followed by next instalment
  test('Second payment settles remaining principal on partial instalment first', () => {
    // Instalment 1 was partially paid (300000 I, 200000 P)
    const partiallyPaidInstalments = [
      {
        ...sampleInstalments[0],
        paidInterestPaise: 300000,
        paidPrincipalPaise: 200000, // 498600 remaining on inst-1
      },
      sampleInstalments[1],
    ];

    const result = allocatePayment({
      instalments: partiallyPaidInstalments,
      amountPaise: 600000, // ₹6,000
    });

    // 498,600 clears remainder of inst-1, 101,400 rolls to inst-2 (interest first)
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({
      instalmentId: 'inst-1',
      interestPaidPaise: 0,
      principalPaidPaise: 498600,
    });
    expect(result.allocations[1]).toEqual({
      instalmentId: 'inst-2',
      interestPaidPaise: 101400,
      principalPaidPaise: 0,
    });
  });
});
