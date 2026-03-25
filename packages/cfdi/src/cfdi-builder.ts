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
}

export interface CfdiConcepto {
  claveProdServ: string;
  cantidad: string;
  claveUnidad: string;
  descripcion: string;
  valorUnitario: string;
  importe: string;
  descuento?: string;
  objetoImp: string;
}

export interface CfdiPayload {
  serie?: string;
  folio?: string;
  fecha: string;
  formaPago: string;
  condicionesDePago?: string;
  subTotal: string;
  descuento?: string;
  moneda: string;
  tipoCambio?: string;
  total: string;
  tipoDeComprobante: string;
  metodoPago: string;
  lugarExpedicion: string;
  emisor: CfdiEmisor;
  receptor: CfdiReceptor;
  conceptos: CfdiConcepto[];
}

export class CfdiBuilder {
  private payload: CfdiPayload;

  constructor(payload: CfdiPayload) {
    this.payload = payload;
  }

  public buildXml(): string {
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('cfdi:Comprobante', {
        'xmlns:cfdi': 'http://www.sat.gob.mx/cfd/4',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd',
        'Version': '4.0',
        'Serie': this.payload.serie || '',
        'Folio': this.payload.folio || '',
        'Fecha': this.payload.fecha,
        'Sello': '', // El sello se genera después con openSSL / crypto
        'FormaPago': this.payload.formaPago,
        'NoCertificado': '', // Certificado real requerido (CSD)
        'Certificado': '', // Base64 del certificado
        'CondicionesDePago': this.payload.condicionesDePago || '',
        'SubTotal': this.payload.subTotal,
        'Descuento': this.payload.descuento || '0.00',
        'Moneda': this.payload.moneda,
        'TipoCambio': this.payload.tipoCambio || '1',
        'Total': this.payload.total,
        'TipoDeComprobante': this.payload.tipoDeComprobante,
        'Exportacion': '01', // 01 No aplica
        'MetodoPago': this.payload.metodoPago,
        'LugarExpedicion': this.payload.lugarExpedicion
      });

    // Nodo Emisor
    doc.ele('cfdi:Emisor', {
      'Rfc': this.payload.emisor.rfc,
      'Nombre': this.payload.emisor.nombre,
      'RegimenFiscal': this.payload.emisor.regimenFiscal
    });

    // Nodo Receptor
    doc.ele('cfdi:Receptor', {
      'Rfc': this.payload.receptor.rfc,
      'Nombre': this.payload.receptor.nombre,
      'DomicilioFiscalReceptor': this.payload.receptor.domicilioFiscalReceptor,
      'RegimenFiscalReceptor': this.payload.receptor.regimenFiscalReceptor,
      'UsoCFDI': this.payload.receptor.usoCfdi
    });

    // Nodo Conceptos
    const conceptosNode = doc.ele('cfdi:Conceptos');
    for (const item of this.payload.conceptos) {
      conceptosNode.ele('cfdi:Concepto', {
        'ClaveProdServ': item.claveProdServ,
        'Cantidad': item.cantidad,
        'ClaveUnidad': item.claveUnidad,
        'Descripcion': item.descripcion,
        'ValorUnitario': item.valorUnitario,
        'Importe': item.importe,
        'Descuento': item.descuento || '0.00',
        'ObjetoImp': item.objetoImp
      });
      // Importante: Aquí irían los nodos de Impuestos hijos (cfdi:Traslados / cfdi:Retenciones) del concepto
      // Se generará en el siguiente bloque según se necesite.
    }

    // Retorna el XML en String sin indentación (SAT manda que la cadena original lo estipule, pero los PAC lo leen indentado opcionalmente)
    return doc.end({ prettyPrint: true });
  }

  // En el futuro, a esta clase se le agregará:
  // - public getCadenaOriginal()
  // - public signWithPEM(keyPem, password)
}
