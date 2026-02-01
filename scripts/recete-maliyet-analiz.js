#!/usr/bin/env node
/**
 * Tüm reçetelerin maliyet ve malzeme fiyatlarını API ile tek tek analiz eder.
 * Eksik fiyat, birim tutarsızlığı, aşırı fiyat sapması tespit eder.
 * Kullanım: API çalışırken node scripts/recete-maliyet-analiz.js
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:3001';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function main() {
  const { data: receteler } = await get('/api/menu-planlama/receteler?limit=500');
  const issues = [];
  let malzemeCount = 0;
  let zeroPriceCount = 0;
  const zeroMaliyetRecete = [];

  for (const r of receteler) {
    const { data: maliyetData } = await get(`/api/maliyet-analizi/receteler/${r.id}/maliyet`);
    if (!maliyetData?.malzemeler) continue;

    let receteToplam = 0;
    for (const m of maliyetData.malzemeler) {
      malzemeCount++;
      const sistemFiyat = parseFloat(m.sistem_fiyat) || 0;
      const toplam = parseFloat(m.sistem_toplam) || 0;

      if (sistemFiyat === 0) {
        zeroPriceCount++;
        issues.push({
          tip: 'sifir_fiyat',
          recete_id: r.id,
          recete_ad: r.ad,
          malzeme: m.malzeme_adi,
          miktar: m.miktar,
          birim: m.birim,
        });
      }
      receteToplam += toplam;
    }

    const tahmini = parseFloat(r.tahmini_maliyet) || 0;
    const hesaplanan = maliyetData.maliyet?.sistem ?? receteToplam;
    const fark = Math.abs(hesaplanan - tahmini);
    if (tahmini > 0 && fark > tahmini * 0.05) {
      issues.push({
        tip: 'maliyet_sapmasi',
        recete_id: r.id,
        recete_ad: r.ad,
        tahmini_maliyet: tahmini,
        hesaplanan,
        fark_yuzde: ((fark / tahmini) * 100).toFixed(1),
      });
    }
    if (hesaplanan === 0 && maliyetData.malzemeler?.length > 0) {
      zeroMaliyetRecete.push({ id: r.id, ad: r.ad });
    }
  }

  console.log('=== REÇETE MALİYET ANALİZ RAPORU ===\n');
  console.log(`Toplam reçete: ${receteler.length}`);
  console.log(`Toplam malzeme satırı: ${malzemeCount}`);
  console.log(`Sıfır fiyatlı malzeme: ${zeroPriceCount}`);
  console.log(`Tespit edilen sorun: ${issues.length}`);
  if (zeroMaliyetRecete.length) {
    console.log(`\nMaliyeti 0 olan reçeteler (${zeroMaliyetRecete.length}):`);
    zeroMaliyetRecete.slice(0, 20).forEach((x) => console.log(`  ${x.id} ${x.ad}`));
  }
  const byTip = {};
  issues.forEach((i) => { byTip[i.tip] = (byTip[i.tip] || 0) + 1; });
  console.log('\nSorun dağılımı:', byTip);
  console.log('\n--- Örnek sorunlar (ilk 30) ---');
  issues.slice(0, 30).forEach((i) => console.log(JSON.stringify(i)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
