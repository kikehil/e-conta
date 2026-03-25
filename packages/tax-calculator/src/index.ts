import Decimal from 'decimal.js';

export * from './iva.js';
export * from './payroll-tax.js';

// Initialize decimal.js settings globally for the tax-calculator
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
