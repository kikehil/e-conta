import React, { useState, useMemo } from 'react';
import Decimal from 'decimal.js';
import { calculatePayrollISR, calculateImssEmployee } from '@contasys/tax-calculator';
import { Calculator, FileSignature, AlertCircle } from 'lucide-react';

export const PayrollCalculator: React.FC = () => {
  const [dailyWageStr, setDailyWageStr] = useState('500');
  const [daysStr, setDaysStr] = useState('15');

  // Parse inputs safely
  const dailyWage = useMemo(() => {
    try { return new Decimal(dailyWageStr || 0); } catch { return new Decimal(0); }
  }, [dailyWageStr]);
  const days = useMemo(() => {
    try { return parseInt(daysStr || '0', 10); } catch { return 0; }
  }, [daysStr]);

  // Cálculos base (Integración salarial LSS)
  const factorIntegracion = new Decimal('1.0452');
  const sdi = dailyWage.mul(factorIntegracion).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  
  const totalSueldoOrdinario = dailyWage.mul(days).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalPerceptions = totalSueldoOrdinario; // Base gravable total para este ejemplo

  // Cálculo de Deducciones usando nuestro paquete @contasys/tax-calculator
  const isrResult = useMemo(() => calculatePayrollISR(totalPerceptions), [totalPerceptions]);
  const imssResult = useMemo(() => calculateImssEmployee(sdi, days), [sdi, days]);

  const totalDeductions = isrResult.isrNet.plus(imssResult.total).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const netPay = totalPerceptions.minus(totalDeductions).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const formatCurrency = (val: Decimal | number) => 
    `$${Number(val).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="bg-primary/5 p-6 border-b border-black/5 flex justify-between items-start">
        <div>
          <h3 className="text-xl font-display font-bold text-primary flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary-container" />
            Cálculo de Recibo de Nómina
          </h3>
          <p className="text-sm text-gray-600 mt-1">Simulador en tiempo real de ISR (RMF 2024) e IMSS obrero</p>
        </div>
        
        {/* Input variables globales */}
        <div className="flex gap-4 bg-white p-3 rounded-xl border border-black/5 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Días Pago</label>
            <input 
              type="number" 
              value={daysStr}
              onChange={(e) => setDaysStr(e.target.value)}
              className="w-20 px-3 py-1.5 text-sm border-b-2 border-primary/20 bg-surface-low focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Salario Diario (MXN)</label>
            <input 
              type="number" 
              step="50"
              value={dailyWageStr}
              onChange={(e) => setDailyWageStr(e.target.value)}
              className="w-32 px-3 py-1.5 text-sm border-b-2 border-primary/20 bg-surface-low focus:border-primary focus:outline-none font-bold text-primary transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 flex gap-8 items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">SDI Calculado:</span>
            <span className="font-bold text-gray-900">{formatCurrency(sdi)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Factor Integración:</span>
            <span className="font-bold text-gray-900 border px-2 py-0.5 rounded text-xs">1.0452</span>
          </div>
        </div>

        {/* Ledger Layout: Dos columnas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/5 border border-black/5 rounded-xl overflow-hidden">
          
          {/* PERCEPCIONES */}
          <div className="bg-white p-6">
            <h4 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-4 border-b border-emerald-100 pb-2">Percepciones</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 font-medium">Sueldo Ordinario ({days} días)</span>
                <span className="font-bold text-gray-900">{formatCurrency(totalSueldoOrdinario)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Horas Extra (Exentas)</span>
                <span className="font-medium text-gray-400">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Prima Vacacional</span>
                <span className="font-medium text-gray-400">$0.00</span>
              </div>
            </div>
            
            <div className="mt-8 pt-4 border-t border-black/5 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Percepciones</span>
              <span className="text-lg font-display font-bold text-emerald-600">{formatCurrency(totalPerceptions)}</span>
            </div>
          </div>

          {/* DEDUCCIONES */}
          <div className="bg-white p-6">
            <h4 className="text-sm font-semibold text-rose-700 uppercase tracking-wider mb-4 border-b border-rose-100 pb-2">Deducciones (Retenciones)</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 font-medium">ISR Retenido (Art. 96 LISR)</span>
                <span className="font-bold text-gray-900">{formatCurrency(isrResult.isrNet)}</span>
              </div>
              
              {/* Desglose ISR colapsado visualmente */}
              <div className="pl-4 border-l-2 border-gray-100 space-y-1 mb-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>- Límite Inferior ({formatCurrency(isrResult.lowerLimit)})</span>
                  <span>Exc: {formatCurrency(isrResult.excess)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>- Impuesto Marginal</span>
                  <span>{formatCurrency(isrResult.marginalTax)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>- Cuota Fija</span>
                  <span>{formatCurrency(isrResult.fixedTax)}</span>
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-700 font-medium">Cuota IMSS Obrero</span>
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                </div>
                <span className="font-bold text-gray-900">{formatCurrency(imssResult.total)}</span>
              </div>

              <div className="pl-4 border-l-2 border-gray-100 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>- Invalidez y Vida (0.625%)</span>
                  <span>{formatCurrency(imssResult.disability)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>- Cesantía (1.125%)</span>
                  <span>{formatCurrency(imssResult.retirement)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-black/5 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total Deducciones</span>
              <span className="text-lg font-display font-bold text-rose-600">{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* FOOTER TOTAL NETO */}
        <div className="mt-6 bg-surface-low rounded-xl p-6 flex flex-col md:flex-row justify-between items-center border border-black/5 gap-4">
          <div>
            <span className="block text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Neto a Recibir</span>
            <span className="text-4xl font-display font-extrabold text-primary tabular-nums tracking-tight">
              {formatCurrency(netPay)}
            </span>
          </div>
          
          <button className="bg-primary hover:bg-primary-container text-white px-6 py-3 rounded-xl font-bold font-body transition-colors flex items-center gap-2 shadow-sm">
            <FileSignature className="w-5 h-5" />
            Timbrar CFDI NóminaV1.2
          </button>
        </div>
      </div>
    </div>
  );
};
