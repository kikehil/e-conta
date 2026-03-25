import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';

// Simulamos los códigos agrupadores del SAT (Anexo 24) para buscar las cuentas contables de la empresa
const SAT_CODES = {
  BANCOS: '102.01',
  CLIENTES: '105.01',
  IVA_TRASLADADO_COBRADO: '208.01',
  IVA_TRASLADADO_NO_COBRADO: '209.01',
  INGRESOS_POR_SERVICIOS: '401.01'
};

/**
 * Automates double-entry bookkeeping for an Income Invoice (CFDI Ingreso).
 * Runs seamlessly inside the same PostgreSQL transaction block.
 */
export const generateInvoiceJournalEntry = async (
  tx: Prisma.TransactionClient,
  invoice: any
): Promise<void> => {
  // 1. Obtener la configuración o cuentas contables base de la compañía
  // En producción, esto busca las cuentas verdaderas que el Contador mapeó para esa empresa.
  // Por ahora simulamos la búsqueda devolviendo UUIDs o IDs para construir la póliza.
  
  const companyId = invoice.companyId;

  // Resoluciones de cuenta (Mock simple de búsqueda por Código Mapeado)
  // ej: const clientsAccount = await tx.account.findFirst({ where: { companyId, satCode: SAT_CODES.CLIENTES } });

  // PUE = Cobrado al instante (Bancos e IVA Cobrado)
  // PPD = A crédito (Clientes e IVA No Cobrado)
  const isPue = invoice.paymentMethod === 'PUE';
  const debitAccountCode = isPue ? SAT_CODES.BANCOS : SAT_CODES.CLIENTES;
  const ivaAccountCode = isPue ? SAT_CODES.IVA_TRASLADADO_COBRADO : SAT_CODES.IVA_TRASLADADO_NO_COBRADO;
  
  // Totales extraídos de la factura
  const totalInvoice = new Decimal(invoice.total);
  const subtotalInvoice = new Decimal(invoice.subtotal);
  const totalIva = new Decimal(invoice.totalIva);

  // 2. Crear la Póliza (Journal Entry) Header
  const journalEntry = await tx.journalEntry.create({
    data: {
      companyId: companyId,
      fiscalYearId: invoice.fiscalYearId, // Requiere relación validada
      periodId: invoice.periodId, // Requiere relación validada
      entryDate: new Date(),
      type: 'DIARIO', // Póliza de Diario (o INGRESO si es PUE estricto)
      status: 'POSTED',
      concept: `Provisión de CFDI ${invoice.series || ''} ${invoice.folio || 'N/A'} - ${invoice.receiverName}`,
      sourceModule: 'INVOICING',
      sourceDocumentId: invoice.id,
      createdBy: invoice.createdBy
    }
  });

  // 3. Crear las líneas de Partida Doble (Cargos y Abonos)
  // REGLA NIF BASE: Cargo = Abonos (El asiento debe cuadrar a 0)

  const lineItems: any[] = [];
  
  // LÍNEA 1: CARGO (Débito) a Clientes o Bancos por el Total Facturado
  lineItems.push({
    journalEntryId: journalEntry.id,
    accountId: 'uuid-cuenta-de-clientes-o-bancos', // En prod: debitAccount.id
    type: 'DEBIT',
    amount: totalInvoice,
    reference: `Factura ${invoice.id}`,
    concept: `Cargo por Facturación a ${invoice.receiverName}`
  });

  // LÍNEA 2: ABONO (Crédito) a Ingresos/Ventas por el Subtotal Exento de Impuestos
  lineItems.push({
    journalEntryId: journalEntry.id,
    accountId: 'uuid-cuenta-de-ingresos', // En prod: targetRevenueAccount.id
    type: 'CREDIT',
    amount: subtotalInvoice,
    reference: `Factura ${invoice.id}`,
    concept: `Ingreso por Venta/Servicio`
  });

  // LÍNEA 3: ABONO (Crédito) al Pasivo de IVA por Pagar al SAT
  if (totalIva.greaterThan(0)) {
    lineItems.push({
      journalEntryId: journalEntry.id,
      accountId: 'uuid-cuenta-de-iva-trasladado', // En prod: targetIvaAccount.id
      type: 'CREDIT',
      amount: totalIva,
      reference: `Factura ${invoice.id}`,
      concept: isPue ? 'IVA Trasladado efectivamente cobrado' : 'IVA Trasladado pendiente de cobro'
    });
  }

  // 4. Inserción Masiva Sub-líneas
  await tx.journalLine.createMany({
    data: lineItems.map((line) => ({
      journalEntryId: line.journalEntryId,
      accountId: line.accountId,
      type: line.type,
      amount: line.amount.toNumber(),
      reference: line.reference,
      concept: line.concept
    }))
  });
  
  // ¡Validación de Cuadratura Automática! (Sum(Cargos) == Sum(Abonos))
  // Opcional: Levantar un error de Rollback si las líneas no cuadran por un centavo.
};
