import { create } from 'xmlbuilder2';

export interface CfdiEmisor {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
}

export interface CfdiReceptor {
  rfc: string;
  nombre: string;
  usoCfdi: string;
  domicilioFiscalReceptor: string;
  regimenFiscalReceptor: string;
  residenciaFiscal?: string;
  numRegIdTrib?: string;
}

export interface CfdiImpuesto {
  tipo: 'IVA' | 'IEPS';
  factor: 'Tasa' | 'Cuota' | 'Exento';
  tasa: string;   // ej: "0.160000"
  base: string;
  importe: string;
}

export interface CfdiRetencion {
  tipo: 'ISR' | 'IVA';
  importe: string;
}

export interface CfdiConcepto {
  claveProdServ: string;
  cantidad: string;
  claveUnidad: string;
  descripcion: string;
  valorUnitario: string;
  importe: string;
  descuento?: string;
  objetoImp: string;          // 01=No objeto, 02=Sí objeto, 03=Sí objeto no obligado
  traslados?: CfdiImpuesto[];
  retenciones?: CfdiRetencion[];
}

export interface CfdiImpuestosGlobales {
  totalImpuestosRetenidos?: string;
  totalImpuestosTrasladados?: string;
  retenciones?: CfdiRetencion[];
  traslados?: CfdiImpuesto[];
}

export interface CfdiPayload {
  serie?: string;
  folio?: string;
  fecha: string;          // ISO 8601: "2024-01-15T10:30:00"
  formaPago?: string;     // c_FormaPago — solo para PUE; omitir si PPD
  noCertificado: string;
  certificadoBase64: string;
  condicionesDePago?: string;
  subTotal: string;
  descuento?: string;
  moneda: string;
  tipoCambio?: string;
  total: string;
  tipoDeComprobante: string;
  exportacion: string;    // '01' No aplica
  metodoPago?: string;    // PUE|PPD
  lugarExpedicion: string;
  emisor: CfdiEmisor;
  receptor: CfdiReceptor;
  conceptos: CfdiConcepto[];
  impuestos?: CfdiImpuestosGlobales;
}

export class CfdiBuilder {
  private payload: CfdiPayload;

  constructor(payload: CfdiPayload) {
    this.payload = payload;
  }

  /**
   * Construye el XML del CFDI 4.0 conforme al Anexo 20 RMF.
   * El sello se inyecta por separado después de firmar con CSD.
   */
  public buildXml(sello: string = ''): string {
    const attrs: Record<string, string> = {
      'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
      'Version': '4.0',
      'Folio': this.payload.folio || '',
      'Fecha': this.payload.fecha,
      'Sello': sello,
      'NoCertificado': this.payload.noCertificado,
      'Certificado': this.payload.certificadoBase64,
      'SubTotal': this.payload.subTotal,
      'Moneda': this.payload.moneda,
      'Total': this.payload.total,
      'TipoDeComprobante': this.payload.tipoDeComprobante,
      'Exportacion': this.payload.exportacion,
      'LugarExpedicion': this.payload.lugarExpedicion,
    };

    if (this.payload.serie) attrs['Serie'] = this.payload.serie;
    if (this.payload.formaPago) attrs['FormaPago'] = this.payload.formaPago;
    if (this.payload.condicionesDePago) attrs['CondicionesDePago'] = this.payload.condicionesDePago;
    if (this.payload.descuento) attrs['Descuento'] = this.payload.descuento;
    if (this.payload.tipoCambio && this.payload.moneda !== 'MXN') attrs['TipoCambio'] = this.payload.tipoCambio;
    if (this.payload.metodoPago) attrs['MetodoPago'] = this.payload.metodoPago;

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('cfdi:Comprobante', attrs);

    // Nodo Emisor
    doc.ele('cfdi:Emisor', {
      'Rfc': this.payload.emisor.rfc,
      'Nombre': this.payload.emisor.nombre,
      'RegimenFiscal': this.payload.emisor.regimenFiscal,
    }).up();

    // Nodo Receptor
    const receptorAttrs: Record<string, string> = {
      'Rfc': this.payload.receptor.rfc,
      'Nombre': this.payload.receptor.nombre,
      'DomicilioFiscalReceptor': this.payload.receptor.domicilioFiscalReceptor,
      'RegimenFiscalReceptor': this.payload.receptor.regimenFiscalReceptor,
      'UsoCFDI': this.payload.receptor.usoCfdi,
    };
    if (this.payload.receptor.residenciaFiscal) {
      receptorAttrs['ResidenciaFiscal'] = this.payload.receptor.residenciaFiscal;
    }
    if (this.payload.receptor.numRegIdTrib) {
      receptorAttrs['NumRegIdTrib'] = this.payload.receptor.numRegIdTrib;
    }
    doc.ele('cfdi:Receptor', receptorAttrs).up();

    // Nodo Conceptos
    const conceptosNode = doc.ele('cfdi:Conceptos');
    for (const item of this.payload.conceptos) {
      const conceptoAttrs: Record<string, string> = {
        'ClaveProdServ': item.claveProdServ,
        'Cantidad': item.cantidad,
        'ClaveUnidad': item.claveUnidad,
        'Descripcion': item.descripcion,
        'ValorUnitario': item.valorUnitario,
        'Importe': item.importe,
        'ObjetoImp': item.objetoImp,
      };
      if (item.descuento) conceptoAttrs['Descuento'] = item.descuento;

      const conceptoNode = conceptosNode.ele('cfdi:Concepto', conceptoAttrs);

      // Impuestos del concepto
      if (item.objetoImp === '02' && (item.traslados?.length || item.retenciones?.length)) {
        const impuestosNode = conceptoNode.ele('cfdi:Impuestos');

        if (item.traslados?.length) {
          const trasladosNode = impuestosNode.ele('cfdi:Traslados');
          for (const t of item.traslados) {
            trasladosNode.ele('cfdi:Traslado', {
              'Base': t.base,
              'Impuesto': t.tipo,
              'TipoFactor': t.factor,
              'TasaOCuota': t.tasa,
              'Importe': t.importe,
            }).up();
          }
          trasladosNode.up();
        }

        if (item.retenciones?.length) {
          const retencionesNode = impuestosNode.ele('cfdi:Retenciones');
          for (const r of item.retenciones) {
            retencionesNode.ele('cfdi:Retencion', {
              'Base': '0', // Para retenciones base no aplica en Concepto
              'Impuesto': r.tipo,
              'TipoFactor': 'Tasa',
              'TasaOCuota': '0',
              'Importe': r.importe,
            }).up();
          }
          retencionesNode.up();
        }

        impuestosNode.up();
      }
      conceptoNode.up();
    }
    conceptosNode.up();

    // Nodo Impuestos globales
    if (this.payload.impuestos) {
      const impAttrs: Record<string, string> = {};
      if (this.payload.impuestos.totalImpuestosRetenidos) {
        impAttrs['TotalImpuestosRetenidos'] = this.payload.impuestos.totalImpuestosRetenidos;
      }
      if (this.payload.impuestos.totalImpuestosTrasladados) {
        impAttrs['TotalImpuestosTrasladados'] = this.payload.impuestos.totalImpuestosTrasladados;
      }

      const impuestosNode = doc.ele('cfdi:Impuestos', impAttrs);

      if (this.payload.impuestos.retenciones?.length) {
        const retNode = impuestosNode.ele('cfdi:Retenciones');
        for (const r of this.payload.impuestos.retenciones) {
          retNode.ele('cfdi:Retencion', { 'Impuesto': r.tipo, 'Importe': r.importe }).up();
        }
        retNode.up();
      }

      if (this.payload.impuestos.traslados?.length) {
        const traNode = impuestosNode.ele('cfdi:Traslados');
        for (const t of this.payload.impuestos.traslados) {
          traNode.ele('cfdi:Traslado', {
            'Base': t.base,
            'Impuesto': t.tipo,
            'TipoFactor': t.factor,
            'TasaOCuota': t.tasa,
            'Importe': t.importe,
          }).up();
        }
        traNode.up();
      }

      impuestosNode.up();
    }

    return doc.end({ prettyPrint: true });
  }

  /**
   * Genera la cadena original del CFDI para firmar con CSD.
   * Formato: ||Version|...||| según Anexo 20 RMF.
   * En producción, esto se calcula aplicando la hoja de estilo XSLT del SAT.
   * Esta implementación genera la cadena mínima sin transformación XSLT.
   */
  public getCadenaOriginal(): string {
    const p = this.payload;
    const parts = [
      '4.0',
      p.serie || '',
      p.folio || '',
      p.fecha,
      p.formaPago || '',
      p.noCertificado,
      p.condicionesDePago || '',
      p.subTotal,
      p.descuento || '',
      p.moneda,
      p.tipoCambio || '',
      p.total,
      p.tipoDeComprobante,
      p.exportacion,
      p.metodoPago || '',
      p.lugarExpedicion,
      p.emisor.rfc,
      p.emisor.nombre,
      p.emisor.regimenFiscal,
      p.receptor.rfc,
      p.receptor.nombre,
      p.receptor.domicilioFiscalReceptor,
      p.receptor.regimenFiscalReceptor,
      p.receptor.usoCfdi,
    ];

    for (const c of p.conceptos) {
      parts.push(c.claveProdServ, c.cantidad, c.claveUnidad, c.descripcion,
        c.valorUnitario, c.importe, c.descuento || '', c.objetoImp);
      if (c.traslados) {
        for (const t of c.traslados) {
          parts.push(t.base, t.tipo, t.factor, t.tasa, t.importe);
        }
      }
    }

    if (p.impuestos) {
      if (p.impuestos.totalImpuestosRetenidos) parts.push(p.impuestos.totalImpuestosRetenidos);
      if (p.impuestos.totalImpuestosTrasladados) parts.push(p.impuestos.totalImpuestosTrasladados);
      if (p.impuestos.traslados) {
        for (const t of p.impuestos.traslados) {
          parts.push(t.base, t.tipo, t.factor, t.tasa, t.importe);
        }
      }
    }

    return '||' + parts.join('|') + '||';
  }
}
