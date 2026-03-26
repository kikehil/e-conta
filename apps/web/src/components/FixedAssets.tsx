import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';

const API = '/api';
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

interface FixedAsset {
  id: string;
  name: string;
  satAssetType: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  satDepreciationRate?: number;
  status: string;
  notes?: string;
  account: { code: string; name: string };
  depreciationSchedules: Array<{
    accountingDepreciation: number;
    netBookValue: number;
    period: { year: number; month: number };
  }>;
}

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  ACTIVE:             { label: 'Activo',     class: 'bg-green-100 text-green-700' },
  DISPOSED:           { label: 'Dado de baja', class: 'bg-gray-100 text-gray-500' },
  FULLY_DEPRECIATED:  { label: 'Dep. total',  class: 'bg-blue-100 text-blue-700' },
};

const METHOD_LABEL: Record<string, string> = {
  LINEA_RECTA: 'Línea recta',
  DOBLE_SALDO: 'Doble saldo',
  SUM_DIGITOS: 'Suma de dígitos',
  UNIDADES_PRODUCCION: 'Unidades de producción',
};

export const FixedAssetsView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [selected, setSelected] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [depRun, setDepRun] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [runningDep, setRunningDep] = useState(false);
  const [depResult, setDepResult] = useState<any>(null);

  const [form, setForm] = useState({
    name: '', accountId: '', satAssetType: 'Maquinaria',
    acquisitionDate: new Date().toISOString().split('T')[0],
    acquisitionCost: '', residualValue: '0',
    depreciationMethod: 'LINEA_RECTA', usefulLifeMonths: '60',
    satDepreciationRate: '', notes: '',
  });

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAssets = async () => {
    setLoading(true);
    const res = await fetch(`${API}/fixed-assets`, { headers });
    if (res.ok) { const j = await res.json(); setAssets(j.data); }
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const res = await fetch(`${API}/accounts`, { headers });
    if (res.ok) { const j = await res.json(); setAccounts(j.data || []); }
  };

  useEffect(() => { fetchAssets(); fetchAccounts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API}/fixed-assets`, {
      method: 'POST', headers,
      body: JSON.stringify({
        ...form,
        acquisitionCost: parseFloat(form.acquisitionCost),
        residualValue: parseFloat(form.residualValue || '0'),
        usefulLifeMonths: parseInt(form.usefulLifeMonths),
        satDepreciationRate: form.satDepreciationRate ? parseFloat(form.satDepreciationRate) : undefined,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      fetchAssets();
    } else {
      const j = await res.json();
      alert(j.error);
    }
  };

  const handleRunDepreciation = async () => {
    setRunningDep(true);
    setDepResult(null);
    const res = await fetch(`${API}/fixed-assets/run-depreciation`, {
      method: 'POST', headers,
      body: JSON.stringify({ year: depRun.year, month: depRun.month }),
    });
    const j = await res.json();
    if (res.ok) { setDepResult(j.data); fetchAssets(); }
    else { alert(j.error); }
    setRunningDep(false);
  };

  const latestSchedule = (a: FixedAsset) => a.depreciationSchedules?.[0];
  const netBookValue = (a: FixedAsset) => {
    const s = latestSchedule(a);
    return s ? s.netBookValue : a.acquisitionCost;
  };
  const accumulated = (a: FixedAsset) => a.acquisitionCost - netBookValue(a);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-primary">Activos Fijos</h2>
          <p className="text-gray-500 text-sm mt-1">Depreciación NIF C-6 y deducción fiscal Art. 34 LISR</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90"
        >
          + Nuevo Activo
        </button>
      </div>

      {/* Depreciation run panel */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-3 text-sm">Calcular Depreciación Mensual</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-700 font-medium">Año:</label>
            <input type="number" value={depRun.year} onChange={e => setDepRun({ ...depRun, year: parseInt(e.target.value) })}
              className="w-24 px-2 py-1 border border-blue-300 rounded-lg text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-blue-700 font-medium">Mes:</label>
            <select value={depRun.month} onChange={e => setDepRun({ ...depRun, month: parseInt(e.target.value) })}
              className="px-2 py-1 border border-blue-300 rounded-lg text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i, 1).toLocaleString('es-MX', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleRunDepreciation} disabled={runningDep}
            className="px-4 py-1.5 bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {runningDep ? 'Calculando...' : 'Calcular'}
          </button>
        </div>
        {depResult && (
          <div className="mt-3 text-sm text-blue-800">
            ✓ {depResult.assets?.length || 0} activos depreciados — Total: {fmt(depResult.totalDepreciation)}
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Nuevo Activo Fijo</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo SAT</label>
              <select value={form.satAssetType} onChange={e => setForm({ ...form, satAssetType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {['Inmuebles','Maquinaria','EquipoTransporte','Computo','Mobiliario','Herramienta'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta contable *</label>
              <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Seleccionar...</option>
                {accounts.filter(a => a.accountType === 'ACTIVO').map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de adquisición *</label>
              <input type="date" value={form.acquisitionDate} onChange={e => setForm({ ...form, acquisitionDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Costo de adquisición *</label>
              <input type="number" step="0.01" value={form.acquisitionCost} onChange={e => setForm({ ...form, acquisitionCost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valor residual</label>
              <input type="number" step="0.01" value={form.residualValue} onChange={e => setForm({ ...form, residualValue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Método depreciación</label>
              <select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vida útil (meses) *</label>
              <input type="number" value={form.usefulLifeMonths} onChange={e => setForm({ ...form, usefulLifeMonths: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tasa fiscal SAT (Art. 34 LISR)</label>
              <input type="number" step="0.01" placeholder="ej: 0.25 para 25%" value={form.satDepreciationRate}
                onChange={e => setForm({ ...form, satDepreciationRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-3">
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold">Crear Activo</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Assets list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Activo','Tipo','Adquisición','Costo Original','Dep. Acumulada','Valor en Libros','Método','Estado'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin activos fijos registrados</td></tr>
              )}
              {assets.map(a => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(selected?.id === a.id ? null : a)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{a.name}</div>
                    <div className="text-xs text-gray-400">{a.account.code} — {a.account.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{a.satAssetType}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(a.acquisitionDate)}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(a.acquisitionCost)}</td>
                  <td className="px-4 py-3 text-orange-600 font-semibold">{fmt(accumulated(a))}</td>
                  <td className="px-4 py-3 font-bold text-primary">{fmt(netBookValue(a))}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{METHOD_LABEL[a.depreciationMethod]}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_LABEL[a.status]?.class}`}>
                      {STATUS_LABEL[a.status]?.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule detail */}
      {selected && selected.depreciationSchedules.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-700">Tabla de depreciación — {selected.name}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Período','Dep. mensual','Dep. acumulada','Valor en libros'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.depreciationSchedules.map((s, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-xs">{s.period.month}/{s.period.year}</td>
                  <td className="px-4 py-2">{fmt(s.accountingDepreciation)}</td>
                  <td className="px-4 py-2 text-orange-600">{fmt(selected.acquisitionCost - s.netBookValue)}</td>
                  <td className="px-4 py-2 font-bold text-primary">{fmt(s.netBookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
