/**
 * Merkezi Config Export
 * Tüm yapılandırmaları tek noktadan export eder
 */

import { aiConfig } from './ai.config.js';
import { scraperConfig } from './scraper.config.js';
import { storageConfig } from './storage.config.js';

export { aiConfig, default as aiConfigDefault } from './ai.config.js';
export { default as scraperConfigDefault, scraperConfig } from './scraper.config.js';
export { default as storageConfigDefault, storageConfig } from './storage.config.js';

// Convenience: tüm config'leri tek objede topla
export const config = {
  get scraper() {
    return scraperConfig;
  },
  get ai() {
    return aiConfig;
  },
  get storage() {
    return storageConfig;
  },
};

export default config;
