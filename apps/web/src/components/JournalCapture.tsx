import React, { useState, useMemo, useEffect } from 'react';
import Decimal from 'decimal.js';
import { BookOpen, Plus, Trash2, Save, Send, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface JournalLine {
  id: string;
  account: string;
  debit: string;
  credit: string;
  concept: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  allowsEntries: boolean;
}

const API = '/api';

export const JournalCapture: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [seedingAccounts, setSeedingAccounts] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState('DIARIO');
  const [concept, setConcept] = useState('');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAccounts = async () => {
    const res = await fetch(`${API}/accounts`, { headers });
    if (res.ok) { const j = await res.json(); setAccounts(j.data || []); }
  };

  const handleSeedAccounts = async () => {
    setSeedingAccounts(true);
    const res = await fetch(`${API}/accounts/seed-sat`, { method: 'POST', headers });
    const j = await res.json();
    if (res.ok) { await fetchAccounts(); alert(j.message); }
    else alert(j.error || 'Error al cargar catálogo');
    setSeedingAccounts(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const [lines, setLines] = useState<JournalLine[]>([
    { id: '1', account: '', debit: '0.00', credit: '0.00', concept: '' },
    { id: '2', account: '', debit: '0.00', credit: '0.00', concept: '' },
  ]);

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), account: '', debit: '', credit: '', concept: '' }]);
  };

  const updateLine = (id: string, field: keyof JournalLine, value: string) => {
    setLines(lines.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  // Validación de Partida Doble (Cargos == Abonos)
  const totals = useMemo(() => {
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    lines.forEach(l => {
      try {
        const d = new Decimal(l.debit || 0);
        const c = new Decimal(l.credit || 0);
        totalDebit = totalDebit.plus(d);
        totalCredit = totalCredit.plus(c);
      } catch (e) {
        // Ignorar tipeo incompleto
      }
    });

    const difference = totalDebit.minus(totalCredit);
    const isValid = difference.isZero() && totalDebit.greaterThan(0);

    return {
      totalDebit: totalDebit.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      totalCredit: totalCredit.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      difference: difference.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      isValid
    };
  }, [lines]);

  const formatAmount = (val: Decimal) => val.toNumber().toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight flex items-center gap-3">
            <BookOpen className="text-primary-container w-8 h-8" />
            Captura de Pólizas Contables
          </h2>
          <p className="text-gray-500 mt-2 text-sm">Registro manual de asientos en el Libro Diario (NIF)</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border-2 border-primary/20 font-bold text-primary rounded-xl hover:bg-surface-low transition-colors flex items-center gap-2">
            <Save className="w-4 h-4" /> Borrador
          </button>
        </div>
      </div>

      {accounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-800 text-sm">Sin catálogo de cuentas</p>
            <p className="text-amber-600 text-xs mt-0.5">Esta empresa no tiene plan de cuentas. Carga el catálogo NIF estándar para comenzar.</p>
          </div>
          <button
            onClick={handleSeedAccounts}
            disabled={seedingAccounts}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shrink-0 ml-4"
          >
            <RefreshCw className={`w-4 h-4 ${seedingAccounts ? 'animate-spin' : ''}`} />
            {seedingAccounts ? 'Cargando...' : 'Cargar catálogo NIF'}
          </button>
        </div>
      )}

      <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Fecha de Póliza</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none transition-colors font-medium text-gray-800" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo de Póliza</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none bg-transparent font-medium text-gray-800">
              <option value="INGRESO">Poliza de Ingreso</option>
              <option value="EGRESO">Poliza de Egreso</option>
              <option value="DIARIO">Poliza de Diario</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Concepto General</label>
            <input type="text" value={concept} onChange={e => setConcept(e.target.value)} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none transition-colors text-gray-800" placeholder="Ej: Pago de nómina quincenal correspondiente a..." />
          </div>
        </div>
      </div>

      <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        <div className="bg-surface-low px-6 py-4 flex justify-between items-center border-b border-black/5">
          <h3 className="font-bold text-gray-700 uppercase tracking-widest text-sm">Detalle de Partidas</h3>
          <button onClick={addLine} className="text-primary hover:text-primary-container text-sm font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Agregar Partida
          </button>
        </div>
        
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold border-b border-black/5">
                <th className="px-4 py-3 w-4/12">Cuenta Contable (Catálogo)</th>
                <th className="px-4 py-3 w-4/12">Concepto / Referencia</th>
                <th className="px-4 py-3 w-2/12 text-right">Cargo (Debe)</th>
                <th className="px-4 py-3 w-2/12 text-right">Abono (Haber)</th>
                <th className="px-4 py-3 text-center">X</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l, index) => (
                <tr key={l.id} className="hover:bg-surface-low/30">
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      list="accountsList"
                      value={l.account} 
                      onChange={e => updateLine(l.id, 'account', e.target.value)} 
                      className="w-full px-2 py-1.5 text-sm border-b border-gray-200 focus:border-primary focus:outline-none bg-transparent" 
                      placeholder="102.01 Bancos..." 
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="text" 
                      value={l.concept} 
                      onChange={e => updateLine(l.id, 'concept', e.target.value)} 
                      className="w-full px-2 py-1.5 text-sm border-b border-gray-200 focus:border-primary focus:outline-none bg-transparent" 
                      placeholder="F-1249..." 
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input 
                      type="number" 
                      value={l.debit} 
                      onChange={e => updateLine(l.id, 'debit', e.target.value)} 
                      onFocus={e => l.debit === '0.00' && updateLine(l.id, 'debit', '')}
                      className="w-32 px-2 py-1.5 text-sm text-right border-b border-gray-200 focus:border-primary focus:outline-none font-bold text-gray-900 bg-transparent tabular-nums" 
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input 
                      type="number" 
                      value={l.credit} 
                      onChange={e => updateLine(l.id, 'credit', e.target.value)} 
                      onFocus={e => l.credit === '0.00' && updateLine(l.id, 'credit', '')}
                      className="w-32 px-2 py-1.5 text-sm text-right border-b border-gray-200 focus:border-primary focus:outline-none font-bold text-gray-900 bg-transparent tabular-nums" 
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => removeLine(l.id)} className="text-gray-400 hover:text-rose-500 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <datalist id="accountsList">
            {accounts.filter(a => a.allowsEntries).map(a => (
              <option key={a.id} value={`${a.code} ${a.name}`} />
            ))}
          </datalist>
        </div>

        {/* Footer Sumatorias Totales */}
        <div className="bg-surface-high border-t border-black/5 p-4 flex justify-end gap-12 font-display text-sm">
           <div className="flex items-center gap-6 text-gray-700">
              <span className="uppercase tracking-widest font-bold text-xs">Sumas Iguales:</span>
              <div className="text-right w-32 font-bold tabular-nums text-lg border-b-2 border-gray-400">
                ${formatAmount(totals.totalDebit)}
              </div>
              <div className="text-right w-32 font-bold tabular-nums text-lg border-b-2 border-gray-400">
                ${formatAmount(totals.totalCredit)}
              </div>
           </div>
        </div>

        {/* Advertencia de Descuadre */}
        {!totals.difference.isZero() && (
          <div className="bg-rose-50 p-4 border-t border-rose-100 flex items-center gap-3 text-rose-700">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-semibold text-sm">
              La póliza está descuadrada por <span className="font-bold tabular-nums text-base">${formatAmount(totals.difference.abs())}</span>. No se puede guardar hasta que Cargos y Abonos sean sumas iguales (Partida Doble).
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4">
        <button 
          disabled={!totals.isValid}
          className="bg-primary hover:bg-primary-container text-white px-8 py-4 rounded-xl font-bold font-body transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          <Send className="w-5 h-5" />
          Afectar Registros Contables
        </button>
      </div>
    </div>
  );
};
