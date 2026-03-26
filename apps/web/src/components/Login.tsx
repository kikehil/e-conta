import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { Lock, Building2, Shield, UserPlus } from 'lucide-react';
import axios from 'axios';

const API_URL = '/api/auth';

export const Login: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rfc, setRfc] = useState('');
  const [userName, setUserName] = useState('');

  const loginState = useAuthStore(state => state.loginState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    try {
      if (isRegisterMode) {
        const res = await axios.post(`${API_URL}/register`, { companyName, rfc, userName, email, password });
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        loginState(res.data.token, 'company-id', res.data.user.role, res.data.user.name, res.data.user.companyName);
      } else {
        const res = await axios.post(`${API_URL}/login`, { email, password });
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        loginState(res.data.token, 'company-id', res.data.user.role, res.data.user.name, res.data.user.companyName);
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error de conexión. Verifica las credenciales.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-body">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white text-primary flex items-center justify-center font-display font-bold text-5xl shadow-lg shadow-black/20">
            C
          </div>
        </div>
        <h2 className="text-center text-4xl font-display tracking-tight font-extrabold text-white">
          ContaSys Cloud
        </h2>
        <p className="mt-2 text-center text-md text-surface-high font-medium tracking-wide">
          {isRegisterMode ? 'Registra tu empresa y genera tu primera factura.' : 'Acceso seguro al portal corporativo.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-surface-lowest py-8 px-4 shadow-2xl sm:rounded-3xl sm:px-12 border border-white/10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {isRegisterMode && (
              <>
                <div className="col-span-2 border-b-2 border-primary/20 pb-2 mb-4">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Building2 className="w-5 h-5"/> 1. Datos del Nuevo Tenant (SaaS)</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre Comercial de Empresa</label>
                    <input type="text" required value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" placeholder="Ej. Finca San Miguel"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">RFC Principal</label>
                    <input type="text" required value={rfc} onChange={e => setRfc(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none uppercase font-mono" placeholder="CACX7605101P8"/>
                  </div>
                </div>

                <div className="col-span-2 border-b-2 border-primary/20 pb-2 mt-8 mb-4">
                  <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Shield className="w-5 h-5"/> 2. Administrador Dueño</h3>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tu Nombre Completo</label>
                  <input type="text" required value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" placeholder="Juan Pérez"/>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Correo Electrónico</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" placeholder="admin@empresa.com" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contraseña Segura</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" placeholder="********" />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {isAuthenticating ? (
                  <span className="animate-pulse">Conectando a PostgreSQL...</span>
                ) : (
                  <>
                    {isRegisterMode ? <UserPlus className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    {isRegisterMode ? 'Crear mi Empresa' : 'Entrar a Mi Empresa'}
                  </>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <button 
              type="button"
              onClick={() => { setIsRegisterMode(!isRegisterMode); setEmail(''); setPassword(''); }}
              className="text-sm font-bold text-primary hover:text-primary-container uppercase tracking-wide transition-colors"
            >
              {isRegisterMode ? '¿Ya tienes cuenta? Inicia Sesión Aquí' : '¿Eres nuevo? Crea tu Empresa (SaaS)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
