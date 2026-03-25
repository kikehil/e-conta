import React from 'react';

const TRANSACTIONS = [
  { id: '1', date: '24 May', desc: 'Pago de ISR Provisional - Abril', type: 'TAX', amount: -45200.00, status: 'Pagado' },
  { id: '2', date: '23 May', desc: 'Factura F-4092 Comercializadora SA', type: 'INCOME', amount: 125000.00, status: 'Timbrado' },
  { id: '3', date: '21 May', desc: 'Nómina Quincena 10', type: 'PAYROLL', amount: -68400.00, status: 'Pendiente' },
  { id: '4', date: '20 May', desc: 'Compra Equipo de Cómputo', type: 'EXPENSE', amount: -24500.00, status: 'Conciliado' },
];

export const TransactionsTable: React.FC = () => {
  return (
    <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <div className="p-6 border-b border-black/5">
        <h3 className="text-lg font-display font-bold text-primary">Transacciones y Obligaciones Recientes</h3>
        <p className="text-sm text-gray-500 mt-1">Últimos movimientos sincronizados con Bancos y SAT</p>
      </div>
      <div className="overflow-x-auto">
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
            {TRANSACTIONS.map((t) => (
              <tr key={t.id} className="hover:bg-surface-high/30 transition-colors">
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-600">{t.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.desc}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                    ${t.status === 'Pagado' ? 'bg-emerald-100 text-emerald-800' : 
                      t.status === 'Timbrado' ? 'bg-blue-100 text-blue-800' : 
                      t.status === 'Pendiente' ? 'bg-amber-100 text-amber-800' : 
                      'bg-gray-100 text-gray-800'}`}>
                    {t.status}
                  </span>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold tabular-nums
                  ${t.amount > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
