import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';

const API = '/api';

interface Bill {
  id: string;
  satUuid: string;
  thirdParty: { razonSocial: string; rfc: string };
  issueDate: string;
  dueDate?: string;
  subtotal: number;
  taxesTransferred: number;
  total: number;
  amountPaid: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  vatCreditable: number;
}

const STATUS_LABEL: Record<string, { label: string; class: string }> = {
  PENDING:   { label: 'Pendiente',  class: 'bg-yellow-100 text-yellow-700' },
  PARTIAL:   { label: 'Parcial',    class: 'bg-blue-100 text-blue-700' },
  PAID:      { label: 'Pagada',     class: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelada',  class: 'bg-gray-100 text-gray-500' },
};

const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');

export const BillsView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [payDialog, setPayDialog] = useState<Bill | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({
    satUuid: '', thirdPartyId: '', issueDate: '', dueDate: '',
    subtotal: '', taxesTransferred: '', total: '', vatCreditable: '',
  });
  const [providers, setProviders] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'list' | 'aging'>('list');
  const [aging, setAging] = useState<any>(null);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchBills = async () => {
    setLoading(true);
    const res = await fetch(`${API}/bills`, { headers });
    if (res.ok) { const j = await res.json(); setBills(j.data); }
    setLoading(false);
  };

  const fetchProviders = async () => {
    const res = await fetch(`${API}/catalogs/third-parties?type=PROVEEDOR`, { headers });
    if (res.ok) { const j = await res.json(); setProviders(j.data || []); }
  };

  const fetchAging = async () => {
    const res = await fetch(`${API}/bills/aging`, { headers });
    if (res.ok) { const j = await res.json(); setAging(j.data); }
  };

  useEffect(() => { fetchBills(); fetchProviders(); }, []);
  useEffect(() => { if (tab === 'aging') fetchAging(); }, [tab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.satUuid || !form.thirdPartyId || !form.total) {
      setError('UUID SAT, proveedor y total son obligatorios');
      return;
    }
    setSaving(true);
    const res = await fetch(`${API}/bills`, {
      method: 'POST', headers,
      body: JSON.stringify({
        ...form,
        subtotal: parseFloat(form.subtotal),
        taxesTransferred: parseFloat(form.taxesTransferred || '0'),
        total: parseFloat(form.total),
        vatCreditable: parseFloat(form.vatCreditable || form.taxesTransferred || '0'),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ satUuid: '', thirdPartyId: '', issueDate: '', dueDate: '', subtotal: '', taxesTransferred: '', total: '', vatCreditable: '' });
      fetchBills();
    } else {
      const j = await res.json();
      setError(j.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const handlePay = async () => {
    if (!payDialog || !payAmount) return;
    const res = await fetch(`${API}/bills/${payDialog.id}/pay`, {
      method: 'POST', headers,
      body: JSON.stringify({ amount: parseFloat(payAmount) }),
    });
    if (res.ok) { setPayDialog(null); setPayAmount(''); fetchBills(); }
    else { const j = await res.json(); alert(j.error); }
  };

  const balance = (b: Bill) => b.total - b.amountPaid;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-primary">Facturas Recibidas</h2>
          <p className="text-gray-500 text-sm mt-1">Cuentas por Pagar — CFDI de proveedores</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          + Registrar Factura
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {['list', 'aging'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
          >
            {t === 'list' ? 'Facturas' : 'Antigüedad CxP'}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Registrar Factura Recibida</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">UUID SAT del proveedor *</label>
              <input
                value={form.satUuid} onChange={e => setForm({ ...form, satUuid: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
              <select
                value={form.thirdPartyId} onChange={e => setForm({ ...form, thirdPartyId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              >
                <option value="">Seleccionar...</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.razonSocial} ({p.rfc})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha emisión *</label>
              <input type="date" value={form.issueDate} onChange={e => setForm({ ...form, issueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vencimiento</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subtotal *</label>
              <input type="number" step="0.01" value={form.subtotal} onChange={e => setForm({ ...form, subtotal: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">IVA Trasladado</label>
              <input type="number" step="0.01" value={form.taxesTransferred} onChange={e => setForm({ ...form, taxesTransferred: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total *</label>
              <input type="number" step="0.01" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex items-center gap-3">
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bills list */}
      {tab === 'list' && (
        loading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Proveedor','UUID SAT','Fecha','Vencimiento','Total','Saldo','Estado',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Sin facturas recibidas</td></tr>
                )}
                {bills.map(b => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{b.thirdParty.razonSocial}</div>
                      <div className="text-xs text-gray-400">{b.thirdParty.rfc}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.satUuid.substring(0, 13)}...</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(b.issueDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{b.dueDate ? fmtDate(b.dueDate) : '—'}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(b.total)}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">{fmt(balance(b))}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_LABEL[b.paymentStatus]?.class}`}>
                        {STATUS_LABEL[b.paymentStatus]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {['PENDING', 'PARTIAL'].includes(b.paymentStatus) && (
                        <button
                          onClick={() => { setPayDialog(b); setPayAmount(String(balance(b))); }}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 transition-colors"
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Aging report */}
      {tab === 'aging' && aging && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { key: 'current', label: 'Al corriente' },
              { key: 'days1_30', label: '1-30 días' },
              { key: 'days31_60', label: '31-60 días' },
              { key: 'days61_90', label: '61-90 días' },
              { key: 'over90', label: '+90 días' },
            ].map(bucket => (
              <div key={bucket.key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs font-medium text-gray-500 mb-1">{bucket.label}</div>
                <div className="text-lg font-bold text-gray-800">{fmt(aging.summary[bucket.key]?.total || 0)}</div>
                <div className="text-xs text-gray-400">{aging.summary[bucket.key]?.count || 0} facturas</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Proveedor','RFC','Fecha','Vencimiento','Saldo','Días vencidos'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aging.items.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.proveedor}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.rfc}</td>
                    <td className="px-4 py-3">{fmtDate(item.issueDate)}</td>
                    <td className="px-4 py-3">{item.dueDate ? fmtDate(item.dueDate) : '—'}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(item.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.daysOverdue > 90 ? 'bg-red-100 text-red-700' : item.daysOverdue > 30 ? 'bg-orange-100 text-orange-700' : item.daysOverdue > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {item.daysOverdue > 0 ? `+${item.daysOverdue} días` : 'Vigente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay dialog */}
      {payDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-display font-bold text-gray-800 mb-1">Registrar Pago</h3>
            <p className="text-sm text-gray-500 mb-4">{payDialog.thirdParty.razonSocial}</p>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Saldo pendiente</span>
                <span className="font-semibold">{fmt(balance(payDialog))}</span>
              </div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto a pagar</label>
              <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={handlePay}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                Confirmar Pago
              </button>
              <button onClick={() => { setPayDialog(null); setPayAmount(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
