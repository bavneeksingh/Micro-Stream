/**
 * Financial utilities for representing and manipulating currency in integer paise.
 * 1 INR = 100 paise.
 * All monetary amounts in database, state machine, and ledger MUST be integer paise.
 */

export function rupeesToPaise(rupees: number): number {
  if (isNaN(rupees)) {
    throw new Error('Invalid rupee amount: NaN');
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  if (!Number.isInteger(paise)) {
    console.warn(`[CurrencyWarning] Non-integer paise detected: ${paise}. Rounding to integer.`);
    paise = Math.round(paise);
  }
  return paise / 100;
}

export function formatPaise(
  paise: number,
  options: {
    showSymbol?: boolean;
    showPaiseDecimals?: boolean;
    compact?: boolean;
  } = {}
): string {
  const { showSymbol = true, showPaiseDecimals = true, compact = false } = options;
  const rupees = paiseToRupees(paise);

  if (compact && Math.abs(rupees) >= 100000) {
    const inLakhs = (rupees / 100000).toFixed(1);
    return `${showSymbol ? '₹' : ''}${inLakhs}L`;
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showPaiseDecimals ? 2 : 0,
    maximumFractionDigits: showPaiseDecimals ? 2 : 0,
  });

  const formattedRupees = formatter.format(rupees);
  return showSymbol ? `₹${formattedRupees}` : formattedRupees;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}
