import type { TransactionDirection } from "@/lib/bank-analysis/categorize-transaction";
import { addMonths, dateInputValue, formatDate, monthLabel, toNumber } from "@/lib/utils";

export type StatementSummaryRow = {
  transactionDate: Date | null;
  amount: unknown;
  balance: unknown;
  currency: string;
  direction: TransactionDirection;
  status: string;
};

export type StatementSummary = {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  duplicateRows: number;
  totalIn: number;
  totalOut: number;
  netCashFlow: number;
  startDate: string | null;
  endDate: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  currency: string;
};

export type MonthlyCashFlowPoint = {
  month: string;
  label: string;
  income: number;
  expense: number;
  net: number;
};

export function summarizeStatementRows(rows: StatementSummaryRow[], currency = "TRY"): StatementSummary {
  const successfulRows = rows.filter((row) => row.status === "SUCCESS");
  const totalIn = sumDirection(successfulRows, "IN");
  const totalOut = sumDirection(successfulRows, "OUT");
  const datedRows = rows
    .filter((row) => row.transactionDate)
    .sort((a, b) => Number(a.transactionDate) - Number(b.transactionDate));
  const balanceRows = rows.filter((row) => row.balance != null);

  return {
    totalRows: rows.length,
    successfulRows: successfulRows.length,
    failedRows: rows.filter((row) => row.status === "ERROR").length,
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    totalIn,
    totalOut,
    netCashFlow: totalIn - totalOut,
    startDate: datedRows[0]?.transactionDate ? formatDate(datedRows[0].transactionDate) : null,
    endDate: datedRows[datedRows.length - 1]?.transactionDate ? formatDate(datedRows[datedRows.length - 1].transactionDate) : null,
    openingBalance: balanceRows[0]?.balance == null ? null : toNumber(balanceRows[0].balance),
    closingBalance: balanceRows[balanceRows.length - 1]?.balance == null ? null : toNumber(balanceRows[balanceRows.length - 1].balance),
    currency
  };
}

export function buildMonthlyCashFlow(rows: StatementSummaryRow[], anchorDate: Date, months = 12): MonthlyCashFlowPoint[] {
  const start = addMonths(new Date(`${dateInputValue(anchorDate).slice(0, 7)}-01T00:00:00+03:00`), -(months - 1));
  const points = Array.from({ length: months }, (_, index) => {
    const date = addMonths(start, index);
    const month = dateInputValue(date).slice(0, 7);
    return {
      month,
      label: monthLabel(date),
      income: 0,
      expense: 0,
      net: 0
    };
  });
  const pointByMonth = new Map(points.map((point) => [point.month, point]));

  for (const row of rows) {
    if (!row.transactionDate || row.status !== "SUCCESS") continue;
    const point = pointByMonth.get(dateInputValue(row.transactionDate).slice(0, 7));
    if (!point) continue;
    const amount = Math.abs(toNumber(row.amount));
    if (row.direction === "IN") {
      point.income += amount;
    } else if (row.direction === "OUT") {
      point.expense += amount;
    }
    point.net = point.income - point.expense;
  }

  return points.map((point) => ({
    ...point,
    income: roundMoney(point.income),
    expense: roundMoney(point.expense),
    net: roundMoney(point.net)
  }));
}

export function inferAnchorDate(rows: StatementSummaryRow[]) {
  const datedRows = rows
    .filter((row) => row.transactionDate)
    .sort((a, b) => Number(a.transactionDate) - Number(b.transactionDate));
  return datedRows[datedRows.length - 1]?.transactionDate ?? new Date();
}

function sumDirection(rows: StatementSummaryRow[], direction: TransactionDirection) {
  return roundMoney(
    rows
      .filter((row) => row.direction === direction)
      .reduce((total, row) => total + Math.abs(toNumber(row.amount)), 0)
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
