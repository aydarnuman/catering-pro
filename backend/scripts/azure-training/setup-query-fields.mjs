#!/usr/bin/env node

/**
 * Azure Document Intelligence Query Fields Setup
 * 
 * Query Fields = Eğitim gerektirmeden özel alan çıkarımı
 * prebuilt-layout modeline ek sorgular göndererek istediğiniz alanları çıkarır
 * 
 * Avantajları:
 * - Eğitim gerektirmez (hemen kullanılabilir)
 * - Ek maliyet yok
 * - Farklı formatlar için esnek
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Query Fields tanımları - İhale dökümanları için
const QUERY_FIELDS = {
  // Menü bilgileri
  menu: [
    'OrnekMenu',           // Örnek menü tablosu
    'HaftalikMenu',        // Haftalık menü
    'DiyetMenu',           // Diyet menü
    'KahvaltiMenu',        // Kahvaltı menüsü
    'OgleYemegiMenu',      // Öğle yemeği menüsü
    'AksamYemegiMenu',     // Akşam yemeği menüsü
  ],
  
  // Gramaj bilgileri
  gramaj: [
    'GramajListesi',       // Tüm gramaj tablosu
    'PorsiyonMiktarlari',  // Porsiyon miktarları
    'MalzemeGramlari',     // Her malzemenin gram değeri
  ],
  
  // Personel bilgileri
  personel: [
    'PersonelListesi',     // Personel gereksinimleri tablosu
    'AsciSayisi',          // Aşçı sayısı
    'DiyetisyenSayisi',    // Diyetisyen sayısı
    'ToplamPersonel',      // Toplam personel sayısı
  ],
  
  // Öğün bilgileri
  ogun: [
    'GunlukOgunSayisi',    // Günlük öğün sayısı
    'KahvaltiAdeti',       // Kahvaltı adeti
    'OgleYemegiAdeti',     // Öğle yemeği adeti
    'AksamYemegiAdeti',    // Akşam yemeği adeti
    'ToplamYemekAdeti',    // Toplam yemek adeti
  ],
  
  // Diğer bilgiler
  diger: [
    'CezaKosullari',       // Ceza koşulları
    'KaliteStandartlari',  // Kalite standartları
    'ServisSaatleri',      // Servis saatleri
    'HijyenKurallari',     // Hijyen kuralları
  ],
};

// API request oluşturucu
function buildQueryFieldsRequest(fields) {
  const allFields = [
    ...fields.menu,
    ...fields.gramaj,
    ...fields.personel,
    ...fields.ogun,
    ...fields.diger,
  ];
  
  return {
    features: ['queryFields'],
    queryFields: allFields,
  };
}

// Provider'a entegre etmek için config oluştur
function generateProviderConfig() {
  const config = {
    // Query fields enabled
    useQueryFields: true,
    
    // Field definitions
    queryFields: buildQueryFieldsRequest(QUERY_FIELDS),
    
    // Field mapping (Azure response -> our schema)
    fieldMapping: {
      'OrnekMenu': 'catering.sample_menus',
      'HaftalikMenu': 'catering.sample_menus',
      'DiyetMenu': 'catering.sample_menus',
      'GramajListesi': 'catering.gramaj',
      'PorsiyonMiktarlari': 'catering.gramaj',
      'PersonelListesi': 'personnel.staff',
      'ToplamPersonel': 'personnel.total_count',
      'GunlukOgunSayisi': 'catering.daily_meal_count',
      'KahvaltiAdeti': 'catering.meals',
      'OgleYemegiAdeti': 'catering.meals',
      'AksamYemegiAdeti': 'catering.meals',
      'CezaKosullari': 'penalties',
      'KaliteStandartlari': 'catering.quality_requirements',
    },
  };
  
  return config;
}

// Test function
async function testQueryFields() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        AZURE QUERY FIELDS CONFIGURATION                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  const config = generateProviderConfig();
  
  console.log('📋 Tanımlanan Query Fields:\n');
  
  console.log('  🍽️  MENÜ ALANLARI:');
  QUERY_FIELDS.menu.forEach(f => console.log(`      - ${f}`));
  
  console.log('\n  ⚖️  GRAMAJ ALANLARI:');
  QUERY_FIELDS.gramaj.forEach(f => console.log(`      - ${f}`));
  
  console.log('\n  👥 PERSONEL ALANLARI:');
  QUERY_FIELDS.personel.forEach(f => console.log(`      - ${f}`));
  
  console.log('\n  🍴 ÖĞÜN ALANLARI:');
  QUERY_FIELDS.ogun.forEach(f => console.log(`      - ${f}`));
  
  console.log('\n  📋 DİĞER ALANLAR:');
  QUERY_FIELDS.diger.forEach(f => console.log(`      - ${f}`));
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📦 API Request Parameters:\n');
  console.log(JSON.stringify(config.queryFields, null, 2));
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('💡 Kullanım:\n');
  console.log('  Bu Query Fields\'ları azure-document-ai.js provider\'ına entegre edin:');
  console.log('  analyzeWithLayout(buffer, { queryFields: [...] })\n');
  
  return config;
}

// Export
export { QUERY_FIELDS, buildQueryFieldsRequest, generateProviderConfig };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testQueryFields();
}
