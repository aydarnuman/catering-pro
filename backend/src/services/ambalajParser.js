/**
 * Akıllı Ambalaj Miktarı Parse Servisi
 *
 * Ürün adından ambalaj miktarını otomatik çıkarır.
 * 1. Önce Regex ile dener (hızlı, ücretsiz)
 * 2. Başarısız olursa AI'a sorar (akıllı)
 */

import Anthropic from '@anthropic-ai/sdk';

// Regex pattern'leri
const PATTERNS = {
  // "25 KG", "25KG", "25 Kg"
  kg: /(\d+[,.]?\d*)\s*kg/i,
  // "5 L", "5L", "5 LT", "5 LİTRE"
  litre: /(\d+[,.]?\d*)\s*(l|lt|litre)/i,
  // "500 GR", "500G", "500 GRAM"
  gram: /(\d+[,.]?\d*)\s*(gr|g|gram)/i,
  // "200 ML"
  ml: /(\d+[,.]?\d*)\s*ml/i,
  // "*24", "x24", "(1*4)", "*6"
  multiplier: /[*xX]\s*(\d+)/,
  // "(1*4)" veya "1*4" pattern - parantez içi çarpım
  parenMultiplier: /\(?\s*(\d+)\s*[*xX]\s*(\d+)\s*\)?/,
  // "195X15", "160X15" format (cips/atıştırmalık paketleri) - son sayı adet
  packageFormat: /(\d+)\s*[xX]\s*(\d+)\s*(?:\(|$|\s)/,
  // "30'LU", "24'LÜ" format
  luFormat: /(\d+)\s*['´`]?\s*l[uüı]/i,
  // "3000 Li", "1000 Lİ" format
  liFormat: /(\d+)\s*l[iİ]/i,
};

// Varsayılan birimler (ürün tipine göre)
const DEFAULT_UNITS = {
  yumurta: { amount: 30, unit: 'ADET', explanation: '30lu viol varsayılan' },
  patates: { amount: 1, unit: 'KG', explanation: 'KG bazlı sebze', isDefault: true },
  lahana: { amount: 1, unit: 'KG', explanation: 'KG bazlı sebze', isDefault: true },
  turp: { amount: 1, unit: 'KG', explanation: 'KG bazlı sebze', isDefault: true },
  limon: { amount: 1, unit: 'KG', explanation: 'KG bazlı meyve', isDefault: true },
  bonfile: { amount: 1, unit: 'KG', explanation: 'KG bazlı et', isDefault: true },
  pilic: { amount: 1, unit: 'KG', explanation: 'KG bazlı et', isDefault: true },
  piliç: { amount: 1, unit: 'KG', explanation: 'KG bazlı et', isDefault: true },
  tavuk: { amount: 1, unit: 'KG', explanation: 'KG bazlı et', isDefault: true },
  eldiven: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
  peçete: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
  paspas: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
  streç: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
  kağıt: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
  kese: { amount: 1, unit: 'ADET', explanation: 'Adet bazlı', isDefault: true },
};

/**
 * Regex ile ambalaj miktarını parse et
 * @param {string} productName - Ürün adı
 * @returns {object} { success, amount, unit, confidence, method }
 */
export function parseWithRegex(productName) {
  if (!productName) return { success: false };

  const name = productName.toUpperCase();
  const nameLower = productName.toLowerCase();
  let amount = null;
  let unit = 'KG'; // Varsayılan birim
  let multiplier = 1;
  const _explanation = '';

  // 1. Önce varsayılan birim kontrolü (yumurta, sebze, et vb.)
  for (const [keyword, defaults] of Object.entries(DEFAULT_UNITS)) {
    if (nameLower.includes(keyword)) {
      // Eğer üründe başka miktar bilgisi yoksa varsayılanı kullan
      const hasAmount =
        PATTERNS.kg.test(name) || PATTERNS.gram.test(name) || PATTERNS.litre.test(name) || PATTERNS.ml.test(name);
      if (!hasAmount) {
        return {
          success: true,
          amount: defaults.amount,
          unit: defaults.unit,
          confidence: 0.7,
          method: 'regex-default',
          explanation: defaults.explanation,
        };
      }
    }
  }

  // 2. "30'LU", "24'LÜ" format kontrolü
  const luMatch = name.match(PATTERNS.luFormat);
  if (luMatch) {
    return {
      success: true,
      amount: parseInt(luMatch[1], 10),
      unit: 'ADET',
      confidence: 0.9,
      method: 'regex',
      explanation: `${luMatch[1]}'li paket`,
    };
  }

  // 3. "3000 Li" format kontrolü
  const liMatch = name.match(PATTERNS.liFormat);
  if (liMatch) {
    return {
      success: true,
      amount: parseInt(liMatch[1], 10),
      unit: 'ADET',
      confidence: 0.9,
      method: 'regex',
      explanation: `${liMatch[1]} adetlik paket`,
    };
  }

  // 4. "195X15" format kontrolü (cips paketleri)
  const pkgMatch = name.match(PATTERNS.packageFormat);
  if (pkgMatch) {
    const adet = parseInt(pkgMatch[2], 10);
    return {
      success: true,
      amount: adet,
      unit: 'ADET',
      confidence: 0.85,
      method: 'regex',
      explanation: `${adet} adetlik koli`,
    };
  }

  // 5. Çarpan kontrolü (örn: "*6", "1*4")
  const parenMatch = name.match(PATTERNS.parenMultiplier);
  if (parenMatch) {
    multiplier = parseInt(parenMatch[2], 10);
  } else {
    const multMatch = name.match(PATTERNS.multiplier);
    if (multMatch) {
      multiplier = parseInt(multMatch[1], 10);
    }
  }

  // 6. KG kontrolü
  const kgMatch = name.match(PATTERNS.kg);
  if (kgMatch) {
    amount = parseFloat(kgMatch[1].replace(',', '.'));
    unit = 'KG';
  }

  // 7. Litre kontrolü
  if (!amount) {
    const ltMatch = name.match(PATTERNS.litre);
    if (ltMatch) {
      amount = parseFloat(ltMatch[1].replace(',', '.'));
      unit = 'L';
    }
  }

  // 8. Gram kontrolü (KG'a çevir)
  if (!amount) {
    const grMatch = name.match(PATTERNS.gram);
    if (grMatch) {
      amount = parseFloat(grMatch[1].replace(',', '.')) / 1000;
      unit = 'KG';
    }
  }

  // 9. ML kontrolü (Litreye çevir)
  if (!amount) {
    const mlMatch = name.match(PATTERNS.ml);
    if (mlMatch) {
      amount = parseFloat(mlMatch[1].replace(',', '.')) / 1000;
      unit = 'L';
    }
  }

  if (amount) {
    const totalAmount = amount * multiplier;
    return {
      success: true,
      amount: totalAmount,
      unit,
      multiplier,
      baseAmount: amount,
      confidence: multiplier > 1 ? 0.85 : 0.95,
      method: 'regex',
      explanation: multiplier > 1 ? `${amount} ${unit} x ${multiplier} = ${totalAmount} ${unit}` : '',
    };
  }

  return { success: false, method: 'regex' };
}

/**
 * AI ile ambalaj miktarını parse et
 * @param {string} productName - Ürün adı
 * @returns {object} { success, amount, unit, confidence, method, explanation }
 */
export async function parseWithAI(productName) {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Aşağıdaki ürün adından toplam ambalaj miktarını çıkar. 
        
Ürün: "${productName}"

SADECE JSON formatında cevap ver:
{
  "amount": <sayı veya null>,
  "unit": "<KG|L|ADET>",
  "explanation": "<kısa açıklama>",
  "confidence": <0-1 arası güven skoru>
}

Örnekler:
- "BİLLUR TUZ 1,5 KG" → {"amount": 1.5, "unit": "KG", "explanation": "1.5 kg paket", "confidence": 0.95}
- "SALÇA 5 KG (1*4)" → {"amount": 20, "unit": "KG", "explanation": "5kg x 4 adet = 20kg koli", "confidence": 0.9}
- "YUMURTA 30'LU" → {"amount": 30, "unit": "ADET", "explanation": "30 adet yumurta", "confidence": 0.95}
- "SU 19 LT" → {"amount": 19, "unit": "L", "explanation": "19 litre damacana", "confidence": 0.95}

Emin değilsen confidence düşük ver.`,
        },
      ],
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        success: result.amount !== null,
        amount: result.amount,
        unit: result.unit || 'KG',
        confidence: result.confidence || 0.7,
        explanation: result.explanation,
        method: 'ai',
      };
    }

    return { success: false, method: 'ai', error: 'JSON parse failed' };
  } catch (error) {
    return { success: false, method: 'ai', error: error.message };
  }
}

/**
 * Akıllı parse - önce regex, sonra AI
 * @param {string} productName - Ürün adı
 * @param {boolean} forceAI - Her zaman AI kullan
 * @returns {object} Parse sonucu
 */
export async function smartParse(productName, forceAI = false) {
  // 1. Önce regex dene
  if (!forceAI) {
    const regexResult = parseWithRegex(productName);
    if (regexResult.success && regexResult.confidence >= 0.85) {
      return regexResult;
    }
  }

  // 2. AI ile dene
  const aiResult = await parseWithAI(productName);
  return aiResult;
}

/**
 * Toplu parse - birden fazla ürün için
 * @param {Array} products - [{id, ad}] formatında ürünler
 * @returns {Array} Parse sonuçları
 */
export async function batchParse(products) {
  const results = [];

  for (const product of products) {
    const result = await smartParse(product.ad);
    results.push({
      id: product.id,
      ad: product.ad,
      ...result,
    });

    // Rate limiting için kısa bekleme
    if (result.method === 'ai') {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

export default {
  parseWithRegex,
  parseWithAI,
  smartParse,
  batchParse,
};
