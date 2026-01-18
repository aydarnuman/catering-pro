import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Gemini ile döküman analizi
 * @param {string} text - Çıkarılmış metin
 * @param {string} filePath - Dosya yolu (görsel için)
 * @param {string} fileType - Dosya tipi
 * @returns {Promise<object>} - Analiz sonucu
 */
export async function analyzeWithGemini(text, filePath, fileType) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    });
    
    const prompt = `
Sen bir ihale dökümanı analiz uzmanısın. Aşağıdaki dökümanı analiz et ve şu bilgileri çıkar:

1. **İhale Başlığı**: İhalenin tam adı
2. **Kurum/Kuruluş**: İhaleyi açan kurum
3. **Şehir**: İhalenin yapılacağı şehir
4. **İhale Tarihi**: İhale tarihi ve saati
5. **Tahmini Bedel**: Yaklaşık maliyet
6. **İş Süresi**: Projenin süresi
7. **Teknik Şartname**: Önemli teknik gereksinimler
8. **Birim Fiyat Cetveli**: Varsa birim fiyatlar
9. **İletişim Bilgileri**: Telefon, email
10. **Önemli Notlar**: Dikkat edilmesi gereken hususlar

Lütfen JSON formatında yanıt ver:

\`\`\`json
{
  "title": "...",
  "organization": "...",
  "city": "...",
  "tender_date": "...",
  "estimated_cost": "...",
  "work_duration": "...",
  "technical_specs": ["...", "..."],
  "unit_prices": [],
  "contact": {
    "phone": "...",
    "email": "..."
  },
  "important_notes": ["...", "..."],
  "summary": "Kısa özet..."
}
\`\`\`

DÖKÜMAN METNİ:
${text}
    `.trim();
    
    console.log('🤖 Gemini API çağrısı yapılıyor...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisText = response.text();
    
    console.log('✅ Gemini analiz tamamlandı');
    
    // JSON çıkarmaya çalış
    try {
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      } else {
        // JSON tag'i yoksa tüm metni parse et
        return JSON.parse(analysisText);
      }
    } catch (parseError) {
      console.warn('JSON parse hatası, raw text döndürülüyor');
      return {
        raw_analysis: analysisText,
        parsed: false
      };
    }
    
  } catch (error) {
    console.error('Gemini analiz hatası:', error);
    throw error;
  }
}

/**
 * Gemini Vision ile görsel analiz (PDF rasterize için)
 */
export async function analyzeImageWithGemini(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });
    
    const imageData = await fs.promises.readFile(imagePath);
    const base64Image = imageData.toString('base64');
    
    const prompt = `
Bu görseldeki metni oku ve ihale bilgilerini çıkar. 
Özellikle tablolar, tarihler, fiyatlar ve kurum bilgilerini dikkatle incele.
JSON formatında yanıt ver.
    `.trim();
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    ]);
    
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error('Gemini Vision hatası:', error);
    throw error;
  }
}

/**
 * Şehir ismini normalize et (batch)
 */
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
    
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    });
    
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
    
    console.log('🤖 Gemini ambalaj parse çağrısı yapılıyor...');
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // JSON parse
    try {
      // JSON array'i bul
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Tek satır JSON'lar varsa
      const lines = text.split('\n').filter(l => l.trim().startsWith('{'));
      return lines.map(l => JSON.parse(l));
    } catch (parseError) {
      console.warn('Gemini JSON parse hatası:', parseError.message);
      return urunAdlari.map(() => ({ miktar: 1, birim: 'ADET', koli_adet: 1, toplam: 1 }));
    }
    
  } catch (error) {
    console.error('Gemini ambalaj parse hatası:', error);
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

    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp'
    });
    
    // Batch input hazırla
    const inputText = cityInputs.map((input, idx) => {
      return `${idx + 1}. Ham şehir: "${input.rawCity || ''}" | Kurum: "${input.organization || ''}" | Adres: "${input.address || ''}"`;
    }).join('\n');
    
    const turkishCities = [
      'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya',
      'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik',
      'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum',
      'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir',
      'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul',
      'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis',
      'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa',
      'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize',
      'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Şırnak', 'Sivas', 'Tekirdağ',
      'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
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
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Satırlara böl
    const lines = text.split('\n').map(line => {
      // Satır başındaki numara varsa temizle: "1. Ankara" -> "Ankara"
      return line.replace(/^\d+\.\s*/, '').trim();
    });
    
    // Boş satırları koruyarak array döndür
    return lines.map(city => city || null);
    
  } catch (error) {
    console.error('Şehir normalizasyon hatası:', error);
    // Fallback: raw değerleri döndür
    return cityInputs.map(input => 
      typeof input === 'string' ? input : (input.rawCity || null)
    );
  }
}
