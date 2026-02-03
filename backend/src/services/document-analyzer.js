/**
 * @deprecated Bu modül artık kullanılmıyor!
 * Yeni Pipeline v5.0 kullanın: ai-analyzer/pipeline/
 *
 * Bu dosya sadece menu-import.js için geçici olarak korunuyor.
 * İhale döküman analizi için: import { analyze } from './ai-analyzer/pipeline/analyzer.js'
 * 
 * Tüm analizler artık Claude ile yapılıyor.
 */

import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

/**
 * Claude ile döküman analizi
 * @param {string} text - Çıkarılmış metin
 * @param {string} filePath - Dosya yolu (kullanılmıyor)
 * @param {string} fileType - Dosya tipi
 * @returns {Promise<object>} - Analiz sonucu
 */
export async function analyzeDocument(text, _filePath, _fileType) {
  // Metin çok kısaysa analiz yapma
  if (!text || text.trim().length < 50) {
    return {
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      tam_metin: text || '',
    };
  }

  const prompt = `Sen bir YEMEK/CATERİNG ihale dökümanı analiz uzmanısın. Aşağıdaki dökümanı DİKKATLİCE analiz et.

## ARADIĞIN BİLGİLER:

### Temel Bilgiler:
- İhale başlığı
- Kurum/kuruluş adı
- Şehir
- İhale tarihi ve saati
- Tahmini bedel / yaklaşık maliyet
- İş süresi (gün/ay/yıl)

### Teknik Şartlar (ÖNEMLİ - HEPSİNİ BUL):
- Günlük öğün sayısı (kahvaltı, öğle, akşam)
- Kişi sayısı
- Gramaj bilgileri
- Menü çeşitleri ve rotasyonu
- Gıda güvenliği şartları (HACCP, ISO 22000, TSE)
- Personel sayısı ve nitelikleri
- Mutfak/ekipman gereksinimleri
- Teslimat saatleri ve koşulları
- Ambalaj ve sunum şartları

### Birim Fiyatlar (tablo varsa):
- Kalem adı
- Birim (kişi, porsiyon, kg, adet)
- Miktar
- Birim fiyat (varsa)

### Önemli Notlar ve Uyarılar:
- Ceza/yaptırım maddeleri
- Zorunlu belgeler
- Özel şartlar
- Dikkat edilmesi gereken hususlar
- Teminat bilgileri

### İletişim:
- Telefon
- E-posta
- Adres

## ÇIKTI FORMATI (JSON):

\`\`\`json
{
  "ihale_basligi": "...",
  "kurum": "...",
  "sehir": "...",
  "tarih": "...",
  "bedel": "...",
  "sure": "...",
  "teknik_sartlar": [
    "Günlük 3 öğün (kahvaltı, öğle, akşam) verilecektir",
    "Toplam 500 kişiye hizmet verilecektir",
    "..."
  ],
  "birim_fiyatlar": [
    {"kalem": "Kahvaltı", "birim": "kişi/gün", "miktar": "500", "fiyat": ""},
    {"kalem": "Öğle Yemeği", "birim": "kişi/gün", "miktar": "500", "fiyat": ""}
  ],
  "notlar": [
    "HACCP belgesi zorunludur",
    "Gecikme halinde günlük %1 ceza uygulanır",
    "..."
  ],
  "iletisim": {
    "telefon": "...",
    "email": "...",
    "adres": "..."
  },
  "tam_metin": "Dökümanın özet metni (max 2000 karakter)..."
}
\`\`\`

## KURALLAR:
1. Dökümanı BAŞTAN SONA oku, hiçbir bilgiyi atlama
2. Teknik şartları AYRINTILI çıkar
3. Sayısal değerleri (kişi sayısı, gramaj, süre) mutlaka belirt
4. Birim fiyat tablosu varsa HER KALEMİ ekle
5. Ceza maddeleri ve zorunlu belgeleri NOTLAR'a ekle
6. Emin olmadığın bilgileri "Belirtilmemiş" olarak yaz
7. JSON formatı BOZMA

DÖKÜMAN METNİ:
${text.substring(0, 100000)}
`.trim();

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const analysisText = response.content[0]?.text || '';

  // JSON çıkarmaya çalış
  try {
    const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      // Frontend ile uyumluluk için alan eşleştirmesi
      return {
        ...parsed,
        // Eski format desteği (backend birleştirme için)
        technical_specs: parsed.teknik_sartlar,
        important_notes: parsed.notlar,
        unit_prices: parsed.birim_fiyatlar,
      };
    } else {
      // JSON tag'i yoksa tüm metni parse et
      const parsed = JSON.parse(analysisText);
      return {
        ...parsed,
        technical_specs: parsed.teknik_sartlar,
        important_notes: parsed.notlar,
        unit_prices: parsed.birim_fiyatlar,
      };
    }
  } catch (_parseError) {
    return {
      raw_analysis: analysisText,
      parsed: false,
      teknik_sartlar: [],
      birim_fiyatlar: [],
      notlar: [],
      tam_metin: text.substring(0, 2000),
    };
  }
}

/**
 * Claude Vision ile görsel analiz
 */
export async function analyzeImageWithClaude(imagePath) {
  const imageData = await fs.promises.readFile(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = imagePath.toLowerCase();
  const mimeType = ext.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `
Bu görseldeki metni oku ve ihale bilgilerini çıkar. 
Özellikle tablolar, tarihler, fiyatlar ve kurum bilgilerini dikkatle incele.
JSON formatında yanıt ver.
    `.trim();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.content[0]?.text || '';
}

// Backward compatibility - eski isimle de export et
export const analyzeImageWithGemini = analyzeImageWithClaude;

/**
 * Ürün adından ambalaj bilgisi parse et
 * @param {string|string[]} urunAdlari - Ürün adı veya adları
 * @returns {Promise<Array<{miktar: number, birim: string, koli_adet: number}>>}
 */
export async function parseAmbalajWithAI(urunAdlari) {
  try {
    // Tek string gelirse array'e çevir
    if (typeof urunAdlari === 'string') {
      urunAdlari = [urunAdlari];
    }

    const inputText = urunAdlari.map((ad, idx) => `${idx + 1}. ${ad}`).join('\n');

    const prompt = `
Sen bir ürün ambalaj bilgisi çıkarma uzmanısın.
Aşağıdaki ürün adlarından ambalaj miktarı, birim ve koli adedini çıkar.

KURALLAR:
1. Miktar ve birim bul: "5 KG", "500 GR", "1,5 LT", "200 ML" gibi
2. Koli/paket adedi bul: "*4", "x24", "(1*4)", "24'lü" gibi
3. GR → KG'a çevir (500 GR = 0.5 KG)
4. ML → LT'ye çevir (200 ML = 0.2 LT)
5. Toplam miktarı hesapla: miktar × koli_adet
6. Birim bulunamazsa "ADET" yaz
7. Her satır için JSON döndür

ÖRNEKLER:
- "ÖNCÜ BİBER SALÇASI 5 KG (1*4)" → {"miktar": 5, "birim": "KG", "koli_adet": 4, "toplam": 20}
- "SANA MARGARİN 200 GR*24" → {"miktar": 0.2, "birim": "KG", "koli_adet": 24, "toplam": 4.8}
- "COLA TURKA 0,2LTx24" → {"miktar": 0.2, "birim": "LT", "koli_adet": 24, "toplam": 4.8}
- "Karton Bardak 3000 Li" → {"miktar": 3000, "birim": "ADET", "koli_adet": 1, "toplam": 3000}
- "PIRINC BALDO 25 KG" → {"miktar": 25, "birim": "KG", "koli_adet": 1, "toplam": 25}

ÜRÜNLER:
${inputText}

YANIT (sadece JSON array, başka açıklama yok):`.trim();

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0]?.text || '').trim();

    // JSON parse
    try {
      // JSON array'i bul
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Tek satır JSON'lar varsa
      const lines = text.split('\n').filter((l) => l.trim().startsWith('{'));
      return lines.map((l) => JSON.parse(l));
    } catch (_parseError) {
      return urunAdlari.map(() => ({ miktar: 1, birim: 'ADET', koli_adet: 1, toplam: 1 }));
    }
  } catch (_error) {
    return urunAdlari.map(() => ({ miktar: 1, birim: 'ADET', koli_adet: 1, toplam: 1 }));
  }
}

/**
 * Şehir ismini normalize et (batch)
 */
export async function normalizeCity(cityInputs) {
  try {
    // cityInputs: [{ rawCity, organization, address }, ...]

    // Eğer tek bir string gelirse array'e çevir
    if (typeof cityInputs === 'string') {
      cityInputs = [{ rawCity: cityInputs }];
    }

    // Eğer array değilse array'e çevir
    if (!Array.isArray(cityInputs)) {
      cityInputs = [cityInputs];
    }

    // Batch input hazırla
    const inputText = cityInputs
      .map((input, idx) => {
        return `${idx + 1}. Ham şehir: "${input.rawCity || ''}" | Kurum: "${input.organization || ''}" | Adres: "${input.address || ''}"`;
      })
      .join('\n');

    const turkishCities = [
      'Adana',
      'Adıyaman',
      'Afyonkarahisar',
      'Ağrı',
      'Aksaray',
      'Amasya',
      'Ankara',
      'Antalya',
      'Ardahan',
      'Artvin',
      'Aydın',
      'Balıkesir',
      'Bartın',
      'Batman',
      'Bayburt',
      'Bilecik',
      'Bingöl',
      'Bitlis',
      'Bolu',
      'Burdur',
      'Bursa',
      'Çanakkale',
      'Çankırı',
      'Çorum',
      'Denizli',
      'Diyarbakır',
      'Düzce',
      'Edirne',
      'Elazığ',
      'Erzincan',
      'Erzurum',
      'Eskişehir',
      'Gaziantep',
      'Giresun',
      'Gümüşhane',
      'Hakkari',
      'Hatay',
      'Iğdır',
      'Isparta',
      'İstanbul',
      'İzmir',
      'Kahramanmaraş',
      'Karabük',
      'Karaman',
      'Kars',
      'Kastamonu',
      'Kayseri',
      'Kilis',
      'Kırıkkale',
      'Kırklareli',
      'Kırşehir',
      'Kocaeli',
      'Konya',
      'Kütahya',
      'Malatya',
      'Manisa',
      'Mardin',
      'Mersin',
      'Muğla',
      'Muş',
      'Nevşehir',
      'Niğde',
      'Ordu',
      'Osmaniye',
      'Rize',
      'Sakarya',
      'Samsun',
      'Şanlıurfa',
      'Siirt',
      'Sinop',
      'Şırnak',
      'Sivas',
      'Tekirdağ',
      'Tokat',
      'Trabzon',
      'Tunceli',
      'Uşak',
      'Van',
      'Yalova',
      'Yozgat',
      'Zonguldak',
    ];

    const prompt = `
Sen bir Türkiye şehir ismi temizleme asistanısın.
Aşağıdaki verilerden şehir ismini çıkar ve standart Türkiye il adı formatında döndür.

Türkiye'nin 81 ili:
${turkishCities.join(', ')}

KURALLAR:
1. Sadece yukarıdaki 81 il adından birini döndür
2. Doğru Türkçe karakterleri kullan (ş, ğ, ü, ö, ç, ı, İ)
3. İlk harfi büyük, diğerleri küçük (örnek: İstanbul, Ankara)
4. Eğer şehir bulunamazsa boş satır bırak
5. Her satırda sadece bir şehir adı olsun (başka açıklama yapma)
6. Kurum adı ve adres bilgisinden de yararlan

VERİLER:
${inputText}

YANIT (her satırda bir şehir):`.trim();

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (response.content[0]?.text || '').trim();

    // Satırlara böl
    const lines = text.split('\n').map((line) => {
      // Satır başındaki numara varsa temizle: "1. Ankara" -> "Ankara"
      return line.replace(/^\d+\.\s*/, '').trim();
    });

    // Boş satırları koruyarak array döndür
    return lines.map((city) => city || null);
  } catch (_error) {
    // Fallback: raw değerleri döndür
    return cityInputs.map((input) => (typeof input === 'string' ? input : input.rawCity || null));
  }
}

// Backward compatibility - eski isimle de export et
export { analyzeDocument as analyzeWithGemini };
