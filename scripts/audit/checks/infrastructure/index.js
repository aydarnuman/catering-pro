/**
 * Infrastructure Check Module Aggregator
 * Altyapı kontrollerinin birleştiricisi
 */

import { checkBuildHealth } from './build-health.js';
import { checkDatabaseHealth } from './database-health.js';
import { checkLogAnalysis } from './log-analysis.js';
import { checkPerformance } from './performance.js';

export const infrastructureChecks = {
  name: 'infrastructure',
  displayName: 'Altyapı',
  description: 'Build, database, logging ve performans kontrolleri',
  checks: [
    {
      id: 'build-health',
      name: 'Build & Deploy Sağlığı',
      description: 'Build yapılandırması ve deployment hazırlığı',
      run: checkBuildHealth,
      fixable: false,
    },
    {
      id: 'database-health',
      name: 'Database Sağlığı',
      description: 'Migration tutarlılığı, index\'ler, N+1 query tespiti',
      run: checkDatabaseHealth,
      fixable: false,
    },
    {
      id: 'log-analysis',
      name: 'Log & Hata Analizi',
      description: 'Error tracking ve log pattern analizi',
      run: checkLogAnalysis,
      fixable: false,
    },
    {
      id: 'performance',
      name: 'Performans Denetimi',
      description: 'Bundle boyutu ve memory leak potansiyeli',
      run: checkPerformance,
      fixable: false,
    },
  ],
};
