import React, { useState, useEffect, useMemo } from 'react';
import { Users, Package, Search, Plus, Loader2, AlertCircle, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface ThirdParty {
  id: string;
  rfc: string;
  razonSocial: string;
  partyType: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';
  email: string | null;
  creditDays: number;
}

interface Product {
  id: string;
  sku: string | null;
  name: string;
  productServiceKey: string;
  unitKey: string;
  salePrice: number;
  vatRate: number;
  isActive: boolean;
}

interface ThirdPartyForm {
  rfc: string;
  razonSocial: string;
  partyType: 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';
  email: string;
  creditDays: string;
}

interface ProductForm {
  name: string;
  sku: string;
  productServiceKey: string;
  unitKey: string;
  unitName: string;
  salePrice: string;
  vatRate: string;
}

const EMPTY_THIRD_PARTY_FORM: ThirdPartyForm = {
  rfc: '',
  razonSocial: '',
  partyType: 'CLIENTE',
  email: '',
  creditDays: '0',
};

const EMPTY_PRODUCT_FORM: ProductForm = {
  name: '',
  sku: '',
  productServiceKey: '',
  unitKey: '',
  unitName: '',
  salePrice: '',
  vatRate: '0.16',
};

export const CatalogsView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [activeTab, setActiveTab] = useState<'clients' | 'products'>('clients');

  // Third parties state
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [tpLoading, setTpLoading] = useState(false);
  const [tpError, setTpError] = useState<string | null>(null);
  const [tpSearch, setTpSearch] = useState('');
  const [showTpModal, setShowTpModal] = useState(false);
  const [tpForm, setTpForm] = useState<ThirdPartyForm>(EMPTY_THIRD_PARTY_FORM);
  const [tpSaving, setTpSaving] = useState(false);
  const [tpSaveError, setTpSaveError] = useState<string | null>(null);

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodSearch, setProdSearch] = useState('');
  const [showProdModal, setShowProdModal] = useState(false);
  const [prodForm, setProdForm] = useState<ProductForm>(EMPTY_PRODUCT_FORM);
  const [prodSaving, setProdSaving] = useState(false);
  const [prodSaveError, setProdSaveError] = useState<string | null>(null);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Fetch third parties
  useEffect(() => {
    if (activeTab !== 'clients') return;
    const fetchTp = async () => {
      setTpLoading(true);
      setTpError(null);
      try {
        const res = await fetch('/api/catalogs/third-parties', { headers: authHeaders });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Error ${res.status}`);
        }
        const json = await res.json();
        setThirdParties(json.data);
      } catch (err: unknown) {
        setTpError(err instanceof Error ? err.message : 'Error al cargar terceros');
      } finally {
        setTpLoading(false);
      }
    };
    fetchTp();
  }, [activeTab, token]);

  // Fetch products
  useEffect(() => {
    if (activeTab !== 'products') return;
    const fetchProds = async () => {
      setProdLoading(true);
      setProdError(null);
      try {
        const res = await fetch('/api/catalogs/products', { headers: authHeaders });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || `Error ${res.status}`);
        }
        const json = await res.json();
        setProducts(json.data);
      } catch (err: unknown) {
        setProdError(err instanceof Error ? err.message : 'Error al cargar productos');
      } finally {
        setProdLoading(false);
      }
    };
    fetchProds();
  }, [activeTab, token]);

  // Filtered lists (local search)
  const filteredTp = useMemo(() => {
    const q = tpSearch.toLowerCase();
    if (!q) return thirdParties;
    return thirdParties.filter(
      t => t.rfc.toLowerCase().includes(q) || t.razonSocial.toLowerCase().includes(q)
    );
  }, [thirdParties, tpSearch]);

  const filteredProds = useMemo(() => {
    const q = prodSearch.toLowerCase();
    if (!q) return products;
    return products.filter(
      p => p.name.toLowerCase().includes(q) || p.productServiceKey.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, prodSearch]);

  // Save new third party
  const handleSaveThirdParty = async () => {
    setTpSaving(true);
    setTpSaveError(null);
    try {
      const res = await fetch('/api/catalogs/third-parties', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          rfc: tpForm.rfc.toUpperCase(),
          razonSocial: tpForm.razonSocial,
          partyType: tpForm.partyType,
          email: tpForm.email || null,
          creditDays: parseInt(tpForm.creditDays || '0', 10),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const json = await res.json();
      setThirdParties(prev => [json.data, ...prev]);
      setShowTpModal(false);
      setTpForm(EMPTY_THIRD_PARTY_FORM);
    } catch (err: unknown) {
      setTpSaveError(err instanceof Error ? err.message : 'Error al guardar tercero');
    } finally {
      setTpSaving(false);
    }
  };

  // Save new product
  const handleSaveProduct = async () => {
    setProdSaving(true);
    setProdSaveError(null);
    try {
      const res = await fetch('/api/catalogs/products', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: prodForm.name,
          sku: prodForm.sku || null,
          productServiceKey: prodForm.productServiceKey,
          unitKey: prodForm.unitKey,
          unitName: prodForm.unitName || null,
          salePrice: parseFloat(prodForm.salePrice || '0'),
          vatRate: parseFloat(prodForm.vatRate || '0.16'),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const json = await res.json();
      setProducts(prev => [json.data, ...prev]);
      setShowProdModal(false);
      setProdForm(EMPTY_PRODUCT_FORM);
    } catch (err: unknown) {
      setProdSaveError(err instanceof Error ? err.message : 'Error al guardar producto');
    } finally {
      setProdSaving(false);
    }
  };

  const partyTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      CLIENTE: 'bg-blue-100 text-blue-700',
      PROVEEDOR: 'bg-amber-100 text-amber-700',
      AMBOS: 'bg-purple-100 text-purple-700',
    };
    return map[type] ?? 'bg-gray-100 text-gray-600';
  };

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

      {/* ── CLIENTES / PROVEEDORES ── */}
      {activeTab === 'clients' && (
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-surface-low">
            <div className="relative w-96">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tpSearch}
                onChange={e => setTpSearch(e.target.value)}
                placeholder="Buscar por Nombre o RFC..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={() => { setShowTpModal(true); setTpSaveError(null); }}
              className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Tercero
            </button>
          </div>

          {tpLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-gray-500 text-sm">Cargando...</span>
            </div>
          )}

          {tpError && !tpLoading && (
            <div className="flex items-center gap-3 m-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {tpError}
            </div>
          )}

          {!tpLoading && !tpError && filteredTp.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">No hay terceros registrados.</div>
          )}

          {!tpLoading && !tpError && filteredTp.length > 0 && (
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">RFC</th>
                  <th className="px-6 py-4">Razón Social</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-right">Días Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTp.map(t => (
                  <tr key={t.id} className="hover:bg-surface-low/50 transition-colors cursor-pointer">
                    <td className="px-6 py-4 font-bold font-display text-gray-900">{t.rfc}</td>
                    <td className="px-6 py-4 font-medium text-gray-700">{t.razonSocial}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${partyTypeBadge(t.partyType)}`}>
                        {t.partyType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{t.email ?? '—'}</td>
                    <td className="px-6 py-4 text-right text-gray-600 tabular-nums">{t.creditDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── PRODUCTOS / SERVICIOS ── */}
      {activeTab === 'products' && (
        <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-surface-low">
            <div className="relative w-96">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                placeholder="Buscar por Clave SAT o Descripción..."
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={() => { setShowProdModal(true); setProdSaveError(null); }}
              className="bg-primary hover:bg-primary-container text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Producto
            </button>
          </div>

          {prodLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-gray-500 text-sm">Cargando...</span>
            </div>
          )}

          {prodError && !prodLoading && (
            <div className="flex items-center gap-3 m-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {prodError}
            </div>
          )}

          {!prodLoading && !prodError && filteredProds.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">No hay productos registrados.</div>
          )}

          {!prodLoading && !prodError && filteredProds.length > 0 && (
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Clave Prod/Serv (SAT)</th>
                  <th className="px-6 py-4">Cve. Unidad</th>
                  <th className="px-6 py-4 w-1/3">Nombre</th>
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4 text-right">IVA</th>
                  <th className="px-6 py-4 text-right">Precio Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProds.map(p => (
                  <tr key={p.id} className={`hover:bg-surface-low/50 transition-colors cursor-pointer ${!p.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 font-bold font-display text-primary tracking-wide">{p.productServiceKey}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{p.unitKey}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{p.name}</td>
                    <td className="px-6 py-4 text-gray-500">{p.sku ?? '—'}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{(p.vatRate * 100).toFixed(0)}%</td>
                    <td className="px-6 py-4 font-bold text-gray-900 text-right tabular-nums">
                      ${p.salePrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODAL: NUEVO TERCERO ── */}
      {showTpModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Tercero</h3>
              <button onClick={() => setShowTpModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">RFC *</label>
                <input
                  type="text"
                  value={tpForm.rfc}
                  onChange={e => setTpForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                  maxLength={13}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none uppercase font-bold"
                  placeholder="XAXX010101000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Razón Social *</label>
                <input
                  type="text"
                  value={tpForm.razonSocial}
                  onChange={e => setTpForm(f => ({ ...f, razonSocial: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="Nombre o Razón Social"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tipo *</label>
                <select
                  value={tpForm.partyType}
                  onChange={e => setTpForm(f => ({ ...f, partyType: e.target.value as ThirdPartyForm['partyType'] }))}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none bg-transparent"
                >
                  <option value="CLIENTE">Cliente</option>
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                <input
                  type="email"
                  value={tpForm.email}
                  onChange={e => setTpForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Días de Crédito</label>
                <input
                  type="number"
                  value={tpForm.creditDays}
                  onChange={e => setTpForm(f => ({ ...f, creditDays: e.target.value }))}
                  min={0}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {tpSaveError && (
              <div className="mt-4 flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> {tpSaveError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTpModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveThirdParty}
                disabled={tpSaving || !tpForm.rfc || !tpForm.razonSocial}
                className="flex-1 bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {tpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO PRODUCTO ── */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Nuevo Producto / Servicio</h3>
              <button onClick={() => setShowProdModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre *</label>
                <input
                  type="text"
                  value={prodForm.name}
                  onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="Descripción del producto o servicio"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">SKU</label>
                  <input
                    type="text"
                    value={prodForm.sku}
                    onChange={e => setProdForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    placeholder="SRV-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">IVA *</label>
                  <select
                    value={prodForm.vatRate}
                    onChange={e => setProdForm(f => ({ ...f, vatRate: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none bg-transparent"
                  >
                    <option value="0.16">16%</option>
                    <option value="0.08">8% (frontera)</option>
                    <option value="0.00">0%</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Clave SAT *</label>
                  <input
                    type="text"
                    value={prodForm.productServiceKey}
                    onChange={e => setProdForm(f => ({ ...f, productServiceKey: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none font-mono"
                    placeholder="84111506"
                    maxLength={8}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cve. Unidad *</label>
                  <input
                    type="text"
                    value={prodForm.unitKey}
                    onChange={e => setProdForm(f => ({ ...f, unitKey: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none uppercase font-mono"
                    placeholder="E48"
                    maxLength={6}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Nombre Unidad</label>
                <input
                  type="text"
                  value={prodForm.unitName}
                  onChange={e => setProdForm(f => ({ ...f, unitName: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  placeholder="Servicio"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Precio de Venta *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    value={prodForm.salePrice}
                    onChange={e => setProdForm(f => ({ ...f, salePrice: e.target.value }))}
                    className="w-full pl-7 pr-3 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none tabular-nums"
                    placeholder="0.00"
                    min={0}
                  />
                </div>
              </div>
            </div>

            {prodSaveError && (
              <div className="mt-4 flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" /> {prodSaveError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProdModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={prodSaving || !prodForm.name || !prodForm.productServiceKey || !prodForm.unitKey || !prodForm.salePrice}
                className="flex-1 bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl font-bold transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {prodSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
