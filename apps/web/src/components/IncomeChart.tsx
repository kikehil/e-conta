import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const data = [
  { month: 'Ene', ingresos: 180000, gastos: 120000 },
  { month: 'Feb', ingresos: 210000, gastos: 145000 },
  { month: 'Mar', ingresos: 195000, gastos: 130000 },
  { month: 'Abr', ingresos: 240000, gastos: 155000 },
  { month: 'May', ingresos: 220000, gastos: 150000 },
  { month: 'Jun', ingresos: 285000, gastos: 165000 },
];

const currencyFormatter = (value: number) => `$${(value / 1000)}k`;

export const IncomeChart: React.FC = () => {
  return (
    <div className="bg-surface-lowest rounded-2xl p-6 shadow-sm border border-black/5 h-[400px]">
      <h3 className="text-lg font-display font-bold text-primary mb-6">Ingresos vs Gastos Anualizados</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 13 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 13 }} 
            tickFormatter={currencyFormatter}
            width={80}
          />
          <Tooltip 
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
          />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="ingresos" name="Ingresos (Facturado)" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={32} />
          <Bar dataKey="gastos" name="Gastos (Deducible)" fill="#001e42" radius={[4, 4, 0, 0]} barSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
