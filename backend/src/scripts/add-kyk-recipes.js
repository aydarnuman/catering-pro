/**
 * KYK Reçetelerini API üzerinden toplu ekle
 */

const API = 'http://localhost:3001/api/menu-planlama';

const receteler = [
  // ÇORBALAR
  { kategori: 'corba', ad: 'Ezogelin Çorbası', kalori: 165, protein: 10, karbonhidrat: 30, yag: 3 },
  { kategori: 'corba', ad: 'Tarhana Çorbası', kalori: 150, protein: 8, karbonhidrat: 25, yag: 4 },
  { kategori: 'corba', ad: 'Domates Çorbası', kalori: 120, protein: 3, karbonhidrat: 20, yag: 3 },
  { kategori: 'corba', ad: 'Yayla Çorbası', kalori: 140, protein: 6, karbonhidrat: 18, yag: 5 },
  { kategori: 'corba', ad: 'Şehriye Çorbası', kalori: 130, protein: 4, karbonhidrat: 24, yag: 2 },
  { kategori: 'corba', ad: 'Düğün Çorbası', kalori: 175, protein: 10, karbonhidrat: 15, yag: 8 },
  { kategori: 'corba', ad: 'Sebze Çorbası', kalori: 100, protein: 3, karbonhidrat: 18, yag: 2 },
  { kategori: 'corba', ad: 'Patates Çorbası', kalori: 145, protein: 4, karbonhidrat: 22, yag: 4 },
  { kategori: 'corba', ad: 'Pirinç Çorbası', kalori: 135, protein: 3, karbonhidrat: 26, yag: 2 },
  { kategori: 'corba', ad: 'Tavuk Suyu Çorbası', kalori: 90, protein: 8, karbonhidrat: 8, yag: 3 },

  // ANA YEMEKLER
  { kategori: 'ana_yemek', ad: 'Kuru Fasulye', kalori: 320, protein: 18, karbonhidrat: 45, yag: 8 },
  { kategori: 'ana_yemek', ad: 'Nohut Yemeği', kalori: 300, protein: 15, karbonhidrat: 42, yag: 7 },
  { kategori: 'ana_yemek', ad: 'Etli Bezelye', kalori: 280, protein: 20, karbonhidrat: 22, yag: 12 },
  { kategori: 'ana_yemek', ad: 'Etli Türlü', kalori: 290, protein: 18, karbonhidrat: 25, yag: 12 },
  { kategori: 'ana_yemek', ad: 'Tavuk Sote', kalori: 260, protein: 28, karbonhidrat: 10, yag: 12 },
  { kategori: 'ana_yemek', ad: 'İzmir Köfte', kalori: 380, protein: 22, karbonhidrat: 20, yag: 24 },
  { kategori: 'ana_yemek', ad: 'Kadınbudu Köfte', kalori: 340, protein: 20, karbonhidrat: 18, yag: 20 },
  { kategori: 'ana_yemek', ad: 'Karnıyarık', kalori: 320, protein: 18, karbonhidrat: 25, yag: 18 },
  { kategori: 'ana_yemek', ad: 'İmam Bayıldı', kalori: 280, protein: 6, karbonhidrat: 22, yag: 18 },
  { kategori: 'ana_yemek', ad: 'Etli Kapuska', kalori: 260, protein: 18, karbonhidrat: 20, yag: 12 },
  { kategori: 'ana_yemek', ad: 'Yaprak Sarma', kalori: 290, protein: 12, karbonhidrat: 35, yag: 12 },
  { kategori: 'ana_yemek', ad: 'Musakka', kalori: 340, protein: 16, karbonhidrat: 28, yag: 18 },
  { kategori: 'ana_yemek', ad: 'Taze Fasulye', kalori: 180, protein: 8, karbonhidrat: 22, yag: 6 },
  { kategori: 'ana_yemek', ad: 'Fırın Tavuk', kalori: 300, protein: 30, karbonhidrat: 5, yag: 18 },
  { kategori: 'ana_yemek', ad: 'Et Haşlama', kalori: 350, protein: 32, karbonhidrat: 8, yag: 22 },
  { kategori: 'ana_yemek', ad: 'Tas Kebabı', kalori: 370, protein: 28, karbonhidrat: 12, yag: 24 },
  { kategori: 'ana_yemek', ad: 'Patlıcan Kebabı', kalori: 310, protein: 22, karbonhidrat: 15, yag: 18 },
  { kategori: 'ana_yemek', ad: 'Güveç', kalori: 380, protein: 24, karbonhidrat: 28, yag: 18 },
  { kategori: 'ana_yemek', ad: 'Karışık Kızartma', kalori: 400, protein: 15, karbonhidrat: 35, yag: 22 },

  // PİLAV / MAKARNA
  { kategori: 'pilav_makarna', ad: 'Pirinç Pilavı', kalori: 200, protein: 4, karbonhidrat: 42, yag: 3 },
  { kategori: 'pilav_makarna', ad: 'Bulgur Pilavı', kalori: 180, protein: 6, karbonhidrat: 38, yag: 2 },
  { kategori: 'pilav_makarna', ad: 'Şehriyeli Pilav', kalori: 210, protein: 5, karbonhidrat: 44, yag: 3 },
  { kategori: 'pilav_makarna', ad: 'Spagetti Bolonez', kalori: 350, protein: 15, karbonhidrat: 48, yag: 10 },
  { kategori: 'pilav_makarna', ad: 'Soslu Makarna', kalori: 300, protein: 10, karbonhidrat: 45, yag: 8 },
  { kategori: 'pilav_makarna', ad: 'Makarna (Domates Soslu)', kalori: 260, protein: 8, karbonhidrat: 48, yag: 4 },
  { kategori: 'pilav_makarna', ad: 'Nohutlu Pilav', kalori: 220, protein: 8, karbonhidrat: 40, yag: 4 },
  { kategori: 'pilav_makarna', ad: 'Domatesli Bulgur Pilavı', kalori: 190, protein: 6, karbonhidrat: 38, yag: 3 },

  // SALATA / MEZE
  { kategori: 'salata_meze', ad: 'Mevsim Salata', kalori: 45, protein: 2, karbonhidrat: 8, yag: 1 },
  { kategori: 'salata_meze', ad: 'Çoban Salata', kalori: 50, protein: 2, karbonhidrat: 10, yag: 1 },
  { kategori: 'salata_meze', ad: 'Cacık', kalori: 60, protein: 4, karbonhidrat: 6, yag: 2 },
  { kategori: 'salata_meze', ad: 'Havuç Tarator', kalori: 80, protein: 3, karbonhidrat: 10, yag: 3 },
  { kategori: 'salata_meze', ad: 'Piyaz', kalori: 120, protein: 6, karbonhidrat: 18, yag: 3 },
  { kategori: 'salata_meze', ad: 'Kısır', kalori: 180, protein: 5, karbonhidrat: 30, yag: 5 },
  { kategori: 'salata_meze', ad: 'Turşu', kalori: 15, protein: 0, karbonhidrat: 3, yag: 0 },
  { kategori: 'salata_meze', ad: 'Rus Salatası', kalori: 200, protein: 4, karbonhidrat: 18, yag: 12 },
  { kategori: 'salata_meze', ad: 'Yoğurt', kalori: 90, protein: 5, karbonhidrat: 8, yag: 4 },
  { kategori: 'salata_meze', ad: 'Haydari', kalori: 110, protein: 6, karbonhidrat: 5, yag: 8 },

  // TATLILAR
  { kategori: 'tatli', ad: 'Sütlaç', kalori: 180, protein: 5, karbonhidrat: 32, yag: 4 },
  { kategori: 'tatli', ad: 'İrmik Helvası', kalori: 250, protein: 4, karbonhidrat: 35, yag: 10 },
  { kategori: 'tatli', ad: 'Keşkül', kalori: 200, protein: 6, karbonhidrat: 28, yag: 7 },
  { kategori: 'tatli', ad: 'Revani', kalori: 280, protein: 4, karbonhidrat: 45, yag: 10 },
  { kategori: 'tatli', ad: 'Puding', kalori: 160, protein: 4, karbonhidrat: 28, yag: 4 },
  { kategori: 'tatli', ad: 'Ayva Tatlısı', kalori: 220, protein: 1, karbonhidrat: 50, yag: 2 },
  { kategori: 'tatli', ad: 'Kabak Tatlısı', kalori: 200, protein: 2, karbonhidrat: 45, yag: 2 },
  { kategori: 'tatli', ad: 'Meyve Komposto', kalori: 100, protein: 0, karbonhidrat: 25, yag: 0 },

  // KAHVALTILIK
  { kategori: 'kahvaltilik', ad: 'Menemen', kalori: 180, protein: 10, karbonhidrat: 12, yag: 12 },
  { kategori: 'kahvaltilik', ad: 'Haşlanmış Yumurta', kalori: 75, protein: 6, karbonhidrat: 1, yag: 5 },
  { kategori: 'kahvaltilik', ad: 'Sahanda Yumurta', kalori: 120, protein: 8, karbonhidrat: 1, yag: 9 },
  { kategori: 'kahvaltilik', ad: 'Beyaz Peynir', kalori: 130, protein: 8, karbonhidrat: 2, yag: 10 },
  { kategori: 'kahvaltilik', ad: 'Kaşar Peynir', kalori: 140, protein: 10, karbonhidrat: 1, yag: 11 },
  { kategori: 'kahvaltilik', ad: 'Zeytin', kalori: 45, protein: 0, karbonhidrat: 2, yag: 4 },
  { kategori: 'kahvaltilik', ad: 'Bal', kalori: 90, protein: 0, karbonhidrat: 23, yag: 0 },
  { kategori: 'kahvaltilik', ad: 'Reçel', kalori: 75, protein: 0, karbonhidrat: 19, yag: 0 },
  { kategori: 'kahvaltilik', ad: 'Sucuk', kalori: 200, protein: 12, karbonhidrat: 2, yag: 16 },
  { kategori: 'kahvaltilik', ad: 'Süt', kalori: 120, protein: 6, karbonhidrat: 10, yag: 6 },
  { kategori: 'kahvaltilik', ad: 'Simit', kalori: 280, protein: 8, karbonhidrat: 50, yag: 5 },

  // İÇECEKLER
  { kategori: 'icecek', ad: 'Ayran', kalori: 60, protein: 3, karbonhidrat: 4, yag: 3 },
  { kategori: 'icecek', ad: 'Limonata', kalori: 80, protein: 0, karbonhidrat: 20, yag: 0 },
  { kategori: 'icecek', ad: 'Şalgam', kalori: 20, protein: 0, karbonhidrat: 4, yag: 0 },
  { kategori: 'icecek', ad: 'Meyve Suyu', kalori: 90, protein: 0, karbonhidrat: 22, yag: 0 },
  { kategori: 'icecek', ad: 'Çay', kalori: 2, protein: 0, karbonhidrat: 0, yag: 0 },
];

async function run() {
  try {
    const katRes = await fetch(API + '/kategoriler');
    const katData = await katRes.json();

    if (!katData.success || !katData.data) {
      return;
    }

    const kategoriler = {};
    katData.data.forEach((k) => {
      kategoriler[k.kod] = k.id;
    });

    // Mevcut reçeteleri kontrol et (duplicate önleme)
    const mevcutRes = await fetch(API + '/receteler?limit=500');
    const mevcutData = await mevcutRes.json();
    const mevcutAdlar = new Set((mevcutData.data || []).map((r) => r.ad.toLowerCase()));

    let _eklenen = 0;
    let _atlanan = 0;

    for (const r of receteler) {
      // Duplicate kontrolü
      if (mevcutAdlar.has(r.ad.toLowerCase())) {
        _atlanan++;
        continue;
      }

      const kod =
        r.ad
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-ZĞÜŞİÖÇ]/gi, 'X') +
        '-' +
        Date.now().toString().slice(-6);
      const body = {
        kod,
        ad: r.ad,
        kategori_id: kategoriler[r.kategori],
        porsiyon_miktar: 1,
        kalori: r.kalori,
        protein: r.protein,
        karbonhidrat: r.karbonhidrat,
        yag: r.yag,
      };

      const res = await fetch(API + '/receteler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        _eklenen++;
        process.stdout.write('.');
      } else {
        const _err = await res.text();
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch (_error) {}
}

run();
