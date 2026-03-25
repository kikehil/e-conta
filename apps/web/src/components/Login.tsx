import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@fincasanmiguel.com.mx');
  const [password, setPassword] = useState('********');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const login = useAuthStore(state => state.login);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    // Simulate API Call providing an ADMIN role for the demo
    setTimeout(() => {
      login('mock_jwt_token_12345', 'tenant_01_fsm', 'ADMIN');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-body">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-white text-primary flex items-center justify-center font-display font-bold text-4xl shadow-lg shadow-black/20">
            C
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-display tracking-tight font-extrabold text-white">
          ContaSys Multi-Tenant
        </h2>
        <p className="mt-2 text-center text-sm text-surface-high">
          Acceso seguro al portal corporativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-lowest py-8 px-4 shadow-xl sm:rounded-3xl sm:px-10 border border-white/10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border-2 border-surface-high rounded-xl placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm font-medium transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border-2 border-surface-high rounded-xl placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm font-medium transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 font-medium">
                  Recordarme en este equipo
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-semibold text-primary hover:text-primary-container">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? (
                  <span className="animate-pulse">Autenticando al SAT...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Ingresar al Sistema
                  </>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
             <div className="text-center text-xs text-gray-400">
                Sistema de Control Fiscal Mexicano (NIF / CFF 2024)
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
