// Ürün adından birim bilgisini parse et (örn: "5 KG*2" -> {unit: "KG", amount: 5, multiplier: 2})
export const parseUnitFromProductName = (
  productName: string
): { unit: string; amount: number; multiplier: number; totalAmount: number } | null => {
  if (!productName) return null;

  // Pattern: "5 KG*2", "10 KG", "250 GR*48", "1.5 L", "500 ML*12" gibi
  const patterns = [
    // "5 KG*2" formatı
    /(\d+(?:\.\d+)?)\s*(KG|GR|G|L|ML|LT|ADET|PKT|PAKET|KUTU|KOLİ)\s*\*\s*(\d+)/i,
    // "5 KG" formatı (çarpı yok)
    /(\d+(?:\.\d+)?)\s*(KG|GR|G|L|ML|LT|ADET|PKT|PAKET|KUTU|KOLİ)/i,
  ];

  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      const amount = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      const multiplier = match[3] ? parseInt(match[3], 10) : 1;
      const totalAmount = amount * multiplier;

      return { unit, amount, multiplier, totalAmount };
    }
  }

  return null;
};

// Birim fiyatını hesapla ve formatla
export const calculateUnitPrice = (
  unitPrice: number,
  productName: string
): { display: string; tooltip: string } | null => {
  const unitInfo = parseUnitFromProductName(productName);
  if (!unitInfo) return null;

  const { unit, amount, multiplier, totalAmount } = unitInfo;

  // Birim fiyatını hesapla
  let unitPricePerBase: number;
  let displayText: string;
  let tooltipText: string;

  if (multiplier > 1) {
    // "5 KG*2" durumu: toplam 10 KG, fiyat 185 TL -> 18.5 TL/kg
    unitPricePerBase = unitPrice / totalAmount;
    displayText = `₺${unitPricePerBase.toFixed(2)}/${unit.toLowerCase()}`;
    tooltipText = `${amount} ${unit} × ${multiplier} = ${totalAmount} ${unit} paket başına ₺${unitPrice.toFixed(2)}`;
  } else {
    // "5 KG" durumu: 5 KG, fiyat 185 TL -> 37 TL/kg
    unitPricePerBase = unitPrice / amount;
    displayText = `₺${unitPricePerBase.toFixed(2)}/${unit.toLowerCase()}`;
    tooltipText = `${amount} ${unit} paket başına ₺${unitPrice.toFixed(2)}`;
  }

  return { display: displayText, tooltip: tooltipText };
};

// Kategoriye göre renk belirle
export const getCategoryColor = (category?: string): string => {
  if (!category) return 'dimmed';

  const categoryLower = category.toLowerCase();

  if (categoryLower.includes('sebze')) return 'green';
  if (categoryLower.includes('meyve')) return 'orange';
  if (categoryLower.includes('et') || categoryLower.includes('tavuk')) return 'red';
  if (categoryLower.includes('balık') || categoryLower.includes('balik')) return 'blue';
  if (categoryLower.includes('süt') || categoryLower.includes('sut')) return 'cyan';
  if (categoryLower.includes('bakliyat')) return 'yellow';
  if (categoryLower.includes('içecek') || categoryLower.includes('icecek')) return 'grape';
  if (categoryLower.includes('baharat')) return 'pink';
  if (categoryLower.includes('yağ') || categoryLower.includes('yag')) return 'lime';
  if (categoryLower.includes('temizlik')) return 'teal';
  if (categoryLower.includes('dondurulmuş') || categoryLower.includes('donuk')) return 'indigo';

  return 'dimmed';
};
