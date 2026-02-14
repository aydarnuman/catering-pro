/**
 * Uyumsoft e-Fatura SOAP API Client
 *
 * API Endpoint: https://efatura.uyumsoft.com.tr/Services/Integration
 * Authentication: WS-Security (UsernameToken)
 */

// Node 18+ has native fetch — no import needed
import { parseStringPromise } from 'xml2js';

const API_ENDPOINT = 'https://efatura.uyumsoft.com.tr/Services/Integration';
const SOAP_TIMEOUT_MS = 60000; // Uyumsoft yanıt süresi limiti (1 dk - sync sayfa sayfa uzun sürebilir)

/**
 * SOAP envelope template with WS-Security header
 */
function createSoapEnvelope(username, password, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://tempuri.org/"
               xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password>${password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Uyumsoft API Client
 */
export class UyumsoftApiClient {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  /**
   * Parse SOAP Fault mesajı (XML'den metin çıkar)
   */
  _faultMessage(fault) {
    if (!fault) return '';
    const str =
      fault.faultstring ??
      fault.Faultstring ??
      fault.Reason?.Text ??
      fault.Reason?.text ??
      fault['s:faultstring'] ??
      fault['s:Faultstring'];
    if (typeof str === 'string') return str.trim();
    if (str && typeof str === 'object') return (str._ ?? str['#text'] ?? '').trim() || '';
    return '';
  }

  /**
   * Make SOAP request
   */
  async soapRequest(action, body) {
    const envelope = createSoapEnvelope(this.username, this.password, body);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOAP_TIMEOUT_MS);
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: action,
        },
        body: envelope,
        signal: controller.signal,
      });

      const text = await response.text();
      const result = await parseStringPromise(text, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [(name) => name.replace(/^.*:/, '')],
      }).catch(() => null);

      const bodyObj = result?.Envelope?.Body ?? result?.body ?? {};
      const fault = bodyObj.Fault ?? bodyObj.fault;

      if (!response.ok) {
        const msg = fault ? this._faultMessage(fault) : `HTTP ${response.status}`;
        throw new Error(msg || `SOAP isteği başarısız: ${response.status}`);
      }

      if (fault) {
        const msg = this._faultMessage(fault);
        throw new Error(msg || 'Uyumsoft servisi hata döndü.');
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(
          'Uyumsoft servisi zaman aşımına uğradı. İnternet bağlantınızı ve Uyumsoft erişimini kontrol edin.'
        );
      }
      if (
        error.message?.startsWith('Uyumsoft') ||
        error.message?.includes('yetkiniz') ||
        error.message?.includes('Ip:')
      ) {
        throw error;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    const body = `<tns:TestConnection />`;
    const result = await this.soapRequest('http://tempuri.org/IIntegration/TestConnection', body);
    const response = result?.Envelope?.Body?.TestConnectionResponse?.TestConnectionResult;
    const attrs = response?.$ ?? {};
    const ok = attrs.IsSucceded === 'true' || attrs.IsSucceeded === 'true';
    const message = attrs.Message ?? '';
    return { success: ok, message };
  }

  /**
   * Who am I - Get user info
   */
  async whoAmI() {
    const body = `<tns:WhoAmI />`;
    const result = await this.soapRequest('http://tempuri.org/IIntegration/WhoAmI', body);
    const response = result?.Envelope?.Body?.WhoAmIResponse?.WhoAmIResult;
    const attrs = response?.$ ?? {};
    const ok = attrs.IsSucceded === 'true' || attrs.IsSucceeded === 'true';
    return { success: ok, value: response?.Value };
  }

  /**
   * Get inbox invoice list
   * @param {Object} options - Query options
   * @param {number} options.pageIndex - Page index (0-based)
   * @param {number} options.pageSize - Page size
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   */
  async getInboxInvoiceList(options = {}) {
    const { pageIndex = 0, pageSize = 100, startDate = null, endDate = null, onlyNewest = false } = options;

    const startDateXml = startDate
      ? `<tns:ExecutionStartDate>${startDate.toISOString()}</tns:ExecutionStartDate>`
      : `<tns:ExecutionStartDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>`;

    const endDateXml = endDate
      ? `<tns:ExecutionEndDate>${endDate.toISOString()}</tns:ExecutionEndDate>`
      : `<tns:ExecutionEndDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>`;

    const body = `
    <tns:GetInboxInvoiceList>
      <tns:query PageIndex="${pageIndex}" PageSize="${pageSize}" OnlyNewestInvoices="${onlyNewest}">
        ${startDateXml}
        ${endDateXml}
        <tns:CreateStartDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
        <tns:CreateEndDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
        <tns:Status xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
        <tns:SortColumn xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
        <tns:SortMode xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
        <tns:IsArchived xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
      </tns:query>
    </tns:GetInboxInvoiceList>`;

    const result = await this.soapRequest('http://tempuri.org/IIntegration/GetInboxInvoiceList', body);

    const response = result?.Envelope?.Body?.GetInboxInvoiceListResponse?.GetInboxInvoiceListResult;

    if (response?.$?.IsSucceded !== 'true') {
      throw new Error(response?.$?.Message || 'Failed to get invoice list');
    }

    const value = response?.Value;
    const items = value?.Items || [];

    // Normalize items to array
    const invoices = Array.isArray(items) ? items : items ? [items] : [];

    return {
      success: true,
      pageIndex: parseInt(String(value?.$?.PageIndex ?? 0), 10),
      pageSize: parseInt(String(value?.$?.PageSize ?? 0), 10),
      totalCount: parseInt(String(value?.$?.TotalCount ?? 0), 10),
      totalPages: parseInt(String(value?.$?.TotalPages ?? 0), 10),
      invoices: invoices.map(this.parseInvoiceListItem),
    };
  }

  /**
   * Parse invoice list item
   */
  parseInvoiceListItem(item) {
    return {
      invoiceId: item?.InvoiceId || '',
      documentId: item?.DocumentId || '',
      type: item?.Type || '',
      targetVkn: item?.TargetTcknVkn || '',
      targetTitle: item?.TargetTitle || '',
      status: item?.Status || '',
      executionDate: item?.ExecutionDate || '',
      createDate: item?.CreateDateUtc || '',
      payableAmount: parseFloat(item?.PayableAmount || 0),
      taxTotal: parseFloat(item?.TaxTotal || 0),
      taxExclusiveAmount: parseFloat(item?.TaxExclusiveAmount || 0),
      currency: item?.DocumentCurrencyCode || 'TRY',
      isNew: item?.IsNew === 'true',
      isSeen: item?.IsSeen === 'true',
    };
  }

  /**
   * Get single inbox invoice (UBL XML)
   * @param {string} invoiceId - Invoice ID (ETTN)
   */
  async getInboxInvoice(invoiceId) {
    const body = `
    <tns:GetInboxInvoice>
      <tns:invoiceId>${invoiceId}</tns:invoiceId>
    </tns:GetInboxInvoice>`;

    const result = await this.soapRequest('http://tempuri.org/IIntegration/GetInboxInvoice', body);

    const response = result?.Envelope?.Body?.GetInboxInvoiceResponse?.GetInboxInvoiceResult;

    if (response?.$?.IsSucceded !== 'true') {
      throw new Error(response?.$?.Message || 'Failed to get invoice');
    }

    return {
      success: true,
      invoice: response?.Value?.Invoice,
    };
  }

  /**
   * Get inbox invoice HTML view
   * @param {string} invoiceId - Invoice ID (ETTN)
   */
  async getInboxInvoiceView(invoiceId) {
    const body = `
    <tns:GetInboxInvoiceView>
      <tns:invoiceId>${invoiceId}</tns:invoiceId>
    </tns:GetInboxInvoiceView>`;

    const result = await this.soapRequest('http://tempuri.org/IIntegration/GetInboxInvoiceView', body);

    const response = result?.Envelope?.Body?.GetInboxInvoiceViewResponse?.GetInboxInvoiceViewResult;

    if (response?.$?.IsSucceded !== 'true') {
      throw new Error(response?.$?.Message || 'Failed to get invoice view');
    }

    return {
      success: true,
      html: response?.Value?.Html || '',
      isVerified: response?.Value?.Verification?.$?.IsVerified === 'true',
      signingDate: response?.Value?.Verification?.SigningDate,
    };
  }

  /**
   * Get inbox invoice PDF
   * @param {string} invoiceId - Invoice ID (ETTN)
   */
  async getInboxInvoicePdf(invoiceId) {
    const body = `
    <tns:GetInboxInvoicePdf>
      <tns:invoiceId>${invoiceId}</tns:invoiceId>
    </tns:GetInboxInvoicePdf>`;

    const result = await this.soapRequest('http://tempuri.org/IIntegration/GetInboxInvoicePdf', body);

    const response = result?.Envelope?.Body?.GetInboxInvoicePdfResponse?.GetInboxInvoicePdfResult;

    if (response?.$?.IsSucceded !== 'true') {
      throw new Error(response?.$?.Message || 'Failed to get invoice PDF');
    }

    return {
      success: true,
      pdfBase64: response?.Value?.Data || '',
      invoiceId: response?.Value?.$?.InvoiceId,
    };
  }

  /**
   * Get inbox invoice XML data
   * @param {string} invoiceId - Invoice ID (ETTN)
   */
  async getInboxInvoiceData(invoiceId) {
    const body = `
    <tns:GetInboxInvoiceData>
      <tns:invoiceId>${invoiceId}</tns:invoiceId>
    </tns:GetInboxInvoiceData>`;

    const result = await this.soapRequest('http://tempuri.org/IIntegration/GetInboxInvoiceData', body);

    const response = result?.Envelope?.Body?.GetInboxInvoiceDataResponse?.GetInboxInvoiceDataResult;

    if (response?.$?.IsSucceded !== 'true') {
      throw new Error(response?.$?.Message || 'Failed to get invoice data');
    }

    return {
      success: true,
      xmlBase64: response?.Value?.Data || '',
      invoiceId: response?.Value?.$?.InvoiceId,
    };
  }
}

export default UyumsoftApiClient;
