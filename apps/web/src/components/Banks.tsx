import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';

const API = '/api';
const fmt = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX');

interface BankAccount {
  id: string;
  bankName: string;
  clabe?: string;
  currency: string;
  currentBalance: number;
  account: { code: string; name: string };
  _count: { transactions: number };
}

interface Transaction {
  id: string;
  transactionDate: string;
  description: string;
  reference?: string;
  amount: number;
  balanceAfter?: number;
  reconciliationStatus: string;
  source: string;
  journalLine?: { account: { code: string; name: string } };
}

const RECONCILE_LABEL: Record<string, { label: string; class: string }> = {
  PENDING:  { label: 'Pendiente',  class: 'bg-yellow-100 text-yellow-700' },
  MATCHED:  { label: 'Conciliado', class: 'bg-green-100 text-green-700' },
  MANUAL:   { label: 'Manual',     class: 'bg-blue-100 text-blue-700' },
  IGNORED:  { label: 'Ignorado',   class: 'bg-gray-100 text-gray-500' },
};

const EMPTY_BANK = { bankName: '', accountId: '', clabe: '', accountNumber: '', currency: 'MXN', initialBalance: '0' };

export const BanksView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txSummary, setTxSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTx, setShowNewTx] = useState(false);
  const [newTx, setNewTx] = useState({ description: '', amount: '', transactionDate: new Date().toISOString().split('T')[0], reference: '' });
  const [savingTx, setSavingTx] = useState(false);
  const [showNewBank, setShowNewBank] = useState(false);
  const [newBank, setNewBank] = useState(EMPTY_BANK);
  const [savingBank, setSavingBank] = useState(false);
  const [contaAccounts, setContaAccounts] = useState<{ id: string; code: string; name: string }[]>([]);

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchSummary = async () => {
    const res = await fetch(`${API}/banks/summary`, { headers });
    if (res.ok) { const j = await res.json(); setSummary(j.data); setAccounts(j.data.accounts || []); }
    setLoading(false);
  };

  const fetchContaAccounts = async () => {
    const res = await fetch(`${API}/accounts`, { headers });
    if (res.ok) { const j = await res.json(); setContaAccounts(j.data || []); }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBank(true);
    const res = await fetch(`${API}/banks`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...newBank, initialBalance: parseFloat(newBank.initialBalance) || 0 }),
    });
    if (res.ok) {
      setShowNewBank(false);
      setNewBank(EMPTY_BANK);
      fetchSummary();
    } else {
      const j = await res.json();
      alert(j.error || 'Error al crear cuenta');
    }
    setSavingBank(false);
  };

  const fetchTransactions = async (accountId: string) => {
    const res = await fetch(`${API}/banks/${accountId}/transactions`, { headers });
    if (res.ok) {
      const j = await res.json();
      setTransactions(j.data.transactions || []);
      setTxSummary(j.data.summary);
    }
  };

  useEffect(() => { fetchSummary(); fetchContaAccounts(); }, []);
  useEffect(() => { if (selected) fetchTransactions(selected); }, [selected]);

  const handleReconcile = async (txId: string, status: string) => {
    await fetch(`${API}/banks/transactions/${txId}/reconcile`, {
      method: 'PUT', headers,
      body: JSON.stringify({ status }),
    });
    if (selected) fetchTransactions(selected);
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingTx(true);
    const res = await fetch(`${API}/banks/${selected}/transactions`, {
      method: 'POST', headers,
      body: JSON.stringify({
        ...newTx,
        amount: parseFloat(newTx.amount),
      }),
    });
    if (res.ok) {
      setShowNewTx(false);
      setNewTx({ description: '', amount: '', transactionDate: new Date().toISOString().split('T')[0], reference: '' });
      fetchTransactions(selected);
      fetchSummary();
    } else {
      const j = await res.json();
      alert(j.error);
    }
    setSavingTx(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-display font-extrabold text-primary">Bancos y Tesorería</h2>
        <p className="text-gray-500 text-sm mt-1">Cuentas bancarias y conciliación de movimientos</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Saldo Total Bancos</div>
                <div className="text-2xl font-bold text-gray-800">{fmt(summary.totalBalance)}</div>
                <div className="text-xs text-gray-400 mt-1">{accounts.length} cuenta(s)</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Pendientes de conciliar</div>
                <div className="text-2xl font-bold text-yellow-600">{summary.pendingReconciliation}</div>
                <div className="text-xs text-gray-400 mt-1">movimientos</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account list */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Cuentas</h3>
                <button
                  onClick={() => setShowNewBank(true)}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90"
                >
                  + Nueva Cuenta
                </button>
              </div>

              {showNewBank && (
                <form onSubmit={handleAddBank} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Banco *</label>
                    <input value={newBank.bankName} onChange={e => setNewBank({ ...newBank, bankName: e.target.value })}
                      placeholder="BBVA, Santander, Banorte..." required
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta contable *</label>
                    <select value={newBank.accountId} onChange={e => setNewBank({ ...newBank, accountId: e.target.value })} required
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                      <option value="">Selecciona cuenta…</option>
                      {contaAccounts.filter(a => a.code.startsWith('110')).map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                      {contaAccounts.filter(a => !a.code.startsWith('110')).map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">CLABE (18 dígitos)</label>
                    <input value={newBank.clabe} onChange={e => setNewBank({ ...newBank, clabe: e.target.value })}
                      placeholder="012345678901234567" maxLength={18}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">No. de cuenta</label>
                    <input value={newBank.accountNumber} onChange={e => setNewBank({ ...newBank, accountNumber: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Saldo inicial (MXN)</label>
                    <input type="number" step="0.01" value={newBank.initialBalance} onChange={e => setNewBank({ ...newBank, initialBalance: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingBank}
                      className="flex-1 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                      {savingBank ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => { setShowNewBank(false); setNewBank(EMPTY_BANK); }}
                      className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => setSelected(acc.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      selected === acc.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white hover:border-primary/30'
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{acc.bankName}</div>
                    {acc.clabe && <div className="text-xs text-gray-400 font-mono">{acc.clabe}</div>}
                    <div className="text-sm font-bold text-primary mt-1">{fmt(acc.currentBalance)}</div>
                    <div className="text-xs text-gray-400">{acc._count?.transactions || 0} movimientos</div>
                  </button>
                ))}
                {accounts.length === 0 && !showNewBank && (
                  <p className="text-sm text-gray-400 text-center py-4">No hay cuentas bancarias.<br/>Usa "+ Nueva Cuenta" para agregar.</p>
                )}
              </div>
            </div>

            {/* Transactions */}
            <div className="lg:col-span-2">
              {selected ? (
                <>
                  {txSummary && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-xs text-green-600 font-medium">Entradas</div>
                        <div className="font-bold text-green-700">{fmt(txSummary.inflows)}</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3">
                        <div className="text-xs text-red-600 font-medium">Salidas</div>
                        <div className="font-bold text-red-700">{fmt(txSummary.outflows)}</div>
                      </div>
                      <div className="bg-yellow-50 rounded-lg p-3">
                        <div className="text-xs text-yellow-600 font-medium">Por conciliar</div>
                        <div className="font-bold text-yellow-700">{txSummary.pending}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Movimientos</h3>
                    <button
                      onClick={() => setShowNewTx(!showNewTx)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90"
                    >
                      + Agregar
                    </button>
                  </div>

                  {showNewTx && (
                    <form onSubmit={handleAddTx} className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                        <input value={newTx.description} onChange={e => setNewTx({ ...newTx, description: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Monto (+/-)</label>
                        <input type="number" step="0.01" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                          placeholder="+5000 o -2000" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                        <input type="date" value={newTx.transactionDate} onChange={e => setNewTx({ ...newTx, transactionDate: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
                        <input value={newTx.reference} onChange={e => setNewTx({ ...newTx, reference: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button type="submit" disabled={savingTx}
                          className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                          {savingTx ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button type="button" onClick={() => setShowNewTx(false)}
                          className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Fecha','Descripción','Monto','Estado',''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.length === 0 && (
                          <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">Sin movimientos</td></tr>
                        )}
                        {transactions.map(tx => (
                          <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-xs text-gray-500">{fmtDate(tx.transactionDate)}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-xs text-gray-800 truncate max-w-[180px]">{tx.description}</div>
                              {tx.reference && <div className="text-xs text-gray-400">{tx.reference}</div>}
                            </td>
                            <td className={`px-3 py-2 font-semibold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {fmt(tx.amount)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${RECONCILE_LABEL[tx.reconciliationStatus]?.class}`}>
                                {RECONCILE_LABEL[tx.reconciliationStatus]?.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {tx.reconciliationStatus === 'PENDING' && (
                                <div className="flex gap-1">
                                  <button onClick={() => handleReconcile(tx.id, 'MATCHED')}
                                    className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                                    ✓
                                  </button>
                                  <button onClick={() => handleReconcile(tx.id, 'IGNORED')}
                                    className="px-2 py-0.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400">
                                    ×
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  Selecciona una cuenta bancaria
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
