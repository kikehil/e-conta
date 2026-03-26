import React, { useEffect, useState } from 'react';
import { KPICard } from './components/KPICard';
import { IncomeChart } from './components/IncomeChart';
import { TransactionsTable } from './components/TransactionsTable';
import { useAuthStore } from './store/auth';
import {
  LineChart,
  Wallet,
  Receipt,
  FileText
} from 'lucide-react';

const API_URL = '/api';

export const Dashboard: React.FC = () => {
  const token = useAuthStore(state => state.token);
  const companyName = useAuthStore(state => state.companyName);
  const [kpis, setKpis] = useState({ ingresosFacturados: 0, gastosDeducibles: 0, ivaPagarEst: 0, isrProvisional: 0 });
  const [chartData, setChartData] = useState<{ month: string; ingresos: number; gastos: number }[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`${API_URL}/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setKpis(json.data.kpis);
          setChartData(json.data.chartData || []);
          setTransactions(json.data.transactions || []);
        }
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [token]);

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight">
          {companyName || 'Mi Empresa'}
        </h2>
        <p className="text-gray-500 mt-2 text-sm">
          Resumen Financiero — Métricas operativas del período en curso
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando datos reales de PostgreSQL...</div>
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard 
              title="Ingresos Facturados" 
              amount={fmt(kpis.ingresosFacturados)}
              trend={kpis.ingresosFacturados > 0 ? "Activo" : "Sin movimiento"}
              trendUp={kpis.ingresosFacturados > 0} 
              colorType="success"
              icon={<LineChart size={24} />} 
            />
            <KPICard 
              title="Gastos (Deducibles)" 
              amount={fmt(kpis.gastosDeducibles)}
              trend={kpis.gastosDeducibles > 0 ? "Registrado" : "Sin movimiento"}
              trendUp={false} 
              colorType="error"
              icon={<Wallet size={24} />} 
            />
            <KPICard 
              title="IVA a Pagar (Est.)" 
              amount={fmt(kpis.ivaPagarEst)}
              colorType="warning"
              icon={<Receipt size={24} />} 
            />
            <KPICard 
              title="ISR Provisional" 
              amount={fmt(kpis.isrProvisional)}
              colorType="default"
              icon={<FileText size={24} />} 
            />
          </div>

          {/* Chart y Tabla */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <IncomeChart data={chartData} />
            </div>
            <div className="lg:col-span-1">
              <TransactionsTable data={transactions} />
            </div>
          </div>
        </>
      )}
    </>
  );
};
