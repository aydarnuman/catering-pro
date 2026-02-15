/**
 * Şartname gramaj kuralları — AI (asistan) tarafından üretilmiş, prompta göre.
 * Sadece malzeme_tip_eslesmeleri ve alt_tip_tanimlari ile uyumlu değerler.
 * Profil: kurumsal (taban), kyk_yurt, hastane, okul, premium, agir_is, diyet.
 */

const BASE_KURUMSAL = [
  {
    alt_tip_kod: 'parcali_et_kemiksiz',
    kurallar: [
      { malzeme_tipi: 'Çiğ et', gramaj: 120, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'parcali_et_kemikli',
    kurallar: [
      { malzeme_tipi: 'Çiğ et (kemikli)', gramaj: 140, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 25, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'kiymali',
    kurallar: [
      { malzeme_tipi: 'Çiğ kıyma', gramaj: 80, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
      { malzeme_tipi: 'Domates salçası', gramaj: 15, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'tavuk_parcali',
    kurallar: [
      { malzeme_tipi: 'Tavuk', gramaj: 120, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'tavuk_kemikli',
    kurallar: [
      { malzeme_tipi: 'Tavuk', gramaj: 140, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'sebze_yemegi',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 200, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 30, birim: 'g' },
      { malzeme_tipi: 'Domates', gramaj: 50, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'sebze_zeytinyagli',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 180, birim: 'g' },
      { malzeme_tipi: 'Zeytinyağı', gramaj: 20, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 25, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'corba_mercimek',
    kurallar: [
      { malzeme_tipi: 'Kırmızı mercimek', gramaj: 50, birim: 'g' },
      { malzeme_tipi: 'Soğan', gramaj: 15, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'corba_yayla',
    kurallar: [
      { malzeme_tipi: 'Yoğurt', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Un', gramaj: 15, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'corba_sebze',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 80, birim: 'g' },
      { malzeme_tipi: 'Domates', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'corba_et_suyu',
    kurallar: [
      { malzeme_tipi: 'Çiğ et (kemikli)', gramaj: 30, birim: 'g' },
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 5, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'corba_tavuklu',
    kurallar: [
      { malzeme_tipi: 'Tavuk', gramaj: 35, birim: 'g' },
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 30, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 5, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'pilav_pirinc',
    kurallar: [
      { malzeme_tipi: 'Pirinç', gramaj: 75, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
      { malzeme_tipi: 'Tereyağı', gramaj: 5, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'pilav_bulgur',
    kurallar: [
      { malzeme_tipi: 'Bulgur', gramaj: 80, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'pilav_etli',
    kurallar: [
      { malzeme_tipi: 'Pirinç', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Çiğ et', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'pilav_tavuklu',
    kurallar: [
      { malzeme_tipi: 'Pirinç', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Tavuk', gramaj: 45, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'makarna_genel',
    kurallar: [
      { malzeme_tipi: 'Makarna', gramaj: 90, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'makarna_kiymali',
    kurallar: [
      { malzeme_tipi: 'Makarna', gramaj: 80, birim: 'g' },
      { malzeme_tipi: 'Çiğ kıyma', gramaj: 50, birim: 'g' },
      { malzeme_tipi: 'Domates salçası', gramaj: 15, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'makarna_soslu',
    kurallar: [
      { malzeme_tipi: 'Makarna', gramaj: 85, birim: 'g' },
      { malzeme_tipi: 'Domates salçası', gramaj: 25, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'kuru_baklagil_etsiz',
    kurallar: [
      { malzeme_tipi: 'Kuru fasulye', gramaj: 70, birim: 'g' },
      { malzeme_tipi: 'Soğan', gramaj: 25, birim: 'g' },
      { malzeme_tipi: 'Domates salçası', gramaj: 15, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'etli_bakliyat',
    kurallar: [
      { malzeme_tipi: 'Nohut', gramaj: 55, birim: 'g' },
      { malzeme_tipi: 'Çiğ et', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'etli_sebze',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 180, birim: 'g' },
      { malzeme_tipi: 'Çiğ et', gramaj: 45, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'salata_mevsim',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 120, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
      { malzeme_tipi: 'Zeytinyağı', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'salata_coban',
    kurallar: [
      { malzeme_tipi: 'Domates', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 50, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'salata_cacik',
    kurallar: [
      { malzeme_tipi: 'Yoğurt', gramaj: 100, birim: 'g' },
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 40, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'balik_genel',
    kurallar: [
      { malzeme_tipi: 'Balık', gramaj: 120, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
      { malzeme_tipi: 'Un', gramaj: 15, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'borek_hamur',
    kurallar: [
      { malzeme_tipi: 'Un', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Çiğ kıyma', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'tatli_sutlu',
    kurallar: [
      { malzeme_tipi: 'Süt', gramaj: 120, birim: 'ml' },
      { malzeme_tipi: 'Un', gramaj: 20, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'corba_genel',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 60, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 8, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'corba_etli',
    kurallar: [
      { malzeme_tipi: 'Çiğ et', gramaj: 35, birim: 'g' },
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 45, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 6, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'pilav_ic',
    kurallar: [
      { malzeme_tipi: 'Pirinç', gramaj: 70, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
      { malzeme_tipi: 'Tereyağı', gramaj: 8, birim: 'g' },
    ],
  },
  {
    alt_tip_kod: 'salata_diger',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 100, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'meze_sicak',
    kurallar: [
      { malzeme_tipi: 'Un', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 15, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'sebze_etli',
    kurallar: [
      { malzeme_tipi: 'Sebze (karışık)', gramaj: 180, birim: 'g' },
      { malzeme_tipi: 'Çiğ et', gramaj: 45, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 12, birim: 'ml' },
    ],
  },
  {
    alt_tip_kod: 'bakliyat_etli',
    kurallar: [
      { malzeme_tipi: 'Yeşil mercimek', gramaj: 50, birim: 'g' },
      { malzeme_tipi: 'Çiğ et', gramaj: 40, birim: 'g' },
      { malzeme_tipi: 'Soğan', gramaj: 20, birim: 'g' },
      { malzeme_tipi: 'Sıvı yağ', gramaj: 10, birim: 'ml' },
    ],
  },
];

const PROFIL_CARPAN = {
  kurumsal: 1,
  kyk_yurt: 0.95,
  hastane: 0.88,
  okul: 0.82,
  premium: 1.25,
  agir_is: 1.4,
  diyet: 0.78,
};

function roundGramaj(val, birim) {
  if (birim === 'ml' || birim === 'g') return Math.round(val);
  return val;
}

/**
 * Profil için AI (asistan) tarafından üretilmiş gramaj kurallarını döndürür.
 * @param {string} profil - kyk_yurt | hastane | okul | kurumsal | premium | agir_is | diyet
 * @returns {{ alt_tip_kod: string, kurallar: { malzeme_tipi: string, gramaj: number, birim: string }[] }[]}
 */
export function getProfilKurallari(profil) {
  const carpan = PROFIL_CARPAN[profil] ?? 1;
  return BASE_KURUMSAL.map(({ alt_tip_kod, kurallar }) => ({
    alt_tip_kod,
    kurallar: kurallar.map((k) => ({
      malzeme_tipi: k.malzeme_tipi,
      gramaj: roundGramaj(k.gramaj * carpan, k.birim),
      birim: k.birim,
    })),
  }));
}

export const SUPPORTED_PROFILES = Object.keys(PROFIL_CARPAN);
