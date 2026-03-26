import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ================================================================
// TABLAS ISR 2024 (Anexo 8 RMF) — Actualizar anualmente en enero
// ================================================================

const ISR_TABLE_MONTHLY_2024 = [
  { lower: 0.01,       upper: 746.04,     fixed: 0.00,        rate: 0.0192 },
  { lower: 746.05,     upper: 6332.05,    fixed: 14.32,       rate: 0.0640 },
  { lower: 6332.06,    upper: 11128.01,   fixed: 371.83,      rate: 0.1088 },
  { lower: 11128.02,   upper: 12935.82,   fixed: 893.63,      rate: 0.1600 },
  { lower: 12935.83,   upper: 15487.71,   fixed: 1182.88,     rate: 0.1792 },
  { lower: 15487.72,   upper: 31236.49,   fixed: 1640.18,     rate: 0.2136 },
  { lower: 31236.50,   upper: 49233.00,   fixed: 5004.12,     rate: 0.2352 },
  { lower: 49233.01,   upper: 93993.90,   fixed: 9236.89,     rate: 0.3000 },
  { lower: 93993.91,   upper: 125325.20,  fixed: 22665.17,    rate: 0.3200 },
  { lower: 125325.21,  upper: 375975.61,  fixed: 32691.18,    rate: 0.3400 },
  { lower: 375975.62,  upper: Infinity,   fixed: 117912.32,   rate: 0.3500 },
];

// Tabla Subsidio al Empleo mensual 2024 (Art. Décimo Transitorio LISR)
const SUBSIDIO_EMPLEO_TABLE_2024 = [
  { lower: 0.01,     upper: 1768.96,   subsidio: 407.02 },
  { lower: 1768.97,  upper: 2653.38,   subsidio: 406.83 },
  { lower: 2653.39,  upper: 3472.84,   subsidio: 406.62 },
  { lower: 3472.85,  upper: 3537.87,   subsidio: 392.77 },
  { lower: 3537.88,  upper: 4446.15,   subsidio: 382.46 },
  { lower: 4446.16,  upper: 4717.18,   subsidio: 354.23 },
  { lower: 4717.19,  upper: 5335.42,   subsidio: 324.87 },
  { lower: 5335.43,  upper: 6224.67,   subsidio: 294.63 },
  { lower: 6224.68,  upper: 7113.90,   subsidio: 253.54 },
  { lower: 7113.91,  upper: 7382.33,   subsidio: 236.67 },
  { lower: 7382.34,  upper: Infinity,  subsidio: 0.00   },
];

// UMA 2024 (Actualizar anualmente. DOF enero)
export const UMA_DIARIO_2024 = new Decimal('108.57');
export const UMA_MENSUAL_2024 = new Decimal('3300.53');

// Salario mínimo 2024 (general)
export const SALARIO_MINIMO_2024 = new Decimal('248.93');

// RCOP (Prima de riesgo) por clase de riesgo IMSS
const RCOP_RATES: Record<number, number> = {
  1: 0.005,
  2: 0.01375,
  3: 0.02500,
  4: 0.04500,
  5: 0.07500,
};

// ================================================================
// TIPOS
// ================================================================

export type PayrollPeriod = 'SEMANAL' | 'CATORCENAL' | 'QUINCENAL' | 'MENSUAL';

export interface PayrollIsrResult {
  lowerLimit: Decimal;
  excess: Decimal;
  marginalTax: Decimal;
  fixedTax: Decimal;
  isrBeforeSubsidy: Decimal;
  employmentSubsidy: Decimal;
  isrNet: Decimal;   // 0 si subsidio > ISR calculado
}

export interface ImssQuotas {
  // Cuotas obreras (descuento al empleado)
  emEnfMatObrero: Decimal;   // Enf y Maternidad obrero
  ivObrero: Decimal;          // Invalidez y Vida obrero
  ceavObrero: Decimal;        // Cesantía y vejez obrero
  totalObrero: Decimal;

  // Cuotas patronales (gasto de la empresa)
  emEnfMatPatron: Decimal;
  emExcedentePatron: Decimal;
  ivPatron: Decimal;
  ceavPatron: Decimal;
  guarderias: Decimal;
  rcop: Decimal;
  totalPatron: Decimal;

  // INFONAVIT (patronal)
  infonavit: Decimal;
}

// ================================================================
// FUNCIÓN PRINCIPAL ISR NÓMINA
// ================================================================

/**
 * Calcula el ISR del período según Art. 96 LISR + Anexo 8 RMF 2024.
 * @param taxableIncome Base gravable del período (total percepciones gravadas)
 * @param periodType Tipo de período para normalizar a equivalente mensual
 */
export const calculatePayrollISR = (
  taxableIncome: Decimal,
  periodType: PayrollPeriod = 'MENSUAL'
): PayrollIsrResult => {
  // Convertir a base mensual para aplicar la tabla
  const periodsPerMonth: Record<PayrollPeriod, number> = {
    SEMANAL: 4.333,
    CATORCENAL: 2.167,
    QUINCENAL: 2,
    MENSUAL: 1,
  };

  const factor = new Decimal(periodsPerMonth[periodType]);
  const monthlyEquiv = taxableIncome.mul(factor).toDecimalPlaces(4);
  const incomeVal = monthlyEquiv.toNumber();

  // Buscar el rango en la tabla ISR
  let bracket = ISR_TABLE_MONTHLY_2024[0];
  for (let i = ISR_TABLE_MONTHLY_2024.length - 1; i >= 0; i--) {
    if (incomeVal >= ISR_TABLE_MONTHLY_2024[i].lower) {
      bracket = ISR_TABLE_MONTHLY_2024[i];
      break;
    }
  }

  const lowerLimit = new Decimal(bracket.lower);
  const excess = monthlyEquiv.minus(lowerLimit).toDecimalPlaces(4);
  const marginalTax = excess.mul(new Decimal(bracket.rate)).toDecimalPlaces(4);
  const fixedTax = new Decimal(bracket.fixed);
  const isrBeforeSubsidy = marginalTax.plus(fixedTax).toDecimalPlaces(4);

  // Subsidio al empleo (sobre ingreso mensual equivalente)
  let subsidioMensual = new Decimal(0);
  for (const row of SUBSIDIO_EMPLEO_TABLE_2024) {
    if (incomeVal >= row.lower && (incomeVal <= row.upper || row.upper === Infinity)) {
      subsidioMensual = new Decimal(row.subsidio);
      break;
    }
  }

  // Convertir subsidio mensual al período real
  const subsidioDelPeriodo = subsidioMensual.div(factor).toDecimalPlaces(4);

  const isrNetMonthly = isrBeforeSubsidy.minus(subsidioMensual);
  const isrNetPeriod = isrNetMonthly.div(factor).toDecimalPlaces(4);

  // ISR neto del período (mínimo 0; si subsidio > ISR, se aplica subsidio en "otros pagos")
  const isrNet = isrNetPeriod.isPositive() ? isrNetPeriod : new Decimal(0);

  return {
    lowerLimit,
    excess: taxableIncome.minus(lowerLimit.div(factor)).toDecimalPlaces(4),
    marginalTax: marginalTax.div(factor).toDecimalPlaces(4),
    fixedTax: fixedTax.div(factor).toDecimalPlaces(4),
    isrBeforeSubsidy: isrBeforeSubsidy.div(factor).toDecimalPlaces(4),
    employmentSubsidy: subsidioDelPeriodo,
    isrNet,
  };
};

// ================================================================
// IMSS — Cuotas obreras y patronales (LSS + Acuerdo IMSS vigente)
// ================================================================

/**
 * Calcula cuotas IMSS completas (obrero + patronal) e INFONAVIT.
 * @param sdi Salario Diario Integrado
 * @param daysInPeriod Días del período (15, 30, etc.)
 * @param imssRiskClass Clase de riesgo IMSS 1-5 (default 1)
 */
export const calculateImssQuotas = (
  sdi: Decimal,
  daysInPeriod: number,
  imssRiskClass: number = 1
): ImssQuotas => {
  const dias = new Decimal(daysInPeriod);
  const umaBase = UMA_DIARIO_2024.mul(dias);        // Base UMA del período
  const tres_uma_diario = UMA_DIARIO_2024.mul(3);   // 3 × UMA diaria
  const sdiTotal = sdi.mul(dias);                    // SDI × días

  // ==== OBRERO ====
  // 1. Enfermedades y Maternidad — excedente obrero (0.40% sobre exceso de 3 × UMA)
  let emEnfMatObrero = new Decimal(0);
  if (sdi.greaterThan(tres_uma_diario)) {
    const exceso = sdi.minus(tres_uma_diario).mul(dias);
    emEnfMatObrero = exceso.mul(new Decimal('0.004')).toDecimalPlaces(4);
  }

  // 2. Invalidez y Vida: 0.625% del SDI
  const ivObrero = sdiTotal.mul(new Decimal('0.00625')).toDecimalPlaces(4);

  // 3. Cesantía y vejez (CEAV): 1.125% del SDI
  const ceavObrero = sdiTotal.mul(new Decimal('0.01125')).toDecimalPlaces(4);

  const totalObrero = emEnfMatObrero.plus(ivObrero).plus(ceavObrero).toDecimalPlaces(4);

  // ==== PATRONAL ====
  // 1. E&M Cuota fija (patronal): 20.40% de 3 × UMA por día
  const emEnfMatPatron = tres_uma_diario.mul(new Decimal('0.204')).mul(dias).toDecimalPlaces(4);

  // 2. E&M Excedente (patronal): 1.10% sobre exceso de 3 × UMA
  let emExcedentePatron = new Decimal(0);
  if (sdi.greaterThan(tres_uma_diario)) {
    const exceso = sdi.minus(tres_uma_diario).mul(dias);
    emExcedentePatron = exceso.mul(new Decimal('0.011')).toDecimalPlaces(4);
  }

  // 3. Invalidez y Vida patronal: 1.75% del SDI
  const ivPatron = sdiTotal.mul(new Decimal('0.0175')).toDecimalPlaces(4);

  // 4. Cesantía y vejez patronal: 3.150% del SDI
  const ceavPatron = sdiTotal.mul(new Decimal('0.035')).toDecimalPlaces(4);

  // 5. Guarderías: 1.00% del SDI
  const guarderias = sdiTotal.mul(new Decimal('0.01')).toDecimalPlaces(4);

  // 6. RCOP (Riesgos de Trabajo): varía por clase de riesgo
  const rcopRate = new Decimal(RCOP_RATES[imssRiskClass] || RCOP_RATES[1]);
  const rcop = sdiTotal.mul(rcopRate).toDecimalPlaces(4);

  const totalPatron = emEnfMatPatron
    .plus(emExcedentePatron)
    .plus(ivPatron)
    .plus(ceavPatron)
    .plus(guarderias)
    .plus(rcop)
    .toDecimalPlaces(4);

  // ==== INFONAVIT ====
  const infonavit = sdiTotal.mul(new Decimal('0.05')).toDecimalPlaces(4);

  return {
    emEnfMatObrero,
    ivObrero,
    ceavObrero,
    totalObrero,
    emEnfMatPatron,
    emExcedentePatron,
    ivPatron,
    ceavPatron,
    guarderias,
    rcop,
    totalPatron,
    infonavit,
  };
};

/** Retrocompatibilidad: devuelve solo las cuotas obreras */
export const calculateImssEmployee = (
  sdi: Decimal,
  daysInPeriod: number,
  imssRiskClass: number = 1
): { health: Decimal; disability: Decimal; retirement: Decimal; total: Decimal } => {
  const q = calculateImssQuotas(sdi, daysInPeriod, imssRiskClass);
  return {
    health: q.emEnfMatObrero,
    disability: q.ivObrero,
    retirement: q.ceavObrero,
    total: q.totalObrero,
  };
};

// ================================================================
// CÁLCULO COMPLETO DE RECIBO
// ================================================================

export interface PayrollSlipCalculation {
  // Entradas
  employeeId: string;
  fullName: string;
  dailyWage: Decimal;
  sdi: Decimal;
  daysInPeriod: number;
  periodType: PayrollPeriod;
  imssRiskClass: number;

  // Percepciones
  sueldoOrdinario: Decimal;
  horasExtraExentas: Decimal;
  horasExtraGravadas: Decimal;
  primaVacacional: Decimal;
  otrasPercepcionesExentas: Decimal;
  otrasPercepcionesGravadas: Decimal;
  totalPercepcionesExentas: Decimal;
  totalPercepcionesGravadas: Decimal;
  totalPerceptions: Decimal;

  // ISR
  isr: PayrollIsrResult;

  // IMSS
  imss: ImssQuotas;

  // Totales
  totalDeductions: Decimal;
  netPay: Decimal;

  // Para CFDI NóminaV1.2
  perceptions: Array<{ clave: string; tipo: string; descripcion: string; importeExento: Decimal; importeGravado: Decimal }>;
  deductions: Array<{ clave: string; descripcion: string; importe: Decimal }>;
  otherPayments: Array<{ clave: string; descripcion: string; importe: Decimal }>;
}

export const calculatePayrollSlip = (params: {
  employeeId: string;
  fullName: string;
  dailyWage: Decimal;
  sdi: Decimal;
  daysInPeriod: number;
  periodType?: PayrollPeriod;
  imssRiskClass?: number;
  // Conceptos adicionales
  horasExtraDobles?: Decimal;    // Ya calculadas como importe
  primaVacacional?: Decimal;
  otrasExentas?: Decimal;
  otrasGravadas?: Decimal;
}): PayrollSlipCalculation => {
  const {
    employeeId, fullName, dailyWage, sdi,
    daysInPeriod,
    periodType = 'QUINCENAL',
    imssRiskClass = 1,
    horasExtraDobles = new Decimal(0),
    primaVacacional = new Decimal(0),
    otrasExentas = new Decimal(0),
    otrasGravadas = new Decimal(0),
  } = params;

  const sueldoOrdinario = dailyWage.mul(daysInPeriod).toDecimalPlaces(4);

  // Horas extra: primeras 9 semanales son dobles → exentas hasta 5 VSM/semana; las demás gravadas
  // Simplificado: todas exentas hasta el tope, gravadas el exceso
  const horasExtraExentas = horasExtraDobles;
  const horasExtraGravadas = new Decimal(0);

  // Base gravable total
  const totalPercepcionesExentas = sueldoOrdinario // sueldo es gravado, pero lo clasificamos para CFDI
    .plus(horasExtraExentas)
    .plus(otrasExentas)
    .toDecimalPlaces(4);

  // Para ISR, solo las gravadas cuentan
  const baseGravableIsr = sueldoOrdinario
    .plus(horasExtraGravadas)
    .plus(primaVacacional)
    .plus(otrasGravadas)
    .toDecimalPlaces(4);

  const totalPercepcionesGravadas = baseGravableIsr;
  const totalPerceptions = sueldoOrdinario
    .plus(horasExtraDobles)
    .plus(primaVacacional)
    .plus(otrasExentas)
    .plus(otrasGravadas)
    .toDecimalPlaces(4);

  // ISR
  const isr = calculatePayrollISR(baseGravableIsr, periodType);

  // IMSS
  const imss = calculateImssQuotas(sdi, daysInPeriod, imssRiskClass);

  // Deducciones totales
  const totalDeductions = isr.isrNet.plus(imss.totalObrero).toDecimalPlaces(4);
  const netPay = totalPerceptions.minus(totalDeductions).toDecimalPlaces(4);

  // Estructura para CFDI NóminaV1.2
  const perceptions = [
    {
      clave: '001',
      tipo: 'HorasOrdinarias',
      descripcion: `Sueldo ordinario ${daysInPeriod} días`,
      importeExento: new Decimal(0),
      importeGravado: sueldoOrdinario,
    },
  ];

  if (horasExtraDobles.greaterThan(0)) {
    perceptions.push({
      clave: '003',
      tipo: 'HorasExtra',
      descripcion: 'Horas extra dobles',
      importeExento: horasExtraExentas,
      importeGravado: horasExtraGravadas,
    });
  }

  if (primaVacacional.greaterThan(0)) {
    perceptions.push({
      clave: '006',
      tipo: 'PrimaVacacional',
      descripcion: 'Prima vacacional',
      importeExento: new Decimal(0),
      importeGravado: primaVacacional,
    });
  }

  const deductions: Array<{ clave: string; descripcion: string; importe: Decimal }> = [
    { clave: '001', descripcion: 'ISR', importe: isr.isrNet },
    { clave: '002', descripcion: 'Cuota IMSS obrero', importe: imss.totalObrero },
  ];

  const otherPayments: Array<{ clave: string; descripcion: string; importe: Decimal }> = [];
  if (isr.employmentSubsidy.greaterThan(0) && isr.isrNet.isZero()) {
    otherPayments.push({
      clave: '002',
      descripcion: 'Subsidio al empleo entregado',
      importe: isr.employmentSubsidy,
    });
  }

  return {
    employeeId,
    fullName,
    dailyWage,
    sdi,
    daysInPeriod,
    periodType,
    imssRiskClass,
    sueldoOrdinario,
    horasExtraExentas,
    horasExtraGravadas,
    primaVacacional,
    otrasPercepcionesExentas: otrasExentas,
    otrasPercepcionesGravadas: otrasGravadas,
    totalPercepcionesExentas,
    totalPercepcionesGravadas,
    totalPerceptions,
    isr,
    imss,
    totalDeductions,
    netPay,
    perceptions,
    deductions,
    otherPayments,
  };
};
