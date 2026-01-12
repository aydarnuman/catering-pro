/**
 * OCAK AYI MENÜ İMPORT SCRİPTİ
 * Masaüstündeki Excel dosyalarından menü planı oluşturur
 */

import XLSX from 'xlsx';
import fetch from 'node-fetch';
import path from 'path';

const API_URL = 'http://localhost:3001/api/menu-planlama';
const PROJE_ID = 1; // KYK Yurdu

// Excel'den verileri parse et
function parseKahvaltiExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const menuler = [];
  
  // Her hafta için satırları tara
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Tarih formatını bul (1/1/26, 1/2/26, vb.)
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell && typeof cell === 'string' && cell.match(/^\d+\/\d+\/\d+$/)) {
        // Bu bir tarih
        const [gun, ay, yil] = cell.split('/');
        const tarih = `20${yil}-${ay.padStart(2, '0')}-${gun.padStart(2, '0')}`;
        
        // Bu tarihin yemeklerini topla (sonraki satırlardan)
        const yemekler = [];
        for (let k = i; k < Math.min(i + 12, data.length); k++) {
          const yemekRow = data[k];
          if (yemekRow && yemekRow[j]) {
            const yemekAdi = String(yemekRow[j]).trim();
            const gramaj = yemekRow[j + 1] ? String(yemekRow[j + 1]).trim() : '';
            const enerji = yemekRow[j + 2] ? String(yemekRow[j + 2]).trim() : '';
            
            // Boş veya başlık satırlarını atla
            if (yemekAdi && 
                !yemekAdi.match(/^\d+\/\d+\/\d+$/) && 
                !yemekAdi.includes('PAZARTESİ') &&
                !yemekAdi.includes('SALI') &&
                !yemekAdi.includes('ÇARŞAMBA') &&
                !yemekAdi.includes('PERŞEMBE') &&
                !yemekAdi.includes('CUMA') &&
                !yemekAdi.includes('CUMARTESİ') &&
                !yemekAdi.includes('PAZAR') &&
                !yemekAdi.includes('OCAK AYI') &&
                yemekAdi.length > 2) {
              yemekler.push({ ad: yemekAdi, gramaj, enerji });
            }
          }
        }
        
        if (yemekler.length > 0) {
          menuler.push({
            tarih,
            ogun: 'kahvalti',
            yemekler: yemekler.filter(y => 
              !y.ad.includes('Çeyrek Ekmek') && 
              !y.ad.includes('500 ml Su') &&
              !y.ad.includes('**Çay')
            ).slice(0, 8) // İlk 8 yemek
          });
        }
      }
    }
  }
  
  return menuler;
}

function parseAksamExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const menuler = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Excel serial number formatındaki tarihleri bul (46023, 46027, vb.)
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell && typeof cell === 'number' && cell > 45000 && cell < 50000) {
        // Excel tarih numarası
        const excelDate = new Date((cell - 25569) * 86400 * 1000);
        const tarih = excelDate.toISOString().split('T')[0];
        
        // Bu tarihin yemeklerini topla
        const yemekler = [];
        
        // Sonraki satırlardan yemekleri oku
        for (let k = i; k < Math.min(i + 10, data.length); k++) {
          const yemekRow = data[k];
          if (yemekRow && yemekRow[j]) {
            const yemekAdi = String(yemekRow[j]).trim();
            const gramaj = yemekRow[j + 1] ? String(yemekRow[j + 1]).trim() : '';
            const enerji = yemekRow[j + 2] ? String(yemekRow[j + 2]).trim() : '';
            
            if (yemekAdi && 
                typeof yemekAdi === 'string' &&
                yemekAdi.length > 3 &&
                !yemekAdi.match(/^\d+$/) &&
                !yemekAdi.includes('YEMEK ÇEŞİTLERİ') &&
                !yemekAdi.includes('Çeyrek Ekmek') &&
                !yemekAdi.includes('500 ml Su')) {
              yemekler.push({ ad: yemekAdi, gramaj, enerji });
            }
          }
        }
        
        if (yemekler.length > 0) {
          menuler.push({
            tarih,
            ogun: 'aksam',
            yemekler: yemekler.slice(0, 6) // İlk 6 yemek (çorba, 2 ana yemek, pilav, salata/tatlı)
          });
        }
      }
    }
  }
  
  return menuler;
}

// Reçeteyi bul veya oluştur
async function getOrCreateRecete(yemekAdi, kategori = 'ana_yemek') {
  // Önce mevcut reçetelerde ara
  const searchRes = await fetch(`${API_URL}/receteler?arama=${encodeURIComponent(yemekAdi)}&proje_id=${PROJE_ID}`);
  const searchData = await searchRes.json();
  
  if (searchData.data && searchData.data.length > 0) {
    // Tam veya benzer eşleşme bul
    const exact = searchData.data.find(r => r.ad.toLowerCase() === yemekAdi.toLowerCase());
    if (exact) return exact.id;
    
    // Benzer isim
    const similar = searchData.data.find(r => 
      r.ad.toLowerCase().includes(yemekAdi.toLowerCase().split('/')[0].split('+')[0].trim())
    );
    if (similar) return similar.id;
  }
  
  // Kategoriyi belirle
  let kategoriKod = 'ana_yemek';
  const yemekLower = yemekAdi.toLowerCase();
  if (yemekLower.includes('çorba')) kategoriKod = 'corba';
  else if (yemekLower.includes('pilav') || yemekLower.includes('makarna') || yemekLower.includes('erişte') || yemekLower.includes('spagetti')) kategoriKod = 'pilav_makarna';
  else if (yemekLower.includes('salata') || yemekLower.includes('cacık') || yemekLower.includes('ezme') || yemekLower.includes('tarator')) kategoriKod = 'salata_meze';
  else if (yemekLower.includes('tatlı') || yemekLower.includes('pasta') || yemekLower.includes('puding') || yemekLower.includes('baklava') || yemekLower.includes('kek')) kategoriKod = 'tatli';
  else if (yemekLower.includes('ayran') || yemekLower.includes('su') || yemekLower.includes('çay')) kategoriKod = 'icecek';
  else if (yemekLower.includes('omlet') || yemekLower.includes('yumurta') || yemekLower.includes('peynir') || yemekLower.includes('zeytin') || yemekLower.includes('reçel') || yemekLower.includes('bal') || yemekLower.includes('simit') || yemekLower.includes('poğaça') || yemekLower.includes('börek')) kategoriKod = 'kahvaltilik';
  
  // Kategori ID'sini bul
  const katRes = await fetch(`${API_URL}/kategoriler`);
  const katData = await katRes.json();
  const kategoriObj = katData.find(k => k.kod === kategoriKod);
  const kategoriId = kategoriObj ? kategoriObj.id : 2; // varsayılan ana_yemek
  
  // Yeni reçete oluştur
  const kod = yemekAdi.substring(0, 3).toUpperCase().replace(/[^A-ZĞÜŞİÖÇ]/gi, 'X') + '-' + Date.now().toString().slice(-6);
  
  const createRes = await fetch(`${API_URL}/receteler`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kod,
      ad: yemekAdi,
      kategori_id: kategoriId,
      porsiyon_miktar: 1,
      proje_id: PROJE_ID
    })
  });
  
  const createData = await createRes.json();
  console.log(`  ✅ Yeni reçete oluşturuldu: ${yemekAdi}`);
  return createData.data?.id || createData.id;
}

// Menü planı oluştur
async function createMenuPlan() {
  // Ocak 2026 için menü planı
  const planRes = await fetch(`${API_URL}/planlar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proje_id: PROJE_ID,
      ad: 'Ocak 2026 Menüsü',
      tip: 'aylik',
      baslangic_tarihi: '2026-01-01',
      bitis_tarihi: '2026-01-31',
      varsayilan_kisi_sayisi: 1000
    })
  });
  
  const planData = await planRes.json();
  return planData.data?.id || planData.id;
}

// Ana fonksiyon
async function importOcakMenu() {
  console.log('🍽️  OCAK AYI MENÜ İMPORT');
  console.log('========================\n');
  
  const kahvaltiPath = '/Users/numanaydar/Desktop/OCAK AYI KAHVALTI MENÜSÜ.xlsx';
  const aksamPath = '/Users/numanaydar/Desktop/OCAK AYI AKSAM YEMEGI MENÜ LİSTESİ.xlsx';
  
  // 1. Kahvaltı menüsünü parse et
  console.log('📖 Kahvaltı menüsü okunuyor...');
  const kahvaltiMenuler = parseKahvaltiExcel(kahvaltiPath);
  console.log(`  Bulunan kahvaltı günü: ${kahvaltiMenuler.length}`);
  
  // 2. Akşam menüsünü parse et
  console.log('\n📖 Akşam yemeği menüsü okunuyor...');
  const aksamMenuler = parseAksamExcel(aksamPath);
  console.log(`  Bulunan akşam yemeği günü: ${aksamMenuler.length}`);
  
  // 3. Benzersiz yemekleri topla
  const tumYemekler = new Set();
  [...kahvaltiMenuler, ...aksamMenuler].forEach(menu => {
    menu.yemekler.forEach(y => tumYemekler.add(y.ad));
  });
  console.log(`\n📊 Toplam benzersiz yemek: ${tumYemekler.size}`);
  
  // 4. Menü planı oluştur
  console.log('\n📅 Menü planı oluşturuluyor...');
  let planId;
  try {
    planId = await createMenuPlan();
    console.log(`  ✅ Plan ID: ${planId}`);
  } catch (e) {
    console.log('  ⚠️ Menü planı zaten var veya hata:', e.message);
  }
  
  // 5. Her gün için öğünleri ve yemekleri ekle
  console.log('\n🍴 Menü öğünleri ekleniyor...');
  
  const tumMenuler = [...kahvaltiMenuler, ...aksamMenuler];
  let eklenenOgun = 0;
  let eklenenYemek = 0;
  
  for (const menu of tumMenuler) {
    try {
      // Öğün tipi ID'sini bul
      const ogunTipId = menu.ogun === 'kahvalti' ? 1 : 3; // 1=kahvaltı, 3=akşam
      
      // Her yemek için reçete bul/oluştur ve ekle
      for (const yemek of menu.yemekler) {
        try {
          const receteId = await getOrCreateRecete(yemek.ad);
          if (receteId) {
            eklenenYemek++;
            process.stdout.write('.');
          }
        } catch (e) {
          // console.log(`    ❌ ${yemek.ad}: ${e.message}`);
        }
      }
      eklenenOgun++;
    } catch (e) {
      // console.log(`  ❌ ${menu.tarih} ${menu.ogun}: ${e.message}`);
    }
  }
  
  console.log(`\n\n✅ İşlem tamamlandı!`);
  console.log(`   📅 ${eklenenOgun} öğün işlendi`);
  console.log(`   🍽️  ${eklenenYemek} yemek/reçete oluşturuldu`);
  console.log(`\n💡 Şimdi frontend'den menü planlamasına gidip:`);
  console.log(`   1. Ocak ayını seçin`);
  console.log(`   2. Reçete kütüphanesinden yemekleri menüye sürükleyin`);
}

importOcakMenu().catch(console.error);

