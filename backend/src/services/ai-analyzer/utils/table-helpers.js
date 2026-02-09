/**
 * Table Helper Functions - Azure Document Intelligence tablo işleme
 * unified-pipeline.js'den extract edildi (refactoring)
 * 
 * Bu fonksiyonlar Azure'dan gelen tablo verilerini parse edip
 * anlamlı veri yapılarına dönüştürür.
 */

/**
 * Azure tablosunun türünü tespit et (menü, gramaj, personel)
 * @param {Object} table - Azure tablo objesi (cells veya rows formatı)
 * @returns {'menu'|'gramaj'|'personnel'|'unknown'}
 */
export function detectTableType(table) {
  // REST API formatı: cells array ile geliyor
  // SDK formatı: headers ve rows ile geliyor
  let text = '';

  if (table.cells) {
    // REST API formatı
    text = table.cells
      .map((c) => c.content || '')
      .join(' ')
      .toLowerCase();
  } else {
    // SDK formatı
    text = [...(table.headers || []), ...(table.rows || []).flat()].join(' ').toLowerCase();
  }

  if (text.includes('menü') || text.includes('kahvaltı') || text.includes('öğle') || text.includes('yemek'))
    return 'menu';
  if (text.includes('gram') || text.includes('porsiyon') || text.includes('miktar') || text.includes('ağırlık'))
    return 'gramaj';
  if (text.includes('personel') || text.includes('aşçı') || text.includes('görevli') || text.includes('çalışan'))
    return 'personnel';
  return 'unknown';
}

/**
 * Gramaj tablosundan yapılandırılmış veri çıkar
 * @param {Array} tables - Azure gramaj tabloları
 * @returns {Array<{item: string, weight: string, unit: string}>}
 */
export function extractGramajData(tables) {
  const results = [];
  for (const table of tables) {
    // REST API formatı: cells array
    if (table.cells) {
      const cellsByRow = {};
      for (const cell of table.cells) {
        if (!cellsByRow[cell.rowIndex]) cellsByRow[cell.rowIndex] = [];
        cellsByRow[cell.rowIndex][cell.columnIndex] = cell.content || '';
      }
      // İlk satır header olabilir, atla
      const rows = Object.keys(cellsByRow)
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        const row = cellsByRow[rows[i]] || [];
        if (row.length >= 2) {
          const item = row[0]?.trim();
          const weightMatch = row[1]?.match(/(\d+)/);
          if (item && weightMatch) {
            results.push({ item, weight: weightMatch[1], unit: 'g' });
          }
        }
      }
    } else {
      // SDK formatı: rows array
      for (const row of table.rows || []) {
        if (row.length >= 2) {
          const item = row[0];
          const weight = row[1]?.match(/(\d+)/)?.[1];
          if (item && weight) {
            results.push({ item, weight, unit: 'g' });
          }
        }
      }
    }
  }
  return results;
}

/**
 * Personel tablosundan yapılandırılmış veri çıkar
 * @param {Array} tables - Azure personel tabloları
 * @returns {Array<{pozisyon: string, adet: number}>}
 */
export function extractPersonnelData(tables) {
  const results = [];
  for (const table of tables) {
    // REST API formatı: cells array
    if (table.cells) {
      const cellsByRow = {};
      for (const cell of table.cells) {
        if (!cellsByRow[cell.rowIndex]) cellsByRow[cell.rowIndex] = [];
        cellsByRow[cell.rowIndex][cell.columnIndex] = cell.content || '';
      }
      // İlk satır header olabilir, atla
      const rows = Object.keys(cellsByRow)
        .map(Number)
        .sort((a, b) => a - b);
      for (let i = 1; i < rows.length; i++) {
        const row = cellsByRow[rows[i]] || [];
        if (row.length >= 2) {
          const position = row[0]?.trim();
          const countMatch = row[1]?.match(/(\d+)/);
          if (position && countMatch) {
            results.push({ pozisyon: position, adet: parseInt(countMatch[1], 10) });
          }
        }
      }
    } else {
      // SDK formatı: rows array
      for (const row of table.rows || []) {
        if (row.length >= 2) {
          const position = row[0];
          const count = parseInt(row[1]?.match(/(\d+)/)?.[1], 10);
          if (position && count) {
            results.push({ pozisyon: position, adet: count });
          }
        }
      }
    }
  }
  return results;
}

/**
 * Analiz sonucunun tamlık skorunu hesapla
 * @param {Object} analysis - Analiz sonucu
 * @returns {{score: number, missing: string[], total: number}}
 */
export function calculateCompleteness(analysis) {
  // Temel alanlar (eskisiyle uyumlu, toplam 70 puan)
  const coreChecks = [
    { field: 'summary.title', weight: 5, value: analysis.summary?.title ? 1 : 0 },
    { field: 'summary.institution', weight: 5, value: analysis.summary?.institution ? 1 : 0 },
    { field: 'summary.ikn', weight: 5, value: analysis.summary?.ikn ? 1 : 0 },
    { field: 'catering.total_persons', weight: 8, value: analysis.catering?.total_persons ? 1 : 0 },
    { field: 'catering.daily_meals', weight: 8, value: analysis.catering?.daily_meals ? 1 : 0 },
    { field: 'catering.sample_menus', weight: 10, value: (analysis.catering?.sample_menus?.length || 0) > 0 ? 1 : 0 },
    { field: 'catering.gramaj', weight: 10, value: (analysis.catering?.gramaj?.length || 0) > 0 ? 1 : 0 },
    { field: 'personnel.staff', weight: 9, value: (analysis.personnel?.staff?.length || 0) > 0 ? 1 : 0 },
    { field: 'dates.start_date', weight: 5, value: analysis.dates?.start_date ? 1 : 0 },
    { field: 'dates.end_date', weight: 5, value: analysis.dates?.end_date ? 1 : 0 },
  ];

  // Azure v5 catering-spesifik alanlar (bonus 30 puan)
  const cateringChecks = [
    { field: 'catering.breakfast_persons', weight: 3, value: analysis.catering?.breakfast_persons ? 1 : 0 },
    { field: 'catering.lunch_persons', weight: 3, value: analysis.catering?.lunch_persons ? 1 : 0 },
    { field: 'catering.dinner_persons', weight: 3, value: analysis.catering?.dinner_persons ? 1 : 0 },
    { field: 'catering.service_days', weight: 3, value: analysis.catering?.service_days ? 1 : 0 },
    { field: 'catering.kitchen_type', weight: 3, value: analysis.catering?.kitchen_type ? 1 : 0 },
    { field: 'catering.cooking_location', weight: 3, value: analysis.catering?.cooking_location ? 1 : 0 },
    { field: 'catering.delivery_hours', weight: 2, value: analysis.catering?.delivery_hours ? 1 : 0 },
    { field: 'catering.labor_rate', weight: 3, value: analysis.catering?.labor_rate ? 1 : 0 },
    { field: 'catering.distribution_points', weight: 2, value: analysis.catering?.distribution_points ? 1 : 0 },
    { field: 'catering.equipment_list', weight: 2, value: analysis.catering?.equipment_list ? 1 : 0 },
    { field: 'catering.material_list', weight: 3, value: analysis.catering?.material_list ? 1 : 0 },
  ];

  const allChecks = [...coreChecks, ...cateringChecks];

  let score = 0;
  const missing = [];

  for (const check of allChecks) {
    if (check.value > 0) score += check.weight;
    else missing.push(check.field);
  }

  return { score, missing, total: 100 };
}
