import Decimal from 'decimal.js';

// Anexo 8 RMF 2024 - Tabla mensual del ISR
const ISR_TABLE_MONTHLY_2024 = [
  { lower: 0.01,      upper: 746.04,    fixed: 0,       rate: 0.0192 },
  { lower: 746.05,    upper: 6332.05,   fixed: 14.32,   rate: 0.0640 },
  { lower: 6332.06,   upper: 11128.01,  fixed: 371.83,  rate: 0.1088 },
  { lower: 11128.02,  upper: 12935.82,  fixed: 893.63,  rate: 0.1600 },
  { lower: 12935.83,  upper: 15487.71,  fixed: 1182.88, rate: 0.1792 },
  { lower: 15487.72,  upper: 31236.49,  fixed: 1640.18, rate: 0.2136 },
  { lower: 31236.50,  upper: 49233.00,  fixed: 5004.12, rate: 0.2352 },
  { lower: 49233.01,  upper: 93993.90,  fixed: 9236.89, rate: 0.3000 },
  { lower: 93993.91,  upper: 125325.20, fixed: 22665.17, rate: 0.3200 },
  { lower: 125325.21, upper: 375975.61, fixed: 32691.18, rate: 0.3400 },
  { lower: 375975.62, upper: Infinity,  fixed: 117912.32, rate: 0.3500 },
];

export interface PayrollIsrResult {
  lowerLimit: Decimal;
  excess: Decimal;
  marginalTax: Decimal;
  fixedTax: Decimal;
  isrBeforeSubsidy: Decimal;
  employmentSubsidy: Decimal;
  isrNet: Decimal;
}

/**
 * Calculates the monthly ISR tax for a standard employee payroll run.
 * Follows Art. 96 LISR rules using strictly Decimal.js to prevent float rounding errors.
 */
export const calculatePayrollISR = (
  taxableIncome: Decimal, 
  subsidyForEmployment: Decimal = new Decimal(0)
): PayrollIsrResult => {
  const incomeVal = taxableIncome.toNumber();
  
  // Find the correct bracket - scanning backwards to find the first bracket where income > lower limit
  let bracket = ISR_TABLE_MONTHLY_2024[0];
  for (let i = ISR_TABLE_MONTHLY_2024.length - 1; i >= 0; i--) {
    if (incomeVal >= ISR_TABLE_MONTHLY_2024[i].lower) {
      bracket = ISR_TABLE_MONTHLY_2024[i];
      break;
    }
  }

  const lowerLimit = new Decimal(bracket.lower);
  const excess = taxableIncome.minus(lowerLimit).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const marginalTax = excess.mul(new Decimal(bracket.rate)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const fixedTax = new Decimal(bracket.fixed);
  const isrBeforeSubsidy = marginalTax.plus(fixedTax).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  const isrNet = isrBeforeSubsidy.minus(subsidyForEmployment).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return {
    lowerLimit,
    excess,
    marginalTax,
    fixedTax,
    isrBeforeSubsidy,
    employmentSubsidy: subsidyForEmployment,
    isrNet: isrNet.isPositive() ? isrNet : new Decimal(0)
  };
};

export interface ImssEmployeeQuotas {
  health: Decimal;
  disability: Decimal;
  retirement: Decimal;
  total: Decimal;
}

/**
 * Simplistic baseline calculation for IMSS standard employee quotas based purely on SDI.
 */
export const calculateImssEmployee = (sdi: Decimal, daysInPeriod: number): ImssEmployeeQuotas => {
  const sdiTotal = sdi.mul(daysInPeriod);
  
  // Invalidez y Vida (0.625% del SDI base obrera)
  const disability = sdiTotal.mul(new Decimal('0.00625'));
  // Cesantía en edad avanzada y vejez (1.125% SDI)
  const retirement = sdiTotal.mul(new Decimal('0.01125'));
  // Enfermedades y maternidad (varía por excedente de UMAs, simplificado temporalmente)
  const health = new Decimal(0); // This typically requires the 3xUMA floor computation

  const total = disability.plus(retirement).plus(health).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

  return { health, disability, retirement, total };
};
