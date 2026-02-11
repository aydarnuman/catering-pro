/**
 * Takip Defteri - Preset templates & AI prompt
 */

import { IconCash, IconCreditCard, IconReceipt } from '@tabler/icons-react';
import { createElement } from 'react';
import type { ColumnType } from './types';

export interface PresetDef {
  name: string;
  color: string;
  icon: React.ReactNode;
  description: string;
  columnDefs: Array<{ name: string; type: ColumnType; options?: string[] }>;
}

export const PRESETS: PresetDef[] = [
  {
    name: 'Borc Takibi',
    color: 'red',
    icon: createElement(IconCreditCard, { size: 20 }),
    description: 'Kisi, tutar, vade, durum',
    columnDefs: [
      { name: 'Kisi / Firma', type: 'text' },
      { name: 'Tutar', type: 'number' },
      { name: 'Vade', type: 'date' },
      { name: 'Durum', type: 'select', options: ['Odenmedi', 'Kismen', 'Odendi'] },
      { name: 'Not', type: 'text' },
    ],
  },
  {
    name: 'Gider Takibi',
    color: 'orange',
    icon: createElement(IconReceipt, { size: 20 }),
    description: 'Tarih, kalem, tutar, kategori',
    columnDefs: [
      { name: 'Tarih', type: 'date' },
      { name: 'Kalem', type: 'text' },
      { name: 'Tutar', type: 'number' },
      {
        name: 'Kategori',
        type: 'select',
        options: ['Malzeme', 'Personel', 'Kira', 'Enerji', 'Ulasim', 'Diger'],
      },
      { name: 'Not', type: 'text' },
    ],
  },
  {
    name: 'Gelir Takibi',
    color: 'teal',
    icon: createElement(IconCash, { size: 20 }),
    description: 'Tarih, kaynak, tutar, kategori',
    columnDefs: [
      { name: 'Tarih', type: 'date' },
      { name: 'Kaynak', type: 'text' },
      { name: 'Tutar', type: 'number' },
      { name: 'Kategori', type: 'select', options: ['Ihale', 'Ozel', 'Etkinlik', 'Diger'] },
      { name: 'Not', type: 'text' },
    ],
  },
];

/**
 * Adim 1: Kullanicinin ham girdisini anlamli bir tablo talebine cevir.
 * v0 tarzi: ne yazarsa yazsin, AI onu iyi bir istek haline getirir.
 */
export const AI_ENHANCE_PROMPT = `Sen bir tablo olusturma asistanisin. Kullanici asagidaki metni yazdi:

"{INPUT}"

Bu metin ne kadar belirsiz, kisa veya hatali olursa olsun, kullanicinin ne tur bir takip tablosu istedigini TAHMIN ET.
Sonra bunu net, detayli bir Turkce tablo talebine cevir.

Kurallar:
- Her zaman bir sonuc uret, asla "anlamadim" deme
- Kisa/belirsiz girdilerde en mantikli tablo turunu tahmin et (ornegin "para" -> "Gelir-Gider Takibi")
- Anlamsiz girdilerde (rastgele harfler, tek kelime) genel amacli bir takip tablosu oner
- Yaniti sadece tek satirlik temiz Turkce cumle olarak yaz
- Baska aciklama ekleme, sadece tablo talebini yaz

Ornekler:
- "jjnj" -> "Genel kayit ve takip tablosu: baslik, tarih, tutar, kategori, not"
- "para" -> "Gelir gider takip tablosu: tarih, aciklama, gelir tutari, gider tutari, bakiye"
- "borc" -> "Borc alacak takip tablosu: kisi, borc tutari, alacak tutari, vade tarihi, durum"
- "yemek" -> "Haftalik yemek menu planlama tablosu: gun, ogle yemegi, aksam yemegi, porsiyon, maliyet"
- "ahmet 500 tl" -> "Kisisel borc takip tablosu: kisi adi, borc tutari, odeme tarihi, durum"`;

/**
 * Adim 2: Zenginlestirilmis prompt'tan JSON tablo yapisi olustur.
 */
export const AI_PROMPT_TEMPLATE = `Kullanici su tabloyu istiyor: "{INPUT}"
JSON formatinda kolon listesi don. Her kolon icin "name" (Turkce) ve "type" ("text", "number", "date" veya "select") belirt.
Select tipindeki kolonlar icin "options" dizisi ekle.
Ayrica tablo icin bir "name" (Turkce) ve "color" (red, orange, teal, blue, violet, cyan, green veya gray) oner.
Sadece JSON don, baska aciklama ekleme. Markdown code fence kullanma.
Ornek: {"name":"Gider Takibi","color":"orange","columns":[{"name":"Tarih","type":"date"},{"name":"Kalem","type":"text"},{"name":"Tutar","type":"number"},{"name":"Durum","type":"select","options":["Odendi","Odenmedi"]}]}`;

export const AI_ANALYZE_PROMPT = `Asagidaki tablo verilerini analiz et ve Turkce olarak kisa bir ozet/degerlendirme yaz.
Tablo adi: {NAME}
Kolonlar: {COLUMNS}
Veri ({ROW_COUNT} satir):
{DATA}

Lütfen:
1. Genel ozet (2-3 cumle)
2. Onemli rakamlar (toplam, ortalama vb.)
3. Dikkat ceken noktalar veya oneriler
Kisa ve oz yaz.`;
