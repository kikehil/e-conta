import Decimal from 'decimal.js';

export const VAT_RATES = {
  GENERAL: new Decimal('0.16'),
  BORDER: new Decimal('0.08'),
  ZERO: new Decimal('0.00'),
  EXEMPT: null, // Exempt implies no tax object calculation
};

export interface VatCalculationResult {
  vatTransferred: Decimal;
  vatCreditable: Decimal;
  vatPayable: Decimal;
  vatInFavor: Decimal;
}

/**
 * Calculates the VAT to be paid to the SAT for a given period.
 * Formulates the diff between transferred (collected from sales) and creditable (paid on expenses).
 */
export const calculateVATPayable = (
  transferredAmount: Decimal,
  creditableAmount: Decimal
): VatCalculationResult => {
  const difference = transferredAmount.minus(creditableAmount);

  return {
    vatTransferred: transferredAmount,
    vatCreditable: creditableAmount,
    vatPayable: difference.isPositive() ? difference : new Decimal(0),
    vatInFavor: difference.isNegative() ? difference.abs() : new Decimal(0),
  };
};

/**
 * Applies IVA to a subtotal line item
 */
export const applyItemVAT = (subtotal: Decimal, rate: Decimal | null): Decimal => {
  if (rate === null) return new Decimal(0);
  return subtotal.mul(rate).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
};
