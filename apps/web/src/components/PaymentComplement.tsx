import React, { useState } from 'react';
import { FileText, Search, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';

export const PaymentComplement: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('03'); // Transferencia

  // Simulación de facturas PPD en Cartera (Pendientes de Cobro)
  const pendingInvoices = [
    { id: 'uuid-1', series: 'A', folio: '450', rfc: 'CACX7605101P8', name: 'Consultoría Especializada S.A.', total: 116000.00, balance: 116000.00, method: 'PPD' },
    { id: 'uuid-2', series: 'A', folio: '448', rfc: 'XAXX010101000', name: 'Público en General (Crédito)', total: 4500.00, balance: 2000.00, method: 'PPD' }
  ];

  const handleGenerateREP = () => {
    alert('Generando Complemento de Recepción de Pagos (REP) 2.0 y Timbrando en el PAC...');
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Izquierdo: Buscador de Cartera PPD */}
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 flex flex-col h-[600px]">
          <div className="p-6 border-b border-gray-100 bg-surface-low">
            <h3 className="font-bold text-gray-800 uppercase tracking-widest text-xs mb-3">Paso 1: Seleccionar Factura PPD Orginal</h3>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar por Serie, Folio o RFC..." className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none text-sm transition-colors" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {pendingInvoices.map((inv) => (
              <div 
                key={inv.id} 
                onClick={() => setSelectedInvoice(inv.id)}
                className={`p-4 mx-2 my-2 rounded-xl border-2 cursor-pointer transition-all ${selectedInvoice === inv.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-300'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-2">PPD - Saldo Pendiente</span>
                    <h4 className="font-bold font-display text-gray-900">{inv.series}-{inv.folio}</h4>
                    <p className="text-xs text-gray-500 mt-1">{inv.name} <br/> <span className="font-mono">{inv.rfc}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo Insoluto</p>
                    <p className="font-bold tabular-nums text-lg text-rose-600">${inv.balance.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
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
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha de Recepción del Cobro</label>
              <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors font-medium text-gray-800" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Forma de Pago del Cliente</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none transition-colors font-medium text-gray-800 bg-transparent">
                <option value="01">01 - Efectivo</option>
                <option value="02">02 - Cheque nominativo</option>
                <option value="03">03 - Transferencia electrónica de fondos (SPEI)</option>
                <option value="04">04 - Tarjeta de crédito</option>
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
                />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-blue-800">
               <AlertCircle className="w-5 h-5 shrink-0" />
               <p className="text-xs">
                 Al timbrar este REP, el sistema automáticamente generará una póliza de ingreso cargando a Bancos y abonando a Cuentas por Cobrar e IVA Trasladado.
               </p>
            </div>

            <button 
              onClick={handleGenerateREP}
              disabled={!amount}
              className="w-full bg-primary hover:bg-primary-container text-white px-8 py-4 rounded-xl font-bold font-body transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-50 text-lg mt-8"
            >
              <CheckCircle2 className="w-5 h-5" />
              Timbrar Complemento (REP 2.0)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
