/**
 * Market Fiyat Servisi - Camgöz API v2
 * camgoz.net üzerinden 45+ Türkiye marketi fiyat karşılaştırma
 * Gelişmiş: Çoklu arama, akıllı alaka filtreleme, marka ayrıştırma
 */

import * as cheerio from 'cheerio';

// ─── CAMGÖZ API ──────────────────────────────────────────

/**
 * Türkçe fiyat formatını parse et
 * "39,5" → 39.5 | "249.90" → 249.90 | "1.249,90" → 1249.90
 */
function parseTurkishPrice(text) {
  if (!text) return null;
  const cleaned = text.trim();
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned);
}

// ─── BİLİNEN MARKALAR ───────────────────────────────────

const KNOWN_BRANDS = new Set([
  // Süt / Peynir
  'pınar', 'sütaş', 'eker', 'muratbey', 'tahsildaroğlu', 'bahçıvan', 'ülker',
  'danone', 'içim', 'mis', 'torku', 'tukaş', 'sek', 'president', 'milka',
  // Yağ
  'komili', 'kristal', 'yudum', 'orkide', 'luna', 'becel', 'altınbaşak',
  // Bakliyat / Tahıl
  'yayla', 'duru', 'reis', 'nuh\'un ankara', 'barilla', 'arbella', 'filiz',
  // Et / Tavuk / Sucuk
  'banvit', 'pınar', 'namet', 'mudurnu', 'beşler', 'polonez', 'cumhuriyet',
  // Konserve / Salça
  'tat', 'tamek', 'penguen', 'öncü', 'sera', 'doğanay',
  // Genel FMCG
  'heinz', 'knorr', 'calve', 'bizim', 'nescafe', 'nestle', 'lipton', 'doğadan',
  'burcu', 'kemal kükrer', 'dalan', 'doğuş', 'çaykur', 'ofçay', 'beta',
  // Baharat / Sos
  'bağdat', 'arifoğlu', 'ana bahçe',
  // Market markaları
  'chef\'s basket', 'a101', 'şok', 'bim', 'migros', 'file', 'happy valley',
  // Şeker / Un
  'balküpü', 'billur', 'sinangil', 'söke', 'ulusoy',
  // Zeytin / Zeytinyağı
  'tariş', 'marmarabirlik', 'gemlik', 'kırlangıç', 'madra',
]);

/**
 * Ürün adından marka, ürün ismi ve ambalaj bilgisini ayrıştır
 */
function parseProductName(productName) {
  const original = (productName || '').trim();
  const lower = original.toLowerCase();

  // Ambalaj pattern'i
  const ambalajMatch = lower.match(/(\d+[.,]?\d*)\s*(kg|kilo|gr|gram|g|lt|litre|l|ml|cl|adet|ad)\b/i);
  let ambalajMiktar = null;
  let ambalajBirim = null;
  let ambalajText = '';

  if (ambalajMatch) {
    ambalajText = ambalajMatch[0];
    const miktar = parseFloat(ambalajMatch[1].replace(',', '.'));
    const birimRaw = ambalajMatch[2].toLowerCase();

    if (['gr', 'gram', 'g'].includes(birimRaw)) {
      ambalajMiktar = miktar / 1000;
      ambalajBirim = 'kg';
    } else if (['ml'].includes(birimRaw)) {
      ambalajMiktar = miktar / 1000;
      ambalajBirim = 'L';
    } else if (['cl'].includes(birimRaw)) {
      ambalajMiktar = miktar / 100;
      ambalajBirim = 'L';
    } else if (['kg', 'kilo'].includes(birimRaw)) {
      ambalajMiktar = miktar;
      ambalajBirim = 'kg';
    } else if (['lt', 'litre', 'l'].includes(birimRaw)) {
      ambalajMiktar = miktar;
      ambalajBirim = 'L';
    } else {
      ambalajMiktar = miktar;
      ambalajBirim = 'adet';
    }
  }

  // Çoklu paket pattern (x4, x6, 4'lü, 6'lı)
  const multiPackMatch = lower.match(/[x×]\s*(\d+)|(\d+)\s*['']?\s*(lı|li|lu|lü|adet)\b/i);
  let multiPackCount = null;
  if (multiPackMatch) {
    multiPackCount = parseInt(multiPackMatch[1] || multiPackMatch[2], 10);
  }

  // Marka tespiti - kelimeleri kontrol et
  const words = original.split(/\s+/);
  let marka = null;
  let markaEndIdx = 0;

  // 1) İlk 1-2 kelimeyi bilinen markalarla kontrol et
  for (let len = Math.min(3, words.length); len >= 1; len--) {
    const candidate = words.slice(0, len).join(' ').toLowerCase();
    if (KNOWN_BRANDS.has(candidate)) {
      marka = words.slice(0, len).join(' ');
      markaEndIdx = len;
      break;
    }
  }

  // 2) Bilinen marka bulunamazsa, büyük harfle başlayan ilk kelime + ürün adında 2+ kelime varsa
  if (!marka && words.length >= 2) {
    const firstWord = words[0];
    // Büyük harfle başlıyor ve sayı içermiyor
    if (/^[A-ZÇĞIİÖŞÜ]/.test(firstWord) && !/\d/.test(firstWord)) {
      // Ürün kelimesi değilse marka kabul et
      const foodKeywords = [
        // Sebzeler
        'domates', 'biber', 'soğan', 'patates', 'salatalık', 'patlıcan', 'kabak',
        'havuç', 'marul', 'ıspanak', 'lahana', 'turp', 'enginar', 'kereviz',
        // Meyveler
        'elma', 'portakal', 'muz', 'üzüm', 'limon', 'kayısı', 'erik', 'kiraz',
        // Temel gıda
        'pirinç', 'bulgur', 'makarna', 'un', 'şeker', 'tuz',
        'süt', 'yoğurt', 'peynir', 'tereyağı', 'ayçiçek', 'zeytinyağı',
        'tavuk', 'dana', 'kuzu', 'kıyma', 'nohut', 'mercimek', 'fasulye',
        // Türler/varyantlar
        'sızma', 'riviera', 'baldo', 'osmancık', 'basmati',
        'spagetti', 'burgu', 'penne', 'erişte',
        // Renkler (ürün tanımlayıcı olarak: kırmızı mercimek, yeşil mercimek vb.)
        'kırmızı', 'yeşil', 'sarı', 'beyaz', 'siyah', 'kahverengi', 'mor',
        // Boyut/durum tanımlayıcıları
        'kuru', 'taze', 'dondurulmuş', 'konserve', 'organik', 'yerli', 'ithal',
        'kaymaksız', 'yarım', 'tam', 'yağlı', 'yağsız', 'light',
        'ince', 'kalın', 'küçük', 'büyük', 'orta', 'jumbo', 'ekstra',
        'çiğ', 'haşlanmış', 'közlenmiş', 'kurutulmuş', 'tütsülenmiş',
      ];
      if (!foodKeywords.includes(firstWord.toLowerCase())) {
        marka = firstWord;
        markaEndIdx = 1;
      }
    }
  }

  // Ürün adını markasız hale getir
  const urunAdiParts = marka ? words.slice(markaEndIdx) : words;
  // Ambalajı da çıkar
  const urunAdi = urunAdiParts.join(' ')
    .replace(/\d+[.,]?\d*\s*(kg|kilo|gr|gram|g|lt|litre|l|ml|cl|adet|ad)\b/gi, '')
    .replace(/[x×]\s*\d+/gi, '')
    .replace(/\d+\s*['']?\s*(lı|li|lu|lü)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    original,
    marka,
    urunAdi: urunAdi || original,
    ambalajMiktar,
    ambalajBirim,
    ambalajText,
    multiPackCount,
  };
}

/**
 * Camgöz API'den fiyat çek (45+ market)
 */
async function fetchCamgozPrices(searchTerm) {
  const results = [];

  try {
    const url = `https://camgoz.net/search-product?value=${encodeURIComponent(searchTerm)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return results;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('tr.table-light').each((_i, row) => {
      const $row = $(row);
      const urunAdi = $row.find('td[data-label="Ürün"]').text().trim();
      if (!urunAdi) return;

      const barkod = $row.find('td[data-label="Barkod"] a').text().trim();
      const parsed = parseProductName(urunAdi);

      const $priceRow = $row.next('tr.price-details');

      $priceRow.find('.border.p-2.rounded').each((_j, priceBox) => {
        const $box = $(priceBox);
        const marketAdi = $box.find('.fw-semibold').text().trim();
        const marketFiyatText = $box.find('.fw-bold').text().trim();
        const fiyatMatch = marketFiyatText.match(/[\d.,]+/);
        const fiyat = fiyatMatch ? parseTurkishPrice(fiyatMatch[0]) : null;

        if (marketAdi && fiyat && fiyat >= 1 && fiyat <= 50000) {
          results.push({
            market: marketAdi,
            urun: urunAdi,
            fiyat,
            birim: 'adet',
            barkod: barkod || undefined,
            marka: parsed.marka,
            urunAdiTemiz: parsed.urunAdi,
            ambalajMiktar: parsed.ambalajMiktar,
            ambalajBirim: parsed.ambalajBirim,
          });
        }
      });
    });
  } catch (_error) {
    // Camgöz erişilemezse sessizce boş dön
  }

  return results;
}

// ─── FİLTRELEME (v2 - SKORLAMA BAZLI) ───────────────────

// Gıda dışı anahtar kelimeler
const NON_FOOD_KEYWORDS = new Set([
  'deterjan', 'temizlik', 'matik', 'çamaşır', 'bulaşık', 'yumuşatıcı',
  'şampuan', 'losyon', 'parfüm', 'deodorant', 'kolonya', 'duş jeli', 'saç kremi',
  'bebek bezi', 'ıslak havlu', 'ıslak mendil',
  'tuvalet kağıdı', 'peçete', 'çöp torbası', 'poşet', 'folyo', 'streç',
  'silikon', 'demlik', 'süzgeç', 'bardak', 'tabak', 'çatal', 'kaşık', 'bıçak',
  'tencere', 'tava', 'kevgir', 'rende', 'spatula', 'tepsi', 'kavanoz', 'saklama kabı',
  'köpek maması', 'kedi maması', 'pet food',
  'oyuncak', 'kitap', 'dergi', 'kırtasiye', 'elektronik', 'mum', 'dekoratif',
  'omega', 'vitamin', 'takviye', 'kapsül', 'tablet', 'balance oil', 'kür',
  // Mutfak aletleri / eşyaları
  'aparat', 'önleyici', 'kaynatma', 'taşırmaz', 'cam', 'termos', 'matara',
  'mandal', 'askı', 'paspas', 'fırça', 'sünger', 'bez', 'eldiven',
  // Kişisel bakım
  'sabun', 'el kremi', 'diş macunu', 'diş macun', 'diş fırçası', 'ağız bakım',
  'eyüp sabri', 'tuncer',
  // Tohum / Fide (sebze değil, ekim malzemesi)
  'tohum', 'fide', 'çim', 'gübre', 'toprak',
  // Hayvan ürünleri
  'köpek', 'kedi', 'akvaryum', 'kuş yemi', 'balık yemi', 'karides yemi',
  'köpek ödülü', 'kedi ödülü',
  // Mobilya / Ev eşyası (yanlış eşleşme önleme)
  'koltuk', 'sandalye', 'masa', 'sehpa', 'mobilya', 'dolap', 'raf', 'yatak',
  'oyuncu koltuğu', 'bilgisayar',
  // Kozmetik / Saç boyası (tarçın, karamel gibi renk adları karışır)
  'palette', 'saç boyası', 'boya', 'koleston', 'garnier', 'loreal',
  'saç bakım', 'saç spreyi', 'saç köpüğü', 'saç maskesi',
  'oje', 'ruj', 'fondöten', 'maskara', 'göz kalemi', 'pudra',
  // Bitki çayları (maydanoz çayı, tarçın çayı vb. gıda ile karışır)
  // NOT: "çay" kelimesi gıda, ama "bitki çayı" + gıda aramada karışıyor
  'poşet çay', 'süzen poşet', 'çay bardak',
]);

/**
 * Alaka skoru hesapla (0-100)
 * 0 = alakasız, 100 = mükemmel eşleşme
 */
/**
 * Ürün adında kelime tam olarak (bağımsız) geçiyor mu?
 * "süt" → "Pınar Süt 1L" ✓ ama "Sütlü Çikolata" ✗
 */
function hasWholeWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s\\-/,.()])${escaped}([\\s\\-/,.()]|$)`, 'i').test(text);
}

/**
 * Türkçe kelime eşleşme skoru
 * Tam kelime > Gramer eki (yağ→yağı) > Türetme eki (süt→sütlü) > Eşleşme yok
 */
function wordMatchScore(product, word) {
  // 1. Tam kelime eşleşmesi
  if (hasWholeWord(product, word)) return 1.0;

  // 2. Ürün kelimelerinde prefix kontrolü (Türkçe ek sistemi)
  const productWords = product.split(/[\s\-/,.()+]+/).filter((w) => w.length >= 2);
  for (const pw of productWords) {
    if (pw.startsWith(word) && pw.length > word.length) {
      const suffix = pw.slice(word.length);
      // Türetme ekleri (sütlü, yağlı vb.) → düşük skor (farklı ürün)
      if (/^l[ıiuü]/i.test(suffix)) return 0.25;

      // Türkçe gramer ekleri: sadece bilinen kalıplar yüksek skor alsın
      // İsim hal ekleri: ı/i/u/ü, ın/in/un/ün, a/e, da/de/ta/te, dan/den/tan/ten
      // İyelik ekleri: ım/im/um/üm, ın/in/un/ün, ı/i/u/ü, sı/si/su/sü
      // Çoğul eki: lar/ler, ları/leri
      // bal→balı ✓ (ı = hal eki)    bal→balon ✗ (on = farklı kelime)
      // yağ→yağın ✓ (ın = hal eki)  süt→sütün ✓ (ün = hal eki)
      const TURKISH_SUFFIXES = /^([ıiuüaeğ]|[ıiuü]n|[dt][ae]|[dt][ae]n|l[ae]r|n[ıiuü]n|s[ıiuü]|[ıiuü]m|n[dt][ae]|lar[ıiuü]|ler[ıiuü])$/i;
      if (TURKISH_SUFFIXES.test(suffix)) return 0.9;

      // Biraz daha uzun ama tanınabilir ekler (peyniri, unu vb.)
      if (suffix.length <= 3 && /^[ıiuüaenrdsmtlşğ]+$/i.test(suffix)) return 0.7;

      // Tanınmayan kısa suffix → düşük skor (balon, kalem vb. farklı kelime olabilir)
      if (suffix.length <= 4) return 0.3;
    }
  }

  // 3. Uzun kelimelerde kök eşleşmesi
  if (word.length >= 5) {
    const stem = word.slice(0, word.length - 2);
    for (const pw of productWords) {
      if (pw.startsWith(stem)) return 0.5;
    }
  }

  return 0;
}

function calculateRelevanceScore(searchTerm, productName) {
  const search = searchTerm.toLowerCase().replace(/\d+\s*(kg|gr|g|lt|l|ml|adet)/gi, '').trim();
  const product = productName.toLowerCase();

  // 1. Gıda dışı kontrol (hemen eleme)
  for (const kw of NON_FOOD_KEYWORDS) {
    if (product.includes(kw) && !search.includes(kw)) return 0;
  }

  // Özel durumlar
  if (product.includes('havlu') && !search.includes('havlu')) return 0;
  if (product.includes('kokulu') && !search.includes('kokulu')) return 0;

  // ── Kategori çapraz bulaşma koruması ──
  // Baharat aramasında kozmetik (tarçın bakır = saç boyası rengi)
  if (/renk|bakır|kumral|sarışın|kahve\s*rengi|platin|açık|koyu/i.test(product) &&
      !search.includes('renk')) return 0;
  // Yeşillik aramasında bitki çayı (maydanoz çayı, nane çayı)
  // "çay" aramasında değilsek ve üründe "çay" + "poşet/süzen/bardak" varsa
  if (!search.includes('çay') && /çay/i.test(product) &&
      /poşet|süzen|demleme|limonlu|bardak/i.test(product)) return 0;
  // Gıda aramasında evcil hayvan ürünü (marka adları: Felix, Whiskas, Purina, Pedigree)
  if (/kedi|köpek|kuş|balık\s*yem|felix|whiskas|purina|pedigree|reflex|proplan|pouch/i.test(product) &&
      !/kedi|köpek|felix|whiskas/i.test(search)) return 0;

  // ── Ürün karışım koruması (dolgulu, soslu, aromalı = farklı kategori) ──
  // "biber" aramasında "biber dolgulu zeytin" veya "biber sos" gelmesin
  // AMA "biber" aramasında "sivri biber", "dolma biber" gelebilsin
  const COMPOSITE_MARKERS = ['dolgulu', 'aromalı', 'çeşnili', 'soslu', 'kaplamalı', 'kaplı', 'biberli', 'soğanlı', 'sarımsaklı', 'limonlu', 'sütlü', 'ballı', 'peynirli', 'etli'];
  for (const marker of COMPOSITE_MARKERS) {
    if (product.includes(marker) && !search.includes(marker)) {
      // Ürün adında composite marker var ama arama teriminde yok
      // Asıl ürün arama terimiyle farklıysa elele
      // "biber dolgulu zeytin" → asıl ürün "zeytin", aranan "biber"
      return Math.min(15, 0); // Çok düşük skor
    }
  }

  // 2. Arama kelimelerini çıkar
  const searchWords = search.split(/\s+/).filter((w) => w.length >= 2);
  if (searchWords.length === 0) return 50; // Çok kısa arama

  // 3. Kelime eşleşmesi (gelişmiş: kelime sınırı + Türkçe ek sistemi)
  let matchedCount = 0;
  let totalWeight = 0;

  for (let i = 0; i < searchWords.length; i++) {
    const word = searchWords[i];
    const weight = i === 0 ? 3 : 1; // İlk kelime (ana ürün) daha ağırlıklı
    totalWeight += weight;

    const score = wordMatchScore(product, word);
    matchedCount += weight * score;
  }

  const baseScore = (matchedCount / totalWeight) * 100;

  // 4. Bileşik isim cezası (limon aramasında limon tuzu, limon sosu çıkmasın)
  // Ama "yağ" aramasında "Ayçiçek Yağı" cezalanmamalı (ana ürünün kendisi)
  const suffixes = ['tuzu', 'suyu', 'sosu', 'aroması', 'özü', 'yağı', 'sirkesi'];
  const mainWord = searchWords[0];
  if (mainWord && mainWord.length >= 3) {
    for (const suffix of suffixes) {
      // Suffix'in kökü arama kelimesiyse ceza verme (yağ → yağı, su → suyu)
      const suffixRoot = suffix.replace(/[ıiuüsş]+$/g, '');
      if (mainWord === suffixRoot || mainWord.startsWith(suffixRoot) || suffixRoot.startsWith(mainWord)) {
        continue; // Ana ürün zaten bu kategori
      }
      if (product.includes(mainWord) && product.includes(suffix) && !search.includes(suffix.replace(/[uü]$/, ''))) {
        return Math.min(baseScore, 20); // Düşük skor
      }
    }
  }

  return Math.round(baseScore);
}

/**
 * Alakasız ürünleri filtrele (skor bazlı)
 * @exports - piyasa-tools ve test'ler tarafından kullanılabilir
 */
export function isRelevantProduct(searchTerm, productName, minScore = 50) {
  return calculateRelevanceScore(searchTerm, productName) >= minScore;
}

// ─── BİRİM FİYAT (v2) ──────────────────────────────────

/**
 * Birim fiyat hesapla (kg/L standardizasyonu)
 * Gelişmiş: Çoklu paket, compound birim desteği
 */
function calculateUnitPrice(price, productName, targetUnit = null) {
  const lowerName = (productName || '').toLowerCase();

  // Çoklu paket kontrolü (örn: "6x200ml", "4'lü 500g")
  const multiMatch = lowerName.match(/(\d+)\s*[x×]\s*(\d+[.,]?\d*)\s*(kg|kilo|gr|gram|g|lt|litre|l|ml|cl)/i);
  if (multiMatch) {
    const count = parseInt(multiMatch[1], 10);
    let amount = parseFloat(multiMatch[2].replace(',', '.'));
    const birim = multiMatch[3].toLowerCase();

    if (['gr', 'gram', 'g'].includes(birim)) amount = amount / 1000;
    else if (['ml'].includes(birim)) amount = amount / 1000;
    else if (['cl'].includes(birim)) amount = amount / 100;

    const totalAmount = count * amount;
    const unit = ['lt', 'litre', 'l', 'ml', 'cl'].includes(birim) ? 'L' : 'kg';
    const unitPrice = Math.round((price / totalAmount) * 100) / 100;

    return { unitPrice, perUnit: unit, ambalajMiktar: totalAmount };
  }

  // Tek birim pattern'leri
  const patterns = [
    { pattern: /(\d+[.,]?\d*)\s*(kg|kilo)\b/i, unit: 'kg', divisor: 1 },
    { pattern: /(\d+[.,]?\d*)\s*(gr|gram|g)\b/i, unit: 'kg', divisor: 1000 },
    { pattern: /(\d+[.,]?\d*)\s*(lt|litre|l)\b/i, unit: 'L', divisor: 1 },
    { pattern: /(\d+[.,]?\d*)\s*(ml)\b/i, unit: 'L', divisor: 1000 },
    { pattern: /(\d+[.,]?\d*)\s*(cl)\b/i, unit: 'L', divisor: 100 },
    { pattern: /(\d+)\s*['']?\s*(lı|li|lu|lü)\b/i, unit: 'adet', divisor: 1 },
    { pattern: /[x×]\s*(\d+)\b/i, unit: 'adet', divisor: 1 },
    { pattern: /(\d+)\s*(adet)/i, unit: 'adet', divisor: 1 },
  ];

  for (const { pattern, unit, divisor } of patterns) {
    const match = lowerName.match(pattern);
    if (match) {
      const rawAmount = parseFloat(match[1].replace(',', '.'));
      if (Number.isNaN(rawAmount) || rawAmount <= 0) continue;

      const normalizedAmount = divisor > 1 ? rawAmount / divisor : rawAmount;
      const unitPrice = Math.round((price / normalizedAmount) * 100) / 100;
      return { unitPrice, perUnit: unit, ambalajMiktar: normalizedAmount };
    }
  }

  // Hedef birim varsa, ona göre varsay
  if (targetUnit === 'kg' || targetUnit === 'L') {
    return { unitPrice: price, perUnit: targetUnit, ambalajMiktar: null };
  }

  // Fiyat aralığı sezgisel kontrolü: catering gıda ürünlerinde
  // "adet" fiyatı genellikle düşüktür (ekmek 15 TL, yumurta 5 TL).
  // 50 TL üstü "adet" fiyat muhtemelen aslında paket fiyatıdır ve
  // birim tespiti başarısız olmuştur. targetUnit yoksa bile,
  // fonksiyon çağıranın birim kararına bırakmak için 'adet' döneriz.
  return { unitPrice: price, perUnit: 'adet', ambalajMiktar: null };
}

// ─── ÇOKLU ARAMA ────────────────────────────────────────

/**
 * Birden fazla arama terimiyle Camgöz'de ara, sonuçları birleştir
 * @param {string[]} searchTerms - Aranacak terimler listesi
 * @param {object} options - { targetUnit, minRelevance }
 */
async function multiSearch(searchTerms, options = {}) {
  const { targetUnit = null, minRelevance = 50 } = options;

  // Paralel arama
  const searchPromises = searchTerms.map((term) => fetchCamgozPrices(term));
  const allSearchResults = await Promise.all(searchPromises);

  // Tüm sonuçları birleştir
  const combined = [];
  const seenProducts = new Set();

  for (let i = 0; i < allSearchResults.length; i++) {
    const results = allSearchResults[i];
    const term = searchTerms[i];

    for (const r of results) {
      // Alaka kontrolü
      const score = calculateRelevanceScore(term, r.urun);
      if (score < minRelevance) continue;

      // Deduplikasyon: aynı market + aynı ürün + aynı fiyat
      const dedupKey = `${r.market}|${r.urun}|${r.fiyat}`;
      if (seenProducts.has(dedupKey)) continue;
      seenProducts.add(dedupKey);

      const { unitPrice, perUnit, ambalajMiktar } = calculateUnitPrice(r.fiyat, r.urun, targetUnit);

      combined.push({
        market: r.market,
        urun: r.urun,
        fiyat: r.fiyat,
        birimFiyat: unitPrice,
        birimTipi: perUnit,
        barkod: r.barkod,
        marka: r.marka,
        urunAdiTemiz: r.urunAdiTemiz,
        ambalajMiktar: ambalajMiktar || r.ambalajMiktar,
        aramaTermi: term,
        alakaSkor: score,
      });
    }
  }

  return combined;
}

// ─── ANA FONKSİYONLAR ───────────────────────────────────

/**
 * Ana arama fonksiyonu - Camgöz API (v2: çoklu arama destekli)
 * @param {string|string[]} searchTermInput - Tek terim veya terimler dizisi
 * @param {object} options - { targetUnit }
 */
export async function searchMarketPrices(searchTermInput, options = {}) {
  const { targetUnit = null } = options;

  // Tekil string'i diziye çevir
  const searchTerms = Array.isArray(searchTermInput) ? searchTermInput : [searchTermInput];

  // Çoklu arama
  const allResults = await multiSearch(searchTerms, { targetUnit, minRelevance: 45 });

  if (allResults.length === 0) {
    return {
      success: false,
      urun: searchTerms[0],
      error: `"${searchTerms.join(', ')}" için fiyat bulunamadı`,
      fiyatlar: [],
    };
  }

  // Birim fiyata göre sırala
  allResults.sort((a, b) => a.birimFiyat - b.birimFiyat);

  // Tekrar edenleri kaldır (market + fiyat bazında)
  const uniqueFiyatlar = [];
  const seen = new Set();
  for (const f of allResults) {
    const key = `${f.market}-${f.fiyat}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFiyatlar.push(f);
    }
  }

  // En yaygın birim tipini bul
  const unitCounts = {};
  uniqueFiyatlar.forEach((f) => {
    unitCounts[f.birimTipi] = (unitCounts[f.birimTipi] || 0) + 1;
  });

  // Hedef birim varsa onu kullan
  let dominantUnit = targetUnit || 'adet';
  if (!targetUnit) {
    if (unitCounts.kg >= 2) dominantUnit = 'kg';
    else if (unitCounts.L >= 2) dominantUnit = 'L';
    else {
      const nonAdetUnits = Object.entries(unitCounts).filter(([k]) => k !== 'adet');
      if (nonAdetUnits.length > 0) {
        dominantUnit = nonAdetUnits.sort((a, b) => b[1] - a[1])[0][0];
      }
    }
  }

  // İstatistikler
  const sameUnitFiyatlar = uniqueFiyatlar.filter((f) => f.birimTipi === dominantUnit);
  const statsBase = sameUnitFiyatlar.length >= 3 ? sameUnitFiyatlar : uniqueFiyatlar;
  let sortedPrices = statsBase.map((f) => f.birimFiyat).sort((a, b) => a - b);

  // Ön-filtre: Birim fiyat sezgisel alt limitleri (2026 Türkiye piyasası)
  // Bu limitler IQR'den önce uygulanır çünkü aşırı düşük fiyatlar IQR'yi bozar
  const MIN_BIRIM_FIYAT = { kg: 5, L: 5, adet: 0.5 }; // TL
  const minThreshold = MIN_BIRIM_FIYAT[dominantUnit] || 1;
  const preFiltered = sortedPrices.filter((p) => p >= minThreshold);
  if (preFiltered.length >= 3) {
    sortedPrices = preFiltered;
  }

  // Outlier temizle: IQR yöntemiyle aşırı ucuz/pahalı fiyatları çıkar
  let cleanPrices = sortedPrices;
  if (sortedPrices.length >= 5) {
    const q1 = sortedPrices[Math.floor(sortedPrices.length * 0.25)];
    const q3 = sortedPrices[Math.floor(sortedPrices.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    cleanPrices = sortedPrices.filter((p) => p >= lowerBound && p <= upperBound);
    if (cleanPrices.length < 3) cleanPrices = sortedPrices; // Yeterli veri kalmazsa geri al
  }

  // Ek kontrol: Medyandan aşırı uzak aykırı değerleri çıkar
  // (IQR, verinin çok dağınık olduğu durumlarda yetersiz kalır)
  if (cleanPrices.length >= 4) {
    const medianPrice = cleanPrices[Math.floor(cleanPrices.length / 2)];
    const minThreshold = medianPrice * 0.2; // Medyanın %20'sinden ucuzları çıkar
    const maxThreshold = medianPrice * 3.0; // Medyanın 3 katından pahalıları çıkar
    const afterMedianFilter = cleanPrices.filter((p) => p >= minThreshold && p <= maxThreshold);
    if (afterMedianFilter.length >= 3) {
      cleanPrices = afterMedianFilter;
    }
  }

  // Ekonomik ortalama (en ucuz 5 — outlier temiz)
  const ekonomikFiyatlar = cleanPrices.slice(0, Math.min(5, cleanPrices.length));
  const ekonomikOrtalama = ekonomikFiyatlar.reduce((a, b) => a + b, 0) / ekonomikFiyatlar.length;

  // Medyan
  const medyan = cleanPrices[Math.floor(cleanPrices.length / 2)];

  // Marka bazlı gruplama
  const markaGruplari = {};
  for (const f of uniqueFiyatlar) {
    const key = f.marka || 'Diğer';
    if (!markaGruplari[key]) markaGruplari[key] = [];
    markaGruplari[key].push(f);
  }

  return {
    success: true,
    urun: searchTerms[0],
    aramaTermleri: searchTerms,
    birim: dominantUnit,
    fiyatlar: uniqueFiyatlar.slice(0, 30),
    min: cleanPrices[0],
    max: cleanPrices[cleanPrices.length - 1],
    ortalama: Math.round(ekonomikOrtalama * 100) / 100,
    medyan,
    kaynak: 'camgoz',
    toplam_sonuc: uniqueFiyatlar.length,
    markalar: Object.keys(markaGruplari).filter((m) => m !== 'Diğer'),
    marka_gruplari: markaGruplari,
  };
}

/**
 * Hızlı arama (alias)
 */
export async function quickSearch(productName, options = {}) {
  return searchMarketPrices(productName, options);
}

/**
 * Browser kapat - artık gerekli değil ama geriye uyumluluk için bırakıldı
 */
export async function closeBrowser() {
  // Puppeteer kaldırıldı, bu fonksiyon artık no-op
}

/**
 * Mevcut market listesi
 */
export function getAvailableMarkets() {
  return [
    {
      key: 'camgoz',
      name: 'Camgöz API',
      active: true,
      type: 'api',
      note: '45+ market: A101, Migros, CarrefourSA, ŞOK, Bizim Toptan, Macro Center, Mopaş, Hakmar, Gürmar ve daha fazlası',
    },
  ];
}

// Yardımcı fonksiyonları dışa aç (test + piyasa-tools kullanımı için)
export { parseProductName, calculateRelevanceScore, calculateUnitPrice };

export default { searchMarketPrices, quickSearch, getAvailableMarkets, closeBrowser, parseProductName, calculateRelevanceScore, calculateUnitPrice };
