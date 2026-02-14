import type { AnalysisData } from '../types';

/**
 * Get all field paths from analysisSummary
 */
export function getAllAnalysisCardPaths(analysisSummary?: AnalysisData): string[] {
  if (!analysisSummary) return [];

  const paths: string[] = [];
  const categories = ['operasyonel', 'mali', 'teknik', 'belgeler'] as const;

  // Predefined fields per category
  const fieldsByCategory = {
    operasyonel: ['takvim', 'servis_saatleri', 'personel_detaylari', 'ogun_bilgileri', 'is_yerleri', 'gramaj_gruplari'],
    mali: [
      'birim_fiyatlar',
      'teminat_oranlari',
      'mali_kriterler',
      'fiyat_farki',
      'ceza_kosullari',
      'odeme_kosullari',
      'is_artisi',
    ],
    teknik: ['teknik_sartlar', 'benzer_is_tanimi', 'onemli_notlar', 'operasyonel_kurallar'],
    belgeler: ['gerekli_belgeler', 'iletisim', 'eksik_bilgiler'],
  };

  for (const category of categories) {
    const fields = fieldsByCategory[category];
    for (const field of fields) {
      if (analysisSummary[field as keyof AnalysisData]) {
        paths.push(field);
      }
    }
  }

  return paths;
}

/**
 * Get field paths for a specific category
 */
export function getAnalysisCardsForCategory(analysisSummary: AnalysisData | undefined, category: string): string[] {
  if (!analysisSummary) return [];

  const fieldsByCategory: Record<string, string[]> = {
    operasyonel: ['takvim', 'servis_saatleri', 'personel_detaylari', 'ogun_bilgileri', 'is_yerleri', 'gramaj_gruplari'],
    mali: [
      'birim_fiyatlar',
      'teminat_oranlari',
      'mali_kriterler',
      'fiyat_farki',
      'ceza_kosullari',
      'odeme_kosullari',
      'is_artisi',
    ],
    teknik: ['teknik_sartlar', 'benzer_is_tanimi', 'onemli_notlar', 'operasyonel_kurallar'],
    belgeler: ['gerekli_belgeler', 'iletisim', 'eksik_bilgiler'],
  };

  const fields = fieldsByCategory[category] || [];
  return fields.filter((field) => analysisSummary[field as keyof AnalysisData]);
}

/**
 * Filter analysisSummary to only include selected fields
 */
export function filterAnalysisBySelection(
  analysisSummary: AnalysisData | undefined,
  selected: Set<string>
): Record<string, unknown> {
  if (!analysisSummary) return {};

  const filtered: Record<string, unknown> = {};

  for (const fieldPath of selected) {
    if (analysisSummary[fieldPath as keyof AnalysisData]) {
      filtered[fieldPath] = analysisSummary[fieldPath as keyof AnalysisData];
    }
  }

  return filtered;
}
