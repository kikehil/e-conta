import React from 'react';

interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  status: string;
}

interface TransactionsTableProps {
  data: Transaction[];
}

const statusStyle: Record<string, string> = {
  POSTED: 'bg-emerald-100 text-emerald-800',
  DRAFT: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabel: Record<string, string> = {
  POSTED: 'Contabilizado',
  DRAFT: 'Pendiente',
  CANCELLED: 'Cancelado',
};

export const TransactionsTable: React.FC<TransactionsTableProps> = ({ data }) => {
  return (
    <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="p-6 border-b border-black/5">
        <h3 className="text-lg font-display font-bold text-primary">Transacciones Recientes</h3>
        <p className="text-sm text-gray-500 mt-1">Últimas pólizas contables registradas</p>
      </div>
      <div className="overflow-x-auto">
        {data.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            Sin movimientos registrados
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-low text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-black/5">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Descripción</th>
                <th className="px-6 py-4">Estatus</th>
                <th className="px-6 py-4 text-right">Importe (MXN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {data.map((t) => (
                <tr key={t.id} className="hover:bg-surface-high/30 transition-colors">
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">{t.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.desc}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusStyle[t.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {statusLabel[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold tabular-nums ${t.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
