/**
 * Uyumsoft e-Fatura SOAP API Client
 * 
 * API Endpoint: https://efatura.uyumsoft.com.tr/Services/Integration
 * Authentication: WS-Security (UsernameToken)
 */

import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const API_ENDPOINT = 'https://efatura.uyumsoft.com.tr/Services/Integration';

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
   * Make SOAP request
   */
  async soapRequest(action, body) {
    const envelope = createSoapEnvelope(this.username, this.password, body);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': action,
        },
        body: envelope,
      });

      const text = await response.text();
      
      if (!response.ok) {
        console.error('SOAP Error Response:', text);
        throw new Error(`SOAP request failed: ${response.status}`);
      }

      // Parse XML response
      const result = await parseStringPromise(text, { 
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [(name) => name.replace(/^.*:/, '')] // Remove namespace prefixes
      });

      return result;
    } catch (error) {
      console.error('SOAP Request Error:', error.message);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    const body = `<tns:TestConnection />`;
    const result = await this.soapRequest('http://tempuri.org/IIntegration/TestConnection', body);
    
    const response = result?.Envelope?.Body?.TestConnectionResponse?.TestConnectionResult;
    return {
      success: response?.['$']?.IsSucceded === 'true',
      message: response?.['$']?.Message || '',
    };
  }

  /**
   * Who am I - Get user info
   */
  async whoAmI() {
    const body = `<tns:WhoAmI />`;
    const result = await this.soapRequest('http://tempuri.org/IIntegration/WhoAmI', body);
    
    const response = result?.Envelope?.Body?.WhoAmIResponse?.WhoAmIResult;
    return {
      success: response?.['$']?.IsSucceded === 'true',
      value: response?.Value,
    };
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
    const {
      pageIndex = 0,
      pageSize = 100,
      startDate = null,
      endDate = null,
      onlyNewest = false,
    } = options;

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
    
    if (response?.['$']?.IsSucceded !== 'true') {
      throw new Error(response?.['$']?.Message || 'Failed to get invoice list');
    }

    const value = response?.Value;
    const items = value?.Items || [];
    
    // Normalize items to array
    const invoices = Array.isArray(items) ? items : (items ? [items] : []);

    return {
      success: true,
      pageIndex: parseInt(value?.['$']?.PageIndex || 0),
      pageSize: parseInt(value?.['$']?.PageSize || 0),
      totalCount: parseInt(value?.['$']?.TotalCount || 0),
      totalPages: parseInt(value?.['$']?.TotalPages || 0),
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
    
    if (response?.['$']?.IsSucceded !== 'true') {
      throw new Error(response?.['$']?.Message || 'Failed to get invoice');
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
    
    if (response?.['$']?.IsSucceded !== 'true') {
      throw new Error(response?.['$']?.Message || 'Failed to get invoice view');
    }

    return {
      success: true,
      html: response?.Value?.Html || '',
      isVerified: response?.Value?.Verification?.['$']?.IsVerified === 'true',
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
    
    if (response?.['$']?.IsSucceded !== 'true') {
      throw new Error(response?.['$']?.Message || 'Failed to get invoice PDF');
    }

    return {
      success: true,
      pdfBase64: response?.Value?.Data || '',
      invoiceId: response?.Value?.['$']?.InvoiceId,
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
    
    if (response?.['$']?.IsSucceded !== 'true') {
      throw new Error(response?.['$']?.Message || 'Failed to get invoice data');
    }

    return {
      success: true,
      xmlBase64: response?.Value?.Data || '',
      invoiceId: response?.Value?.['$']?.InvoiceId,
    };
  }
}

export default UyumsoftApiClient;

