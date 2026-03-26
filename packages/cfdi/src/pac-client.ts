/**
 * Cliente PAC (Proveedor Autorizado de Certificación)
 * Soporta: SW Sapien (REST) y Finkok (SOAP simulado)
 *
 * Para producción real, se requieren credenciales del PAC y CSD válido.
 * En sandbox, retorna respuestas mockeadas con estructura real del SAT.
 */

export interface PacStampResult {
  uuid: string;
  fechaTimbrado: string;
  selloCFD: string;
  selloSAT: string;
  noCertificadoSAT: string;
  xmlTimbrado: string;
}

export interface PacCancelResult {
  acuse: string;
  status: 'CANCELADO' | 'EN_PROCESO' | 'RECHAZADO';
  fechaCancelacion?: string;
}

export interface PacConfig {
  provider: 'SW_SAPIEN' | 'FINKOK' | 'SANDBOX';
  user: string;
  password: string;
  environment: 'sandbox' | 'production';
}

export class PacClient {
  constructor(private config: PacConfig) {}

  /**
   * Timbra un XML de CFDI ya firmado con CSD.
   * En sandbox retorna un mock con estructura real para desarrollo.
   */
  public async stampXml(xmlFirmado: string): Promise<PacStampResult> {
    if (this.config.environment === 'sandbox' || this.config.provider === 'SANDBOX') {
      return this.mockStamp(xmlFirmado);
    }

    if (this.config.provider === 'SW_SAPIEN') {
      return this.stampWithSWSapien(xmlFirmado);
    }

    return this.mockStamp(xmlFirmado);
  }

  /**
   * Cancela un CFDI ante el SAT.
   * Motivos: 01=Comp. en error con rel., 02=Comp. en error sin rel., 03=No se llevó a cabo operación, 04=Operación nominativa
   */
  public async cancelCfdi(
    uuid: string,
    rfcEmisor: string,
    rfcReceptor: string,
    total: string,
    motivo: '01' | '02' | '03' | '04',
    folioSustitucion?: string
  ): Promise<PacCancelResult> {
    if (this.config.environment === 'sandbox' || this.config.provider === 'SANDBOX') {
      return {
        acuse: `MOCK_ACUSE_CANCELACION_${uuid}`,
        status: 'CANCELADO',
        fechaCancelacion: new Date().toISOString(),
      };
    }

    // En producción implementar llamada real al PAC
    return {
      acuse: '',
      status: 'RECHAZADO',
    };
  }

  private async stampWithSWSapien(xmlFirmado: string): Promise<PacStampResult> {
    // SW Sapien REST API
    // POST https://services.sw.com.mx/cfdi33/stamp/v3/b64
    // Body: { xml: Buffer.from(xmlFirmado).toString('base64') }
    // Headers: Authorization: Bearer <token>
    throw new Error('SW Sapien production not configured. Set PAC_PROVIDER=SANDBOX for development.');
  }

  private mockStamp(xmlFirmado: string): PacStampResult {
    const mockUuid = this.generateMockUuid();
    const fechaTimbrado = new Date().toISOString().substring(0, 19);
    const mockSelloCFD = 'MockSelloCFD' + Math.random().toString(36).substring(2, 20).toUpperCase();
    const mockSelloSAT = 'MockSelloSAT' + Math.random().toString(36).substring(2, 20).toUpperCase();

    // Insertar el complemento TimbreFiscalDigital en el XML
    const tfd = `<cfdi:Complemento>` +
      `<tfd:TimbreFiscalDigital ` +
      `xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" ` +
      `xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd" ` +
      `Version="1.1" ` +
      `UUID="${mockUuid}" ` +
      `FechaTimbrado="${fechaTimbrado}" ` +
      `RfcProvCertif="SAT970701NN3" ` +
      `SelloCFD="${mockSelloCFD}" ` +
      `NoCertificadoSAT="20001000000300022323" ` +
      `SelloSAT="${mockSelloSAT}"/>` +
      `</cfdi:Complemento>`;

    const xmlTimbrado = xmlFirmado.replace(
      '</cfdi:Comprobante>',
      tfd + '</cfdi:Comprobante>'
    );

    return {
      uuid: mockUuid,
      fechaTimbrado,
      selloCFD: mockSelloCFD,
      selloSAT: mockSelloSAT,
      noCertificadoSAT: '20001000000300022323',
      xmlTimbrado,
    };
  }

  private generateMockUuid(): string {
    // Formato UUID v4 real para que sea compatible con validaciones del SAT
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16).toUpperCase();
    });
  }
}
