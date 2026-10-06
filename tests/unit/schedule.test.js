import { calculateEmiPaise } from '../../lib/core/emi.js';
import { generateSchedule, addMonthsClamped } from '../../lib/core/schedule.js';
import { computePosition } from '../../lib/core/position.js';

describe('Schedule & EMI Core Calculations', () => {
  // Test 1: EMI reference case from assignment brief
  test('Verification case: ₹2,00,000 @ 18% over 24 months gives EMI within ±₹2 of ₹9,986', () => {
    const principalPaise = 20000000; // ₹2,00,000
    const annualRatePct = 18.0;
    const tenureMonths = 24;

    const emiPaise = calculateEmiPaise(principalPaise, annualRatePct, tenureMonths);
    const expectedPaise = 998600; // ₹9,986.00

    // Within ±200 paise (±₹2.00)
    expect(Math.abs(emiPaise - expectedPaise)).toBeLessThanOrEqual(200);
  });

  // Test 2: Principal sums exactly across multiple combinations
  test('Invariant: sum of all instalment principal components strictly equals loan principal', () => {
    const testCases = [
      { principalPaise: 5000000, rate: 12.5, tenure: 6 },   // ₹50,000, 6 months
      { principalPaise: 20000000, rate: 18.0, tenure: 24 }, // ₹2,00,000, 24 months
      { principalPaise: 100000000, rate: 15.0, tenure: 36 },// ₹10,00,000, 36 months
      { principalPaise: 7500000, rate: 21.0, tenure: 11 },  // odd tenure & rate
    ];

    for (const tc of testCases) {
      const schedule = generateSchedule({
        principalPaise: tc.principalPaise,
        annualRatePct: tc.rate,
        tenureMonths: tc.tenure,
        disbursementDate: '2026-01-15',
      });

      const sumPrincipal = schedule.instalments.reduce(
        (sum, inst) => sum + inst.principalPaise,
        0
      );

      expect(sumPrincipal).toBe(tc.principalPaise);
      expect(schedule.instalments.length).toBe(tc.tenure);

      // Check each instalment total matches principal + interest
      for (const inst of schedule.instalments) {
        expect(inst.totalDuePaise).toBe(inst.principalPaise + inst.interestPaise);
      }
    }
  });

  // Test 3: Final instalment absorbs rounding remainder
  test('Final instalment absorbs residual rounding: outstanding is 0 at the end', () => {
    const schedule = generateSchedule({
      principalPaise: 20000000,
      annualRatePct: 18.0,
      tenureMonths: 24,
      disbursementDate: '2026-09-01',
    });

    const lastInstalment = schedule.instalments[schedule.instalments.length - 1];
    expect(lastInstalment.seq).toBe(24);

    // Sum of all principal matches loan principal
    const totalPrincipal = schedule.instalments.reduce((acc, i) => acc + i.principalPaise, 0);
    expect(totalPrincipal).toBe(20000000);
  });

  // Test 4: Zero rate loans & Month-end date clamping (31 Jan + 1 month = 28/29 Feb)
  test('Zero rate loans work smoothly, and due dates clamp to valid month-ends', () => {
    // 0% loan
    const zeroRateSchedule = generateSchedule({
      principalPaise: 12000000, // ₹1,20,000
      annualRatePct: 0,
      tenureMonths: 12,
      disbursementDate: '2026-01-31',
    });

    expect(zeroRateSchedule.emiPaise).toBe(1000000); // exactly 10,000 each month
    for (const inst of zeroRateSchedule.instalments) {
      expect(inst.interestPaise).toBe(0);
      expect(inst.principalPaise).toBe(1000000);
    }

    // Month-end clamping check
    // 31 Jan 2026 + 1 month should be 28 Feb 2026 (non-leap year)
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
    // 31 Jan 2026 + 2 months should be 31 Mar 2026
    expect(addMonthsClamped('2026-01-31', 2)).toBe('2026-03-31');
    // 31 Jan 2026 + 3 months should be 30 Apr 2026
    expect(addMonthsClamped('2026-01-31', 3)).toBe('2026-04-30');
  });

  // Test 5: Position computation and overdue handling
  test('Position computes accurate overdue amount and days overdue', () => {
    const mockInstalments = [
      {
        id: 'inst-1',
        seq: 1,
        dueDate: '2026-08-01',
        principalPaise: 700000,
        interestPaise: 300000,
        totalDuePaise: 1000000,
        paidInterestPaise: 300000,
        paidPrincipalPaise: 700000, // fully paid
      },
      {
        id: 'inst-2',
        seq: 2,
        dueDate: '2026-09-01',
        principalPaise: 700000,
        interestPaise: 300000,
        totalDuePaise: 1000000,
        paidInterestPaise: 0,
        paidPrincipalPaise: 0, // unpaid and past due as of 2026-09-12
      },
      {
        id: 'inst-3',
        seq: 3,
        dueDate: '2026-10-01',
        principalPaise: 700000,
        interestPaise: 300000,
        totalDuePaise: 1000000,
        paidInterestPaise: 0,
        paidPrincipalPaise: 0, // future
      },
    ];

    const result = computePosition({
      instalments: mockInstalments,
      asOf: '2026-09-12',
    });

    expect(result.position.status).toBe('OVERDUE');
    expect(result.position.overdueAmountPaise).toBe(1000000);
    expect(result.position.daysOverdue).toBe(11); // 12 Sep - 01 Sep = 11 days
    expect(result.position.nextDue.dueDate).toBe('2026-10-01');
  });
});
