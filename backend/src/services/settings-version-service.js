/**
 * Settings Version Service
 * AI ayarları versiyonlama yönetimi
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';

const SettingsVersionService = {
  /**
   * Ayar değişikliğini versiyon geçmişine kaydet
   * @param {string} settingKey - Ayar anahtarı
   * @param {any} settingValue - Ayar değeri
   * @param {number} changedBy - Değiştiren kullanıcı ID
   * @param {string} changeNote - Değişiklik notu (opsiyonel)
   * @returns {Promise<number>} - Versiyon numarası
   */
  async saveVersion(settingKey, settingValue, changedBy, changeNote = null) {
    try {
      const result = await query('SELECT save_setting_version($1, $2, $3, $4) as version', [
        settingKey,
        JSON.stringify(settingValue),
        changedBy,
        changeNote,
      ]);
      return result.rows[0]?.version || 0;
    } catch (error) {
      logger.error('Save setting version error', { error: error.message, settingKey });
      throw error;
    }
  },

  /**
   * Birden fazla ayar değişikliğini versiyon geçmişine kaydet
   * @param {Object} settings - {settingKey: value} objesi
   * @param {number} changedBy - Değiştiren kullanıcı ID
   * @param {string} changeNote - Değişiklik notu (opsiyonel)
   * @returns {Promise<Object>} - {settingKey: version} objesi
   */
  async saveVersions(settings, changedBy, changeNote = null) {
    const versions = {};

    for (const [key, value] of Object.entries(settings)) {
      try {
        const version = await SettingsVersionService.saveVersion(key, value, changedBy, changeNote);
        versions[key] = version;
      } catch (error) {
        logger.error(`Save version error for ${key}`, { error: error.message });
      }
    }

    return versions;
  },

  /**
   * Belirli bir ayarın versiyon geçmişini getir
   * @param {string} settingKey - Ayar anahtarı
   * @param {number} limit - Maksimum kayıt sayısı
   * @returns {Promise<Array>} - Versiyon geçmişi
   */
  async getHistory(settingKey, limit = 50) {
    try {
      const result = await query('SELECT * FROM get_setting_history($1, $2)', [settingKey, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Get setting history error', { error: error.message, settingKey });
      return [];
    }
  },

  /**
   * Tüm ayarların versiyon geçmişini getir
   * @param {number} limit - Maksimum kayıt sayısı
   * @returns {Promise<Array>} - Tüm versiyon geçmişi
   */
  async getAllHistory(limit = 100) {
    try {
      const result = await query('SELECT * FROM get_all_settings_history($1)', [limit]);
      return result.rows;
    } catch (error) {
      logger.error('Get all settings history error', { error: error.message });
      return [];
    }
  },

  /**
   * Belirli bir versiyonu getir
   * @param {string} settingKey - Ayar anahtarı
   * @param {number} version - Versiyon numarası
   * @returns {Promise<Object|null>} - Versiyon bilgisi
   */
  async getVersion(settingKey, version) {
    try {
      const result = await query('SELECT * FROM get_setting_version($1, $2)', [settingKey, version]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get setting version error', { error: error.message, settingKey, version });
      return null;
    }
  },

  /**
   * Versiyona geri dön (ayarı eski değerine geri yükle)
   * @param {string} settingKey - Ayar anahtarı
   * @param {number} version - Versiyon numarası
   * @param {number} restoredBy - Geri yükleyen kullanıcı ID
   * @returns {Promise<boolean>} - Başarılı mı?
   */
  async restoreVersion(settingKey, version, restoredBy) {
    try {
      // Versiyonu getir
      const versionData = await SettingsVersionService.getVersion(settingKey, version);

      if (!versionData) {
        throw new Error('Versiyon bulunamadı');
      }

      // Ayarı güncelle
      await query(
        `UPDATE ai_settings 
         SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = $2`,
        [versionData.setting_value, settingKey]
      );

      // Geri yükleme işlemini versiyon geçmişine kaydet
      await SettingsVersionService.saveVersion(
        settingKey,
        versionData.setting_value,
        restoredBy,
        `Versiyon ${version} geri yüklendi`
      );

      logger.info('Setting version restored', { settingKey, version, restoredBy });
      return true;
    } catch (error) {
      logger.error('Restore setting version error', { error: error.message, settingKey, version });
      throw error;
    }
  },

  /**
   * Eski versiyonları temizle
   * @returns {Promise<void>}
   */
  async cleanupOldVersions() {
    try {
      await query('SELECT cleanup_old_settings_history()');
      logger.info('Old settings history cleaned up');
    } catch (error) {
      logger.error('Cleanup old versions error', { error: error.message });
      throw error;
    }
  },
};

export default SettingsVersionService;
