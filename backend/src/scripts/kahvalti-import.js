import XLSX from 'xlsx';
import { query } from '../database.js';

const PROJE_ID = 1;

async function findOrCreateRecete(yemekAdi) {
  // Önce tam eşleşme dene
  let existing = await query(
    `SELECT id FROM receteler WHERE LOWER(TRIM(ad)) = LOWER(TRIM($1)) AND proje_id = $2 LIMIT 1`,
    [yemekAdi, PROJE_ID]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  // Kısmi eşleşme dene
  const temizAd = yemekAdi.split('/')[0].split('+')[0].trim();
  existing = await query(`SELECT id FROM receteler WHERE ad ILIKE $1 AND proje_id = $2 LIMIT 1`, [
    `%${temizAd}%`,
    PROJE_ID,
  ]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  // Yeni oluştur - kategori 7 = Kahvaltılık
  const kod = 'KAH-' + Date.now().toString().slice(-8);
  const result = await query(
    `INSERT INTO receteler (kod, ad, kategori_id, proje_id, porsiyon_miktar) VALUES ($1, $2, 7, $3, 1) RETURNING id`,
    [kod, yemekAdi, PROJE_ID]
  );
  return result.rows[0].id;
}

async function getOrCreateOgun(planId, tarih) {
  const ogunTipResult = await query(`SELECT id FROM ogun_tipleri WHERE kod = 'kahvalti'`);
  const ogunTipiId = ogunTipResult.rows[0]?.id || 1;

  const existing = await query(
    `SELECT id FROM menu_plan_ogunleri WHERE menu_plan_id = $1 AND tarih = $2 AND ogun_tipi_id = $3`,
    [planId, tarih, ogunTipiId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const result = await query(
    `INSERT INTO menu_plan_ogunleri (menu_plan_id, tarih, ogun_tipi_id, kisi_sayisi) VALUES ($1, $2, $3, 1000) RETURNING id`,
    [planId, tarih, ogunTipiId]
  );
  return result.rows[0].id;
}

async function addYemek(ogunId, receteId, sira) {
  const existing = await query(`SELECT id FROM menu_ogun_yemekleri WHERE menu_ogun_id = $1 AND recete_id = $2`, [
    ogunId,
    receteId,
  ]);
  if (existing.rows.length > 0) return false;

  await query(`INSERT INTO menu_ogun_yemekleri (menu_ogun_id, recete_id, sira) VALUES ($1, $2, $3)`, [
    ogunId,
    receteId,
    sira,
  ]);
  return true;
}

async function main() {
  const wb = XLSX.readFile('/Users/numanaydar/Desktop/OCAK AYI KAHVALTI MENÜSÜ.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

  // Plan ID al
  const planResult = await query(`SELECT id FROM menu_planlari WHERE proje_id = $1 ORDER BY id LIMIT 1`, [PROJE_ID]);
  if (planResult.rows.length === 0) {
    process.exit(1);
  }
  const planId = planResult.rows[0].id;

  let _eklenenGun = 0;
  let _eklenenYemek = 0;

  // Tarihleri ve pozisyonlarını bul
  const tarihler = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      // Format: D/M/YY (örn: 1/1/26, 1/15/26)
      if (cell && typeof cell === 'string' && cell.match(/^\d{1,2}\/\d{1,2}\/26$/)) {
        const parts = cell.split('/');
        // AY/GÜN/YIL formatı (US style) - 1/1/26 = Ocak 1
        const ay = parseInt(parts[0], 10);
        const gun = parseInt(parts[1], 10);

        if (ay === 1 && gun >= 1 && gun <= 31) {
          tarihler.push({ row: i, col: j, gun });
        }
      }
    }
  }

  // Her tarih için yemekleri topla
  for (const t of tarihler) {
    const tarihStr = `2026-01-${String(t.gun).padStart(2, '0')}`;

    // Yemekleri topla (tarih hücresinin altındaki satırlar)
    const yemekler = [];
    for (let k = t.row + 1; k < Math.min(t.row + 12, data.length); k++) {
      const yemekRow = data[k];
      if (!yemekRow || !yemekRow[t.col]) continue;

      const yemekAdi = String(yemekRow[t.col]).trim();

      // Başka bir tarih mi?
      if (yemekAdi.match(/^\d{1,2}\/\d{1,2}\/26$/)) break;

      // Geçersiz satırları atla
      if (
        yemekAdi.length < 3 ||
        yemekAdi.includes('Çeyrek') ||
        yemekAdi.includes('500 ml') ||
        yemekAdi.startsWith('**') ||
        yemekAdi.startsWith('*') ||
        yemekAdi.includes('Gramaj') ||
        yemekAdi.includes('Enerji') ||
        yemekAdi.includes('kcal') ||
        yemekAdi.includes('kkal') ||
        yemekAdi.match(/^\d+$/) ||
        yemekAdi.toLowerCase().includes('toplam')
      ) {
        continue;
      }

      yemekler.push(yemekAdi);
    }

    if (yemekler.length > 0) {
      const ogunId = await getOrCreateOgun(planId, tarihStr);

      let gunEklenen = 0;
      for (let sira = 0; sira < yemekler.length; sira++) {
        const receteId = await findOrCreateRecete(yemekler[sira]);
        const eklendi = await addYemek(ogunId, receteId, sira + 1);
        if (eklendi) {
          _eklenenYemek++;
          gunEklenen++;
        }
      }

      if (gunEklenen > 0) _eklenenGun++;
    }
  }

  // Toplam kontrol
  const _total = await query(
    `
    SELECT 
      COUNT(DISTINCT mpo.tarih) as gun,
      COUNT(moy.id) as yemek
    FROM menu_planlari mp
    JOIN menu_plan_ogunleri mpo ON mpo.menu_plan_id = mp.id
    JOIN ogun_tipleri ot ON ot.id = mpo.ogun_tipi_id AND ot.kod = 'kahvalti'
    LEFT JOIN menu_ogun_yemekleri moy ON moy.menu_ogun_id = mpo.id
    WHERE mp.proje_id = $1
  `,
    [PROJE_ID]
  );

  process.exit(0);
}

main().catch((_e) => {
  process.exit(1);
});
