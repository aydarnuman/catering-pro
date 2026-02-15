#!/usr/bin/env node
/**
 * Şartname gramaj kurallarını DB'ye ekler (asistan üretimi şablon).
 * Kullanım:
 *   node scripts/seed-sartname-gramaj.mjs <sartname_id> [profil]
 *   node scripts/seed-sartname-gramaj.mjs --tum --profil kyk_yurt
 * Profil: kurumsal | kyk_yurt | hastane | okul | premium | agir_is | diyet (varsayılan: kurumsal)
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { getProfilKurallari, SUPPORTED_PROFILES } from '../src/data/sartname-gramaj-sablonlari.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

async function main() {
  const args = process.argv.slice(2);
  const tum = args.includes('--tum');
  let profil = 'kurumsal';
  if (tum) {
    const profilArg = args.find((a) => a === '--profil');
    const profilIndex = profilArg ? args.indexOf(profilArg) + 1 : -1;
    profil = profilIndex > 0 && args[profilIndex] ? args[profilIndex] : profil;
  } else if (args[1] && SUPPORTED_PROFILES.includes(args[1])) {
    profil = args[1];
  }
  if (!SUPPORTED_PROFILES.includes(profil)) {
    console.error('Geçersiz profil. Kullanılabilir:', SUPPORTED_PROFILES.join(', '));
    process.exit(1);
  }

  let sartnameIds = [];
  if (tum) {
    const r = await query('SELECT id FROM proje_sartnameleri ORDER BY id');
    sartnameIds = r.rows.map((row) => row.id);
    if (sartnameIds.length === 0) {
      console.log('Hiç şartname yok.');
      pool.end();
      return;
    }
    console.log(`${sartnameIds.length} şartname bulundu, profil: ${profil}`);
  } else {
    const id = Number(args[0]);
    if (!Number.isInteger(id) || id < 1) {
      console.error('Kullanım: node scripts/seed-sartname-gramaj.mjs <sartname_id> [profil]');
      console.error('   veya: node scripts/seed-sartname-gramaj.mjs --tum --profil kyk_yurt');
      process.exit(1);
    }
    const r = await query('SELECT id FROM proje_sartnameleri WHERE id = $1', [id]);
    if (r.rows.length === 0) {
      console.error('Şartname bulunamadı:', id);
      process.exit(1);
    }
    sartnameIds = [id];
    console.log(`Şartname ${id}, profil: ${profil}`);
  }

  const altTiplerResult = await query('SELECT id, kod FROM alt_tip_tanimlari WHERE aktif = true');
  const kodToId = Object.fromEntries(altTiplerResult.rows.map((r) => [r.kod, r.id]));
  const kurallar = getProfilKurallari(profil);

  let toplamEklenen = 0;
  for (const sartnameId of sartnameIds) {
    const mevcut = await query(
      'SELECT alt_tip_id, malzeme_tipi FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND aktif = true',
      [sartnameId]
    );
    const mevcutSet = new Set(mevcut.rows.map((k) => `${k.alt_tip_id}:${k.malzeme_tipi}`));
    let eklenen = 0;

    for (const { alt_tip_kod, kurallar: klist } of kurallar) {
      const altTipId = kodToId[alt_tip_kod];
      if (!altTipId) continue;
      for (const k of klist) {
        const key = `${altTipId}:${k.malzeme_tipi}`;
        if (mevcutSet.has(key)) continue;
        try {
          await query(
            `INSERT INTO sartname_gramaj_kurallari (sartname_id, alt_tip_id, malzeme_tipi, gramaj, birim, sira)
             VALUES ($1, $2, $3, $4, $5,
               (SELECT COALESCE(MAX(sira), 0) + 1 FROM sartname_gramaj_kurallari WHERE sartname_id = $1 AND alt_tip_id = $2))
             ON CONFLICT (sartname_id, alt_tip_id, malzeme_tipi) DO NOTHING`,
            [sartnameId, altTipId, k.malzeme_tipi, k.gramaj, k.birim || 'g']
          );
          eklenen++;
          mevcutSet.add(key);
        } catch (err) {
          console.warn('Insert atlandı:', sartnameId, alt_tip_kod, k.malzeme_tipi, err.message);
        }
      }
    }
    toplamEklenen += eklenen;
    if (sartnameIds.length > 1 && eklenen > 0) console.log(`  Şartname ${sartnameId}: ${eklenen} kural eklendi.`);
  }

  console.log('Toplam eklenen kural:', toplamEklenen);
  pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
