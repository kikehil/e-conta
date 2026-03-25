# CLAUDE.md — Sistema Contable SaaS México
> Blueprint técnico completo para Claude Code. Este archivo define la arquitectura, normativas fiscales mexicanas, estructura de base de datos, módulos y convenciones del proyecto.

---

## 1. Visión del producto

Sistema contable empresarial SaaS y on-premise diseñado para el mercado mexicano, con capacidad multipaís futura. Cumple con todas las obligaciones fiscales del SAT, IMSS, INFONAVIT y normativas contables NIF (Normas de Información Financiera) vigentes en México.

**Modelos de entrega:**
- **SaaS cloud:** subdominios por empresa (`empresa.contasys.mx`), PostgreSQL multi-schema
- **On-premise:** Docker Compose, instalador web, actualización automática

---

## 2. Normativas y leyes mexicanas aplicables

### 2.1 Fiscales (SAT)

| Normativa | Descripción | Impacto en el sistema |
|-----------|-------------|----------------------|
| **CFF** — Código Fiscal de la Federación | Marco general de obligaciones fiscales | Fundamento de toda la lógica fiscal |
| **LISR** — Ley del ISR (DOF vigente) | Impuesto Sobre la Renta personas morales y físicas | Cálculo de retenciones, pagos provisionales, declaración anual |
| **LIVA** — Ley del IVA | IVA 16%, tasa 0%, exento, actos accidentales | Motor de cálculo de IVA en facturas, DIOT |
| **LIEPS** — Ley del IEPS | Impuesto a bebidas, tabacos, combustibles, plásticos | Cálculo en productos afectos a IEPS |
| **RMF** — Resolución Miscelánea Fiscal** | Reglas anuales del SAT (publicación DOF enero cada año) | Validaciones CFDI, catálogos c_TipoDeComprobante, etc. |
| **Anexo 20 de la RMF** | Especificación técnica del CFDI 4.0 | Generación y validación de XML CFDI |

### 2.2 CFDI (Comprobante Fiscal Digital por Internet)

- **Versión vigente:** CFDI 4.0 (obligatorio desde enero 2022)
- **Complementos requeridos:**
  - `Pago20` — Complemento para Recepción de Pagos (REP)
  - `NominaV12` — Recibo de nómina electrónico
  - `CartaPorte31` — Transporte de mercancías
  - `ComercioExterior11` — Exportaciones
  - `Leyendas` — Leyendas fiscales
  - `Retenciones20` — Retenciones e información de pagos
- **Catálogos SAT obligatorios** (actualizados desde `http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_CFDI_complemento_CE.htm`):
  - `c_RegimenFiscal` — Régimen fiscal del emisor/receptor
  - `c_UsoCFDI` — Uso del CFDI (G01, G03, D01, S01…)
  - `c_FormaPago` — Formas de pago (01 Efectivo, 03 Transferencia, 04 Tarjeta…)
  - `c_MetodoPago` — PUE (Pago en Una Exhibición) / PPD (Pago en Parcialidades)
  - `c_ClaveProdServ` — Clave de producto/servicio CFF (catálogo SAT con >50,000 registros)
  - `c_ClaveUnidad` — Unidades de medida (H87 Pieza, E48 Servicio, KGM Kilogramo…)
  - `c_Pais`, `c_Estado`, `c_CodigoPostal`
  - `c_Moneda` — Monedas (MXN, USD, EUR…)
  - `c_TasaOCuota` — Tasas de IVA/IEPS aplicables
  - `c_ObjetoImp` — Objeto de impuesto (01 No objeto, 02 Sí objeto, 03 Sí objeto no obligado)

### 2.3 PAC (Proveedores Autorizados de Certificación)

El sistema debe integrarse con al menos un PAC certificado por el SAT:

```
PACs recomendados para integración inicial:
- Finkok:    https://api.finkok.com  (sandbox + producción)
- SW Sapien: https://api.sw.com.mx   (sandbox + producción)
- Edicom:    https://edic.om          (enterprise)
- Diverza:   https://api.diverza.com
```

**Flujo de timbrado:**
1. Sistema genera XML firmado con CSD (Certificado de Sello Digital) del emisor
2. Se envía al PAC vía SOAP/REST
3. PAC valida con el SAT y devuelve XML timbrado con sello del SAT + UUID (folio fiscal)
4. Se almacena XML timbrado en Object Storage; PDF se genera localmente

### 2.4 Declaraciones periódicas obligatorias

| Declaración | Periodicidad | Forma SAT | Módulo responsable |
|-------------|-------------|-----------|-------------------|
| IVA mensual | Mensual (día 17) | DIOT + declaración | Impuestos |
| ISR provisional personas morales | Mensual (día 17) | DEM | Impuestos |
| DIOT — Declaración Informativa de Operaciones con Terceros | Mensual | A-29 | Impuestos |
| Declaración anual personas morales | Anual (marzo) | DEM | Impuestos |
| Nómina — CFDI | Cada pago de nómina | Complemento NóminaV1.2 | Nómina |
| Prima de riesgo IMSS | Anual (febrero) | SIPE | Nómina / RRHH |
| Declaración ISN — Impuesto Sobre Nómina | Mensual (varía por estado) | Portal estatal | Nómina |

### 2.5 IMSS e INFONAVIT

- **Ley del Seguro Social (LSS)** — Cuotas obrero-patronales, ramas: enfermedad y maternidad, invalidez y vida, guarderías, RCOP
- **SUA** — Sistema Único de Autodeterminación (archivo SUA para pago bimestral IMSS/INFONAVIT)
- **IDSE** — Internet para Empresas (altas, bajas, modificaciones de salario)
- **Factor de integración salarial** — SDI = Salario Diario × Factor (mínimo 1.0452 para trabajadores sin prestaciones superiores)
- **INFONAVIT:** Aportación patronal 5% sobre SBC (Salario Base de Cotización)
- **Tabla de cuotas IMSS 2024-2025** — deben actualizarse anualmente desde el DOF

### 2.6 Nómina — Ley Federal del Trabajo (LFT)

| Concepto | Base legal | Cálculo |
|----------|-----------|---------|
| Aguinaldo | Art. 87 LFT | 15 días de salario mínimo como base; empresas suelen pagar más |
| Vacaciones | Art. 76 LFT (reforma 2023) | 12 días primer año, +2 días por año hasta 20, luego +2 c/5 años |
| Prima vacacional | Art. 80 LFT | Mínimo 25% sobre salario de vacaciones |
| PTU — Participación de Utilidades | Art. 117-131 LFT | 10% de utilidad fiscal; pago antes del 30 de mayo personas morales |
| Prima de antigüedad | Art. 162 LFT | 12 días de salario por año de servicio |
| Liquidación | Art. 50 y 89 LFT | 3 meses + 20 días por año + partes proporcionales |
| ISR nómina | Art. 96 LISR + Anexo 8 RMF | Tabla subsidio al empleo, retención mensual, cálculo anual |

### 2.7 NIF — Normas de Información Financiera (CINIF)

El sistema debe generar estados financieros conforme a:
- **NIF A-3** — Necesidades de los usuarios y objetivos de los estados financieros
- **NIF B-1** — Cambios contables y correcciones de errores
- **NIF B-3** — Estado de resultado integral
- **NIF B-4** — Estado de cambios en el capital contable
- **NIF B-6** — Estado de situación financiera (Balance General)
- **NIF C-1** — Efectivo y equivalentes de efectivo
- **NIF C-4** — Inventarios (valuación PEPS / costo promedio)
- **NIF C-6** — Propiedades, planta y equipo (depreciación)
- **NIF D-3** — Beneficios a los empleados (PTU diferida)

### 2.8 Contabilidad Electrónica (obligatoria desde 2015)

Conforme al Art. 28 CFF y la RMF:
- **Catálogo de cuentas** en XML (formato SAT, schema XSD oficial)
- **Balanza de comprobación** mensual en XML
- **Pólizas contables** con UUID de CFDIs relacionados
- **Auxiliares** por cuenta y por tercero

Formatos XML requeridos:
```
- Catálogo de cuentas:   {RFC}{Año}{Mes}CT.xml
- Balanza:               {RFC}{Año}{Mes}BN.xml  (normal) o BD.xml (cierre)
- Pólizas:               {RFC}{Año}{Mes}{Tipo}PL.xml
```

---

## 3. Arquitectura del sistema

### 3.1 Stack tecnológico

```
Backend:
  Runtime:     Node.js 22 LTS + TypeScript 5.x
  Framework:   Fastify 4.x (performance > Express para APIs contables de alto volumen)
  ORM:         Prisma 5.x (migraciones) + Kysely (queries complejas tipadas)
  Validación:  Zod 3.x (validación de DTOs y respuestas)
  Colas:       BullMQ 5.x sobre Redis 7
  Scheduler:   node-cron (declaraciones periódicas, recordatorios)

Base de datos:
  Principal:   PostgreSQL 16 (schema por empresa + RLS)
  Caché:       Redis 7 (sesiones, rate limiting, colas)
  OLAP:        ClickHouse 24.x (reportes históricos, BI)
  Busqueda:    PostgreSQL FTS (búsqueda de CFDIs, terceros)

Frontend:
  Framework:   React 18 + TypeScript + Vite 5
  UI:          Radix UI + Tailwind CSS 3
  Estado:      Zustand + TanStack Query v5
  Tablas:      TanStack Table v8 (miles de registros contables)
  Gráficas:    Recharts 2.x
  Formularios: React Hook Form + Zod

Infraestructura:
  Contenedores: Docker + Docker Compose (on-premise) / Kubernetes (SaaS)
  CI/CD:        GitHub Actions
  Object Storage: AWS S3 / MinIO (XMLs CFDI, PDFs)
  Monitoreo:    OpenTelemetry + Grafana + Loki
  Reverse proxy: Caddy (HTTPS automático en on-premise)
```

### 3.2 Estructura de carpetas del monorepo

```
/
├── apps/
│   ├── api/                    # Backend Fastify
│   │   ├── src/
│   │   │   ├── modules/        # Módulos del sistema
│   │   │   │   ├── auth/
│   │   │   │   ├── companies/
│   │   │   │   ├── accounting/
│   │   │   │   ├── invoicing/  # CFDI 4.0
│   │   │   │   ├── receivables/
│   │   │   │   ├── payables/
│   │   │   │   ├── treasury/
│   │   │   │   ├── inventory/
│   │   │   │   ├── payroll/    # Nómina + NóminaV1.2
│   │   │   │   ├── taxes/      # IVA, ISR, DIOT
│   │   │   │   ├── fixed-assets/
│   │   │   │   ├── reports/
│   │   │   │   └── sat-catalogs/
│   │   │   ├── shared/
│   │   │   │   ├── middleware/
│   │   │   │   ├── plugins/    # Fastify plugins
│   │   │   │   ├── utils/
│   │   │   │   └── types/
│   │   │   ├── workers/        # BullMQ workers
│   │   │   │   ├── cfdi-stamping.worker.ts
│   │   │   │   ├── payroll-calculation.worker.ts
│   │   │   │   ├── bank-reconciliation.worker.ts
│   │   │   │   └── report-generation.worker.ts
│   │   │   └── app.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   │
│   └── web/                    # Frontend React
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   │   ├── accounting/
│       │   │   ├── invoicing/
│       │   │   ├── payroll/
│       │   │   └── shared/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── lib/
│       └── package.json
│
├── packages/
│   ├── cfdi/                   # Librería CFDI 4.0 (generación XML, validación)
│   │   ├── src/
│   │   │   ├── builder/        # Construcción del XML
│   │   │   ├── validator/      # Validación contra XSD SAT
│   │   │   ├── signer/         # Firma con CSD (.cer + .key)
│   │   │   ├── catalogs/       # Catálogos SAT sincronizados
│   │   │   └── complements/    # Complementos (Pago20, NominaV12…)
│   │   └── package.json
│   │
│   ├── nif-accounting/         # Motor contable NIF
│   │   ├── src/
│   │   │   ├── chart-of-accounts/  # PUC México estándar
│   │   │   ├── journal/            # Motor de asientos
│   │   │   ├── closing/            # Cierre de períodos
│   │   │   └── statements/         # Estados financieros NIF
│   │   └── package.json
│   │
│   ├── tax-calculator/         # Calculadora fiscal mexicana
│   │   ├── src/
│   │   │   ├── iva/            # Cálculo IVA 16%, 0%, exento
│   │   │   ├── isr/            # Retenciones ISR, pagos provisionales
│   │   │   ├── ieps/           # IEPS por producto
│   │   │   ├── payroll-tax/    # ISR nómina, subsidio al empleo
│   │   │   └── diot/           # Generación DIOT A-29
│   │   └── package.json
│   │
│   └── database/               # Tipos compartidos Prisma + helpers
│       └── package.json
│
├── docker-compose.yml          # On-premise completo
├── docker-compose.dev.yml      # Desarrollo local
├── CLAUDE.md                   # Este archivo
└── pnpm-workspace.yaml
```

---

## 4. Base de datos — Esquema PostgreSQL

### 4.1 Principios de diseño

```sql
-- REGLAS INVIOLABLES:
-- 1. Todos los montos en DECIMAL(19,4) — NUNCA FLOAT ni NUMERIC sin precisión
-- 2. company_id en CADA tabla operativa (RLS enforcement)
-- 3. Tabla audit_log: solo INSERT (inmutable). Trigger en cada tabla crítica
-- 4. UUID v7 como PK (ordenable por tiempo, eficiente en índices B-tree)
-- 5. SUM(debits) = SUM(credits) validado por CHECK CONSTRAINT en journal_lines
-- 6. Documentos XML/PDF: solo referencia en BD, archivo en Object Storage
-- 7. Nunca DELETE en tablas fiscales: solo cancelación lógica con status
-- 8. Campos RFC siempre en MAYÚSCULAS, validados con regex mexicano
```

### 4.2 Schema principal

```sql
-- ================================================================
-- TENANT Y EMPRESAS (Multitenancy)
-- ================================================================

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),
  country_code  CHAR(2) NOT NULL DEFAULT 'MX',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  settings      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  -- Datos fiscales SAT
  rfc             VARCHAR(13) NOT NULL CHECK (rfc ~ '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  razon_social    TEXT NOT NULL,
  nombre_comercial TEXT,
  regimen_fiscal  VARCHAR(3) NOT NULL, -- c_RegimenFiscal SAT (ej: '601' S.A. de C.V.)
  codigo_postal   VARCHAR(5) NOT NULL, -- Obligatorio CFDI 4.0
  -- Datos operativos
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  fiscal_year_start INT NOT NULL DEFAULT 1, -- mes de inicio ejercicio (1=enero)
  logo_url        TEXT,
  settings        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, rfc)
);

-- Certificados CSD por empresa (para timbrado CFDI)
CREATE TABLE company_certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  certificate_no  VARCHAR(20) NOT NULL, -- Número de certificado SAT
  cer_encrypted   BYTEA NOT NULL,       -- .cer cifrado en reposo (AES-256)
  key_encrypted   BYTEA NOT NULL,       -- .key cifrado en reposo
  valid_from      DATE NOT NULL,
  valid_until     DATE NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- PLAN DE CUENTAS (NIF México)
-- ================================================================

CREATE TABLE accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  parent_id       UUID REFERENCES accounts(id),
  code            VARCHAR(20) NOT NULL,
  name            TEXT NOT NULL,
  -- Clasificación NIF
  account_type    TEXT NOT NULL CHECK (account_type IN (
    'ACTIVO','PASIVO','CAPITAL','INGRESO','COSTO','GASTO','ORDEN'
  )),
  nature          TEXT NOT NULL CHECK (nature IN ('DEUDORA','ACREEDORA')),
  level           INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 6),
  allows_entries  BOOLEAN NOT NULL DEFAULT true, -- Solo cuentas de detalle
  -- Contabilidad electrónica SAT
  sat_group_code  VARCHAR(10), -- Agrupador SAT para balanza (ej: '1.01.01')
  -- Configuración
  currency        CHAR(3) DEFAULT 'MXN',
  is_bank_account BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(company_id, code)
);

-- ================================================================
-- PERÍODOS FISCALES
-- ================================================================

CREATE TABLE fiscal_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id),
  year        INT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_at   TIMESTAMPTZ,
  closed_by   UUID,
  UNIQUE(company_id, year)
);

CREATE TABLE periods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  company_id     UUID NOT NULL REFERENCES companies(id),
  month          INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           INT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','LOCKED')),
  -- Contabilidad electrónica enviada al SAT
  sat_catalog_sent    BOOLEAN NOT NULL DEFAULT false,
  sat_balanza_sent    BOOLEAN NOT NULL DEFAULT false,
  sat_polizas_sent    BOOLEAN NOT NULL DEFAULT false,
  closed_at      TIMESTAMPTZ,
  UNIQUE(company_id, year, month)
);

-- ================================================================
-- DIARIO CONTABLE (Motor central)
-- ================================================================

CREATE TABLE journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  period_id       UUID NOT NULL REFERENCES periods(id),
  entry_date      DATE NOT NULL,
  reference       VARCHAR(50),
  description     TEXT NOT NULL,
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
    'MANUAL','FACTURA_EMITIDA','FACTURA_RECIBIDA','PAGO_COBRADO',
    'PAGO_REALIZADO','NOMINA','DEPRECIACION','AJUSTE','CIERRE'
  )),
  source_id       UUID,   -- ID del documento origen (CFDI, pago, etc.)
  source_type     TEXT,   -- 'CFDI','PAYMENT','PAYROLL_RUN', etc.
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
  -- Auditoría
  created_by      UUID NOT NULL,
  posted_by       UUID,
  posted_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID NOT NULL REFERENCES journal_entries(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  -- NIF: partida doble
  debit           DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit          DECIMAL(19,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  -- Exactamente uno debe ser cero
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)
  ),
  description     TEXT,
  -- Auxiliares
  third_party_id  UUID,       -- cliente/proveedor relacionado
  cost_center_id  UUID,
  line_number     INT NOT NULL,
  -- Multidivisa
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  exchange_rate   DECIMAL(15,6) NOT NULL DEFAULT 1,
  amount_mxn      DECIMAL(19,4) NOT NULL -- Siempre en pesos para reportes
);

-- Garantizar partida doble a nivel de póliza
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT ABS(SUM(debit) - SUM(credit)) FROM journal_lines WHERE entry_id = NEW.entry_id) > 0.01 THEN
    RAISE EXCEPTION 'Póliza desbalanceada: suma débitos ≠ suma créditos (entrada: %)', NEW.entry_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- TERCEROS (Clientes y Proveedores)
-- ================================================================

CREATE TABLE third_parties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  -- Datos fiscales SAT (obligatorios para CFDI 4.0)
  rfc             VARCHAR(13) CHECK (rfc ~ '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  razon_social    TEXT NOT NULL,
  regimen_fiscal  VARCHAR(3),    -- c_RegimenFiscal SAT
  uso_cfdi        VARCHAR(3),    -- c_UsoCFDI por defecto para este cliente
  codigo_postal   VARCHAR(5),    -- Obligatorio CFDI 4.0 cuando es receptor nacional
  -- Tipo
  party_type      TEXT NOT NULL CHECK (party_type IN ('CLIENTE','PROVEEDOR','AMBOS')),
  is_foreign      BOOLEAN NOT NULL DEFAULT false,
  country_code    CHAR(2) DEFAULT 'MX',
  -- Datos de contacto
  email           TEXT,
  phone           VARCHAR(20),
  address         JSONB,
  -- Crédito
  credit_limit    DECIMAL(19,4),
  credit_days     INT DEFAULT 0,
  -- Configuración DIOT
  diot_type       TEXT CHECK (diot_type IN ('04_PROVEEDOR_NACIONAL','05_PROVEEDOR_EXTRANJERO','15_GLOBAL')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- CFDI — FACTURAS EMITIDAS (CFDI 4.0)
-- ================================================================

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  third_party_id  UUID NOT NULL REFERENCES third_parties(id),
  -- Tipo de CFDI
  invoice_type    TEXT NOT NULL CHECK (invoice_type IN (
    'I','E','T','N','P' -- Ingreso, Egreso, Traslado, Nómina, Pago
  )),
  -- Folio interno
  series          VARCHAR(10),
  folio           VARCHAR(20) NOT NULL,
  -- Datos fiscales CFDI 4.0
  issue_date      TIMESTAMPTZ NOT NULL,
  payment_method  VARCHAR(3) NOT NULL, -- c_MetodoPago: PUE / PPD
  payment_form    VARCHAR(2),          -- c_FormaPago: 01,03,04…
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  exchange_rate   DECIMAL(15,6) NOT NULL DEFAULT 1,
  use_cfdi        VARCHAR(3) NOT NULL, -- c_UsoCFDI
  -- Importes
  subtotal        DECIMAL(19,4) NOT NULL,
  discount        DECIMAL(19,4) NOT NULL DEFAULT 0,
  taxes_transferred DECIMAL(19,4) NOT NULL DEFAULT 0,  -- IVA trasladado
  taxes_withheld  DECIMAL(19,4) NOT NULL DEFAULT 0,    -- IVA / ISR retenido
  total           DECIMAL(19,4) NOT NULL,
  -- Timbrado SAT
  sat_uuid        UUID UNIQUE,         -- Folio fiscal (UUID del SAT)
  sat_certificate_no VARCHAR(20),
  sat_seal        TEXT,                -- Sello del SAT
  issuer_seal     TEXT,                -- Sello del emisor
  xml_url         TEXT,                -- URL en Object Storage
  pdf_url         TEXT,
  qr_url          TEXT,
  -- Estado
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','STAMPED','SENT','PAID','CANCELLED','SUBSTITUTED'
  )),
  cancellation_reason VARCHAR(2),      -- c_MotivoCancelacion: 01,02,03,04
  substituted_by  UUID REFERENCES invoices(id),
  -- Relaciones
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, series, folio)
);

CREATE TABLE invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  line_number     INT NOT NULL,
  -- Catálogos SAT obligatorios CFDI 4.0
  product_service_key VARCHAR(8) NOT NULL,  -- c_ClaveProdServ
  unit_key        VARCHAR(6) NOT NULL,       -- c_ClaveUnidad
  -- Descripción
  product_id      UUID,
  description     TEXT NOT NULL,
  unit_name       VARCHAR(50),
  quantity        DECIMAL(19,4) NOT NULL,
  unit_price      DECIMAL(19,4) NOT NULL,
  discount        DECIMAL(19,4) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(19,4) NOT NULL,
  -- Objeto de impuesto
  tax_object      VARCHAR(2) NOT NULL DEFAULT '02', -- c_ObjetoImp
  taxes           JSONB NOT NULL DEFAULT '[]'
  -- Estructura taxes: [{type:"IVA",factor:"Tasa",rate:0.16,base:X,amount:Y}]
);

-- ================================================================
-- COMPLEMENTO DE PAGO (REP — CFDI de Pagos)
-- ================================================================

CREATE TABLE payment_complements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  invoice_id      UUID NOT NULL REFERENCES invoices(id), -- CFDI tipo P generado
  payment_date    DATE NOT NULL,
  payment_form    VARCHAR(2) NOT NULL, -- c_FormaPago
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  amount          DECIMAL(19,4) NOT NULL,
  -- Cuenta bancaria (requerido para c_FormaPago = 03 transferencia)
  bank_account_origin TEXT,
  bank_account_dest   TEXT,
  -- Relacionados (CFDIs que liquida este pago)
  related_cfdi    JSONB NOT NULL DEFAULT '[]',
  -- [{uuid, series, folio, currency, paymentCurrency, exchangeRate,
  --   partialAmount, previousBalance, amountPaid, remainingBalance,
  --   previousTaxesObject, taxesObject}]
  sat_uuid        UUID UNIQUE,
  xml_url         TEXT,
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- FACTURAS RECIBIDAS (Cuentas por Pagar)
-- ================================================================

CREATE TABLE bills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  third_party_id  UUID NOT NULL REFERENCES third_parties(id),
  -- Datos del CFDI recibido
  sat_uuid        UUID UNIQUE NOT NULL,  -- UUID del CFDI del proveedor
  series          VARCHAR(10),
  folio           VARCHAR(20),
  issue_date      DATE NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  exchange_rate   DECIMAL(15,6) NOT NULL DEFAULT 1,
  subtotal        DECIMAL(19,4) NOT NULL,
  taxes_transferred DECIMAL(19,4) NOT NULL DEFAULT 0,
  taxes_withheld  DECIMAL(19,4) NOT NULL DEFAULT 0,
  total           DECIMAL(19,4) NOT NULL,
  -- IVA acreditable (solo el relacionado con actividad gravada)
  vat_creditable  DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Vencimiento y pago
  due_date        DATE,
  payment_status  TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
    'PENDING','PARTIAL','PAID','CANCELLED'
  )),
  amount_paid     DECIMAL(19,4) NOT NULL DEFAULT 0,
  xml_url         TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- NÓMINA (LFT + LSS + LISR)
-- ================================================================

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  -- Datos personales y fiscales
  rfc             VARCHAR(13) NOT NULL CHECK (rfc ~ '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  curp            VARCHAR(18) NOT NULL CHECK (curp ~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$'),
  nss             VARCHAR(11), -- Número Seguro Social IMSS
  full_name       TEXT NOT NULL,
  email           TEXT,
  -- Relación laboral (LFT)
  hire_date       DATE NOT NULL,
  termination_date DATE,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('INDEFINIDO','DETERMINADO','OBRA','TEMPORAL')),
  work_shift      TEXT CHECK (work_shift IN ('DIURNA','NOCTURNA','MIXTA','POR_HORAS','REDUCIDA','CONTINUADA','PARTIDA','VARIABLE')),
  -- Salarios
  daily_wage      DECIMAL(19,4) NOT NULL,  -- Salario diario ordinario
  sdi             DECIMAL(19,4) NOT NULL,  -- Salario Diario Integrado (IMSS)
  integration_factor DECIMAL(8,6) NOT NULL DEFAULT 1.0452,
  -- IMSS
  imss_risk_class INT NOT NULL DEFAULT 1 CHECK (imss_risk_class BETWEEN 1 AND 5),
  -- Departamento y puesto
  department_id   UUID,
  job_title       TEXT,
  -- Estado
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','TERMINATED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  -- Período
  payroll_type    TEXT NOT NULL CHECK (payroll_type IN (
    'SEMANAL','CATORCENAL','QUINCENAL','MENSUAL','EXTRAORDINARIA',
    'FINIQUITO','LIQUIDACION','PTU','AGUINALDO'
  )),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  payment_date    DATE NOT NULL,
  -- Totales
  total_perceptions DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_deductions  DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_net_pay     DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_isr_withheld DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_imss_employee DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_imss_employer DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_infonavit   DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Estado y timbrado
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','CALCULATED','APPROVED','STAMPED','PAID','CANCELLED'
  )),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by      UUID NOT NULL,
  approved_by     UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_slips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  -- Percepciones (catálogo SAT NóminaV1.2)
  perceptions     JSONB NOT NULL DEFAULT '[]',
  -- [{clave:"001",tipo:"ExentaISR",descripcion:"Sueldos",importe_exento:X,importe_gravado:Y}]
  -- Claves SAT: 001 Sueldos, 002 Gratificación Anual, 004 Reembolso gastos médicos...
  -- Deducciones
  deductions      JSONB NOT NULL DEFAULT '[]',
  -- [{clave:"001",descripcion:"ISR",importe:X}, {clave:"002",descripcion:"IMSS",importe:Y}]
  -- Claves SAT: 001 ISR, 002 IMSS, 003 ISSSTE, 004 Otras
  -- Otros pagos (subsidio al empleo)
  other_payments  JSONB NOT NULL DEFAULT '[]',
  -- Totales
  total_perceptions   DECIMAL(19,4) NOT NULL,
  total_deductions    DECIMAL(19,4) NOT NULL,
  net_pay             DECIMAL(19,4) NOT NULL,
  -- ISR (Art. 96 LISR + Anexo 8 RMF)
  isr_base            DECIMAL(19,4) NOT NULL,
  isr_withheld        DECIMAL(19,4) NOT NULL,
  subsidy_for_employment DECIMAL(19,4) NOT NULL DEFAULT 0,
  isr_net             DECIMAL(19,4) NOT NULL, -- isr_withheld - subsidio
  -- CFDI Nómina
  sat_uuid            UUID UNIQUE,
  xml_url             TEXT,
  pdf_url             TEXT,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- BANCOS Y TESORERÍA
-- ================================================================

CREATE TABLE bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  account_id      UUID NOT NULL REFERENCES accounts(id), -- Cuenta contable enlazada
  bank_name       TEXT NOT NULL,
  clabe           VARCHAR(18) CHECK (clabe ~ '^[0-9]{18}$'), -- CLABE interbancaria
  account_number  VARCHAR(30),
  currency        CHAR(3) NOT NULL DEFAULT 'MXN',
  -- Belvo / Open Banking
  belvo_account_id TEXT,
  last_sync_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  transaction_date DATE NOT NULL,
  value_date      DATE,
  description     TEXT NOT NULL,
  reference       TEXT,
  amount          DECIMAL(19,4) NOT NULL, -- Positivo=depósito, negativo=cargo
  balance_after   DECIMAL(19,4),
  -- Conciliación
  reconciliation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    reconciliation_status IN ('PENDING','MATCHED','MANUAL','IGNORED')
  ),
  journal_line_id UUID REFERENCES journal_lines(id),
  -- Origen del movimiento
  source          TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','BELVO','OFX','CSV')),
  external_id     TEXT UNIQUE, -- ID en sistema Belvo u Open Banking
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- ACTIVOS FIJOS (NIF C-6)
-- ================================================================

CREATE TABLE fixed_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  account_id      UUID NOT NULL REFERENCES accounts(id),
  name            TEXT NOT NULL,
  -- Clasificación SAT (para deducibilidad fiscal)
  sat_asset_type  TEXT NOT NULL, -- Inmuebles, Maquinaria, Equipo transporte, Cómputo...
  -- Valores
  acquisition_date DATE NOT NULL,
  acquisition_cost DECIMAL(19,4) NOT NULL,
  residual_value  DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Depreciación (NIF C-6)
  depreciation_method TEXT NOT NULL DEFAULT 'LINEA_RECTA' CHECK (
    depreciation_method IN ('LINEA_RECTA','DOBLE_SALDO','SUM_DIGITOS','UNIDADES_PRODUCCION')
  ),
  useful_life_months INT NOT NULL,
  -- Tasa SAT (Art. 34 LISR) para deducción fiscal
  sat_depreciation_rate DECIMAL(6,4), -- ej: 0.25 para equipo cómputo (25% anual)
  -- Estado
  status          TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISPOSED','FULLY_DEPRECIATED')),
  disposal_date   DATE,
  disposal_amount DECIMAL(19,4)
);

CREATE TABLE depreciation_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id  UUID NOT NULL REFERENCES fixed_assets(id),
  company_id      UUID NOT NULL REFERENCES companies(id),
  period_id       UUID NOT NULL REFERENCES periods(id),
  -- Montos (NIF vs Fiscal)
  accounting_depreciation DECIMAL(19,4) NOT NULL, -- NIF C-6
  fiscal_depreciation     DECIMAL(19,4) NOT NULL, -- Art. 34 LISR
  accumulated_accounting  DECIMAL(19,4) NOT NULL,
  net_book_value          DECIMAL(19,4) NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id),
  UNIQUE(fixed_asset_id, period_id)
);

-- ================================================================
-- INVENTARIOS (NIF C-4)
-- ================================================================

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  sku                 VARCHAR(50),
  name                TEXT NOT NULL,
  description         TEXT,
  -- Catálogos SAT (requeridos en CFDI)
  product_service_key VARCHAR(8) NOT NULL, -- c_ClaveProdServ
  unit_key            VARCHAR(6) NOT NULL, -- c_ClaveUnidad
  unit_name           VARCHAR(50),
  -- Tipo
  product_type        TEXT NOT NULL CHECK (product_type IN ('PRODUCTO','SERVICIO','COMBO')),
  -- Precios
  unit_cost           DECIMAL(19,4) NOT NULL DEFAULT 0,
  sale_price          DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Impuestos
  vat_rate            DECIMAL(6,4) NOT NULL DEFAULT 0.16, -- 0, 0.08 (frontera), 0.16
  vat_exempt          BOOLEAN NOT NULL DEFAULT false,
  ieps_rate           DECIMAL(6,4) DEFAULT 0,
  -- Inventario
  track_inventory     BOOLEAN NOT NULL DEFAULT false,
  costing_method      TEXT DEFAULT 'PROMEDIO' CHECK (costing_method IN ('PEPS','PROMEDIO')),
  min_stock           DECIMAL(19,4) DEFAULT 0,
  -- Cuenta contable
  inventory_account_id UUID REFERENCES accounts(id),
  cost_account_id      UUID REFERENCES accounts(id),
  income_account_id    UUID REFERENCES accounts(id),
  is_active            BOOLEAN NOT NULL DEFAULT true
);

-- ================================================================
-- IMPUESTOS — DIOT y declaraciones
-- ================================================================

CREATE TABLE diot_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  period_id       UUID NOT NULL REFERENCES periods(id),
  third_party_id  UUID NOT NULL REFERENCES third_parties(id),
  -- Campos DIOT A-29
  diot_type       TEXT NOT NULL, -- 04, 05, 15
  -- IVA pagado por tasa
  vat_16_paid     DECIMAL(19,4) NOT NULL DEFAULT 0,
  vat_8_paid      DECIMAL(19,4) NOT NULL DEFAULT 0,  -- Zona fronteriza
  vat_0_paid      DECIMAL(19,4) NOT NULL DEFAULT 0,
  vat_exempt_paid DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Retenciones
  vat_withheld    DECIMAL(19,4) NOT NULL DEFAULT 0,
  isr_withheld    DECIMAL(19,4) NOT NULL DEFAULT 0,
  -- Totales
  total_paid      DECIMAL(19,4) NOT NULL DEFAULT 0,
  UNIQUE(company_id, period_id, third_party_id)
);

-- ================================================================
-- AUDITORÍA (Inmutable)
-- ================================================================

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  company_id      UUID,
  user_id         UUID,
  action          TEXT NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, STAMP_CFDI, etc.
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- IMPORTANTE: Sin permisos UPDATE/DELETE en audit_logs para ningún rol
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

-- ================================================================
-- ÍNDICES CRÍTICOS
-- ================================================================

CREATE INDEX idx_journal_entries_company_period ON journal_entries(company_id, period_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id, company_id);
CREATE INDEX idx_invoices_company_date ON invoices(company_id, issue_date DESC);
CREATE INDEX idx_invoices_sat_uuid ON invoices(sat_uuid) WHERE sat_uuid IS NOT NULL;
CREATE INDEX idx_bank_transactions_reconciliation ON bank_transactions(company_id, reconciliation_status);
CREATE INDEX idx_payroll_slips_run ON payroll_slips(payroll_run_id);
CREATE INDEX idx_third_parties_rfc ON third_parties(company_id, rfc);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, created_at DESC);
```

---

## 5. Módulos — Especificaciones técnicas

### 5.1 Módulo CFDI 4.0 (`packages/cfdi`)

```typescript
// packages/cfdi/src/builder/cfdi-builder.ts
// Responsabilidades:
// - Construir XML CFDI conforme al XSD del SAT (Anexo 20 RMF)
// - Validar catálogos SAT antes de generar
// - Firmar con CSD del emisor (RSA-SHA256)
// - Enviar a PAC y procesar respuesta

interface CFDIBuilderConfig {
  pac: 'FINKOK' | 'SW_SAPIEN' | 'EDICOM'
  environment: 'sandbox' | 'production'
  pacCredentials: { user: string; password: string }
}

interface CFDIData {
  // Nodo Comprobante
  version: '4.0'
  serie?: string
  folio: string
  fecha: string                    // ISO 8601: "2024-01-15T10:30:00"
  formaPago?: string               // c_FormaPago — solo para PUE
  noCertificado: string            // 20 dígitos
  subTotal: Decimal
  descuento?: Decimal
  moneda: string                   // c_Moneda
  tipoCambio?: Decimal             // Si moneda ≠ MXN
  total: Decimal
  tipoDeComprobante: 'I'|'E'|'T'|'N'|'P'
  exportacion: string              // c_Exportacion: '01' no aplica
  metodoPago?: string              // c_MetodoPago: PUE | PPD
  lugarExpedicion: string          // CP del emisor (5 dígitos)

  // Nodo Emisor
  emisor: {
    rfc: string
    nombre: string
    regimenFiscal: string          // c_RegimenFiscal
  }

  // Nodo Receptor (CFDI 4.0: datos fiscales completos obligatorios)
  receptor: {
    rfc: string                    // XAXX010101000 para público en general
    nombre: string
    domicilioFiscalReceptor: string // CP del receptor — OBLIGATORIO 4.0
    regimenFiscalReceptor: string   // c_RegimenFiscal — OBLIGATORIO 4.0
    usoCFDI: string                 // c_UsoCFDI
    residenciaFiscal?: string       // c_Pais — solo extranjeros
    numRegIdTrib?: string           // RFC/Tax ID extranjero
  }

  conceptos: CFDIConcepto[]
  impuestos?: CFDIImpuestos
  cfdiRelacionados?: CFDIRelacionados[]
  complemento?: CFDIComplemento
}

// REGLAS DE VALIDACIÓN CFDI 4.0 OBLIGATORIAS:
// 1. Si tipoDeComprobante='I' o 'E': formaPago y metodoPago son requeridos (excepto PPD)
// 2. Si metodoPago='PPD': formaPago='99' (por definir) y no incluir formaPago en nodo Pago
// 3. RFC XAXX010101000: receptor público en general (ventas al público < $600 MXN sin RFC)
// 4. RFC XEXX010101000: receptor extranjero sin RFC
// 5. usoCFDI='S01' si receptor es XAXX o XEXX
// 6. c_ObjetoImp='01' si concepto no genera impuestos
// 7. Validar que c_ClaveProdServ exista en catálogo SAT vigente
// 8. Total = Subtotal - Descuento + ImpuestosTrasladados - ImpuestosRetenidos
```

### 5.2 Módulo de Nómina (`apps/api/src/modules/payroll`)

```typescript
// Proceso de cálculo de nómina (Art. 96 LISR + Anexo 8 RMF vigente)

interface PayrollCalculation {
  // 1. PERCEPCIONES
  calculatePerceptions(employee: Employee, period: PayrollPeriod): {
    ordinary: Decimal      // Sueldo ordinario
    overtime: Decimal      // Horas extra (primeras 9 dobles, siguientes triples — Art. 68 LFT)
    bonus: Decimal         // Gratificaciones
    vacation_premium: Decimal  // Prima vacacional (mínimo 25%)
    other: PerceptionItem[]
    total_exempt: Decimal  // Exentas ISR (ej: horas extra exentas 5 VSM/semana)
    total_taxable: Decimal // Gravadas ISR
  }

  // 2. CÁLCULO ISR NÓMINA (Art. 96 LISR + Tabla Anexo 8 RMF)
  calculateISR(taxableIncome: Decimal, period: 'SEMANAL'|'QUINCENAL'|'MENSUAL'): {
    lower_limit: Decimal
    excess: Decimal
    marginal_tax: Decimal
    fixed_tax: Decimal
    isr_before_subsidy: Decimal
    // Subsidio al empleo (Artículo Décimo Transitorio LISR)
    employment_subsidy: Decimal
    isr_net: Decimal       // ISR a retener (puede ser 0 si subsidio > ISR)
  }

  // 3. CUOTAS IMSS (LSS + acuerdo del IMSS vigente)
  calculateIMSS(employee: Employee): {
    // Cuotas obrero (descuentos al trabajador)
    employee_health: Decimal      // Enfermedad y Maternidad (cuota fija + excedente)
    employee_disability: Decimal  // Invalidez y Vida 0.625% SDI
    employee_retirement: Decimal  // Cesantía y vejez 1.125% SDI
    // Cuotas patronales
    employer_health: Decimal
    employer_disability: Decimal
    employer_retirement: Decimal
    employer_daycare: Decimal     // Guarderías 1% SDI
    employer_risk: Decimal        // RCOP (según prima de riesgo)
    // INFONAVIT
    infonavit: Decimal            // 5% SDI patronal
  }

  // 4. GENERAR CFDI NÓMINA (Complemento NóminaV1.2)
  stampPayrollCFDI(slip: PayrollSlip): Promise<StampedCFDI>
}

// TABLA ISR 2024 (Anexo 8 RMF — actualizar anualmente)
// Estas tablas se almacenan en BD y se actualizan via seed en cada ejercicio fiscal
const ISR_TABLE_MONTHLY_2024 = [
  { lower: 0.01,      upper: 746.04,    fixed: 0,       rate: 0.0192 },
  { lower: 746.05,    upper: 6332.05,   fixed: 14.32,   rate: 0.0640 },
  { lower: 6332.06,   upper: 11128.01,  fixed: 371.83,  rate: 0.1088 },
  { lower: 11128.02,  upper: 12935.82,  fixed: 893.63,  rate: 0.1600 },
  { lower: 12935.83,  upper: 15487.71,  fixed: 1182.88, rate: 0.1792 },
  { lower: 15487.72,  upper: 31236.49,  fixed: 1640.18, rate: 0.2136 },
  { lower: 31236.50,  upper: 49233.00,  fixed: 5004.12, rate: 0.2352 },
  { lower: 49233.01,  upper: 93993.90,  fixed: 9236.89, rate: 0.3000 },
  { lower: 93993.91,  upper: 125325.20, fixed: 22665.17, rate: 0.3200 },
  { lower: 125325.21, upper: 375975.61, fixed: 32691.18, rate: 0.3400 },
  { lower: 375975.62, upper: Infinity,  fixed: 117912.32, rate: 0.3500 },
]
```

### 5.3 Módulo de Impuestos (`apps/api/src/modules/taxes`)

```typescript
// Generación de DIOT (Declaración Informativa de Operaciones con Terceros)
// Formato: archivo de texto (.txt) para importar en portal SAT

interface DISOTGenerator {
  // Genera archivo DIOT para el período
  // Formato: registro tipo 3 (layout del SAT)
  generateDIOTFile(companyId: string, periodId: string): Promise<Buffer>

  // Calcula IVA a pagar del período
  calculateVATPayable(companyId: string, periodId: string): {
    vat_transferred: Decimal   // IVA cobrado a clientes
    vat_creditable: Decimal    // IVA pagado a proveedores (acreditable)
    vat_payable: Decimal       // A pagar al SAT (trasladado - acreditable)
    vat_in_favor: Decimal      // Saldo a favor (si acreditable > trasladado)
  }

  // Calcula ISR provisional personas morales (Art. 14 LISR)
  calculateProvisionalISR(companyId: string, periodId: string): {
    cumulative_income: Decimal
    authorized_deductions: Decimal
    fiscal_result: Decimal
    provisional_tax: Decimal
    previous_payments: Decimal
    isr_payable: Decimal
  }
}

// TASAS IVA VIGENTES (actualizar si hay reforma fiscal)
const VAT_RATES = {
  GENERAL: 0.16,         // Tasa general (Art. 1 LIVA)
  BORDER: 0.08,          // Zona fronteriza (Decreto 2019, revisar vigencia)
  ZERO: 0.00,            // Tasa 0% (alimentos, medicinas — Art. 2-A LIVA)
  EXEMPT: null,          // Exento (arrendamiento habitacional, etc. — Art. 9 LIVA)
}
```

---

## 6. Convenciones de código

### 6.1 Naming y estructura

```typescript
// Archivos: kebab-case
// invoice-builder.ts, payroll-calculator.ts, vat-calculator.ts

// Clases: PascalCase
class CFDIBuilder { }
class PayrollCalculator { }

// Funciones y variables: camelCase
const calculateISR = (income: Decimal) => { }

// Constantes: SCREAMING_SNAKE_CASE
const SAT_RFC_REGEX = /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/
const CFDI_VERSION = '4.0'

// Tipos de BD: snake_case (Prisma)
// Tipos TypeScript: PascalCase

// REGLA: Usar Decimal.js para TODOS los cálculos monetarios
// NUNCA: const tax = amount * 0.16  ❌
// SIEMPRE: const tax = amount.mul(new Decimal('0.16'))  ✅
import Decimal from 'decimal.js'
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })
```

### 6.2 Manejo de errores fiscales

```typescript
// Errores con códigos específicos del dominio fiscal
class FiscalError extends Error {
  constructor(
    public code: FiscalErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message)
  }
}

enum FiscalErrorCode {
  // CFDI
  CFDI_INVALID_RFC          = 'CFDI_001',
  CFDI_INVALID_PRODUCT_KEY  = 'CFDI_002',
  CFDI_PAC_REJECTION        = 'CFDI_003',
  CFDI_ALREADY_CANCELLED    = 'CFDI_004',
  CFDI_CANCELLATION_WINDOW  = 'CFDI_005', // Fuera de 72 horas para cancelar sin aceptación
  // Contabilidad
  JOURNAL_UNBALANCED        = 'CONT_001',
  PERIOD_CLOSED             = 'CONT_002',
  FISCAL_YEAR_CLOSED        = 'CONT_003',
  // Nómina
  PAYROLL_MISSING_CURP      = 'NOM_001',
  PAYROLL_INVALID_SDI       = 'NOM_002',
  // General
  COMPANY_RFC_MISMATCH      = 'EMP_001',
}
```

### 6.3 API REST — Endpoints por módulo

```
# Autenticación
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout

# Empresas (dentro del tenant autenticado)
GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
PUT    /api/v1/companies/:id

# Plan de cuentas
GET    /api/v1/companies/:cid/accounts
POST   /api/v1/companies/:cid/accounts
GET    /api/v1/companies/:cid/accounts/:id/balance?period=2024-01

# Pólizas contables
GET    /api/v1/companies/:cid/journal-entries?from=&to=&type=
POST   /api/v1/companies/:cid/journal-entries
POST   /api/v1/companies/:cid/journal-entries/:id/post
DELETE /api/v1/companies/:cid/journal-entries/:id  # Solo DRAFT

# CFDI Facturas
GET    /api/v1/companies/:cid/invoices
POST   /api/v1/companies/:cid/invoices
POST   /api/v1/companies/:cid/invoices/:id/stamp      # Timbrar con PAC
POST   /api/v1/companies/:cid/invoices/:id/cancel     # Cancelar en SAT
GET    /api/v1/companies/:cid/invoices/:id/xml        # Descargar XML
GET    /api/v1/companies/:cid/invoices/:id/pdf        # Descargar PDF

# Cuentas por cobrar
GET    /api/v1/companies/:cid/receivables
POST   /api/v1/companies/:cid/receivables/:id/payments  # REP

# Facturas recibidas
GET    /api/v1/companies/:cid/bills
POST   /api/v1/companies/:cid/bills/from-xml   # Cargar XML del proveedor

# Nómina
GET    /api/v1/companies/:cid/employees
POST   /api/v1/companies/:cid/payroll-runs
POST   /api/v1/companies/:cid/payroll-runs/:id/calculate
POST   /api/v1/companies/:cid/payroll-runs/:id/approve
POST   /api/v1/companies/:cid/payroll-runs/:id/stamp    # CFDI Nómina masivo

# Bancos
GET    /api/v1/companies/:cid/bank-accounts
POST   /api/v1/companies/:cid/bank-accounts/:id/sync   # Sincronizar Belvo
GET    /api/v1/companies/:cid/bank-transactions?reconciled=false

# Impuestos
GET    /api/v1/companies/:cid/tax-periods/:year/:month/vat-summary
GET    /api/v1/companies/:cid/tax-periods/:year/:month/diot
GET    /api/v1/companies/:cid/tax-periods/:year/:month/diot/export  # .txt SAT

# Reportes financieros (NIF)
GET    /api/v1/companies/:cid/reports/balance-sheet?date=2024-12-31
GET    /api/v1/companies/:cid/reports/income-statement?from=&to=
GET    /api/v1/companies/:cid/reports/trial-balance?period=2024-01
GET    /api/v1/companies/:cid/reports/cash-flow?from=&to=
GET    /api/v1/companies/:cid/reports/accounts-aging?type=receivable|payable

# Contabilidad electrónica SAT
GET    /api/v1/companies/:cid/sat-reports/:year/:month/catalog/xml
GET    /api/v1/companies/:cid/sat-reports/:year/:month/balanza/xml
GET    /api/v1/companies/:cid/sat-reports/:year/:month/polizas/xml
```

---

## 7. Variables de entorno requeridas

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@localhost:5432/contasys
REDIS_URL=redis://localhost:6379
CLICKHOUSE_URL=http://localhost:8123

# Seguridad
JWT_SECRET=           # min 64 chars, random
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES=7d
ENCRYPTION_KEY=       # 32 bytes hex, para cifrar CSD (.cer/.key)

# Object Storage
STORAGE_PROVIDER=minio          # o 's3'
STORAGE_BUCKET=contasys-docs
STORAGE_ENDPOINT=http://minio:9000
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# PAC CFDI (al menos uno requerido)
PAC_PROVIDER=finkok             # o 'sw_sapien'
PAC_USER=
PAC_PASSWORD=
PAC_ENVIRONMENT=sandbox         # 'production' en producción

# Open Banking (conciliación)
BELVO_SECRET_ID=
BELVO_SECRET_PASSWORD=
BELVO_ENVIRONMENT=sandbox       # 'production'

# Correo (envío de facturas)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=facturas@tuempresa.mx

# Monitoreo
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=

# App
NODE_ENV=development
PORT=3000
API_BASE_URL=https://api.contasys.mx
WEB_BASE_URL=https://app.contasys.mx
```

---

## 8. Tareas críticas de inicio del proyecto

### Prioridad 1 — Sin esto no hay sistema

- [ ] Configurar monorepo con pnpm workspaces + TypeScript paths
- [ ] Schema PostgreSQL completo con migraciones Prisma
- [ ] Autenticación JWT + refresh tokens + RBAC middleware
- [ ] Multitenancy: resolver tenant por subdominio + RLS en PostgreSQL
- [ ] Cargar catálogos SAT en BD (`c_ClaveProdServ`, `c_RegimenFiscal`, `c_UsoCFDI`, etc.)
- [ ] Paquete `cfdi`: builder + validador XSD + firmador con CSD
- [ ] Integración con un PAC (Finkok sandbox primero)
- [ ] Motor de asientos contables con validación partida doble
- [ ] API de facturas emitidas (CFDI 4.0 Ingreso y Egreso) — timbrado y cancelación
- [ ] Generación de PDF de facturas (Puppeteer o PDFKit con plantilla SAT)

### Prioridad 2 — Para salir al mercado

- [ ] Módulo de cuentas por cobrar + Complemento de Pago (REP CFDI P)
- [ ] Módulo de facturas recibidas (carga XML proveedor + validación SAT)
- [ ] Plan de cuentas NIF estándar México con seed inicial
- [ ] Estados financieros: Balance, PyG, Balanza de comprobación
- [ ] Módulo de bancos: registro manual + conciliación
- [ ] Exportación XML Contabilidad Electrónica SAT (Catálogo, Balanza, Pólizas)
- [ ] Módulo de nómina: cálculo ISR + IMSS + generación CFDI NóminaV1.2
- [ ] DIOT: cálculo y exportación archivo .txt SAT
- [ ] Dashboard gerencial con KPIs financieros

### Prioridad 3 — Competitivo

- [ ] Conciliación bancaria automática vía Belvo
- [ ] Portal del contador externo (acceso multi-empresa desde un solo login)
- [ ] Activos fijos: depreciación NIF vs fiscal (Art. 34 LISR)
- [ ] Módulo de inventarios con PEPS / Promedio ponderado
- [ ] Alertas automáticas: vencimientos, declaraciones próximas, stock mínimo
- [ ] API pública documentada (OpenAPI 3.1)
- [ ] Integración Shopify / WooCommerce (sincronización de ventas como facturas)
- [ ] Asistente IA: clasificación automática de gastos, detección de anomalías

---

## 9. Reglas de negocio críticas (nunca violar)

```
CONTABILIDAD:
✓ Toda transacción genera asiento contable automático (no hay movimiento sin póliza)
✓ Los asientos de períodos cerrados son inmutables
✓ La balanza siempre cuadra: suma de saldos deudores = suma de saldos acreedores
✓ Un CFDI cancelado genera nota de crédito y póliza de reversión automática

FISCAL:
✓ El RFC del emisor debe coincidir con el del CSD utilizado para firmar
✓ CFDI cancelados: hasta 72 horas sin aceptación del receptor; después requiere motivo
✓ La fecha del CFDI no puede ser anterior en más de 72 horas al momento de timbrado
✓ Facturas en moneda extranjera deben incluir tipo de cambio DOF del día de emisión
✓ XAXX010101000 solo válido para operaciones ≤ $600 MXN en tienda (ventas al público)

NÓMINA:
✓ El SDI nunca puede ser menor al salario mínimo vigente
✓ El subsidio al empleo se aplica solo cuando el ISR calculado < subsidio correspondiente
✓ Las horas extra (primeras 9 semanales) son dobles; las siguientes son triples (Art. 68 LFT)
✓ El aguinaldo y prima vacacional tienen partes exentas de ISR (límites Anexo 8 RMF)

DATOS:
✓ Los XMLs timbrados se guardan en Object Storage indefinidamente (obligación SAT: 5 años)
✓ El log de auditoría es inmutable: ningún usuario puede borrar entradas
✓ Los certificados CSD se cifran en reposo con AES-256; nunca en texto plano en BD
```

---

## 10. Referencias normativas

| Documento | URL / Fuente |
|-----------|-------------|
| Anexo 20 RMF (CFDI 4.0) | https://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Anexo_20_Ene_2022.pdf |
| Catálogos CFDI SAT | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/catalogos_emision_CFDI_complemento_CE.htm |
| XSD CFDI 4.0 | http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd |
| NóminaV1.2 XSD | http://www.sat.gob.mx/sitio_internet/cfd/nomina/nomina12.xsd |
| Complemento Pago 2.0 | http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd |
| Contabilidad Electrónica XSD | https://omawww.sat.gob.mx/tramitesyservicios/Paginas/contabilidad_electronica.htm |
| LISR vigente | https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf |
| LIVA vigente | https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf |
| LFT vigente | https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf |
| LSS vigente | https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf |
| NIF CINIF | https://www.cinif.org.mx |
| Tabla ISR Anual (Anexo 8 RMF) | DOF cada enero |
| Salario Mínimo CONASAMI | https://www.gob.mx/conasami |

---

> **Nota para Claude Code:** Este archivo es la fuente de verdad del proyecto. Ante cualquier duda sobre implementación fiscal, las reglas aquí definidas y las leyes referenciadas tienen precedencia. Los catálogos SAT deben mantenerse actualizados sincronizando con el portal del SAT al inicio de cada ejercicio fiscal (enero). Las tablas ISR y cuotas IMSS cambian anualmente con la publicación de la RMF en el DOF.
