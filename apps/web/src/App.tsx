import React, { useState } from 'react';
import { Dashboard } from './Dashboard';
import { PayrollCalculator } from './components/PayrollCalculator';
import { InvoiceForm } from './components/InvoiceForm';
import { JournalCapture } from './components/JournalCapture';
import { CatalogsView } from './components/Catalogs';
import { PaymentComplement } from './components/PaymentComplement';
import { FinancialStatements } from './components/FinancialStatements';
import { BillsView } from './components/Bills';
import { BanksView } from './components/Banks';
import { FixedAssetsView } from './components/FixedAssets';
import { TaxesView } from './components/Taxes';
import { Login } from './components/Login';
import { useAuthStore } from './store/auth';
import {
  LayoutDashboard, FileText, Receipt, BookOpen,
  Users, Building2, Landmark, Package, Calculator,
  LogOut, ChevronDown, ChevronUp,
} from 'lucide-react';

type View =
  | 'dashboard' | 'invoice' | 'bills' | 'rep'
  | 'payroll' | 'journal' | 'statements' | 'catalogs'
  | 'banks' | 'fixed-assets' | 'taxes';

interface NavItem {
  id: View;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    label: 'Dashboard',          icon: <LayoutDashboard size={16} />, group: 'inicio' },
  { id: 'invoice',      label: 'Emisión CFDI',        icon: <FileText size={16} />,        roles: ['ADMIN','BILLER'], group: 'facturacion' },
  { id: 'bills',        label: 'Facturas Recibidas',  icon: <Receipt size={16} />,         roles: ['ADMIN','ACCOUNTANT'], group: 'facturacion' },
  { id: 'rep',          label: 'Pagos (REP)',         icon: <Calculator size={16} />,      roles: ['ADMIN','BILLER'], group: 'facturacion' },
  { id: 'payroll',      label: 'Nómina',             icon: <Users size={16} />,           roles: ['ADMIN','HR'], group: 'nomina' },
  { id: 'journal',      label: 'Pólizas Contables',  icon: <BookOpen size={16} />,        roles: ['ADMIN','ACCOUNTANT'], group: 'contabilidad' },
  { id: 'statements',   label: 'Estados Financieros', icon: <Building2 size={16} />,       roles: ['ADMIN','ACCOUNTANT'], group: 'contabilidad' },
  { id: 'banks',        label: 'Bancos',             icon: <Landmark size={16} />,        roles: ['ADMIN','ACCOUNTANT'], group: 'contabilidad' },
  { id: 'fixed-assets', label: 'Activos Fijos',      icon: <Package size={16} />,         roles: ['ADMIN','ACCOUNTANT'], group: 'contabilidad' },
  { id: 'taxes',        label: 'Impuestos / DIOT',   icon: <Receipt size={16} />,         roles: ['ADMIN','ACCOUNTANT'], group: 'impuestos' },
  { id: 'catalogs',     label: 'Catálogos SAT',      icon: <FileText size={16} />,        roles: ['ADMIN','BILLER'], group: 'config' },
];

const GROUP_LABELS: Record<string, string> = {
  inicio: 'Inicio',
  facturacion: 'Facturación',
  nomina: 'Nómina',
  contabilidad: 'Contabilidad',
  impuestos: 'Impuestos',
  config: 'Configuración',
};

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const role = useAuthStore(state => state.role);
  const userName = useAuthStore(state => state.userName);
  const companyName = useAuthStore(state => state.companyName);
  const logout = useAuthStore(state => state.logout);

  if (!isAuthenticated) return <Login />;

  const allowedItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(role || '')
  );

  const groups = Array.from(new Set(allowedItems.map(i => i.group)));

  const navigate = (view: View) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-surface font-body text-gray-900 flex">
      {/* Sidebar */}
      <aside className={`w-60 bg-white border-r border-gray-200 flex flex-col fixed top-0 bottom-0 left-0 z-20 transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-display font-bold text-xl">
            C
          </div>
          <div>
            <div className="font-display font-bold text-primary text-base leading-tight">ContaSys</div>
            <div className="text-xs text-gray-400 truncate max-w-[130px]">{companyName}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {groups.map(group => {
            const items = allowedItems.filter(i => i.group === group);
            return (
              <div key={group} className="mb-4">
                <div className="text-xs font-semibold uppercase text-gray-400 tracking-wider px-2 mb-1">
                  {GROUP_LABELS[group!] || group}
                </div>
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                      currentView === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {userName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-gray-400">{role}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/30 z-10 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sticky top-0 z-10">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          <span className="font-display font-bold text-primary">ContaSys</span>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {userName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'invoice' && <InvoiceForm />}
          {currentView === 'bills' && <BillsView />}
          {currentView === 'rep' && <PaymentComplement />}
          {currentView === 'payroll' && <PayrollCalculator />}
          {currentView === 'journal' && <JournalCapture />}
          {currentView === 'statements' && <FinancialStatements />}
          {currentView === 'banks' && <BanksView />}
          {currentView === 'fixed-assets' && <FixedAssetsView />}
          {currentView === 'taxes' && <TaxesView />}
          {currentView === 'catalogs' && <CatalogsView />}
        </main>
      </div>
    </div>
  );
}

export default App;
