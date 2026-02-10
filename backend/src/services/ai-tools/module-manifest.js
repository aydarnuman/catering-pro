/**
 * Module Manifest Standardı
 *
 * Her tool modülü bu yapıda bir "manifest" export ETMELİDİR (opsiyonel).
 *
 * manifest YOKSA → eski usul registerModule/registerXxxModule ile elle kayıt (geriye uyumlu)
 * manifest VARSA → auto-discovery tarafından otomatik yüklenir
 *
 * İKİ FORMAT DESTEKLENİR:
 *
 * FORMAT 1 — "legacy" (cari, fatura, ihale, rapor, satin-alma):
 *   module: { toolName: { description, parameters, handler } }
 *   registerModule() ile kayıt edilir → tool adı: moduleName_toolName
 *
 * FORMAT 2 — "definitions" (personel, web, piyasa, menu):
 *   definitions: [{ name, description, input_schema }]
 *   implementations: { toolName: handler }
 *   Her definition ayrı kayıt edilir → tool adı: definition.name (prefix zaten içinde)
 */

import logger from '../../utils/logger.js';

/**
 * Manifest şema tanımı (referans amaçlı)
 */
export const MANIFEST_SCHEMA = {
  // Modül benzersiz kimliği (snake_case)
  id: 'string', // örn: 'demirbas', 'arac_takip'

  // Modül görünen adı (Türkçe)
  name: 'string', // örn: 'Demirbaş Yönetimi'

  // Hangi departmana ait (BÜYÜK HARF)
  department: 'string', // örn: 'DEMİRBAŞ'

  // AI'ın bu departmanda nasıl davranacağı
  aiRole: {
    title: 'string', // örn: 'Demirbaş Uzmanı'
    icon: 'string', // örn: '🏗️'
    color: 'string', // Mantine renk adı: 'blue', 'red', vb.
  },

  // Hangi URL'lerde aktif olacağı (frontend eşleştirmesi)
  routes: ['string'], // örn: ['/muhasebe/demirbas', '/varlik-yonetimi']

  // Sayfa bağlam tipi
  contextType: 'string', // örn: 'demirbas'

  // FORMAT BELİRTECİ
  format: "'legacy' | 'definitions'",

  // Legacy format: Object with { toolName: { description, parameters, handler } }
  module: 'object (sadece legacy format)',

  // Definitions format: Array of tool definitions
  definitions: 'array (sadece definitions format)',

  // Definitions format: Object with handler functions
  implementations: 'object (sadece definitions format)',

  // Modül versiyonu
  version: 'string', // örn: '1.0.0'

  // Aktif mi? (false yaparak geçici devre dışı bırakılabilir)
  enabled: 'boolean', // varsayılan: true
};

/**
 * Zorunlu manifest alanlarını doğrular.
 * Geçersizse hata mesajı dizisi döner, geçerliyse boş dizi.
 *
 * @param {object} manifest
 * @returns {string[]} Hata mesajları (boş dizi = geçerli)
 */
export function validateManifest(manifest) {
  const errors = [];

  if (!manifest) {
    return ['Manifest objesi bulunamadı'];
  }

  // Zorunlu alanlar
  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('manifest.id (string) zorunlu');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('manifest.name (string) zorunlu');
  }
  if (!manifest.department || typeof manifest.department !== 'string') {
    errors.push('manifest.department (string) zorunlu');
  }

  // Format kontrolü
  const validFormats = ['legacy', 'definitions'];
  if (!manifest.format || !validFormats.includes(manifest.format)) {
    errors.push(`manifest.format '${validFormats.join("' | '")}' olmalı`);
  }

  // Format'a göre gerekli alanlar
  if (manifest.format === 'legacy') {
    if (!manifest.module || typeof manifest.module !== 'object') {
      errors.push('Legacy format için manifest.module (object) zorunlu');
    }
  } else if (manifest.format === 'definitions') {
    if (!Array.isArray(manifest.definitions)) {
      errors.push('Definitions format için manifest.definitions (array) zorunlu');
    }
    if (!manifest.implementations || typeof manifest.implementations !== 'object') {
      errors.push('Definitions format için manifest.implementations (object) zorunlu');
    }
  }

  // Opsiyonel ama önerilen alanlar (uyarı)
  if (!manifest.aiRole) {
    logger.debug(`[Manifest] ${manifest.id}: aiRole eksik (opsiyonel)`);
  }
  if (!manifest.routes || !Array.isArray(manifest.routes)) {
    logger.debug(`[Manifest] ${manifest.id}: routes eksik (opsiyonel)`);
  }

  return errors;
}

/**
 * Manifest'ten tool sayısını hesaplar
 * @param {object} manifest
 * @returns {number}
 */
export function getToolCount(manifest) {
  if (!manifest) return 0;

  if (manifest.format === 'legacy' && manifest.module) {
    return Object.keys(manifest.module).length;
  }

  if (manifest.format === 'definitions' && Array.isArray(manifest.definitions)) {
    return manifest.definitions.length;
  }

  return 0;
}

/**
 * Yeni modül oluşturmak için boş manifest şablonu döner
 * @param {string} id - Modül ID'si
 * @returns {object} Boş manifest şablonu
 */
export function createManifestTemplate(id) {
  return {
    id,
    name: `${id.charAt(0).toUpperCase() + id.slice(1)} Yönetimi`,
    department: id.toUpperCase(),
    aiRole: {
      title: `${id.charAt(0).toUpperCase() + id.slice(1)} Uzmanı`,
      icon: '🔧',
      color: 'blue',
    },
    routes: [`/muhasebe/${id}`],
    contextType: id,
    format: 'legacy',
    module: {},
    version: '1.0.0',
    enabled: true,
  };
}
