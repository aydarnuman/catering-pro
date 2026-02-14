// Node 18+ has native fetch — no import needed
import XLSX from 'xlsx';

const API_URL = 'http://localhost:3001/api/menu-planlama';
const PROJE_ID = 1;

async function getOrCreateRecete(yemekAdi) {
  try {
    const searchRes = await fetch(`${API_URL}/receteler?arama=${encodeURIComponent(yemekAdi)}&proje_id=${PROJE_ID}`);
    const searchData = await searchRes.json();

    if (searchData.data && searchData.data.length > 0) {
      const exact = searchData.data.find((r) => r.ad.toLowerCase() === yemekAdi.toLowerCase());
      if (exact) return exact.id;
    }

    const kategoriId = 7; // kahvaltılık

    const kod =
      yemekAdi
        .substring(0, 3)
        .toUpperCase()
        .replace(/[^A-Z]/gi, 'X') +
      '-' +
      Date.now().toString().slice(-6);

    await fetch(`${API_URL}/receteler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kod,
        ad: yemekAdi,
        kategori_id: kategoriId,
        proje_id: PROJE_ID,
      }),
    });

    return true;
  } catch (_e) {
    return false;
  }
}

async function run() {
  const wb = XLSX.readFile('/Users/numanaydar/Desktop/OCAK AYI KAHVALTI MENÜSÜ.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const yemekler = new Set();

  for (const row of data) {
    if (!row) continue;
    for (const cell of row) {
      if (cell && typeof cell === 'string') {
        const str = cell.trim();
        if (
          str.length > 3 &&
          str.length < 80 &&
          !str.match(/^\d+\/\d+\/\d+/) &&
          !str.includes('PAZARTESİ') &&
          !str.includes('SALI') &&
          !str.includes('ÇARŞAMBA') &&
          !str.includes('PERŞEMBE') &&
          !str.includes('CUMA') &&
          !str.includes('CUMARTESİ') &&
          !str.includes('PAZAR') &&
          !str.includes('OCAK AYI') &&
          !str.includes('Gramaj') &&
          !str.includes('Enerji') &&
          !str.includes('kcal') &&
          !str.includes('kkal') &&
          !str.includes('NOT:') &&
          !str.includes('Müdür') &&
          !str.includes('Vekili') &&
          !str.match(/^\d+ g/) &&
          !str.match(/^\d+ ml/) &&
          !str.includes('Çeyrek Ekmek') &&
          !str.startsWith('**') &&
          !str.startsWith('*') &&
          !str.includes('adet') &&
          !str.includes('boy') &&
          !str.includes('+')
        ) {
          yemekler.add(str);
        }
      }
    }
  }

  let _eklenen = 0;
  for (const yemek of yemekler) {
    const result = await getOrCreateRecete(yemek);
    if (result) {
      _eklenen++;
      process.stdout.write('.');
    }
  }
}

run().catch(console.error);
