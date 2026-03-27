import React, { useState, useEffect } from 'react';
import { Users, Plus, X, RefreshCw, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/auth';

const API = '/api';

interface Employee {
  id: string;
  rfc: string;
  curp: string;
  nss: string | null;
  fullName: string;
  email: string | null;
  hireDate: string;
  employmentType: string;
  workShift: string | null;
  dailyWage: number;
  sdi: number;
  integrationFactor: number;
  imssRiskClass: number;
  jobTitle: string | null;
  status: string;
}

const EMPTY_FORM = {
  rfc: '', curp: '', nss: '', fullName: '', email: '',
  hireDate: '', employmentType: 'INDEFINIDO', workShift: 'DIURNA',
  dailyWage: '', integrationFactor: '1.0452', imssRiskClass: '1',
  jobTitle: '', bankClabe: '',
};

export const EmployeesView: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState('');

  const fetchEmployees = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/payroll/employees`, { headers });
      const j = await res.json();
      if (res.ok) setEmployees(j.data || []);
      else setError(j.error || 'Error al cargar empleados');
    } catch { setError('Error de conexión'); }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.rfc || !form.curp || !form.fullName || !form.hireDate || !form.dailyWage || !form.employmentType) {
      alert('Completa todos los campos obligatorios (*)'); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/payroll/employees`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...form,
          rfc: form.rfc.toUpperCase(),
          curp: form.curp.toUpperCase(),
          dailyWage: parseFloat(form.dailyWage),
          integrationFactor: parseFloat(form.integrationFactor),
          imssRiskClass: parseInt(form.imssRiskClass),
        }),
      });
      const j = await res.json();
      if (res.ok) {
        alert(`✅ Empleado dado de alta: ${j.data.fullName}`);
        setShowForm(false);
        setForm({ ...EMPTY_FORM });
        fetchEmployees();
      } else {
        alert(j.error || 'Error al guardar empleado');
      }
    } catch { alert('Error de conexión'); }
    setSaving(false);
  };

  const filtered = employees.filter(e =>
    e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    e.rfc.toLowerCase().includes(search.toLowerCase()) ||
    (e.jobTitle || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-extrabold text-primary tracking-tight flex items-center gap-3">
            <Users className="text-primary-container w-8 h-8" />
            Empleados
          </h2>
          <p className="text-gray-500 mt-2 text-sm">Alta y gestión de trabajadores (LFT + IMSS)</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-primary/90 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Empleado
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RFC o puesto..."
          className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" /> Cargando empleados...
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-6 text-rose-600">
            <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? 'Sin resultados para tu búsqueda' : 'No hay empleados registrados'}</p>
            {!search && <p className="text-sm mt-1">Usa "+ Nuevo Empleado" para dar de alta al primer trabajador</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <tr>
                <th className="px-6 py-3 text-left">Nombre</th>
                <th className="px-6 py-3 text-left">RFC / CURP</th>
                <th className="px-6 py-3 text-left">Puesto</th>
                <th className="px-6 py-3 text-left">Tipo</th>
                <th className="px-6 py-3 text-right">Salario Diario</th>
                <th className="px-6 py-3 text-right">SDI</th>
                <th className="px-6 py-3 text-center">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div>
                        <div>{emp.fullName}</div>
                        {emp.email && <div className="text-xs text-gray-400">{emp.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    <div>{emp.rfc}</div>
                    <div className="text-gray-400">{emp.curp}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{emp.jobTitle || '—'}</td>
                  <td className="px-6 py-4 text-gray-600 text-xs">{emp.employmentType}</td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums">
                    ${Number(emp.dailyWage).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-gray-600">
                    ${Number(emp.sdi).toLocaleString('es-MX', { minimumFractionDigits: 4 })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      emp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      emp.status === 'INACTIVE' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {emp.status === 'ACTIVE' ? <UserCheck className="w-3 h-3" /> : null}
                      {emp.status === 'ACTIVE' ? 'Activo' : emp.status === 'INACTIVE' ? 'Inactivo' : 'Baja'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Alta de Empleado */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-display font-bold text-lg text-gray-900">Alta de Empleado</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Datos personales */}
              <div className="md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Datos Personales</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre Completo *</label>
                <input name="fullName" value={form.fullName} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="Apellido Paterno Materno Nombre(s)" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">RFC *</label>
                <input name="rfc" value={form.rfc} onChange={handleChange} maxLength={13}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary uppercase"
                  placeholder="AAAA000000AAA" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CURP *</label>
                <input name="curp" value={form.curp} onChange={handleChange} maxLength={18}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary uppercase"
                  placeholder="AAAA000000HAAAAA00" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">NSS (IMSS)</label>
                <input name="nss" value={form.nss} onChange={handleChange} maxLength={11}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                  placeholder="00000000000" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Correo electrónico</label>
                <input name="email" value={form.email} onChange={handleChange} type="email"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="empleado@empresa.com" />
              </div>

              {/* Relación laboral */}
              <div className="md:col-span-2 mt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Relación Laboral (LFT)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha de Ingreso *</label>
                <input name="hireDate" value={form.hireDate} onChange={handleChange} type="date"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Puesto / Cargo</label>
                <input name="jobTitle" value={form.jobTitle} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                  placeholder="Contador, Vendedor, Gerente..." />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo de Contrato *</label>
                <select name="employmentType" value={form.employmentType} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                  <option value="INDEFINIDO">Tiempo Indefinido</option>
                  <option value="DETERMINADO">Tiempo Determinado</option>
                  <option value="OBRA">Por Obra</option>
                  <option value="TEMPORAL">Temporal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Jornada de Trabajo</label>
                <select name="workShift" value={form.workShift} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                  <option value="DIURNA">Diurna</option>
                  <option value="NOCTURNA">Nocturna</option>
                  <option value="MIXTA">Mixta</option>
                  <option value="POR_HORAS">Por Horas</option>
                  <option value="REDUCIDA">Reducida</option>
                </select>
              </div>

              {/* Salario e IMSS */}
              <div className="md:col-span-2 mt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Salario e IMSS (LSS)</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Salario Diario * (MXN)</label>
                <input name="dailyWage" value={form.dailyWage} onChange={handleChange} type="number" min="0" step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary tabular-nums"
                  placeholder="350.00" />
                <p className="text-xs text-gray-400 mt-0.5">SDI = Salario × {form.integrationFactor} = ${form.dailyWage ? (parseFloat(form.dailyWage) * parseFloat(form.integrationFactor || '1')).toFixed(4) : '0.0000'}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Factor de Integración</label>
                <input name="integrationFactor" value={form.integrationFactor} onChange={handleChange} type="number" min="1" step="0.0001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary tabular-nums" />
                <p className="text-xs text-gray-400 mt-0.5">Mínimo 1.0452 sin prestaciones superiores</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Clase de Riesgo IMSS</label>
                <select name="imssRiskClass" value={form.imssRiskClass} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                  <option value="1">Clase I — Riesgo Mínimo</option>
                  <option value="2">Clase II — Riesgo Bajo</option>
                  <option value="3">Clase III — Riesgo Medio</option>
                  <option value="4">Clase IV — Riesgo Alto</option>
                  <option value="5">Clase V — Riesgo Máximo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CLABE Bancaria (18 dígitos)</label>
                <input name="bankClabe" value={form.bankClabe} onChange={handleChange} maxLength={18}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
                  placeholder="000000000000000000" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : <><UserCheck className="w-4 h-4" /> Dar de Alta</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
