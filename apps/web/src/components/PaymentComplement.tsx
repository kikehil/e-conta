import React, { useState, useEffect } from 'react';
import { FileText, Search, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface PendingInvoice {
  id: string;
  folio: string;
  series: string | null;
  thirdParty: { razonSocial: string };
  total: number;
  currency: string;
  satUuid: string | null;
}

export const PaymentComplement: React.FC = () => {
  const token = useAuthStore(s => s.token);

  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoice | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('03');
  const [searchQuery, setSearchQuery] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successUuid, setSuccessUuid] = useState<string | null>(null);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/invoices?paymentMethod=PPD&status=STAMPED', {
          headers: authHeaders,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Error ${res.status}`);
        }
        const json = await res.json();
        setInvoices(json.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar facturas PPD');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [token]);

  const filteredInvoices = invoices.filter(inv => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      inv.folio.toLowerCase().includes(q) ||
      (inv.series ?? '').toLowerCase().includes(q) ||
      inv.thirdParty.razonSocial.toLowerCase().includes(q)
    );
  });

  const handleGenerateREP = async () => {
    if (!selectedInvoice || !amount) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessUuid(null);

    const amountNum = parseFloat(amount);

    try {
      const body = {
        invoiceId: selectedInvoice.id,
        paymentDate: date,
        paymentForm: method,
        currency: selectedInvoice.currency ?? 'MXN',
        amount: amountNum,
        relatedCfdi: [
          {
            uuid: selectedInvoice.satUuid,
            partialAmount: amountNum,
            previousBalance: selectedInvoice.total,
            amountPaid: amountNum,
            remainingBalance: Math.max(0, selectedInvoice.total - amountNum),
          },
        ],
      };

      const res = await fetch('/api/payment-complements', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }

      const json = await res.json();
      const uuid = json.data?.satUuid ?? json.data?.id ?? 'N/A';
      setSuccessUuid(uuid);
      // Remove the invoice from the list once paid
      setInvoices(prev => prev.filter(inv => inv.id !== selectedInvoice.id));
      setSelectedInvoice(null);
      setAmount('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al crear complemento de pago');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight flex items-center gap-3">
            <CreditCard className="text-primary-container w-8 h-8" />
            Complementos de Pago (REP 2.0)
          </h2>
          <p className="text-gray-500 mt-2 text-sm">Timbra recibos electrónicos de pago para abonos a facturas PPD.</p>
        </div>
      </div>

      {successUuid && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-5 py-4 rounded-xl text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          Complemento de pago generado correctamente. UUID: <span className="font-mono font-bold">{successUuid}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Izquierdo: Listado de facturas PPD */}
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 flex flex-col h-[600px]">
          <div className="p-6 border-b border-gray-100 bg-surface-low">
            <h3 className="font-bold text-gray-800 uppercase tracking-widest text-xs mb-3">
              Paso 1: Seleccionar Factura PPD Original
            </h3>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por Serie, Folio o Razón Social..."
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none text-sm transition-colors"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="ml-2 text-gray-500 text-sm">Cargando facturas...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex items-center gap-2 m-3 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            {!loading && !error && invoices.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm text-center px-6">
                <FileText className="w-10 h-10 mb-3 text-gray-300" />
                No hay facturas con método de pago PPD pendientes.
              </div>
            )}

            {!loading && !error && invoices.length > 0 && filteredInvoices.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-sm">
                No se encontraron facturas con esa búsqueda.
              </div>
            )}

            {filteredInvoices.map(inv => (
              <div
                key={inv.id}
                onClick={() => { setSelectedInvoice(inv); setSubmitError(null); setSuccessUuid(null); }}
                className={`p-4 mx-2 my-2 rounded-xl border-2 cursor-pointer transition-all ${selectedInvoice?.id === inv.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-2">
                      PPD - Saldo Pendiente
                    </span>
                    <h4 className="font-bold font-display text-gray-900">
                      {inv.series ? `${inv.series}-` : ''}{inv.folio}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{inv.thirdParty.razonSocial}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</p>
                    <p className="font-bold tabular-nums text-lg text-rose-600">
                      ${inv.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lado Derecho: Formulario de Pago */}
        <div className={`bg-surface-lowest rounded-2xl shadow-sm border border-black/5 p-6 transition-opacity ${selectedInvoice ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <h3 className="font-bold text-gray-800 uppercase tracking-widest text-xs mb-6 border-b border-gray-100 pb-4">
            Paso 2: Detalles de Recepción (Nodos Pagos20)
          </h3>

          <div className="space-y-6">
            {selectedInvoice && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                <p className="text-xs text-gray-500 mb-1 uppercase font-semibold tracking-wide">Factura seleccionada</p>
                <p className="font-bold text-gray-900">{selectedInvoice.series ? `${selectedInvoice.series}-` : ''}{selectedInvoice.folio} — {selectedInvoice.thirdParty.razonSocial}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha de Recepción del Cobro</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors font-medium text-gray-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Forma de Pago del Cliente</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors font-medium text-gray-800 bg-transparent"
              >
                <option value="01">01 - Efectivo</option>
                <option value="03">03 - Transferencia electrónica de fondos (SPEI)</option>
                <option value="04">04 - Tarjeta de crédito</option>
                <option value="02">02 - Cheque nominativo</option>
                <option value="28">28 - Tarjeta de débito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monto Pagado (Abono)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 text-xl font-bold font-display tabular-nums border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors"
                  placeholder="0.00"
                  min={0}
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-blue-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs">
                Al timbrar este REP, el sistema automáticamente generará una póliza de ingreso cargando a Bancos y abonando a Cuentas por Cobrar e IVA Trasladado.
              </p>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
              </div>
            )}

            <button
              onClick={handleGenerateREP}
              disabled={!amount || submitting}
              className="w-full bg-primary hover:bg-primary-container text-white px-8 py-4 rounded-xl font-bold font-body transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 text-lg mt-8"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {submitting ? 'Procesando...' : 'Timbrar Complemento (REP 2.0)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
