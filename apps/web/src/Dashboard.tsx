import React from 'react';
import { KPICard } from './components/KPICard';
import { IncomeChart } from './components/IncomeChart';
import { TransactionsTable } from './components/TransactionsTable';
import {
  LineChart,
  Wallet,
  Receipt,
  FileText
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight">Resumen Financiero</h2>
        <p className="text-gray-500 mt-2 text-sm">Métricas operativas del mes en curso (Mayo 2024)</p>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard 
          title="Ingresos Facturados" 
          amount="285,000" 
          trend="12%" 
          trendUp={true} 
          colorType="success"
          icon={<LineChart size={24} />} 
        />
        <KPICard 
          title="Gastos (Deducibles)" 
          amount="165,000" 
          trend="4%" 
          trendUp={false} 
          colorType="error"
          icon={<Wallet size={24} />} 
        />
        <KPICard 
          title="IVA a Pagar (Est.)" 
          amount="19,200" 
          colorType="warning"
          icon={<Receipt size={24} />} 
        />
        <KPICard 
          title="ISR Provisional" 
          amount="14,580" 
          colorType="default"
          icon={<FileText size={24} />} 
        />
      </div>

      {/* Chart y Tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <IncomeChart />
        </div>
        <div className="lg:col-span-1">
          <TransactionsTable />
        </div>
      </div>
    </>
  );
};
