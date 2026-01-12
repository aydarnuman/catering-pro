/**
 * KYK 2025 Standartlarına Göre Reçete Malzemeleri
 * Her reçete için gramaj ve malzeme bilgilerini ekler
 */

const API = 'http://localhost:3001/api/menu-planlama';

// KYK 2025 Standart Reçete Malzemeleri (1 porsiyon için gramaj)
const receteMalzemeleri = {
  // ========= ÇORBALAR =========
  'Mercimek Çorbası': [
    { malzeme_adi: 'Kırmızı Mercimek', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Havuç', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' },
    { malzeme_adi: 'Karabiber', miktar: 0.5, birim: 'g' },
    { malzeme_adi: 'Kimyon', miktar: 0.5, birim: 'g' }
  ],
  'Ezogelin Çorbası': [
    { malzeme_adi: 'Kırmızı Mercimek', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Bulgur', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Pirinç', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Biber Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Nane (Kuru)', miktar: 1, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Tarhana Çorbası': [
    { malzeme_adi: 'Tarhana', miktar: 35, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Domates Çorbası': [
    { malzeme_adi: 'Domates (Taze)', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Süt', miktar: 30, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 2, birim: 'g' }
  ],
  'Yayla Çorbası': [
    { malzeme_adi: 'Yoğurt', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Pirinç', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Yumurta', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Nane (Kuru)', miktar: 1, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Şehriye Çorbası': [
    { malzeme_adi: 'Şehriye', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Düğün Çorbası': [
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Yumurta', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Limon Suyu', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Sebze Çorbası': [
    { malzeme_adi: 'Havuç', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Kabak', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Patates Çorbası': [
    { malzeme_adi: 'Patates', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Süt', miktar: 30, birim: 'ml' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Pirinç Çorbası': [
    { malzeme_adi: 'Pirinç', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Tavuk Suyu', miktar: 200, birim: 'ml' },
    { malzeme_adi: 'Tereyağı', miktar: 8, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Tavuk Suyu Çorbası': [
    { malzeme_adi: 'Tavuk Göğsü', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Şehriye', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Havuç', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],

  // ========= ANA YEMEKLER =========
  'Kuru Fasulye': [
    { malzeme_adi: 'Kuru Fasulye', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Biber Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Nohut Yemeği': [
    { malzeme_adi: 'Nohut', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Etli Bezelye': [
    { malzeme_adi: 'Bezelye', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Etli Türlü': [
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Patlıcan', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Kabak', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Tavuk Sote': [
    { malzeme_adi: 'Tavuk But (Kemiksiz)', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'İzmir Köfte': [
    { malzeme_adi: 'Dana Kıyma', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Ekmek İçi', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 20, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Kadınbudu Köfte': [
    { malzeme_adi: 'Dana Kıyma', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Pirinç', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Yumurta', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 30, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Karnıyarık': [
    { malzeme_adi: 'Patlıcan', miktar: 150, birim: 'g' },
    { malzeme_adi: 'Dana Kıyma', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 30, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'İmam Bayıldı': [
    { malzeme_adi: 'Patlıcan', miktar: 150, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Sarımsak', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 25, birim: 'ml' },
    { malzeme_adi: 'Maydanoz', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Etli Kapuska': [
    { malzeme_adi: 'Beyaz Lahana', miktar: 120, birim: 'g' },
    { malzeme_adi: 'Dana Kıyma', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Biber Salçası', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Yaprak Sarma': [
    { malzeme_adi: 'Asma Yaprağı', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Dana Kıyma', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Pirinç', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Nane', miktar: 2, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Musakka': [
    { malzeme_adi: 'Patlıcan', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Dana Kıyma', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 20, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Taze Fasulye': [
    { malzeme_adi: 'Taze Fasulye', miktar: 150, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 20, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Fırın Tavuk': [
    { malzeme_adi: 'Tavuk But', miktar: 150, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Kekik', miktar: 1, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Et Haşlama': [
    { malzeme_adi: 'Dana Eti (Haşlamalık)', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Havuç', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Tas Kebabı': [
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Patlıcan Kebabı': [
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Patlıcan', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Güveç': [
    { malzeme_adi: 'Dana Eti (Kuşbaşı)', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Patlıcan', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],
  'Karışık Kızartma': [
    { malzeme_adi: 'Patlıcan', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Patates', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Kabak', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Ayçiçek Yağı', miktar: 40, birim: 'ml' },
    { malzeme_adi: 'Yoğurt', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 3, birim: 'g' }
  ],

  // ========= PİLAV / MAKARNA =========
  'Pirinç Pilavı': [
    { malzeme_adi: 'Pirinç Baldo', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tavuk Suyu', miktar: 150, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Bulgur Pilavı': [
    { malzeme_adi: 'Bulgur', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Şehriyeli Pilav': [
    { malzeme_adi: 'Pirinç Baldo', miktar: 70, birim: 'g' },
    { malzeme_adi: 'Şehriye', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tavuk Suyu', miktar: 150, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Soslu Makarna': [
    { malzeme_adi: 'Makarna', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Makarna (Domates Soslu)': [
    { malzeme_adi: 'Makarna', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Spagetti Bolonez': [
    { malzeme_adi: 'Spagetti', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Dana Kıyma', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Nohutlu Pilav': [
    { malzeme_adi: 'Pirinç Baldo', miktar: 70, birim: 'g' },
    { malzeme_adi: 'Nohut (Haşlanmış)', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tavuk Suyu', miktar: 150, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Domatesli Bulgur Pilavı': [
    { malzeme_adi: 'Bulgur', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Tavuklu Pilav': [
    { malzeme_adi: 'Pirinç Baldo', miktar: 70, birim: 'g' },
    { malzeme_adi: 'Tavuk Göğsü', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Tavuk Suyu', miktar: 150, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],

  // ========= SALATA / MEZE =========
  'Mevsim Salata': [
    { malzeme_adi: 'Marul', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Salatalık', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Havuç', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 8, birim: 'ml' },
    { malzeme_adi: 'Limon', miktar: 5, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Çoban Salata': [
    { malzeme_adi: 'Domates', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Salatalık', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Maydanoz', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Cacık': [
    { malzeme_adi: 'Yoğurt', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Salatalık', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Sarımsak', miktar: 2, birim: 'g' },
    { malzeme_adi: 'Nane (Kuru)', miktar: 1, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 5, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Havuç Tarator': [
    { malzeme_adi: 'Havuç', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Yoğurt', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Sarımsak', miktar: 3, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 8, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Piyaz': [
    { malzeme_adi: 'Kuru Fasulye (Haşlanmış)', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Soğan', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Maydanoz', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Yumurta (Haşlanmış)', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Sirke', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Kısır': [
    { malzeme_adi: 'Bulgur (İnce)', miktar: 60, birim: 'g' },
    { malzeme_adi: 'Domates Salçası', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Biber Salçası', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Maydanoz', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Yeşil Soğan', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 15, birim: 'ml' },
    { malzeme_adi: 'Limon', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Turşu': [
    { malzeme_adi: 'Karışık Turşu', miktar: 50, birim: 'g' }
  ],
  'Rus Salatası': [
    { malzeme_adi: 'Patates (Haşlanmış)', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Havuç (Haşlanmış)', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Bezelye (Haşlanmış)', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Salatalık Turşusu', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Mayonez', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Yoğurt': [
    { malzeme_adi: 'Yoğurt', miktar: 150, birim: 'g' }
  ],
  'Haydari': [
    { malzeme_adi: 'Süzme Yoğurt', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Beyaz Peynir', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Sarımsak', miktar: 3, birim: 'g' },
    { malzeme_adi: 'Dereotu', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Zeytinyağı', miktar: 10, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],

  // ========= TATLILAR =========
  'Sütlaç': [
    { malzeme_adi: 'Süt', miktar: 120, birim: 'ml' },
    { malzeme_adi: 'Pirinç', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Nişasta', miktar: 5, birim: 'g' },
    { malzeme_adi: 'Vanilya', miktar: 1, birim: 'g' }
  ],
  'İrmik Helvası': [
    { malzeme_adi: 'İrmik', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Süt', miktar: 80, birim: 'ml' },
    { malzeme_adi: 'Çam Fıstığı', miktar: 5, birim: 'g' }
  ],
  'Keşkül': [
    { malzeme_adi: 'Süt', miktar: 100, birim: 'ml' },
    { malzeme_adi: 'Badem (Çekilmiş)', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Pirinç Unu', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Gül Suyu', miktar: 2, birim: 'ml' }
  ],
  'Revani': [
    { malzeme_adi: 'İrmik', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Un', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Yumurta', miktar: 20, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 40, birim: 'g' },
    { malzeme_adi: 'Yoğurt', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Kabartma Tozu', miktar: 2, birim: 'g' }
  ],
  'Puding': [
    { malzeme_adi: 'Süt', miktar: 100, birim: 'ml' },
    { malzeme_adi: 'Kakao', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Nişasta', miktar: 15, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 20, birim: 'g' }
  ],
  'Meyve Komposto': [
    { malzeme_adi: 'Karışık Meyve', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Su', miktar: 80, birim: 'ml' }
  ],

  // ========= İÇECEKLER =========
  'Ayran': [
    { malzeme_adi: 'Yoğurt', miktar: 80, birim: 'g' },
    { malzeme_adi: 'Su', miktar: 120, birim: 'ml' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Limonata': [
    { malzeme_adi: 'Limon', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Şeker', miktar: 25, birim: 'g' },
    { malzeme_adi: 'Su', miktar: 180, birim: 'ml' }
  ],
  'Şalgam': [
    { malzeme_adi: 'Şalgam Suyu', miktar: 200, birim: 'ml' }
  ],
  'Meyve Suyu': [
    { malzeme_adi: 'Meyve Suyu', miktar: 200, birim: 'ml' }
  ],
  'Çay': [
    { malzeme_adi: 'Çay', miktar: 2, birim: 'g' },
    { malzeme_adi: 'Su', miktar: 150, birim: 'ml' }
  ],
  'Süt': [
    { malzeme_adi: 'Süt', miktar: 200, birim: 'ml' }
  ],

  // ========= KAHVALTILIK =========
  'Menemen': [
    { malzeme_adi: 'Yumurta', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Domates', miktar: 50, birim: 'g' },
    { malzeme_adi: 'Biber', miktar: 30, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 2, birim: 'g' }
  ],
  'Haşlanmış Yumurta': [
    { malzeme_adi: 'Yumurta', miktar: 60, birim: 'g' }
  ],
  'Sahanda Yumurta': [
    { malzeme_adi: 'Yumurta', miktar: 100, birim: 'g' },
    { malzeme_adi: 'Tereyağı', miktar: 10, birim: 'g' },
    { malzeme_adi: 'Tuz', miktar: 1, birim: 'g' }
  ],
  'Beyaz Peynir': [
    { malzeme_adi: 'Beyaz Peynir', miktar: 40, birim: 'g' }
  ],
  'Kaşar Peynir': [
    { malzeme_adi: 'Kaşar Peynir', miktar: 30, birim: 'g' }
  ],
  'Zeytin': [
    { malzeme_adi: 'Zeytin', miktar: 30, birim: 'g' }
  ],
  'Bal': [
    { malzeme_adi: 'Bal', miktar: 25, birim: 'g' }
  ],
  'Reçel': [
    { malzeme_adi: 'Reçel', miktar: 25, birim: 'g' }
  ],
  'Sucuk': [
    { malzeme_adi: 'Sucuk', miktar: 40, birim: 'g' }
  ],
  'Simit': [
    { malzeme_adi: 'Simit', miktar: 100, birim: 'g' }
  ]
};

async function run() {
  console.log('🍽️ KYK 2025 Standart Malzemeleri Ekleniyor...\n');
  
  // Mevcut reçeteleri al
  const recetelerRes = await fetch(API + '/receteler?limit=100');
  const recetelerData = await recetelerRes.json();
  const receteler = recetelerData.data || [];
  
  let toplamEklenen = 0;
  let receteGuncellenen = 0;
  
  for (const recete of receteler) {
    const malzemeler = receteMalzemeleri[recete.ad];
    
    if (!malzemeler) {
      continue;
    }
    
    console.log(`📝 ${recete.ad} (ID: ${recete.id})`);
    
    let eklenen = 0;
    for (const m of malzemeler) {
      try {
        const res = await fetch(`${API}/receteler/${recete.id}/malzemeler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            malzeme_adi: m.malzeme_adi,
            miktar: m.miktar,
            birim: m.birim,
            zorunlu: true
          })
        });
        
        if (res.ok) {
          eklenen++;
          process.stdout.write('.');
        }
      } catch (e) {
        // Hata varsa atla
      }
    }
    
    if (eklenen > 0) {
      console.log(` ✅ ${eklenen} malzeme`);
      toplamEklenen += eklenen;
      receteGuncellenen++;
    }
    
    // Rate limit için kısa bekleme
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ ${receteGuncellenen} reçete güncellendi`);
  console.log(`✅ ${toplamEklenen} malzeme eklendi`);
  console.log(`📋 KYK 2025 standartlarına uygun!`);
}

run().catch(console.error);

