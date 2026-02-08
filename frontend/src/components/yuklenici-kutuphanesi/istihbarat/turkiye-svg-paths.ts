/**
 * Türkiye İl Merkezleri Koordinatları (Basitleştirilmiş)
 * ──────────────────────────────────────────────────────
 * Her il için merkez koordinatı (x, y) ve il adı.
 * SVG viewBox: 0 0 1000 500 ölçeğine uyarlanmıştır.
 * Tam SVG path yerine daire (circle) noktası kullanılır — daha hafif ve esnek.
 */

export interface IlNokta {
  ad: string;
  plaka: number;
  x: number;
  y: number;
}

export const TURKIYE_ILLERI: IlNokta[] = [
  { ad: 'Adana', plaka: 1, x: 565, y: 330 },
  { ad: 'Adıyaman', plaka: 2, x: 640, y: 290 },
  { ad: 'Afyonkarahisar', plaka: 3, x: 395, y: 260 },
  { ad: 'Ağrı', plaka: 4, x: 805, y: 200 },
  { ad: 'Amasya', plaka: 5, x: 565, y: 175 },
  { ad: 'Ankara', plaka: 6, x: 455, y: 215 },
  { ad: 'Antalya', plaka: 7, x: 400, y: 350 },
  { ad: 'Artvin', plaka: 8, x: 720, y: 120 },
  { ad: 'Aydın', plaka: 9, x: 305, y: 310 },
  { ad: 'Balıkesir', plaka: 10, x: 280, y: 185 },
  { ad: 'Bilecik', plaka: 11, x: 355, y: 195 },
  { ad: 'Bingöl', plaka: 12, x: 720, y: 235 },
  { ad: 'Bitlis', plaka: 13, x: 775, y: 240 },
  { ad: 'Bolu', plaka: 14, x: 415, y: 170 },
  { ad: 'Burdur', plaka: 15, x: 390, y: 310 },
  { ad: 'Bursa', plaka: 16, x: 320, y: 185 },
  { ad: 'Çanakkale', plaka: 17, x: 240, y: 175 },
  { ad: 'Çankırı', plaka: 18, x: 490, y: 175 },
  { ad: 'Çorum', plaka: 19, x: 530, y: 175 },
  { ad: 'Denizli', plaka: 20, x: 345, y: 300 },
  { ad: 'Diyarbakır', plaka: 21, x: 690, y: 270 },
  { ad: 'Edirne', plaka: 22, x: 185, y: 125 },
  { ad: 'Elazığ', plaka: 23, x: 665, y: 250 },
  { ad: 'Erzincan', plaka: 24, x: 680, y: 200 },
  { ad: 'Erzurum', plaka: 25, x: 740, y: 185 },
  { ad: 'Eskişehir', plaka: 26, x: 385, y: 215 },
  { ad: 'Gaziantep', plaka: 27, x: 615, y: 320 },
  { ad: 'Giresun', plaka: 28, x: 640, y: 145 },
  { ad: 'Gümüşhane', plaka: 29, x: 670, y: 155 },
  { ad: 'Hakkari', plaka: 30, x: 835, y: 270 },
  { ad: 'Hatay', plaka: 31, x: 590, y: 365 },
  { ad: 'Isparta', plaka: 32, x: 395, y: 290 },
  { ad: 'Mersin', plaka: 33, x: 520, y: 345 },
  { ad: 'İstanbul', plaka: 34, x: 280, y: 150 },
  { ad: 'İzmir', plaka: 35, x: 255, y: 260 },
  { ad: 'Kars', plaka: 36, x: 790, y: 165 },
  { ad: 'Kastamonu', plaka: 37, x: 490, y: 140 },
  { ad: 'Kayseri', plaka: 38, x: 555, y: 255 },
  { ad: 'Kırklareli', plaka: 39, x: 210, y: 115 },
  { ad: 'Kırşehir', plaka: 40, x: 510, y: 230 },
  { ad: 'Kocaeli', plaka: 41, x: 325, y: 165 },
  { ad: 'Konya', plaka: 42, x: 460, y: 290 },
  { ad: 'Kütahya', plaka: 43, x: 355, y: 225 },
  { ad: 'Malatya', plaka: 44, x: 640, y: 255 },
  { ad: 'Manisa', plaka: 45, x: 290, y: 255 },
  { ad: 'Kahramanmaraş', plaka: 46, x: 600, y: 290 },
  { ad: 'Mardin', plaka: 47, x: 720, y: 300 },
  { ad: 'Muğla', plaka: 48, x: 315, y: 340 },
  { ad: 'Muş', plaka: 49, x: 755, y: 230 },
  { ad: 'Nevşehir', plaka: 50, x: 530, y: 260 },
  { ad: 'Niğde', plaka: 51, x: 530, y: 285 },
  { ad: 'Ordu', plaka: 52, x: 610, y: 145 },
  { ad: 'Rize', plaka: 53, x: 695, y: 130 },
  { ad: 'Sakarya', plaka: 54, x: 345, y: 165 },
  { ad: 'Samsun', plaka: 55, x: 575, y: 140 },
  { ad: 'Siirt', plaka: 56, x: 745, y: 275 },
  { ad: 'Sinop', plaka: 57, x: 535, y: 120 },
  { ad: 'Sivas', plaka: 58, x: 610, y: 215 },
  { ad: 'Tekirdağ', plaka: 59, x: 225, y: 140 },
  { ad: 'Tokat', plaka: 60, x: 585, y: 185 },
  { ad: 'Trabzon', plaka: 61, x: 670, y: 135 },
  { ad: 'Tunceli', plaka: 62, x: 690, y: 230 },
  { ad: 'Şanlıurfa', plaka: 63, x: 660, y: 310 },
  { ad: 'Uşak', plaka: 64, x: 350, y: 260 },
  { ad: 'Van', plaka: 65, x: 810, y: 240 },
  { ad: 'Yozgat', plaka: 66, x: 530, y: 215 },
  { ad: 'Zonguldak', plaka: 67, x: 405, y: 140 },
  { ad: 'Aksaray', plaka: 68, x: 500, y: 270 },
  { ad: 'Bayburt', plaka: 69, x: 700, y: 165 },
  { ad: 'Karaman', plaka: 70, x: 475, y: 310 },
  { ad: 'Kırıkkale', plaka: 71, x: 485, y: 210 },
  { ad: 'Batman', plaka: 72, x: 730, y: 280 },
  { ad: 'Şırnak', plaka: 73, x: 775, y: 295 },
  { ad: 'Bartın', plaka: 74, x: 420, y: 130 },
  { ad: 'Ardahan', plaka: 75, x: 775, y: 145 },
  { ad: 'Iğdır', plaka: 76, x: 820, y: 185 },
  { ad: 'Yalova', plaka: 77, x: 305, y: 165 },
  { ad: 'Karabük', plaka: 78, x: 440, y: 145 },
  { ad: 'Kilis', plaka: 79, x: 620, y: 340 },
  { ad: 'Osmaniye', plaka: 80, x: 580, y: 330 },
  { ad: 'Düzce', plaka: 81, x: 390, y: 155 },
];

/**
 * İl adını normalize eder (büyük harfe çevirip Türkçe karakterleri standartlaştırır)
 * Karşılaştırma için kullanılır
 */
export function normalizeIlAdi(ad: string): string {
  return ad
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
}

/**
 * Veri setindeki şehir adını TURKIYE_ILLERI'ndeki karşılığıyla eşleştirir
 */
export function bulIl(sehirAdi: string): IlNokta | undefined {
  const normalized = normalizeIlAdi(sehirAdi);
  return TURKIYE_ILLERI.find((il) => normalizeIlAdi(il.ad) === normalized);
}
