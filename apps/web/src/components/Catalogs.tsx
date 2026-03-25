import React, { useState } from 'react';
import { Users, Package, Search, Plus, Save } from 'lucide-react';

export const CatalogsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'clients' | 'products'>('clients');

  // Mocks hasta que se enchufe la BD
  const [clients] = useState([
    { rfc: 'XAXX010101000', name: 'Público en General', regimen: '616', cp: '00000' },
    { rfc: 'CACX7605101P8', name: 'Consultoría Especializada S.A. de C.V.', regimen: '601', cp: '11560' },
  ]);

  const [products] = useState([
    { satCode: '84111506', unit: 'E48', desc: 'Servicios de facturación', price: '1,500.00' },
    { satCode: '80101500', unit: 'E48', desc: 'Consultoría de negocios', price: '4,500.00' },
  ]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight">Catálogos Fiscales (SAT)</h2>
          <p className="text-gray-500 mt-2 text-sm">Organiza a tus clientes, proveedores y productos antes de facturar.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 pb-px">
        <button 
          onClick={() => setActiveTab('clients')}
          className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${activeTab === 'clients' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
          <Users className="w-5 h-5" />
          Directorio (Clientes / Prov)
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-6 py-3 font-bold transition-colors border-b-2 uppercase tracking-wide text-sm ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
          <Package className="w-5 h-5" />
          Bienes y Servicios (c_ProdServ)
        </button>
      </div>

      {activeTab === 'clients' && (
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-surface-low">
            <div className="relative w-96">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar por Nombre o RFC..." className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" />
            </div>
            <button className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Nuevo Cliente
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">RFC</th>
                <th className="px-6 py-4">Razón Social</th>
                <th className="px-6 py-4">Régimen Fiscal (SAT)</th>
                <th className="px-6 py-4">C.P. (Domicilio)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c, i) => (
                <tr key={i} className="hover:bg-surface-low/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-bold font-display text-gray-900">{c.rfc}</td>
                  <td className="px-6 py-4 font-medium text-gray-700">{c.name}</td>
                  <td className="px-6 py-4 text-blue-600 font-medium">{c.regimen}</td>
                  <td className="px-6 py-4 text-gray-500 tabular-nums">{c.cp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-surface-low">
             <div className="relative w-96">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar por Clave SAT o Descripción..." className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none" />
            </div>
            <button className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Nuevo Servicio
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Clave Prod/Serv (SAT)</th>
                <th className="px-6 py-4">Cve. Unidad</th>
                <th className="px-6 py-4 w-1/3">Descripción (Concepto)</th>
                <th className="px-6 py-4 text-right">Valor Unitario Sugerido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {products.map((p, i) => (
                <tr key={i} className="hover:bg-surface-low/50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 font-bold font-display text-primary tracking-wide">{p.satCode}</td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{p.unit}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{p.desc}</td>
                  <td className="px-6 py-4 font-bold text-gray-900 text-right tabular-nums">${p.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
