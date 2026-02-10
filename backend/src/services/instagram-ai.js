import fs from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';

/**
 * Görsel dosyasını Claude için hazırla
 * @param {string} filePath - Dosya yolu
 * @param {string} mimeType - MIME tipi
 * @returns {object} - Claude formatında görsel
 */
function fileToImageBlock(filePath, mimeType) {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType,
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
    },
  };
}

/**
 * Buffer'dan Claude için görsel hazırla
 * @param {Buffer} buffer - Görsel buffer
 * @param {string} mimeType - MIME tipi
 * @returns {object} - Claude formatında görsel
 */
function bufferToImageBlock(buffer, mimeType) {
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: mimeType,
      data: buffer.toString('base64'),
    },
  };
}

/**
 * Claude ile analiz yap (helper)
 */
async function analyzeWithClaude(prompt, imageBlock = null) {
  const content = imageBlock ? [imageBlock, { type: 'text', text: prompt }] : [{ type: 'text', text: prompt }];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  });

  return response.content[0]?.text || '';
}

/**
 * JSON parse helper
 */
function parseJsonResponse(text) {
  let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    jsonMatch = text.match(/\{[\s\S]*\}/);
  }

  if (jsonMatch) {
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  }
  throw new Error('JSON parse hatası');
}

/**
 * Yemek görselinden Instagram caption üret
 * @param {Buffer|string} imageData - Görsel buffer veya dosya yolu
 * @param {string} mimeType - MIME tipi (image/jpeg, image/png vb.)
 * @param {object} options - Ek seçenekler
 * @returns {Promise<object>} - Caption ve hashtag önerileri
 */
export async function generateInstagramCaption(imageData, mimeType, options = {}) {
  try {
    // Görsel verisi hazırla
    let imageBlock;
    if (Buffer.isBuffer(imageData)) {
      imageBlock = bufferToImageBlock(imageData, mimeType);
    } else if (typeof imageData === 'string' && fs.existsSync(imageData)) {
      imageBlock = fileToImageBlock(imageData, mimeType);
    } else {
      throw new Error('Geçersiz görsel verisi');
    }

    const {
      style = 'professional', // professional, casual, fun
      includeEmoji = true,
      includeHashtags = true,
      businessName = 'Degsan Yemek',
      businessType = 'catering',
    } = options;

    const styleGuide = {
      professional: 'Profesyonel, kurumsal ve güven veren bir dil kullan.',
      casual: 'Samimi, sıcak ve arkadaşça bir dil kullan.',
      fun: 'Eğlenceli, enerjik ve dikkat çekici bir dil kullan.',
    };

    const prompt = `Sen bir profesyonel sosyal medya içerik uzmanısın. ${businessName} adlı ${businessType} firması için Instagram paylaşımı hazırlıyorsun.

## GÖREV
Bu yemek/catering görselini analiz et ve Instagram için mükemmel bir paylaşım içeriği oluştur.

## GÖRSEL ANALİZİ YAP:
1. Görseldeki yemeği/yemekleri tanımla
2. Sunum kalitesini değerlendir
3. Renk ve görsel çekiciliği not et
4. Ortamı tanımla (mutfak, servis, organizasyon vb.)

## İÇERİK KURALLARI:
- Dil: Türkçe
- Stil: ${styleGuide[style]}
- Emoji: ${includeEmoji ? 'Uygun emojiler kullan (2-4 adet)' : 'Emoji kullanma'}
- Uzunluk: 2-3 cümle (kısa ve öz)
- Hedef: Etkileşim ve güven oluşturma

## HASHTAG KURALLARI (${includeHashtags ? 'Dahil et' : 'Dahil etme'}):
- Türkçe ve sektöre özel hashtagler
- 8-12 adet hashtag
- Popüler + niş karışımı
- Şehir etiketi ekle (ankara)

## JSON ÇIKTI FORMATI:
\`\`\`json
{
  "yemek_analizi": {
    "tespit_edilen_yemekler": ["..."],
    "sunum_puani": 1-10,
    "ortam": "...",
    "oneriler": ["..."]
  },
  "caption": "...",
  "caption_alternatifleri": ["...", "..."],
  "hashtagler": ["...", "..."],
  "en_iyi_paylasim_saati": "...",
  "hedef_kitle": "..."
}
\`\`\`

ÖNEMLİ: Sadece JSON formatında yanıt ver, başka açıklama ekleme.`;

    const text = await analyzeWithClaude(prompt, imageBlock);
    const parsed = parseJsonResponse(text);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Hashtag önerileri üret
 * @param {string} caption - Mevcut caption
 * @param {object} options - Seçenekler
 * @returns {Promise<object>} - Hashtag önerileri
 */
export async function generateHashtags(caption, options = {}) {
  try {
    const { count = 12, city = 'ankara', businessType = 'catering' } = options;

    const prompt = `Sen bir Instagram hashtag uzmanısın. Aşağıdaki catering/yemek paylaşımı için en etkili hashtagleri öner.

CAPTION: "${caption}"

KURALLAR:
- ${count} adet hashtag öner
- Türkçe hashtagler kullan
- Sektör: ${businessType}
- Şehir: ${city}
- Popüler + niş hashtag karışımı
- Engagement artıran hashtagler

JSON FORMATI:
\`\`\`json
{
  "hashtagler": ["hashtag1", "hashtag2", ...],
  "kategoriler": {
    "populer": ["..."],
    "sektorel": ["..."],
    "lokasyon": ["..."],
    "trend": ["..."]
  },
  "kullanim_orani": {
    "hashtag1": "yüksek/orta/düşük",
    ...
  }
}
\`\`\``;

    const text = await analyzeWithClaude(prompt);
    const parsed = parseJsonResponse(text);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * DM mesajı analiz et ve otomatik yanıt öner
 * @param {string} message - Gelen mesaj
 * @param {object} context - Firma bilgileri
 * @returns {Promise<object>} - Önerilen yanıt
 */
export async function analyzeDMAndSuggestReply(message, context = {}) {
  try {
    const {
      businessName = 'Degsan Yemek',
      businessType = 'catering',
      phone = '0312 XXX XX XX',
      services = ['kurumsal yemek', 'organizasyon', 'tabldot', 'düğün catering'],
    } = context;

    const prompt = `Sen ${businessName} firmasının müşteri hizmetleri asistanısın. Gelen Instagram DM mesajını analiz et ve uygun yanıt öner.

GELEN MESAJ: "${message}"

FİRMA BİLGİLERİ:
- İsim: ${businessName}
- Sektör: ${businessType}
- Telefon: ${phone}
- Hizmetler: ${services.join(', ')}

ANALİZ ET:
1. Mesajın amacı (fiyat sorma, bilgi alma, şikayet, teşekkür, sipariş, vb.)
2. Aciliyet seviyesi
3. Müşteri duygu durumu

YANITLAMA KURALLARI:
- Profesyonel ama samimi ol
- Türkçe yanıt ver
- Kısa ve öz ol (1-3 cümle)
- Gerekirse telefon numarası ver
- Emojileri ölçülü kullan

JSON FORMATI:
\`\`\`json
{
  "analiz": {
    "mesaj_amaci": "...",
    "aciliyet": "düşük/orta/yüksek",
    "duygu": "pozitif/nötr/negatif",
    "anahtar_kelimeler": ["..."]
  },
  "onerilen_yanit": "...",
  "alternatif_yanitlar": ["...", "..."],
  "aksiyon_gerekli": true/false,
  "aksiyon_detay": "..."
}
\`\`\``;

    const text = await analyzeWithClaude(prompt);
    const parsed = parseJsonResponse(text);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Günlük menüden Instagram içeriği oluştur
 * @param {object} menu - Menü bilgileri
 * @param {object} options - Seçenekler
 * @returns {Promise<object>} - Post içeriği
 */
export async function generateMenuPost(menu, options = {}) {
  try {
    const {
      businessName = 'Degsan Yemek',
      date = new Date().toLocaleDateString('tr-TR'),
      includePrice = false,
    } = options;

    const menuText = Array.isArray(menu)
      ? menu.map((item) => `- ${item.name}${item.price ? ` (${item.price}₺)` : ''}`).join('\n')
      : JSON.stringify(menu, null, 2);

    const prompt = `${businessName} firması için günlük menü Instagram paylaşımı hazırla.

TARİH: ${date}

MENÜ:
${menuText}

KURALLAR:
- Çekici ve iştah açıcı bir dil kullan
- Emojiler ekle
- ${includePrice ? 'Fiyatları belirt' : 'Fiyat yazma'}
- Kısa ve öz ol
- Günün temasına uygun ol (Pazartesi motivasyonu, Cuma neşesi vb.)

JSON FORMATI:
\`\`\`json
{
  "caption": "...",
  "hashtagler": ["..."],
  "en_iyi_paylasim_saati": "...",
  "hikaye_metni": "..."
}
\`\`\``;

    const text = await analyzeWithClaude(prompt);
    const parsed = parseJsonResponse(text);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * AI ile görsel üretimi için prompt oluştur
 * @param {string} description - Kullanıcı açıklaması
 * @param {object} options - Seçenekler
 * @returns {Promise<object>} - Optimize edilmiş prompt
 */
export async function generateImagePrompt(description, options = {}) {
  try {
    const {
      style = 'professional', // professional, rustic, modern, minimalist
      type = 'food', // food, menu, promo
    } = options;

    const styleGuides = {
      professional: 'stüdyo ışığında, profesyonel fotoğraf, yüksek kalite, keskin detaylar',
      rustic: 'rustik ahşap masa, doğal ışık, ev yapımı his, sıcak tonlar',
      modern: 'minimalist sunum, beyaz tabak, geometrik düzen, şık',
      minimalist: 'sade arka plan, tek renk, negatif alan, temiz',
    };

    const prompt = `Sen bir profesyonel yemek fotoğrafçısısın. Aşağıdaki açıklama için DALL-E/Stable Diffusion'a verilecek İNGİLİZCE bir görsel prompt oluştur.

KULLANICI AÇIKLAMASI: "${description}"

GÖRSEL STİLİ: ${styleGuides[style]}
GÖRSEL TİPİ: ${type}

PROMPT KURALLARI:
- İngilizce yaz
- Yemek fotoğrafçılığı terimleri kullan
- Işık, açı, kompozisyon belirt
- Negatif prompt da öner
- Maksimum 200 kelime

JSON FORMATI:
\`\`\`json
{
  "prompt": "...",
  "negative_prompt": "...",
  "suggested_style": "...",
  "suggested_aspect_ratio": "1:1 / 4:5 / 16:9"
}
\`\`\``;

    const text = await analyzeWithClaude(prompt);
    const parsed = parseJsonResponse(text);

    return {
      success: true,
      ...parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Replicate (Flux) ile görsel üret
 * @param {string} prompt - Görsel prompt
 * @param {object} options - Seçenekler
 * @returns {Promise<object>} - Üretilen görsel
 */
export async function generateImageWithReplicate(prompt, options = {}) {
  try {
    const apiKey = process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return {
        success: false,
        error:
          'REPLICATE_API_TOKEN tanımlı değil. .env dosyasına ekleyin. https://replicate.com/account/api-tokens adresinden alın.',
      };
    }

    const {
      model = 'flux-schnell', // flux-schnell (hızlı, ucuz) veya flux-dev (kaliteli)
      aspectRatio = '1:1',
      numOutputs = 1,
    } = options;

    // Model endpoint'leri (yeni API formatı)
    const modelEndpoints = {
      'flux-schnell': 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      'flux-dev': 'https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions',
    };

    const endpoint = modelEndpoints[model] || modelEndpoints['flux-schnell'];

    // Replicate API - Prediction oluştur (yeni format)
    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Prefer: 'wait', // Sonucu bekle (webhook yerine)
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          aspect_ratio: aspectRatio,
          num_outputs: numOutputs,
          output_format: 'webp',
          output_quality: 90,
          go_fast: true, // Hızlı mod
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let errorMsg = `Replicate API hatası: ${createResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = `Replicate API hatası: ${errorData.detail || errorData.error || errorText}`;
      } catch {
        errorMsg = `Replicate API hatası: ${errorText}`;
      }
      throw new Error(errorMsg);
    }

    let result = await createResponse.json();

    // Eğer henüz tamamlanmadıysa polling yap
    let attempts = 0;
    const maxAttempts = 120; // 120 saniye timeout

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 saniye bekle

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      result = await statusResponse.json();
      attempts++;
    }

    if (result.status === 'failed') {
      throw new Error(`Görsel üretimi başarısız: ${result.error || 'Bilinmeyen hata'}`);
    }

    if (result.status !== 'succeeded') {
      throw new Error('Görsel üretimi zaman aşımına uğradı');
    }

    // Sonuç URL'lerini al
    const outputUrls = result.output;
    const imageUrl = Array.isArray(outputUrls) ? outputUrls[0] : outputUrls;

    if (!imageUrl) {
      throw new Error('Görsel URL alınamadı');
    }

    // Görseli indir ve base64'e çevir
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');

    return {
      success: true,
      image: base64Image,
      imageUrl: imageUrl,
      format: 'webp',
      dataUrl: `data:image/webp;base64,${base64Image}`,
      model: model,
      predictionId: result.id,
      metrics: result.metrics, // Süre bilgisi
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Eski isimle de erişilebilir olsun (backward compatibility)
export const generateImageWithStability = generateImageWithReplicate;

/**
 * Menü kartı görsel şablonu oluştur (HTML → Canvas)
 * @param {object} menu - Menü bilgileri
 * @param {object} options - Şablon seçenekleri
 * @returns {Promise<object>} - HTML şablonu
 */
export async function generateMenuCardTemplate(menu, options = {}) {
  try {
    const {
      template = 'modern', // modern, classic, minimal, story
      businessName = 'Degsan Yemek',
      date = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
      primaryColor = '#E4405F',
      secondaryColor = '#833AB4',
    } = options;

    const menuItems = Array.isArray(menu) ? menu : Object.values(menu);

    const templates = {
      modern: `
        <div style="width: 1080px; height: 1080px; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); padding: 60px; font-family: 'Segoe UI', sans-serif; color: white; position: relative;">
          <div style="position: absolute; top: 40px; right: 40px; font-size: 18px; opacity: 0.9;">${date}</div>
          <h1 style="font-size: 48px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 3px;">📅 Günün Menüsü</h1>
          <h2 style="font-size: 28px; font-weight: 300; margin-bottom: 40px; opacity: 0.9;">${businessName}</h2>
          <div style="background: rgba(255,255,255,0.15); border-radius: 20px; padding: 40px; backdrop-filter: blur(10px);">
            ${menuItems
              .map(
                (item, i) => `
              <div style="display: flex; align-items: center; margin-bottom: 25px; ${i < menuItems.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 20px;' : ''}">
                <span style="font-size: 36px; margin-right: 20px;">${item.emoji || '🍽️'}</span>
                <span style="font-size: 28px; flex: 1;">${item.name || item}</span>
                ${item.price ? `<span style="font-size: 24px; opacity: 0.8;">${item.price}₺</span>` : ''}
              </div>
            `
              )
              .join('')}
          </div>
          <div style="position: absolute; bottom: 40px; left: 60px; right: 60px; display: flex; justify-content: space-between; align-items: center; opacity: 0.8;">
            <span>☎️ İletişim için DM</span>
            <span>🏷️ #${businessName.replace(/\s/g, '').toLowerCase()}</span>
          </div>
        </div>
      `,
      classic: `
        <div style="width: 1080px; height: 1080px; background: #FFF8E7; padding: 60px; font-family: Georgia, serif; color: #4A3728; position: relative; border: 20px solid #D4A574;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 42px; color: #8B4513; margin-bottom: 10px;">✨ ${businessName} ✨</h1>
            <p style="font-size: 20px; font-style: italic;">${date}</p>
            <hr style="border: none; border-top: 2px solid #D4A574; width: 200px; margin: 20px auto;">
          </div>
          <h2 style="text-align: center; font-size: 32px; margin-bottom: 30px;">Günün Menüsü</h2>
          ${menuItems
            .map(
              (item) => `
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 24px;">${item.emoji || '◆'} ${item.name || item}</span>
              ${item.price ? `<span style="display: block; font-size: 18px; color: #8B4513;">${item.price}₺</span>` : ''}
            </div>
          `
            )
            .join('')}
          <div style="position: absolute; bottom: 40px; left: 0; right: 0; text-align: center; font-size: 16px; color: #8B4513;">
            Afiyet olsun! 🙏
          </div>
        </div>
      `,
      minimal: `
        <div style="width: 1080px; height: 1080px; background: #FFFFFF; padding: 80px; font-family: 'Helvetica Neue', sans-serif; color: #333;">
          <div style="border-left: 4px solid ${primaryColor}; padding-left: 30px; margin-bottom: 50px;">
            <h1 style="font-size: 36px; font-weight: 300; margin: 0;">Günün Menüsü</h1>
            <p style="font-size: 16px; color: #999; margin-top: 10px;">${date}</p>
          </div>
          ${menuItems
            .map(
              (item) => `
            <div style="margin-bottom: 30px;">
              <span style="font-size: 28px; font-weight: 300;">${item.name || item}</span>
              ${item.price ? `<span style="float: right; font-size: 24px; color: ${primaryColor};">${item.price}₺</span>` : ''}
            </div>
          `
            )
            .join('')}
          <div style="position: absolute; bottom: 60px; left: 80px;">
            <span style="font-size: 20px; font-weight: 600; color: ${primaryColor};">${businessName}</span>
          </div>
        </div>
      `,
      story: `
        <div style="width: 1080px; height: 1920px; background: linear-gradient(180deg, ${primaryColor}, ${secondaryColor}); padding: 80px 60px; font-family: 'Segoe UI', sans-serif; color: white; position: relative;">
          <div style="text-align: center; margin-top: 100px;">
            <h1 style="font-size: 48px; margin-bottom: 20px;">🍽️</h1>
            <h2 style="font-size: 36px; text-transform: uppercase; letter-spacing: 5px;">Günün Menüsü</h2>
            <p style="font-size: 20px; opacity: 0.8; margin-top: 10px;">${date}</p>
          </div>
          <div style="margin-top: 100px;">
            ${menuItems
              .map(
                (item, i) => `
              <div style="text-align: center; margin-bottom: 50px; animation: fadeIn ${0.5 + i * 0.2}s;">
                <span style="font-size: 42px;">${item.emoji || '🍴'}</span>
                <p style="font-size: 32px; margin-top: 15px;">${item.name || item}</p>
              </div>
            `
              )
              .join('')}
          </div>
          <div style="position: absolute; bottom: 150px; left: 0; right: 0; text-align: center;">
            <p style="font-size: 24px; opacity: 0.9;">⬆️ Yukarı kaydır</p>
            <p style="font-size: 18px; opacity: 0.7; margin-top: 10px;">Sipariş için DM</p>
          </div>
          <div style="position: absolute; bottom: 60px; left: 0; right: 0; text-align: center; font-size: 20px; font-weight: 600;">
            ${businessName}
          </div>
        </div>
      `,
    };

    return {
      success: true,
      html: templates[template] || templates.modern,
      template,
      dimensions: template === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  generateInstagramCaption,
  generateHashtags,
  analyzeDMAndSuggestReply,
  generateMenuPost,
  generateImagePrompt,
  generateImageWithReplicate,
  generateImageWithStability, // alias
  generateMenuCardTemplate,
};
