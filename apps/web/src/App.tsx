import React, { useState } from 'react';
import { Dashboard } from './Dashboard';
import { PayrollCalculator } from './components/PayrollCalculator';
import { InvoiceForm } from './components/InvoiceForm';
import { JournalCapture } from './components/JournalCapture';
import { CatalogsView } from './components/Catalogs';
import { PaymentComplement } from './components/PaymentComplement';
import { FinancialStatements } from './components/FinancialStatements';
import { Login } from './components/Login';
import { useAuthStore } from './store/auth';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'payroll' | 'invoice' | 'journal' | 'catalogs' | 'rep' | 'statements'>('dashboard');
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const role = useAuthStore(state => state.role);
  const logout = useAuthStore(state => state.logout);

  if (!isAuthenticated) return <Login />;

  return (
    <div className="min-h-screen bg-surface font-body text-gray-900 pb-12">
      {/* App Bar Compartido */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-display font-bold text-xl">
                C
              </div>
              <h1 className="font-display font-bold text-xl tracking-tight text-primary">ContaSys</h1>
            </div>
            {/* Navegación rápida interna */}
            <nav className="hidden md:flex gap-4 border-l border-gray-300 pl-6">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={`text-sm font-semibold transition-colors ${currentView === 'dashboard' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
              >
                Dashboard
              </button>
              
              {(role === 'ADMIN' || role === 'HR') && (
                <button 
                  onClick={() => setCurrentView('payroll')}
                  className={`text-sm font-semibold transition-colors ${currentView === 'payroll' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  Simulador Nómina
                </button>
              )}
              
              {(role === 'ADMIN' || role === 'BILLER') && (
                <>
                  <button 
                    onClick={() => setCurrentView('invoice')}
                    className={`text-sm font-semibold transition-colors ${currentView === 'invoice' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Emisión CFDI
                  </button>
                  <button 
                    onClick={() => setCurrentView('rep')}
                    className={`text-sm font-semibold transition-colors ${currentView === 'rep' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Pagos (REP)
                  </button>
                </>
              )}

              {(role === 'ADMIN' || role === 'ACCOUNTANT') && (
                <>
                  <button 
                    onClick={() => setCurrentView('journal')}
                    className={`text-sm font-semibold transition-colors ${currentView === 'journal' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Contabilidad (Pólizas)
                  </button>
                  <button 
                    onClick={() => setCurrentView('statements')}
                    className={`text-sm font-semibold transition-colors ${currentView === 'statements' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    Estados Financieros
                  </button>
                </>
              )}
              
              {(role === 'ADMIN' || role === 'BILLER') && (
                 <button 
                  onClick={() => setCurrentView('catalogs')}
                  className={`text-sm font-semibold transition-colors ${currentView === 'catalogs' ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
                >
                  Catálogos SAT
                </button>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-surface-high border-2 border-white shadow-sm overflow-hidden">
              <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="User avatar" />
            </div>
          </div>
        </div>
      </header>

      {/* Ruteo sencillo basado en estado */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'payroll' && (
          <div className="max-w-5xl mx-auto pt-4">
             <PayrollCalculator />
          </div>
        )}
        {currentView === 'invoice' && (
          <div className="max-w-7xl mx-auto pt-4 pb-12">
             <InvoiceForm />
          </div>
        )}
        {currentView === 'journal' && (
          <div className="max-w-7xl mx-auto pt-4 pb-12">
             <JournalCapture />
          </div>
        )}
        {currentView === 'catalogs' && (
          <div className="max-w-7xl mx-auto pt-4 pb-12">
             <CatalogsView />
          </div>
        )}
        {currentView === 'rep' && (
          <div className="max-w-7xl mx-auto pt-4 pb-12">
             <PaymentComplement />
          </div>
        )}
        {currentView === 'statements' && (
          <div className="max-w-7xl mx-auto pt-4 pb-12">
             <FinancialStatements />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
