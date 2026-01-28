/**
 * Code Quality Check Module Aggregator
 * Kod kalitesi kontrollerinin birleştiricisi
 */

import { lintAndFormat } from './lint-format.js';
import { checkDeadCode } from './dead-code.js';
import { checkTypeScriptStrict } from './typescript-strict.js';
import { checkComplexity } from './complexity.js';
import { checkAPIConsistency } from './api-consistency.js';
import { checkDocumentation } from './documentation.js';

export const codeQualityChecks = {
  name: 'code-quality',
  displayName: 'Kod Kalitesi',
  description: 'Lint, formatting, dead code, complexity ve dokümantasyon kontrolleri',
  checks: [
    {
      id: 'lint-format',
      name: 'Lint & Formatting',
      description: 'Biome lint ve formatting ihlalleri',
      run: lintAndFormat,
      fixable: true,
    },
    {
      id: 'dead-code',
      name: 'Dead Code Tespiti',
      description: 'Kullanılmayan import, değişken ve bağımlılıklar',
      run: checkDeadCode,
      fixable: true,
    },
    {
      id: 'typescript-strict',
      name: 'TypeScript Strict Mode',
      description: 'TypeScript strict mode uyumluluğu',
      run: checkTypeScriptStrict,
      fixable: false,
    },
    {
      id: 'complexity',
      name: 'Kod Karmaşıklığı',
      description: 'Cyclomatic complexity analizi',
      run: checkComplexity,
      fixable: false,
    },
    {
      id: 'api-consistency',
      name: 'API Tutarlılığı',
      description: 'Endpoint adlandırma ve response format tutarlılığı',
      run: checkAPIConsistency,
      fixable: false,
    },
    {
      id: 'documentation',
      name: 'Dokümantasyon Kapsamı',
      description: 'JSDoc coverage ve README güncelliği',
      run: checkDocumentation,
      fixable: false,
    },
  ],
};
