import React, { useState } from 'react';
import { PieChart, Download, FileText, ArrowRight, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

export const FinancialStatements: React.FC = () => {
  const [statementType, setStatementType] = useState<'BALANCE' | 'PYG'>('BALANCE');

  // Mocks representing API data parsed into financial items
  const balanceData = {
    activos: { title: 'Activo', items: [{ name: 'Caja y Bancos', val: 540000.50 }, { name: 'Cuentas por Cobrar', val: 125000.00 }, { name: 'Propiedad, Planta y Equipo', val: 1200000.00 }], total: 1865000.50 },
    pasivos: { title: 'Pasivo', items: [{ name: 'Proveedores Nacionales', val: 115000.00 }, { name: 'Impuestos por Pagar (IVA/ISR)', val: 100000.00 }, { name: 'Acreedores LP', val: 400000.00 }], total: 615000.00 },
    capital: { title: 'Capital Contable', items: [{ name: 'Capital Social', val: 500000.00 }, { name: 'Resultados Ejercicios Anteriores', val: 587000.50 }, { name: 'Resultado del Ejercicio', val: 163000.00 }], total: 1250000.50 }
  };

  const pygData = {
    ingresos: { title: 'Ingresos', items: [{ name: 'Ventas Nacionales Gravadas', val: 380000.00 }, { name: 'Servicios de Consultoría', val: 45000.00 }], total: 425000.00 },
    costos: { title: 'Costo de Ventas', items: [{ name: 'Inventario Consumido', val: 120000.00 }], total: 120000.00 },
    gastos: { title: 'Gastos de Operación', items: [{ name: 'Sueldos y Salarios', val: 65000.00 }, { name: 'Arrendamientos', val: 20000.00 }], total: 85000.00 },
    otros: { title: 'Gastos Financieros', items: [{ name: 'Comisiones Bancarias', val: 12000.00 }], total: 12000.00 },
    utilidad: 208000.00
  };

  const format = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  const ItemRow = ({ name, val, isBold = false }: { name: string, val: number, isBold?: boolean }) => (
    <div className={`flex justify-between py-2 border-b border-black/5 ${isBold ? 'font-bold text-gray-900 mt-2' : 'text-gray-600'}`}>
      <span>{name}</span>
      <span className="tabular-nums">{format(val)}</span>
    </div>
  );

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
        <button className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Exportar a PDF
        </button>
      </div>

      <div className="flex gap-4 border-b border-gray-200 pb-px mb-6">
        <button onClick={() => setStatementType('BALANCE')} className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${statementType === 'BALANCE' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
           Balance General
        </button>
         <button onClick={() => setStatementType('PYG')} className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${statementType === 'PYG' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
           Estado de Resultados (P&G)
        </button>
      </div>

      <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 p-8 max-w-4xl mx-auto">
        <div className="text-center mb-10 border-b-2 border-primary/20 pb-6">
          <h1 className="text-2xl font-display font-extrabold tracking-widest uppercase text-gray-900">Finca San Miguel S.A. de C.V.</h1>
          <h2 className="text-lg font-bold text-gray-500 tracking-wide uppercase mt-1">
            {statementType === 'BALANCE' ? 'Estado de Situación Financiera' : 'Estado de Resultados Integral'}
          </h2>
          <p className="text-xs text-gray-400 mt-2 uppercase">Al 31 de Diciembre de 2024 (cifras en MXN)</p>
        </div>

        {statementType === 'BALANCE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 text-sm">
            {/* Activos */}
            <div>
              <h3 className="uppercase tracking-widest font-bold text-primary mb-4 pb-2 border-b border-gray-200">1. Activo</h3>
              <div className="space-y-1 mb-6">
                {balanceData.activos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                <div className="pt-2"></div>
                <ItemRow name="Suma del Activo" val={balanceData.activos.total} isBold />
              </div>
            </div>

            {/* Pasivos y Capital */}
            <div>
              <h3 className="uppercase tracking-widest font-bold text-rose-600 mb-4 pb-2 border-b border-gray-200">2. Pasivo</h3>
              <div className="space-y-1 mb-6">
                {balanceData.pasivos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                <ItemRow name="Suma del Pasivo" val={balanceData.pasivos.total} isBold />
              </div>

              <h3 className="uppercase tracking-widest font-bold text-amber-600 mb-4 pb-2 border-b border-gray-200">3. Capital Contable</h3>
              <div className="space-y-1 mb-6">
                {balanceData.capital.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
                <ItemRow name="Suma del Capital" val={balanceData.capital.total} isBold />
              </div>
              
              <div className="mt-8 bg-surface-low p-4 rounded-xl border border-black/5">
                <ItemRow name="Suma Pasivo + Capital" val={balanceData.pasivos.total + balanceData.capital.total} isBold />
                {(balanceData.activos.total === (balanceData.pasivos.total + balanceData.capital.total)) && (
                   <p className="text-xs text-green-600 font-bold tracking-widest mt-2 flex items-center gap-1 uppercase"><CheckCircle2 className="w-3 h-3" /> Ecuación Contable Balanceada</p>
                )}
              </div>
            </div>
          </div>
        )}

        {statementType === 'PYG' && (
          <div className="max-w-2xl mx-auto text-sm">
            <div className="space-y-1 mb-6 border-b-2 border-primary/20 pb-4">
              <h3 className="uppercase tracking-widest font-bold text-primary mb-4">Ingresos Operativos</h3>
              {pygData.ingresos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
              <ItemRow name="Ventas Totales" val={pygData.ingresos.total} isBold />
            </div>

            <div className="space-y-1 mb-6 border-b-2 border-rose-600/20 pb-4">
              <h3 className="uppercase tracking-widest font-bold text-rose-600 mb-4">Costos Operativos</h3>
              {pygData.costos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
              <ItemRow name="Costo de Ventas" val={pygData.costos.total} isBold />
            </div>
            
            <div className="my-6 bg-surface-low p-3 border border-black/5 rounded">
              <ItemRow name="Utilidad Bruta" val={pygData.ingresos.total - pygData.costos.total} isBold />
            </div>

            <div className="space-y-1 mb-6 border-b-2 border-amber-600/20 pb-4">
              <h3 className="uppercase tracking-widest font-bold text-amber-600 mb-4">Gastos Generales</h3>
              {pygData.gastos.items.map(i => <ItemRow key={i.name} name={i.name} val={i.val} />)}
              <ItemRow name="Total Gastos" val={pygData.gastos.total} isBold />
            </div>

            <div className="my-8 bg-green-50 p-4 border-2 border-green-200 rounded-xl text-green-900">
              <ItemRow name="Utilidad Neta de Operación" val={pygData.utilidad} isBold />
            </div>
          </div>
        )}
        
        <div className="mt-12 text-center text-[10px] text-gray-400 uppercase tracking-widest border-t border-gray-100 pt-6">
          Generado automáticamente por ContaSys Cloud - {new Date().toLocaleDateString('es-MX')}
        </div>
      </div>
    </div>
  );
};
