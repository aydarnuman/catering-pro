#!/usr/bin/env node
/**
 * Beşamel Soslu Tavuk reçetesini 2 farklı şartnamede test eder.
 * Gramajların şartnameye göre değiştiğini doğrular.
 *
 * Kullanım: cd backend && node scripts/test-recete-sartname-gramaj.mjs
 *
 * Gerekli: .env içinde DATABASE_URL (veya backend ortam değişkenleri)
 */

import { receteSartnameMalzemeOnizleme } from '../src/services/sartname-onizleme.js';

const RECETE_ID = 135; // Beşamel Soslu Tavuk
const SARTNAME_KYK = 4;  // KYK Yurt Şartnamesi
const SARTNAME_CHEF = 6; // Chef Şartnamesi

async function main() {
  console.log('--- Beşamel Soslu Tavuk - Şartname Gramaj Testi ---\n');
  console.log(`Reçete ID: ${RECETE_ID}`);
  console.log(`Şartname 1: ${SARTNAME_KYK} (KYK Yurt)`);
  console.log(`Şartname 2: ${SARTNAME_CHEF} (Chef)\n`);

  const [onizlemeKyk, onizlemeChef] = await Promise.all([
    receteSartnameMalzemeOnizleme(RECETE_ID, SARTNAME_KYK),
    receteSartnameMalzemeOnizleme(RECETE_ID, SARTNAME_CHEF),
  ]);

  console.log('Alt tip:', onizlemeKyk.alt_tip_adi ?? '(atanmamış)');
  console.log('');

  // Karşılaştırma: Şartname kolonunda değişen malzemeler
  const kykMap = new Map(onizlemeKyk.malzemeler.map((m) => [m.malzeme_adi, m]));
  const chefMap = new Map(onizlemeChef.malzemeler.map((m) => [m.malzeme_adi, m]));

  const baslik = 'Malzeme'.padEnd(22) + 'Reçete'.padStart(12) + 'KYK (4)'.padStart(14) + 'Chef (6)'.padStart(14);
  console.log(baslik);
  console.log('-'.repeat(62));

  for (const m of onizlemeKyk.malzemeler) {
    const receteVal = `${m.mevcut_miktar} ${m.mevcut_birim}`;
    const kykVal = m.sartname_gramaj != null ? `${m.sartname_gramaj} ${m.sartname_birim ?? 'g'}` : '—';
    const chef = chefMap.get(m.malzeme_adi);
    const chefVal = chef?.sartname_gramaj != null ? `${chef.sartname_gramaj} ${chef.sartname_birim ?? 'g'}` : '—';
    const fark = kykVal !== chefVal ? '  ← FARK' : '';
    console.log(`${m.malzeme_adi.padEnd(22)}${receteVal.padStart(12)}${kykVal.padStart(14)}${chefVal.padStart(14)}${fark}`);
  }

  console.log('-'.repeat(62));
  console.log('Toplam maliyet (KYK):  ₺' + (onizlemeKyk.toplam_maliyet ?? 0).toFixed(2));
  console.log('Toplam maliyet (Chef): ₺' + (onizlemeChef.toplam_maliyet ?? 0).toFixed(2));
  console.log('');
  console.log('Özet: Şartname değiştirildiğinde gramaj (ve maliyet) değişiyor.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
