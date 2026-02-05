/**
 * Constants
 * Enum'lar ve sabit listeler
 */

// ============================================
// TURKISH CITIES
// ============================================

export const TURKISH_CITIES = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Aksaray',
  'Amasya',
  'Ankara',
  'Antalya',
  'Ardahan',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bartın',
  'Batman',
  'Bayburt',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Düzce',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Iğdır',
  'Isparta',
  'İstanbul',
  'İzmir',
  'Kahramanmaraş',
  'Karabük',
  'Karaman',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kırıkkale',
  'Kırklareli',
  'Kırşehir',
  'Kilis',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Mardin',
  'Mersin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Osmaniye',
  'Rize',
  'Sakarya',
  'Samsun',
  'Siirt',
  'Sinop',
  'Sivas',
  'Şanlıurfa',
  'Şırnak',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Uşak',
  'Van',
  'Yalova',
  'Yozgat',
  'Zonguldak',
];

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOC_TYPES = {
  // İndirilebilir dökümanlar
  TECH_SPEC: 'tech_spec',
  ADMIN_SPEC: 'admin_spec',
  ANNOUNCEMENT: 'announcement',
  GOODS_LIST: 'goods_list',
  GOODS_SERVICES: 'goods_services',
  ZEYILNAME: 'zeyilname',
  ZEYILNAME_TECH_SPEC: 'zeyilname_tech_spec',
  ZEYILNAME_ADMIN_SPEC: 'zeyilname_admin_spec',
  CORRECTION_NOTICE: 'correction_notice',
  CONTRACT: 'contract',
  UNIT_PRICE: 'unit_price',
  PURSANTAJ: 'pursantaj',
  QUANTITY_SURVEY: 'quantity_survey',
  STANDARD_FORMS: 'standard_forms',
  OTHER: 'other',
};

export const DOC_TYPE_LABELS = {
  [DOC_TYPES.TECH_SPEC]: 'Teknik Şartname',
  [DOC_TYPES.ADMIN_SPEC]: 'İdari Şartname',
  [DOC_TYPES.ANNOUNCEMENT]: 'İhale İlanı',
  [DOC_TYPES.GOODS_LIST]: 'Malzeme Listesi',
  [DOC_TYPES.GOODS_SERVICES]: 'Mal/Hizmet Listesi',
  [DOC_TYPES.ZEYILNAME]: 'Zeyilname',
  [DOC_TYPES.ZEYILNAME_TECH_SPEC]: 'Teknik Şartname Zeyilnamesi',
  [DOC_TYPES.ZEYILNAME_ADMIN_SPEC]: 'İdari Şartname Zeyilnamesi',
  [DOC_TYPES.CORRECTION_NOTICE]: 'Düzeltme İlanı',
  [DOC_TYPES.CONTRACT]: 'Sözleşme Tasarısı',
  [DOC_TYPES.UNIT_PRICE]: 'Birim Fiyat Teklif Cetveli',
  [DOC_TYPES.PURSANTAJ]: 'Pursantaj Listesi',
  [DOC_TYPES.QUANTITY_SURVEY]: 'Mahal Listesi / Metraj',
  [DOC_TYPES.STANDARD_FORMS]: 'Standart Formlar',
  [DOC_TYPES.OTHER]: 'Diğer',
};

// ============================================
// SOURCE TYPES
// ============================================

export const SOURCE_TYPES = {
  CONTENT: 'content', // Site içeriğinden oluşturulan
  DOWNLOAD: 'download', // ihalebul.com'dan indirilen
  UPLOAD: 'upload', // Kullanıcının yüklediği
};

// ============================================
// PROCESSING STATUS
// ============================================

export const PROCESSING_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// ============================================
// TENDER STATUS
// ============================================

export const TENDER_STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

// ============================================
// TRACKING STATUS
// ============================================

export const TRACKING_STATUS = {
  PENDING: 'bekliyor',
  APPLIED: 'basvuruldu',
  WON: 'kazanildi',
  LOST: 'kaybedildi',
  CANCELLED: 'iptal',
};

// ============================================
// IHALEBUL.COM URL CODES
// ============================================

export const IHALEBUL_URL_CODES = {
  2: DOC_TYPES.ANNOUNCEMENT,
  3: DOC_TYPES.CORRECTION_NOTICE,
  6: DOC_TYPES.GOODS_LIST,
  7: DOC_TYPES.ADMIN_SPEC,
  8: DOC_TYPES.TECH_SPEC,
  9: DOC_TYPES.ZEYILNAME,
};

// ============================================
// FILE EXTENSIONS BY CATEGORY
// ============================================

export const FILE_EXTENSIONS = {
  DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.odt', '.ods', '.rtf'],
  ARCHIVES: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'],
  TEXT: ['.txt', '.csv', '.json', '.xml', '.html'],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Doc type'dan label al
 * @param {string} docType
 * @returns {string}
 */
export function getDocTypeLabel(docType) {
  return DOC_TYPE_LABELS[docType] || docType;
}

/**
 * URL kodundan doc type al
 * @param {string|number} code
 * @returns {string}
 */
export function getDocTypeFromUrlCode(code) {
  return IHALEBUL_URL_CODES[parseInt(code, 10)] || DOC_TYPES.OTHER;
}

/**
 * Dosya uzantısının desteklenip desteklenmediğini kontrol et
 * @param {string} extension
 * @returns {boolean}
 */
export function isSupportedExtension(extension) {
  const ext = extension.toLowerCase();
  return (
    FILE_EXTENSIONS.DOCUMENTS.includes(ext) ||
    FILE_EXTENSIONS.ARCHIVES.includes(ext) ||
    FILE_EXTENSIONS.IMAGES.includes(ext) ||
    FILE_EXTENSIONS.TEXT.includes(ext)
  );
}
