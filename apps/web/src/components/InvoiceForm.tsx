import React, { useState, useMemo, useRef } from 'react';
import Decimal from 'decimal.js';
import { applyItemVAT } from '@contasys/tax-calculator';
import { Plus, Trash2, Send, Receipt, Component, Save, Building, CreditCard, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth';

interface Concept {
  id: string;
  claveProdServ: string;
  cantidad: string;
  claveUnidad: string;
  descripcion: string;
  valorUnitario: string;
  descuento: string;
  objetoImp: string;
  tasaIva: string;
}

export const InvoiceForm: React.FC = () => {
  const token = useAuthStore(s => s.token);

  const [conceptos, setConceptos] = useState<Concept[]>([
    {
      id: '1', claveProdServ: '84111506', cantidad: '1', claveUnidad: 'E48',
      descripcion: 'Honorarios por Servicios Contables del mes de Mayo 2024',
      valorUnitario: '5000', descuento: '0', objetoImp: '02', tasaIva: '0.16'
    }
  ]);

  const [metodoPago, setMetodoPago] = useState('PUE');
  const [formaPago, setFormaPago] = useState('03');

  // Receptor refs
  const razonSocialRef = useRef<HTMLInputElement>(null);
  const rfcRef = useRef<HTMLInputElement>(null);
  const regimenFiscalRef = useRef<HTMLSelectElement>(null);
  const usoCfdiRef = useRef<HTMLSelectElement>(null);
  const cpRef = useRef<HTMLInputElement>(null);

  // Button states
  const [saving, setSaving] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const addConcepto = () => {
    setConceptos([...conceptos, {
      id: Date.now().toString(), claveProdServ: '', cantidad: '1', claveUnidad: 'H87',
      descripcion: '', valorUnitario: '0', descuento: '0', objetoImp: '02', tasaIva: '0.16'
    }]);
  };

  const updateConcepto = (id: string, field: keyof Concept, value: string) => {
    setConceptos(conceptos.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeConcepto = (id: string) => setConceptos(conceptos.filter(c => c.id !== id));

  // Cálculos dinámicos utilizando Decimal.js (tax-calculator dependency)
  const totals = useMemo(() => {
    let subtotal = new Decimal(0);
    let totalDescuento = new Decimal(0);
    let totalIvaTranslado = new Decimal(0);

    conceptos.forEach(c => {
      try {
        const qty = new Decimal(c.cantidad || 0);
        const unitVal = new Decimal(c.valorUnitario || 0);
        const disc = new Decimal(c.descuento || 0);

        const sub = qty.mul(unitVal);
        const base = sub.minus(disc);

        subtotal = subtotal.plus(sub);
        totalDescuento = totalDescuento.plus(disc);

        if (c.objetoImp === '02') {
          const iva = applyItemVAT(base, new Decimal(c.tasaIva || 0));
          totalIvaTranslado = totalIvaTranslado.plus(iva);
        }
      } catch (_e) {
        // Ignorar filas con montos inválidos en typing
      }
    });

    const total = subtotal.minus(totalDescuento).plus(totalIvaTranslado);

    return {
      subtotal: subtotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      descuento: totalDescuento.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      iva: totalIvaTranslado.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      total: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    };
  }, [conceptos]);

  const buildInvoiceBody = () => ({
    invoiceType: 'I',
    folio: Date.now().toString(),
    issueDate: new Date().toISOString(),
    paymentMethod: metodoPago,
    paymentForm: metodoPago === 'PPD' ? '99' : formaPago,
    currency: 'MXN',
    exchangeRate: 1,
    useCfdi: usoCfdiRef.current?.value ?? 'G03',
    thirdPartyId: null,
    receptor: {
      rfc: rfcRef.current?.value ?? '',
      nombre: razonSocialRef.current?.value ?? '',
      domicilioFiscalReceptor: cpRef.current?.value ?? '',
      regimenFiscalReceptor: regimenFiscalRef.current?.value ?? '601',
      usoCFDI: usoCfdiRef.current?.value ?? 'G03',
    },
    subtotal: totals.subtotal,
    discount: totals.descuento,
    taxesTransferred: totals.iva,
    taxesWithheld: 0,
    total: totals.total,
    lines: conceptos.map((c, idx) => ({
      lineNumber: idx + 1,
      productServiceKey: c.claveProdServ,
      unitKey: c.claveUnidad,
      description: c.descripcion,
      quantity: parseFloat(c.cantidad || '1'),
      unitPrice: parseFloat(c.valorUnitario || '0'),
      discount: parseFloat(c.descuento || '0'),
      subtotal: new Decimal(c.cantidad || 0).mul(new Decimal(c.valorUnitario || 0)).minus(new Decimal(c.descuento || 0)).toNumber(),
      taxObject: c.objetoImp,
      taxes: c.objetoImp === '02' ? [
        { type: 'IVA', factor: 'Tasa', rate: parseFloat(c.tasaIva || '0.16'), base: new Decimal(c.cantidad || 0).mul(new Decimal(c.valorUnitario || 0)).minus(new Decimal(c.descuento || 0)).toNumber(), amount: new Decimal(c.cantidad || 0).mul(new Decimal(c.valorUnitario || 0)).minus(new Decimal(c.descuento || 0)).mul(new Decimal(c.tasaIva || '0.16')).toNumber() }
      ] : [],
    })),
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(buildInvoiceBody()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Error al guardar: ${err.message ?? res.status}`);
        return;
      }
      const json = await res.json();
      const id = json.data?.id ?? json.id;
      setCreatedInvoiceId(id);
      alert(`Borrador guardado. ID: ${id}`);
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStamp = async () => {
    const invoiceId = createdInvoiceId;
    if (!invoiceId) {
      alert('Primero guarda el borrador antes de timbrar.');
      return;
    }
    setStamping(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/stamp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Error del PAC: ${err.message ?? res.status}`);
        return;
      }
      const json = await res.json();
      const uuid = json.data?.satUuid ?? json.satUuid ?? 'N/A';
      alert(`Factura timbrada exitosamente.\nUUID SAT: ${uuid}`);
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setStamping(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight flex items-center gap-3">
            <Receipt className="text-primary-container w-8 h-8" />
            Emisión de CFDI 4.0
          </h2>
          <p className="text-gray-500 mt-2 text-sm">Validaciones cruzadas en tiempo real para el Anexo 20 del SAT</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || stamping}
            className="px-4 py-2 border-2 border-primary/20 font-bold text-primary rounded-xl hover:bg-surface-low transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Borrador'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-8 space-y-6">

          {/* BLOQUE RECEPTOR Y METODO DE PAGO */}
          <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
            <div className="bg-surface-low px-6 py-4 flex items-center gap-2 border-b border-black/5">
              <Building className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-700 uppercase tracking-widest text-sm">Datos del Receptor</h3>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Razón Social</label>
                <input ref={razonSocialRef} type="text" className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none transition-colors" defaultValue="COMERCIALIZADORA DE INSUMOS INDUSTRIALES SA DE CV" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">RFC</label>
                <input ref={rfcRef} type="text" className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none uppercase font-bold" defaultValue="CII1810243K1" maxLength={13} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Régimen Fiscal</label>
                <select ref={regimenFiscalRef} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none bg-transparent">
                  <option value="601">601 - General de Ley Personas Morales</option>
                  <option value="612">612 - Personas Físicas con Actividades</option>
                  <option value="626">626 - RESICO Personas Físicas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Uso de CFDI</label>
                <select ref={usoCfdiRef} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none bg-transparent">
                  <option value="G03">G03 - Gastos en general</option>
                  <option value="G01">G01 - Adquisición de mercancias</option>
                  <option value="S01">S01 - Sin efectos fiscales</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Código Postal</label>
                <input ref={cpRef} type="text" className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none tabular-nums" defaultValue="64000" maxLength={5} />
              </div>
            </div>
          </div>

          {/* CONCEPTOS (TABLA) */}
          <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 overflow-hidden">
            <div className="bg-surface-low px-6 py-4 flex justify-between items-center border-b border-black/5">
              <div className="flex items-center gap-2">
                <Component className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-gray-700 uppercase tracking-widest text-sm">Conceptos Facturados</h3>
              </div>
              <button onClick={addConcepto} className="text-primary hover:text-primary-container text-sm font-bold flex items-center gap-1">
                <Plus className="w-4 h-4" /> Agregar Línea
              </button>
            </div>

            <div className="overflow-x-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold border-b border-black/5">
                    <th className="px-4 py-3">Clave SAT</th>
                    <th className="px-4 py-3 w-1/3">Descripción</th>
                    <th className="px-4 py-3 text-right">Cant</th>
                    <th className="px-4 py-3">Unidad</th>
                    <th className="px-4 py-3 text-right">P. Unitario</th>
                    <th className="px-4 py-3 text-center">Obj. Imp.</th>
                    <th className="px-4 py-3 text-right">IVA</th>
                    <th className="px-4 py-3 text-center">X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {conceptos.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-low/30">
                      <td className="px-4 py-2">
                        <input type="text" value={c.claveProdServ} onChange={e => updateConcepto(c.id, 'claveProdServ', e.target.value)} className="w-20 px-2 py-1.5 text-xs border rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary" placeholder="00000000" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={c.descripcion} onChange={e => updateConcepto(c.id, 'descripcion', e.target.value)} className="w-full px-2 py-1.5 text-xs border rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Descripción del servicio/producto" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" value={c.cantidad} onChange={e => updateConcepto(c.id, 'cantidad', e.target.value)} className="w-16 px-2 py-1.5 text-xs text-right border rounded bg-gray-50 focus:bg-white focus:outline-none tabular-nums" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={c.claveUnidad} onChange={e => updateConcepto(c.id, 'claveUnidad', e.target.value)} className="w-12 px-2 py-1.5 text-xs border rounded bg-gray-50 focus:bg-white focus:outline-none uppercase" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" value={c.valorUnitario} onChange={e => updateConcepto(c.id, 'valorUnitario', e.target.value)} className="w-24 px-2 py-1.5 text-xs text-right border rounded bg-gray-50 focus:bg-white focus:outline-none tabular-nums font-bold" />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <select value={c.objetoImp} onChange={e => updateConcepto(c.id, 'objetoImp', e.target.value)} className="w-14 px-2 py-1.5 text-xs border rounded bg-gray-50 focus:outline-none">
                          <option value="01">01</option>
                          <option value="02">02</option>
                          <option value="03">03</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <select disabled={c.objetoImp !== '02'} value={c.tasaIva} onChange={e => updateConcepto(c.id, 'tasaIva', e.target.value)} className="w-16 px-2 py-1.5 text-xs border rounded bg-gray-50 focus:outline-none disabled:opacity-50">
                          <option value="0.16">16%</option>
                          <option value="0.08">8%</option>
                          <option value="0.00">0%</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => removeConcepto(c.id)} className="text-gray-400 hover:text-rose-500 transition-colors p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conceptos.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">No tienes conceptos. Haz clic en "Agregar Línea" para cobrar un servicio.</div>
            )}
          </div>

        </div>

        {/* SIDEBAR DERECHO: PAGO Y TOTALES */}
        <div className="lg:col-span-4 space-y-6">

          <div className="bg-surface-lowest rounded-2xl shadow-sm border border-black/5 p-6">
            <h3 className="font-bold text-gray-700 uppercase tracking-widest text-sm flex items-center gap-2 mb-6">
              <CreditCard className="w-4 h-4 text-gray-500" />
              Condiciones de Pago
            </h3>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Método (PUE/PPD)</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none bg-transparent font-medium">
                  <option value="PUE">PUE - Pago en una sola exhibición</option>
                  <option value="PPD">PPD - Pago en parcialidades o diferido</option>
                </select>
                {metodoPago === 'PPD' && <p className="text-[11px] text-amber-600 mt-1">Con PPD se obliga a FormaPago = 99 y requerirá Complemento de Pago posterior.</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Forma de Pago</label>
                <select value={formaPago} onChange={e => setFormaPago(e.target.value)} disabled={metodoPago === 'PPD'} className="w-full px-3 py-2 border-b-2 border-gray-200 focus:border-primary focus:outline-none bg-transparent disabled:opacity-50">
                  <option value="01">01 - Efectivo</option>
                  <option value="02">02 - Cheque nominativo</option>
                  <option value="03">03 - Transferencia electrónica</option>
                  <option value="04">04 - Tarjeta de crédito</option>
                  <option value="99">99 - Por definir</option>
                </select>
              </div>
            </div>
          </div>

          {/* TOTALES */}
          <div className="bg-surface-highest rounded-2xl shadow-inner border border-black/5 p-6">
            <h3 className="font-bold text-gray-700 uppercase tracking-widest text-sm border-b border-gray-300 pb-3 mb-4">Totales a Timbrar</h3>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold tabular-nums">${totals.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
              {totals.descuento > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Descuento</span>
                  <span className="font-bold tabular-nums">-${totals.descuento.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IVA Trasladado</span>
                <span className="font-bold tabular-nums text-emerald-700">${totals.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t border-gray-300 items-baseline">
              <span className="font-bold text-gray-800">TOTAL MXN</span>
              <span className="text-3xl font-display font-extrabold text-primary tracking-tight tabular-nums">
                ${totals.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={handleStamp}
              disabled={saving || stamping}
              className="w-full mt-8 bg-primary hover:bg-primary-container text-white px-6 py-4 rounded-xl font-bold font-body transition-colors flex items-center justify-center gap-2 shadow-sm text-lg disabled:opacity-50"
            >
              {stamping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {stamping ? 'Timbrando...' : 'Timbrar Factura SAT'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3 font-medium">Conectado a PAC Finkok (Producción)</p>
          </div>

        </div>
      </div>
    </div>
  );
};
