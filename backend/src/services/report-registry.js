/**
 * Report Registry - Merkezi Rapor Kayıt Sistemi
 * Tüm modüller raporlarını buraya kaydeder.
 * Registry rapor tanımlarını tutar, modül bazlı filtreler, generate isteğini doğru generator'a yönlendirir.
 */

const reports = new Map();
const generators = new Map();

/**
 * Rapor tanımı şeması:
 * {
 *   id: string,              // Benzersiz rapor ID (örn: 'ihale-ozet')
 *   module: string,           // Modül adı (örn: 'ihale', 'finans', 'operasyon', 'admin')
 *   label: string,            // Görünen ad
 *   description: string,      // Açıklama
 *   icon: string,             // Tabler icon adı (örn: 'file-text')
 *   formats: string[],        // Desteklenen formatlar: ['excel', 'pdf']
 *   requiresContext: boolean,  // Context (tenderId, projeId vb.) gerekli mi
 *   contextType: string|null, // 'tender', 'proje', 'donem', null
 *   category: string,         // Alt gruplama (örn: 'tek-ihale', 'genel', 'finansal')
 *   generator: string,        // Generator referansı: 'modulAdi:fonksiyonAdi'
 * }
 */

/**
 * Rapor tanımı kaydet
 * @param {Object} definition - Rapor tanımı
 */
export function registerReport(definition) {
  if (!definition.id || !definition.module || !definition.generator) {
    throw new Error(`Rapor kaydı eksik alan: id=${definition.id}, module=${definition.module}, generator=${definition.generator}`);
  }
  reports.set(definition.id, {
    ...definition,
    formats: definition.formats || ['excel'],
    requiresContext: definition.requiresContext ?? false,
    contextType: definition.contextType || null,
    category: definition.category || 'genel',
  });
}

/**
 * Birden fazla rapor tanımı kaydet
 * @param {Array<Object>} definitions
 */
export function registerReports(definitions) {
  for (const def of definitions) {
    registerReport(def);
  }
}

/**
 * Generator fonksiyon kaydet
 * @param {string} name - Generator adı (örn: 'ihale')
 * @param {Object} fns - { fonksiyonAdi: async (context, format) => {buffer, filename, contentType} }
 */
export function registerGenerator(name, fns) {
  generators.set(name, fns);
}

/**
 * Tüm rapor tanımlarını getir (modül bazlı gruplu)
 * @param {string|null} moduleFilter - Modül filtresi
 * @returns {Object} - { modules: [{ module, label, reports: [...] }] }
 */
export function getCatalog(moduleFilter = null) {
  const moduleLabels = {
    ihale: 'İhale Merkezi',
    finans: 'Finans',
    operasyon: 'Operasyon',
    admin: 'Yönetim',
  };

  const grouped = {};

  for (const [, report] of reports) {
    if (moduleFilter && report.module !== moduleFilter) continue;
    if (!grouped[report.module]) {
      grouped[report.module] = {
        module: report.module,
        label: moduleLabels[report.module] || report.module,
        reports: [],
      };
    }
    grouped[report.module].reports.push({
      id: report.id,
      label: report.label,
      description: report.description,
      icon: report.icon,
      formats: report.formats,
      requiresContext: report.requiresContext,
      contextType: report.contextType,
      category: report.category,
    });
  }

  // Kategoriye göre sırala
  for (const mod of Object.values(grouped)) {
    mod.reports.sort((a, b) => {
      if (a.category === b.category) return 0;
      if (a.category === 'tek-ihale' || a.category === 'detay') return -1;
      return 1;
    });
  }

  return {
    modules: Object.values(grouped),
  };
}

/**
 * Tek rapor tanımını getir
 * @param {string} reportId
 * @returns {Object|null}
 */
export function getReportDefinition(reportId) {
  return reports.get(reportId) || null;
}

/**
 * Rapor üret
 * @param {string} reportId - Rapor ID
 * @param {string} format - 'excel' veya 'pdf'
 * @param {Object} context - Sayfa bağlamı (tenderId, filters, vb.)
 * @returns {Promise<{buffer: Buffer, filename: string, contentType: string}>}
 */
export async function generateReport(reportId, format, context = {}) {
  const definition = reports.get(reportId);
  if (!definition) {
    throw new Error(`Rapor bulunamadı: ${reportId}`);
  }

  if (!definition.formats.includes(format)) {
    throw new Error(`${reportId} raporu "${format}" formatını desteklemiyor. Desteklenen: ${definition.formats.join(', ')}`);
  }

  // Generator referansını parse et: 'modulAdi:fonksiyonAdi'
  const [genName, fnName] = definition.generator.split(':');
  const gen = generators.get(genName);
  if (!gen) {
    throw new Error(`Generator bulunamadı: ${genName}`);
  }

  const fn = gen[fnName];
  if (!fn || typeof fn !== 'function') {
    throw new Error(`Generator fonksiyonu bulunamadı: ${genName}:${fnName}`);
  }

  const result = await fn(context, format);
  return {
    buffer: result.buffer,
    filename: result.filename || `${reportId}-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`,
    contentType: result.contentType || (format === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf'),
  };
}

/**
 * Preview verisi üret (PDF için buffer, Excel için JSON tablo)
 * @param {string} reportId
 * @param {string} format
 * @param {Object} context
 * @returns {Promise<{type: 'pdf'|'table', data: Buffer|Object}>}
 */
export async function previewReport(reportId, format, context = {}) {
  const definition = reports.get(reportId);
  if (!definition) {
    throw new Error(`Rapor bulunamadı: ${reportId}`);
  }

  // Generator referansını parse et
  const [genName, fnName] = definition.generator.split(':');
  const gen = generators.get(genName);
  if (!gen) {
    throw new Error(`Generator bulunamadı: ${genName}`);
  }

  // Preview fonksiyonu varsa onu kullan, yoksa normal generate
  const previewFnName = `${fnName}Preview`;
  const previewFn = gen[previewFnName];

  if (previewFn && typeof previewFn === 'function') {
    return await previewFn(context, format);
  }

  // Fallback: Normal generate çalıştır
  if (format === 'pdf' || !definition.formats.includes('excel')) {
    const result = await generateReport(reportId, definition.formats.includes('pdf') ? 'pdf' : definition.formats[0], context);
    return { type: 'pdf', data: result.buffer };
  }

  // Excel için: generate edip JSON olarak dön
  const fn = gen[fnName];
  if (fn) {
    const result = await fn(context, 'json');
    if (result.previewData) {
      return { type: 'table', data: result.previewData };
    }
  }

  // Son fallback: PDF olarak üret
  const result = await generateReport(reportId, definition.formats[0], context);
  return { type: 'pdf', data: result.buffer };
}

export default {
  registerReport,
  registerReports,
  registerGenerator,
  getCatalog,
  getReportDefinition,
  generateReport,
  previewReport,
};
