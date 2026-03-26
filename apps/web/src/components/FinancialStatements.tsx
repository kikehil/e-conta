import React, { useState, useEffect } from 'react';
import { PieChart, Download, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface BalanceSection {
  title: string;
  items: { name: string; val: number }[];
  total: number;
}

interface FinancialData {
  companyName: string;
  balance: {
    activos: BalanceSection;
    pasivos: BalanceSection;
    capital: BalanceSection;
  };
  incomeStatement: {
    ingresos: { title: string; items: { name: string; val: number }[]; total: number };
    costos: { title: string; items: { name: string; val: number }[]; total: number };
    utilidad: number;
  };
}

export const FinancialStatements: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [statementType, setStatementType] = useState<'BALANCE' | 'PYG'>('BALANCE');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatements = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/accounting/financial-statements?year=${selectedYear}&month=${selectedMonth}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Error ${res.status}`);
        }
        const json = await res.json();
        setData(json.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar estados financieros');
      } finally {
        setLoading(false);
      }
    };

    fetchStatements();
  }, [token, selectedYear, selectedMonth]);

  const format = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const ItemRow = ({ name, val, isBold = false }: { name: string; val: number; isBold?: boolean }) => (
    <div className={`flex justify-between py-2 border-b border-black/5 ${isBold ? 'font-bold text-gray-900 mt-2' : 'text-gray-600'}`}>
      <span>{name}</span>
      <span className="tabular-nums">{format(val)}</span>
    </div>
  );

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight flex items-center gap-3">
            <PieChart className="text-primary-container w-8 h-8" />
            Estados Financieros (NIF)
          </h2>
          <p className="text-gray-500 mt-2 text-sm">Visualización y exportación en PDF de Balance General y Resultados.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de período */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none text-sm font-medium"
          >
            {months.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none text-sm font-medium"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {/* Botón exportar deshabilitado */}
          <div className="relative group">
            <button
              disabled
              className="bg-gray-300 text-gray-500 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> Exportar a PDF
            </button>
            <div className="absolute right-0 top-full mt-1 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Próximamente
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 pb-px mb-6">
        <button
          onClick={() => setStatementType('BALANCE')}
          className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${statementType === 'BALANCE' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
          Balance General
        </button>
        <button
          onClick={() => setStatementType('PYG')}
          className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${statementType === 'PYG' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
          Estado de Resultados (P&G)
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="ml-3 text-gray-500 font-medium">Cargando estados financieros...</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-xl">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="text-center py-24 text-gray-400 text-sm">
          No hay datos disponibles para el período seleccionado.
        </div>
      )}

      {!loading && !error && data && (
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 p-8 max-w-4xl mx-auto">
          <div className="text-center mb-10 border-b-2 border-primary/20 pb-6">
            <h1 className="text-2xl font-display font-extrabold tracking-widest uppercase text-gray-900">{data.companyName}</h1>
            <h2 className="text-lg font-bold text-gray-500 tracking-wide uppercase mt-1">
              {statementType === 'BALANCE' ? 'Estado de Situación Financiera' : 'Estado de Resultados Integral'}
            </h2>
            <p className="text-xs text-gray-400 mt-2 uppercase">
              {months[selectedMonth - 1]} {selectedYear} (cifras en MXN)
            </p>
          </div>

          {statementType === 'BALANCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 text-sm">
              {/* Activos */}
              <div>
                <h3 className="uppercase tracking-widest font-bold text-primary mb-4 pb-2 border-b border-gray-200">1. Activo</h3>
                <div className="space-y-1 mb-6">
                  {data.balance.activos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                  <div className="pt-2"></div>
                  <ItemRow name="Suma del Activo" val={data.balance.activos.total} isBold />
                </div>
              </div>

              {/* Pasivos y Capital */}
              <div>
                <h3 className="uppercase tracking-widest font-bold text-rose-600 mb-4 pb-2 border-b border-gray-200">2. Pasivo</h3>
                <div className="space-y-1 mb-6">
                  {data.balance.pasivos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                  <ItemRow name="Suma del Pasivo" val={data.balance.pasivos.total} isBold />
                </div>

                <h3 className="uppercase tracking-widest font-bold text-amber-600 mb-4 pb-2 border-b border-gray-200">3. Capital Contable</h3>
                <div className="space-y-1 mb-6">
                  {data.balance.capital.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                  <ItemRow name="Suma del Capital" val={data.balance.capital.total} isBold />
                </div>

                <div className="mt-8 bg-surface-low p-4 rounded-xl border border-black/5">
                  <ItemRow name="Suma Pasivo + Capital" val={data.balance.pasivos.total + data.balance.capital.total} isBold />
                  {Math.abs(data.balance.activos.total - (data.balance.pasivos.total + data.balance.capital.total)) < 0.01 && (
                    <p className="text-xs text-green-600 font-bold tracking-widest mt-2 flex items-center gap-1 uppercase">
                      <CheckCircle2 className="w-3 h-3" /> Ecuación Contable Balanceada
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {statementType === 'PYG' && (
            <div className="max-w-2xl mx-auto text-sm">
              <div className="space-y-1 mb-6 border-b-2 border-primary/20 pb-4">
                <h3 className="uppercase tracking-widest font-bold text-primary mb-4">Ingresos Operativos</h3>
                {data.incomeStatement.ingresos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                <ItemRow name="Ventas Totales" val={data.incomeStatement.ingresos.total} isBold />
              </div>

              <div className="space-y-1 mb-6 border-b-2 border-rose-600/20 pb-4">
                <h3 className="uppercase tracking-widest font-bold text-rose-600 mb-4">Costos Operativos</h3>
                {data.incomeStatement.costos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                <ItemRow name="Costo de Ventas" val={data.incomeStatement.costos.total} isBold />
              </div>

              <div className="my-6 bg-surface-low p-3 border border-black/5 rounded">
                <ItemRow name="Utilidad Bruta" val={data.incomeStatement.ingresos.total - data.incomeStatement.costos.total} isBold />
              </div>

              <div className="my-8 bg-green-50 p-4 border-2 border-green-200 rounded-xl text-green-900">
                <ItemRow name="Utilidad Neta de Operación" val={data.incomeStatement.utilidad} isBold />
              </div>
            </div>
          )}

          <div className="mt-12 text-center text-[10px] text-gray-400 uppercase tracking-widest border-t border-gray-100 pt-6">
            Generado automáticamente por ContaSys Cloud - {new Date().toLocaleDateString('es-MX')}
          </div>
        </div>
      )}
    </div>
  );
};
