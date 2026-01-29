/**
 * Excel'den Menü Planına Direkt Aktarım
 */
import XLSX from 'xlsx';
import { query } from '../database.js';

const PROJE_ID = 1;

// Excel tarih numarasını JS tarihine çevir
function excelDateToJS(excelDate) {
  if (typeof excelDate === 'number') {
    return new Date((excelDate - 25569) * 86400 * 1000);
  }
  if (typeof excelDate === 'string' && excelDate.match(/^\d+\/\d+\/\d+$/)) {
    const [gun, ay, yil] = excelDate.split('/');
    return new Date(`20${yil}-${ay.padStart(2, '0')}-${gun.padStart(2, '0')}`);
  }
  return null;
}

// Reçete bul veya oluştur
async function findOrCreateRecete(yemekAdi) {
  // Önce ara
  const existing = await query(`SELECT id FROM receteler WHERE ad ILIKE $1 AND proje_id = $2 LIMIT 1`, [
    `%${yemekAdi.split('/')[0].split('+')[0].trim()}%`,
    PROJE_ID,
  ]);

  if (existing.rows.length > 0) return existing.rows[0].id;

  // Yoksa oluştur
  const kod = 'AUTO-' + Date.now().toString().slice(-8);
  const result = await query(
    `INSERT INTO receteler (kod, ad, kategori_id, proje_id, porsiyon_miktar)
     VALUES ($1, $2, 2, $3, 1) RETURNING id`,
    [kod, yemekAdi, PROJE_ID]
  );
  return result.rows[0].id;
}

// Menü planını bul veya oluştur
async function getOrCreateMenuPlan() {
  const existing = await query(`SELECT id FROM menu_planlari WHERE proje_id = $1 AND baslangic_tarihi = '2026-01-01'`, [
    PROJE_ID,
  ]);

  if (existing.rows.length > 0) return existing.rows[0].id;

  const result = await query(
    `INSERT INTO menu_planlari (proje_id, ad, tip, baslangic_tarihi, bitis_tarihi, varsayilan_kisi_sayisi)
     VALUES ($1, 'Ocak 2026 Menüsü', 'aylik', '2026-01-01', '2026-01-31', 1000) RETURNING id`,
    [PROJE_ID]
  );
  return result.rows[0].id;
}

// Öğün ekle
async function addOgun(planId, tarih, ogunTipiKod) {
  const ogunTipResult = await query(`SELECT id FROM ogun_tipleri WHERE kod = $1`, [ogunTipiKod]);
  const ogunTipiId = ogunTipResult.rows[0]?.id || 1;

  // Var mı kontrol et
  const existing = await query(
    `SELECT id FROM menu_plan_ogunleri WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3`,
    [planId, tarih, ogunTipiId]
  );

  if (existing.rows.length > 0) return existing.rows[0].id;

  const result = await query(
    `INSERT INTO menu_plan_ogunleri (menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi)
     VALUES ($1, $2, $3, 1000) RETURNING id`,
    [planId, tarih, ogunTipiId]
  );
  return result.rows[0].id;
}

// Yemek ekle
async function addYemek(ogunId, receteId, sira) {
  // Var mı kontrol et
  const existing = await query(`SELECT id FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1 AND recete_id = $2`, [
    ogunId,
    receteId,
  ]);
  if (existing.rows.length > 0) return;

  await query(`INSERT INTO menu_ogun_yemekleri (menu_ogun_id, recete_id, sira) VALUES ($1, $2, $3)`, [
    ogunId,
    receteId,
    sira,
  ]);
}

async function importAksamMenu() {
  const wb = XLSX.readFile('/Users/numanaydar/Desktop/OCAK AYI AKSAM YEMEGI MENÜ LİSTESİ.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const planId = await getOrCreateMenuPlan();
  let _eklenenGun = 0;
  let _eklenenYemek = 0;

  // Her satırı tara
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    // Excel tarih numaralarını bul (46023, 46027, vb.)
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (typeof cell === 'number' && cell > 45000 && cell < 50000) {
        const tarih = excelDateToJS(cell);
        if (!tarih) continue;

        const tarihStr = tarih.toISOString().split('T')[0];

        // Bu tarihin yemeklerini topla (altındaki satırlardan)
        const yemekler = [];
        for (let k = i + 1; k < Math.min(i + 8, data.length); k++) {
          const yemekRow = data[k];
          if (yemekRow?.[j]) {
            const yemekAdi = String(yemekRow[j]).trim();
            if (
              yemekAdi.length > 3 &&
              !yemekAdi.includes('YEMEK ÇEŞİTLERİ') &&
              !yemekAdi.includes('Çeyrek Ekmek') &&
              !yemekAdi.includes('500 ml') &&
              !yemekAdi.match(/^\d+\./)
            ) {
              yemekler.push(yemekAdi);
            }
          }
        }

        if (yemekler.length > 0) {
          const ogunId = await addOgun(planId, tarihStr, 'aksam');

          for (let sira = 0; sira < yemekler.length; sira++) {
            const receteId = await findOrCreateRecete(yemekler[sira]);
            await addYemek(ogunId, receteId, sira + 1);
            _eklenenYemek++;
          }
          _eklenenGun++;
          process.stdout.write(`📅 ${tarihStr} (${yemekler.length} yemek) `);
        }
      }
    }
  }
}

async function importKahvaltiMenu() {
  const wb = XLSX.readFile('/Users/numanaydar/Desktop/OCAK AYI KAHVALTI MENÜSÜ.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const planId = await getOrCreateMenuPlan();
  let _eklenenGun = 0;
  let _eklenenYemek = 0;

  // Her satırı tara - tarih formatı: 1/1/26, 1/2/26 vb.
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (typeof cell === 'string' && cell.match(/^\d+\/\d+\/26$/)) {
        const tarih = excelDateToJS(cell);
        if (!tarih) continue;

        const tarihStr = tarih.toISOString().split('T')[0];

        // Bu tarihin yemeklerini topla
        const yemekler = [];
        for (let k = i + 1; k < Math.min(i + 12, data.length); k++) {
          const yemekRow = data[k];
          if (yemekRow?.[j]) {
            const yemekAdi = String(yemekRow[j]).trim();
            if (
              yemekAdi.length > 3 &&
              !yemekAdi.match(/^\d+\/\d+\/\d+$/) &&
              !yemekAdi.includes('Çeyrek Ekmek') &&
              !yemekAdi.includes('500 ml') &&
              !yemekAdi.startsWith('**') &&
              !yemekAdi.startsWith('*')
            ) {
              yemekler.push(yemekAdi);
            }
          }
        }

        if (yemekler.length > 0) {
          const ogunId = await addOgun(planId, tarihStr, 'kahvalti');

          for (let sira = 0; sira < yemekler.length; sira++) {
            const receteId = await findOrCreateRecete(yemekler[sira]);
            await addYemek(ogunId, receteId, sira + 1);
            _eklenenYemek++;
          }
          _eklenenGun++;
          process.stdout.write(`📅 ${tarihStr} `);
        }
      }
    }
  }
}

async function main() {
  await importAksamMenu();
  await importKahvaltiMenu();

  // Özet
  const _summary = await query(
    `
    SELECT 
      COUNT(DISTINCT mpo.tarih) as gun_sayisi,
      COUNT(moy.id) as yemek_sayisi
    FROM menu_planlari mp
    JOIN menu_plan_ogunleri mpo ON mpo.menu_plan_id = mp.id
    LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
    WHERE mp.proje_id = $1 AND mp.baslangic_tarihi = '2026-01-01'
  `,
    [PROJE_ID]
  );

  process.exit(0);
}

main().catch((_e) => {
  process.exit(1);
});
