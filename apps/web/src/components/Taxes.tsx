import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';

const API = '/api';
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

type TaxTab = 'vat' | 'diot' | 'isr';

export const TaxesView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [tab, setTab] = useState<TaxTab>('vat');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [vatData, setVatData] = useState<any>(null);
  const [diotData, setDiotData] = useState<any[]>([]);
  const [isrData, setIsrData] = useState<any>(null);
  const [calcMsg, setCalcMsg] = useState('');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchVat = async () => {
    setLoading(true); setVatData(null);
    const res = await fetch(`${API}/taxes/${year}/${month}/vat-summary`, { headers });
    if (res.ok) { const j = await res.json(); setVatData(j.data); }
    else { const j = await res.json(); alert(j.error); }
    setLoading(false);
  };

  const fetchDiot = async () => {
    setLoading(true); setDiotData([]);
    const res = await fetch(`${API}/taxes/${year}/${month}/diot`, { headers });
    if (res.ok) { const j = await res.json(); setDiotData(j.data); }
    setLoading(false);
  };

  const calcDiot = async () => {
    setLoading(true); setCalcMsg('');
    const res = await fetch(`${API}/taxes/${year}/${month}/diot/calculate`, { method: 'POST', headers });
    const j = await res.json();
    if (res.ok) { setCalcMsg(j.message); fetchDiot(); }
    else { alert(j.error); }
    setLoading(false);
  };

  const exportDiot = () => {
    window.open(`${API}/taxes/${year}/${month}/diot/export`, '_blank');
  };

  const fetchIsr = async () => {
    setLoading(true); setIsrData(null);
    const res = await fetch(`${API}/taxes/${year}/${month}/isr-provisional`, { headers });
    if (res.ok) { const j = await res.json(); setIsrData(j.data); }
    else { const j = await res.json(); alert(j.error); }
    setLoading(false);
  };

  const handleSearch = () => {
    if (tab === 'vat') fetchVat();
    else if (tab === 'diot') fetchDiot();
    else fetchIsr();
  };

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-display font-extrabold text-primary">Impuestos y Declaraciones</h2>
        <p className="text-gray-500 text-sm mt-1">IVA, DIOT (A-29), ISR Provisional — Obligaciones SAT</p>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Año:</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Mes:</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {loading ? 'Consultando...' : 'Consultar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {[
          { id: 'vat', label: 'IVA Mensual' },
          { id: 'diot', label: 'DIOT (A-29)' },
          { id: 'isr', label: 'ISR Provisional' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as TaxTab)}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* IVA tab */}
      {tab === 'vat' && vatData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-xl border border-green-200 p-4">
              <div className="text-xs font-medium text-green-600 mb-1">IVA Trasladado (cobrado)</div>
              <div className="text-xl font-bold text-green-700">{fmt(vatData.vatTransferred)}</div>
              <div className="text-xs text-green-500 mt-1">{vatData.invoicesCount} facturas emitidas</div>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="text-xs font-medium text-blue-600 mb-1">IVA Acreditable (pagado)</div>
              <div className="text-xl font-bold text-blue-700">{fmt(vatData.vatCreditable)}</div>
              <div className="text-xs text-blue-500 mt-1">{vatData.billsCount} facturas recibidas</div>
            </div>
            <div className={`rounded-xl border p-4 ${vatData.vatPayable > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`text-xs font-medium mb-1 ${vatData.vatPayable > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {vatData.vatPayable > 0 ? 'IVA a Pagar' : 'Saldo a Favor'}
              </div>
              <div className={`text-xl font-bold ${vatData.vatPayable > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {fmt(vatData.vatPayable > 0 ? vatData.vatPayable : vatData.vatInFavor)}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Fecha límite declaración</div>
              <div className="text-base font-bold text-gray-700">{vatData.dueDate}</div>
              <div className="text-xs text-gray-400 mt-1">Art. 5-D LIVA</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Resumen para declaración</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">IVA Trasladado a clientes (16%)</span>
                <span className="font-semibold text-green-600">{fmt(vatData.vatTransferred)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">IVA Acreditable de proveedores</span>
                <span className="font-semibold text-blue-600">- {fmt(vatData.vatCreditable)}</span>
              </div>
              {vatData.vatWithheldFromClients > 0 && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-600">IVA retenido por clientes</span>
                  <span className="font-semibold text-orange-600">- {fmt(vatData.vatWithheldFromClients)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-bold text-base">
                <span className={vatData.vatPayable > 0 ? 'text-red-700' : 'text-green-700'}>
                  {vatData.vatPayable > 0 ? 'IVA a pagar al SAT' : 'Saldo a favor'}
                </span>
                <span className={vatData.vatPayable > 0 ? 'text-red-700' : 'text-green-700'}>
                  {fmt(vatData.vatPayable > 0 ? vatData.vatPayable : vatData.vatInFavor)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIOT tab */}
      {tab === 'diot' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={calcDiot} disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              Calcular DIOT automático
            </button>
            {diotData.length > 0 && (
              <button onClick={exportDiot}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">
                Descargar TXT (SAT)
              </button>
            )}
            {calcMsg && <p className="text-sm text-green-600 font-medium">✓ {calcMsg}</p>}
          </div>

          {diotData.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Proveedor','RFC','Tipo','IVA 16%','IVA 8%','IVA 0%','IVA Exento','IVA Ret.','ISR Ret.','Total'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {diotData.map(d => (
                    <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-xs">{d.thirdParty?.razonSocial || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{d.thirdParty?.rfc || '—'}</td>
                      <td className="px-3 py-2 text-xs">{d.diotType}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.vat16Paid)}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.vat8Paid)}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.vat0Paid)}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.vatExemptPaid)}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.vatWithheld)}</td>
                      <td className="px-3 py-2 text-xs">{fmt(d.isrWithheld)}</td>
                      <td className="px-3 py-2 font-semibold text-xs">{fmt(d.totalPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Sin datos DIOT. Presiona "Calcular DIOT automático" para generar desde las facturas recibidas pagadas.</p>
            </div>
          )}
        </div>
      )}

      {/* ISR tab */}
      {tab === 'isr' && isrData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4">
              <div className="text-xs font-medium text-indigo-600 mb-1">Ingresos acumulados</div>
              <div className="text-xl font-bold text-indigo-700">{fmt(isrData.cumulativeIncome)}</div>
            </div>
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
              <div className="text-xs font-medium text-orange-600 mb-1">Deducciones autorizadas</div>
              <div className="text-xl font-bold text-orange-700">{fmt(isrData.authorizedDeductions)}</div>
            </div>
            <div className={`rounded-xl border p-4 ${isrData.fiscalResult > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs font-medium text-blue-600 mb-1">Resultado fiscal</div>
              <div className="text-xl font-bold text-blue-700">{fmt(isrData.fiscalResult)}</div>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="text-xs font-medium text-red-600 mb-1">ISR Provisional ({(isrData.taxRate * 100).toFixed(0)}%)</div>
              <div className="text-xl font-bold text-red-700">{fmt(isrData.provisionalTax)}</div>
              <div className="text-xs text-red-400 mt-1">Vence: {isrData.dueDate}</div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-sm text-yellow-800">
            <strong>Nota:</strong> {isrData.note}
          </div>
        </div>
      )}

      {!loading && !vatData && !isrData && diotData.length === 0 && tab !== 'diot' && (
        <div className="text-center py-12 text-gray-400">
          Selecciona año/mes y presiona Consultar
        </div>
      )}
    </div>
  );
};
