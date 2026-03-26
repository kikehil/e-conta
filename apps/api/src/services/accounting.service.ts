import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Códigos SAT agrupadores para localizar cuentas contables
const SAT_CODES = {
  CAJA:                    '110.01',
  BANCOS:                  '110.02',
  CLIENTES:                '120.01',
  IVA_ACREDITABLE:         '216.10',
  IVA_TRASLADADO:          '216.01',
  IVA_POR_PAGAR:           '216.03',
  PROVEEDORES:             '210.01',
  INGRESOS_VENTAS:         '401',
  INGRESOS_SERVICIOS:      '402',
  SUELDOS_SALARIOS:        '610',
  CUOTAS_IMSS_PATRON:      '611',
  DEPRECIACION:            '160',
  ISR_POR_PAGAR:           '216.02',
};

type TxClient = Prisma.TransactionClient;

/**
 * Busca una cuenta contable por satGroupCode o por code.
 * Lanza error si no existe (indica que el catálogo no está configurado).
 */
async function findAccount(tx: TxClient, companyId: string, code: string) {
  const account = await tx.account.findFirst({
    where: {
      companyId,
      OR: [{ satGroupCode: code }, { code }],
      isActive: true,
    },
  });
  return account;
}

/**
 * Asegura que exista el período fiscal para una fecha dada.
 * Crea FiscalYear y Period si no existen.
 */
export async function ensurePeriod(
  tx: TxClient,
  companyId: string,
  date: Date
): Promise<string> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  let fiscalYear = await tx.fiscalYear.findFirst({ where: { companyId, year } });
  if (!fiscalYear) {
    fiscalYear = await tx.fiscalYear.create({
      data: { companyId, year, status: 'OPEN' },
    });
  }

  let period = await tx.period.findFirst({ where: { companyId, year, month } });
  if (!period) {
    period = await tx.period.create({
      data: { companyId, fiscalYearId: fiscalYear.id, year, month, status: 'OPEN' },
    });
  }

  return period.id;
}

// ================================================================
// FACTURAS EMITIDAS (CFDI Ingreso/Egreso)
// ================================================================

export const generateInvoiceJournalEntry = async (
  tx: TxClient,
  invoice: {
    id: string;
    companyId: string;
    thirdPartyId: string;
    issueDate: Date;
    paymentMethod: string;  // PUE | PPD
    subtotal: Decimal | number;
    taxesTransferred: Decimal | number;
    taxesWithheld: Decimal | number;
    total: Decimal | number;
    series?: string | null;
    folio: string;
    createdBy: string;
  }
): Promise<string> => {
  const companyId = invoice.companyId;
  const periodId = await ensurePeriod(tx, companyId, new Date(invoice.issueDate));

  const total = new Decimal(invoice.total.toString());
  const subtotal = new Decimal(invoice.subtotal.toString());
  const iva = new Decimal(invoice.taxesTransferred.toString());
  const retenciones = new Decimal(invoice.taxesWithheld.toString());

  const isPue = invoice.paymentMethod === 'PUE';

  // Localizar cuentas
  const cuentaDeudora = await findAccount(tx, companyId, isPue ? SAT_CODES.BANCOS : SAT_CODES.CLIENTES);
  const cuentaIngresos = await findAccount(tx, companyId, SAT_CODES.INGRESOS_SERVICIOS)
    || await findAccount(tx, companyId, SAT_CODES.INGRESOS_VENTAS);
  const cuentaIva = await findAccount(tx, companyId, SAT_CODES.IVA_TRASLADADO);

  const folio = `${invoice.series || ''}${invoice.folio}`;

  const entry = await tx.journalEntry.create({
    data: {
      companyId,
      periodId,
      entryDate: new Date(invoice.issueDate),
      reference: folio,
      description: `Factura emitida ${folio}`,
      entryType: 'FACTURA_EMITIDA',
      sourceId: invoice.id,
      sourceType: 'CFDI',
      status: 'POSTED',
      createdBy: invoice.createdBy,
      postedBy: invoice.createdBy,
      postedAt: new Date(),
    },
  });

  const lines: any[] = [];
  let lineNumber = 1;

  // CARGO: Total a Clientes (PPD) o Bancos (PUE)
  if (cuentaDeudora) {
    lines.push({
      entryId: entry.id,
      companyId,
      accountId: cuentaDeudora.id,
      debit: total.toDecimalPlaces(4).toNumber(),
      credit: 0,
      description: `${isPue ? 'Cobro inmediato' : 'CxC'} ${folio}`,
      thirdPartyId: invoice.thirdPartyId,
      lineNumber: lineNumber++,
      currency: 'MXN',
      exchangeRate: 1,
      amountMxn: total.toDecimalPlaces(4).toNumber(),
    });
  }

  // ABONO: Ingresos (subtotal)
  if (cuentaIngresos) {
    lines.push({
      entryId: entry.id,
      companyId,
      accountId: cuentaIngresos.id,
      debit: 0,
      credit: subtotal.toDecimalPlaces(4).toNumber(),
      description: `Ingreso factura ${folio}`,
      lineNumber: lineNumber++,
      currency: 'MXN',
      exchangeRate: 1,
      amountMxn: subtotal.toDecimalPlaces(4).toNumber(),
    });
  }

  // ABONO: IVA trasladado
  if (iva.greaterThan(0) && cuentaIva) {
    lines.push({
      entryId: entry.id,
      companyId,
      accountId: cuentaIva.id,
      debit: 0,
      credit: iva.toDecimalPlaces(4).toNumber(),
      description: `IVA trasladado ${folio}`,
      lineNumber: lineNumber++,
      currency: 'MXN',
      exchangeRate: 1,
      amountMxn: iva.toDecimalPlaces(4).toNumber(),
    });
  }

  // Si hay retenciones (ISR/IVA retenido): CARGO a ISR/IVA retenido por cobrar
  if (retenciones.greaterThan(0)) {
    const cuentaRet = await findAccount(tx, companyId, SAT_CODES.ISR_POR_PAGAR);
    if (cuentaRet) {
      lines.push({
        entryId: entry.id,
        companyId,
        accountId: cuentaRet.id,
        debit: retenciones.toDecimalPlaces(4).toNumber(),
        credit: 0,
        description: `Retenciones factura ${folio}`,
        lineNumber: lineNumber++,
        currency: 'MXN',
        exchangeRate: 1,
        amountMxn: retenciones.toDecimalPlaces(4).toNumber(),
      });
    }
  }

  if (lines.length > 0) {
    await tx.journalLine.createMany({ data: lines });
  }

  return entry.id;
};

// ================================================================
// FACTURAS RECIBIDAS (Bills / CxP)
// ================================================================

export const generateBillJournalEntry = async (
  tx: TxClient,
  bill: {
    id: string;
    companyId: string;
    thirdPartyId: string;
    issueDate: Date;
    subtotal: Decimal | number;
    taxesTransferred: Decimal | number;
    taxesWithheld: Decimal | number;
    total: Decimal | number;
    vatCreditable: Decimal | number;
    satUuid: string;
    createdBy: string;
  }
): Promise<string> => {
  const companyId = bill.companyId;
  const periodId = await ensurePeriod(tx, companyId, new Date(bill.issueDate));

  const total = new Decimal(bill.total.toString());
  const subtotal = new Decimal(bill.subtotal.toString());
  const ivaAcreditable = new Decimal(bill.vatCreditable.toString());

  const cuentaProveedor = await findAccount(tx, companyId, SAT_CODES.PROVEEDORES);
  const cuentaGasto = await findAccount(tx, companyId, SAT_CODES.INGRESOS_VENTAS); // fallback
  const cuentaIvaAcreditable = await findAccount(tx, companyId, SAT_CODES.IVA_ACREDITABLE);

  const entry = await tx.journalEntry.create({
    data: {
      companyId,
      periodId,
      entryDate: new Date(bill.issueDate),
      reference: bill.satUuid.substring(0, 8).toUpperCase(),
      description: `Factura recibida ${bill.satUuid.substring(0, 8).toUpperCase()}`,
      entryType: 'FACTURA_RECIBIDA',
      sourceId: bill.id,
      sourceType: 'CFDI',
      status: 'POSTED',
      createdBy: bill.createdBy,
      postedBy: bill.createdBy,
      postedAt: new Date(),
    },
  });

  const lines: any[] = [];
  let lineNumber = 1;

  // CARGO: Gasto (subtotal)
  if (cuentaGasto) {
    lines.push({
      entryId: entry.id, companyId,
      accountId: cuentaGasto.id,
      debit: subtotal.toDecimalPlaces(4).toNumber(), credit: 0,
      description: 'Gasto deducible',
      thirdPartyId: bill.thirdPartyId,
      lineNumber: lineNumber++,
      currency: 'MXN', exchangeRate: 1,
      amountMxn: subtotal.toDecimalPlaces(4).toNumber(),
    });
  }

  // CARGO: IVA acreditable
  if (ivaAcreditable.greaterThan(0) && cuentaIvaAcreditable) {
    lines.push({
      entryId: entry.id, companyId,
      accountId: cuentaIvaAcreditable.id,
      debit: ivaAcreditable.toDecimalPlaces(4).toNumber(), credit: 0,
      description: 'IVA acreditable',
      lineNumber: lineNumber++,
      currency: 'MXN', exchangeRate: 1,
      amountMxn: ivaAcreditable.toDecimalPlaces(4).toNumber(),
    });
  }

  // ABONO: Proveedor (total)
  if (cuentaProveedor) {
    lines.push({
      entryId: entry.id, companyId,
      accountId: cuentaProveedor.id,
      debit: 0, credit: total.toDecimalPlaces(4).toNumber(),
      description: 'CxP proveedor',
      thirdPartyId: bill.thirdPartyId,
      lineNumber: lineNumber++,
      currency: 'MXN', exchangeRate: 1,
      amountMxn: total.toDecimalPlaces(4).toNumber(),
    });
  }

  if (lines.length > 0) {
    await tx.journalLine.createMany({ data: lines });
  }

  return entry.id;
};

// ================================================================
// NÓMINA
// ================================================================

export const generatePayrollJournalEntry = async (
  tx: TxClient,
  run: {
    id: string;
    companyId: string;
    periodStart: Date;
    totalPerceptions: Decimal | number;
    totalIsrWithheld: Decimal | number;
    totalImssEmployee: Decimal | number;
    totalImssEmployer: Decimal | number;
    totalInfonavit: Decimal | number;
    totalNetPay: Decimal | number;
    createdBy: string;
  }
): Promise<string> => {
  const companyId = run.companyId;
  const periodId = await ensurePeriod(tx, companyId, new Date(run.periodStart));

  const totalPerceptions = new Decimal(run.totalPerceptions.toString());
  const isr = new Decimal(run.totalIsrWithheld.toString());
  const imssObrero = new Decimal(run.totalImssEmployee.toString());
  const imssPatron = new Decimal(run.totalImssEmployer.toString());
  const infonavit = new Decimal(run.totalInfonavit.toString());
  const netPay = new Decimal(run.totalNetPay.toString());

  const cuentaSueldos = await findAccount(tx, companyId, SAT_CODES.SUELDOS_SALARIOS);
  const cuentaImssPatron = await findAccount(tx, companyId, SAT_CODES.CUOTAS_IMSS_PATRON);
  const cuentaIsrPorPagar = await findAccount(tx, companyId, SAT_CODES.ISR_POR_PAGAR);
  const cuentaBancos = await findAccount(tx, companyId, SAT_CODES.BANCOS);

  const entry = await tx.journalEntry.create({
    data: {
      companyId, periodId,
      entryDate: new Date(run.periodStart),
      description: 'Póliza de nómina',
      entryType: 'NOMINA',
      sourceId: run.id,
      sourceType: 'PAYROLL_RUN',
      status: 'POSTED',
      createdBy: run.createdBy,
      postedBy: run.createdBy,
      postedAt: new Date(),
    },
  });

  const lines: any[] = [];
  let lineNumber = 1;

  const addLine = (accountId: string | undefined, debit: number, credit: number, desc: string) => {
    if (!accountId || (debit === 0 && credit === 0)) return;
    lines.push({
      entryId: entry.id, companyId, accountId,
      debit, credit,
      description: desc,
      lineNumber: lineNumber++,
      currency: 'MXN', exchangeRate: 1,
      amountMxn: debit || credit,
    });
  };

  // CARGO: Sueldos y salarios
  addLine(cuentaSueldos?.id, totalPerceptions.toNumber(), 0, 'Sueldos y salarios');
  // CARGO: Cuotas IMSS patronal
  addLine(cuentaImssPatron?.id, imssPatron.plus(infonavit).toNumber(), 0, 'IMSS patronal + INFONAVIT');
  // ABONO: ISR retenido por pagar
  addLine(cuentaIsrPorPagar?.id, 0, isr.toNumber(), 'ISR retenido nómina');
  // ABONO: IMSS obrero (retención)
  addLine(cuentaIsrPorPagar?.id, 0, imssObrero.toNumber(), 'IMSS obrero retenido');
  // ABONO: Bancos (neto pagado)
  addLine(cuentaBancos?.id, 0, netPay.toNumber(), 'Pago neto nómina');

  if (lines.length > 0) {
    await tx.journalLine.createMany({ data: lines });
  }

  return entry.id;
};
