/**
 * Merkezi Config Export
 * Tüm yapılandırmaları tek noktadan export eder
 */

export { aiConfig, default as aiConfigDefault } from './ai.config.js';
export { default as scraperConfigDefault, scraperConfig } from './scraper.config.js';
export { default as storageConfigDefault, storageConfig } from './storage.config.js';

// Convenience: tüm config'leri tek objede topla
export const config = {
  get scraper() {
    return require('./scraper.config.js').scraperConfig;
  },
  get ai() {
    return require('./ai.config.js').aiConfig;
  },
  get storage() {
    return require('./storage.config.js').storageConfig;
  },
};

export default config;
