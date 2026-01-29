/**
 * Uyumsoft API Yapılandırması
 */

export const api = {
  endpoint: 'https://efatura.uyumsoft.com.tr/Services/Integration',
  wsdl: 'https://efatura.uyumsoft.com.tr/Services/Integration?wsdl',
};

export const defaults = {
  syncMonths: 3, // Varsayılan kaç ay geriye git
  maxInvoices: 1000, // Varsayılan maksimum fatura sayısı
  pageSize: 100, // API sayfa boyutu
  requestTimeout: 30000, // API istek timeout (ms)
};

export default { api, defaults };
