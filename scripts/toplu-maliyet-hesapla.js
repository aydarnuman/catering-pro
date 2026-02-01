#!/usr/bin/env node
/**
 * Tüm reçetelerin maliyetini yeniden hesaplatır (aktif_fiyat + birim dönüşümü).
 * Migration 119 veya fiyat güncellemelerinden sonra çalıştırın.
 * Kullanım: API çalışırken node scripts/toplu-maliyet-hesapla.js
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:3001';

async function post(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function main() {
  const { data: receteler } = await get('/api/menu-planlama/receteler?limit=500');
  let ok = 0;
  let err = 0;
  for (const r of receteler) {
    try {
      await post(`/api/menu-planlama/receteler/${r.id}/maliyet-hesapla`);
      ok++;
      if (ok % 50 === 0) console.log(`Hesaplandı: ${ok}/${receteler.length}`);
    } catch (e) {
      err++;
      console.error(`Hata ${r.id} ${r.ad}:`, e.message);
    }
  }
  console.log(`\nTamamlandı: ${ok} başarılı, ${err} hata`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
