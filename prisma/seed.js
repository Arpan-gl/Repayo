import { PrismaClient } from '@prisma/client';
import { generateSchedule } from '../lib/core/schedule.js';
import { allocatePayment } from '../lib/core/allocate.js';

const prisma = new PrismaClient();

function getPastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('🌱 Starting idempotent database seed...');

  // Clean existing allocations, payments, instalments, loans for seed IDs
  const seedIds = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
  ];

  await prisma.allocation.deleteMany({
    where: { payment: { loanId: { in: seedIds } } },
  });
  await prisma.payment.deleteMany({
    where: { loanId: { in: seedIds } },
  });
  await prisma.instalment.deleteMany({
    where: { loanId: { in: seedIds } },
  });
  await prisma.loan.deleteMany({
    where: { id: { in: seedIds } },
  });

  // 1. Healthy Loan (2 instalments paid on time)
  const loan1Id = seedIds[0];
  const loan1Disb = getPastDate(75);
  const sched1 = generateSchedule({
    principalPaise: 20000000,
    annualRatePct: 18.0,
    tenureMonths: 24,
    disbursementDate: loan1Disb,
  });

  await prisma.loan.create({
    data: {
      id: loan1Id,
      principalPaise: 20000000,
      annualRatePct: 18.0,
      tenureMonths: 24,
      disbursementDate: new Date(loan1Disb + 'T00:00:00.000Z'),
      emiPaise: sched1.emiPaise,
      totalPayablePaise: sched1.totalPayablePaise,
      instalments: {
        create: sched1.instalments.map((inst) => ({
          seq: inst.seq,
          dueDate: new Date(inst.dueDate + 'T00:00:00.000Z'),
          principalPaise: inst.principalPaise,
          interestPaise: inst.interestPaise,
          totalDuePaise: inst.totalDuePaise,
        })),
      },
    },
  });

  // Pay instalments 1 and 2
  const inst1_1 = await prisma.instalment.findUnique({
    where: { loanId_seq: { loanId: loan1Id, seq: 1 } },
  });
  const inst1_2 = await prisma.instalment.findUnique({
    where: { loanId_seq: { loanId: loan1Id, seq: 2 } },
  });

  if (inst1_1 && inst1_2) {
    const pay1 = await prisma.payment.create({
      data: {
        loanId: loan1Id,
        amountPaise: inst1_1.totalDuePaise,
        paidOn: new Date(inst1_1.dueDate),
        idempotencyKey: 'seed-pay-1-1',
        requestHash: 'seed-hash-1',
        allocations: {
          create: {
            instalmentId: inst1_1.id,
            interestPaidPaise: inst1_1.interestPaise,
            principalPaidPaise: inst1_1.principalPaise,
          },
        },
      },
    });

    const pay2 = await prisma.payment.create({
      data: {
        loanId: loan1Id,
        amountPaise: inst1_2.totalDuePaise,
        paidOn: new Date(inst1_2.dueDate),
        idempotencyKey: 'seed-pay-1-2',
        requestHash: 'seed-hash-2',
        allocations: {
          create: {
            instalmentId: inst1_2.id,
            interestPaidPaise: inst1_2.interestPaise,
            principalPaidPaise: inst1_2.principalPaise,
          },
        },
      },
    });
  }

  // 2. Overdue Loan (Required Case: Disbursed ~45 days ago, 1st instalment overdue by 15 days)
  const loan2Id = seedIds[1];
  const loan2Disb = getPastDate(45);
  const sched2 = generateSchedule({
    principalPaise: 15000000,
    annualRatePct: 16.0,
    tenureMonths: 12,
    disbursementDate: loan2Disb,
  });

  await prisma.loan.create({
    data: {
      id: loan2Id,
      principalPaise: 15000000,
      annualRatePct: 16.0,
      tenureMonths: 12,
      disbursementDate: new Date(loan2Disb + 'T00:00:00.000Z'),
      emiPaise: sched2.emiPaise,
      totalPayablePaise: sched2.totalPayablePaise,
      instalments: {
        create: sched2.instalments.map((inst) => ({
          seq: inst.seq,
          dueDate: new Date(inst.dueDate + 'T00:00:00.000Z'),
          principalPaise: inst.principalPaise,
          interestPaise: inst.interestPaise,
          totalDuePaise: inst.totalDuePaise,
        })),
      },
    },
  });

  // 3. Partially Paid Loan (Partial payment of ₹5,000 received on instalment 1)
  const loan3Id = seedIds[2];
  const loan3Disb = getPastDate(35);
  const sched3 = generateSchedule({
    principalPaise: 10000000,
    annualRatePct: 15.0,
    tenureMonths: 12,
    disbursementDate: loan3Disb,
  });

  await prisma.loan.create({
    data: {
      id: loan3Id,
      principalPaise: 10000000,
      annualRatePct: 15.0,
      tenureMonths: 12,
      disbursementDate: new Date(loan3Disb + 'T00:00:00.000Z'),
      emiPaise: sched3.emiPaise,
      totalPayablePaise: sched3.totalPayablePaise,
      instalments: {
        create: sched3.instalments.map((inst) => ({
          seq: inst.seq,
          dueDate: new Date(inst.dueDate + 'T00:00:00.000Z'),
          principalPaise: inst.principalPaise,
          interestPaise: inst.interestPaise,
          totalDuePaise: inst.totalDuePaise,
        })),
      },
    },
  });

  const inst3_1 = await prisma.instalment.findUnique({
    where: { loanId_seq: { loanId: loan3Id, seq: 1 } },
  });

  if (inst3_1) {
    // Underpayment: ₹5,000 (500,000 paise). Pays interest first, remainder to principal.
    const iPaid = Math.min(500000, inst3_1.interestPaise);
    const pPaid = 500000 - iPaid;

    await prisma.payment.create({
      data: {
        loanId: loan3Id,
        amountPaise: 500000,
        paidOn: new Date(loan3Disb + 'T00:00:00.000Z'),
        idempotencyKey: 'seed-pay-3-1',
        requestHash: 'seed-hash-3',
        allocations: {
          create: {
            instalmentId: inst3_1.id,
            interestPaidPaise: iPaid,
            principalPaidPaise: pPaid,
          },
        },
      },
    });
  }

  // 4. Fully Settled Loan
  const loan4Id = seedIds[3];
  const loan4Disb = getPastDate(120);
  const sched4 = generateSchedule({
    principalPaise: 5000000,
    annualRatePct: 12.0,
    tenureMonths: 3,
    disbursementDate: loan4Disb,
  });

  await prisma.loan.create({
    data: {
      id: loan4Id,
      principalPaise: 5000000,
      annualRatePct: 12.0,
      tenureMonths: 3,
      disbursementDate: new Date(loan4Disb + 'T00:00:00.000Z'),
      emiPaise: sched4.emiPaise,
      totalPayablePaise: sched4.totalPayablePaise,
      instalments: {
        create: sched4.instalments.map((inst) => ({
          seq: inst.seq,
          dueDate: new Date(inst.dueDate + 'T00:00:00.000Z'),
          principalPaise: inst.principalPaise,
          interestPaise: inst.interestPaise,
          totalDuePaise: inst.totalDuePaise,
        })),
      },
    },
  });

  const inst4List = await prisma.instalment.findMany({
    where: { loanId: loan4Id },
    orderBy: { seq: 'asc' },
  });

  for (const inst of inst4List) {
    await prisma.payment.create({
      data: {
        loanId: loan4Id,
        amountPaise: inst.totalDuePaise,
        paidOn: new Date(inst.dueDate),
        idempotencyKey: `seed-pay-4-${inst.seq}`,
        requestHash: `seed-hash-4-${inst.seq}`,
        allocations: {
          create: {
            instalmentId: inst.id,
            interestPaidPaise: inst.interestPaise,
            principalPaidPaise: inst.principalPaise,
          },
        },
      },
    });
  }

  console.log('✅ Seed completed successfully:');
  console.log('  1. Healthy Loan:', loan1Id);
  console.log('  2. Overdue Loan:', loan2Id);
  console.log('  3. Partially Paid Loan:', loan3Id);
  console.log('  4. Fully Settled Loan:', loan4Id);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
