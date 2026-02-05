# Toolbar – Artlist Toolkit ile Karşılaştırma ve Öneriler

Referans: [Artlist AI Toolkit – Video & Image Generation](https://toolkit.artlist.io/image-video-generator?mode=video&modelGroupID=302)

---

## 1. Yapı ve Layout

| Özellik | Artlist Toolkit | Bizim Toolbar (Catering) | Öneri |
|--------|------------------|---------------------------|--------|
| **Satır sayısı** | Tek yatay bar (prompt + model + buton) | Üst: tarih + kapat, orta: input + ikonlar + notlar, alt: badge’ler + CTA | Tarih satırını daha ince/opsiyonel yap; tek “blok” hissi ver |
| **Yükseklik** | İnce, tek satır yüksekliğine yakın | Çok katmanlı, textarea 3 satır, badge satırı | Input’u tek satır/pill yap (genişleyebilir), alt bar’ı tek satırda sıkılaştır |
| **Prompt alanı** | Tek satır, pill (tam yuvarlak), placeholder | Çok satırlı Textarea, minRows 3 | Tek satır pill input + focus’ta veya “daha fazla” ile genişleyen alan |
| **Genişlik** | Bar çok geniş, neredeyse tam genişlik | maxWidth: 900px | maxWidth artır (örn. 960–1000) veya yüzde ile daha geniş |

---

## 2. Cam / Glass Efekt

| Özellik | Artlist Toolkit | Bizim Toolbar | Öneri |
|--------|------------------|----------------|--------|
| **Arka plan opaklığı** | Çok düşük, neredeyse sadece blur | rgba(255,255,255,0.06) | 0.04–0.05 deneyebilir; “tül” hissi |
| **Blur** | Güçlü (30–40px+) | 40px | Aynı kalabilir veya 48px |
| **Border** | Çok ince veya yok | 1px solid rgba(255,255,255,0.04) | 0.02–0.03 veya border’ı kaldır |
| **Köşe** | Tek parça, büyük radius (pill veya 24px+) | borderRadius: 20 | 24 veya 9999 (tam pill) |

---

## 3. İç Elemanlar

| Özellik | Artlist Toolkit | Bizim Toolbar | Öneri |
|--------|------------------|----------------|--------|
| **İç çizgiler** | Yok veya çok hafif | Tarih alt çizgisi, notlar sol çizgisi, alt bar üst çizgisi | Hepsi 0.02–0.03 veya kaldır |
| **“Şirket Asistanı” etiketi** | Yok | Üstte gradient label | Kaldır veya placeholder ile birleştir; daha sade |
| **Sol/orta ikonlar** | Az, sade (model/type seçici) | Çok ikon (yükle, ara, not, faturalar, raporlar) | Catering için gerekli kalabilir; görsel ağırlığı azalt (daha küçük, daha şeffaf) |
| **Badge’ler** | Model/ayar chip’leri, tek satır | İhaleler, Finans, Stok, Hızlı İşlem, Ayarlar | Font 11px → 12px; padding/gap artır; hover daha yumuşak |
| **CTA buton** | Tek, belirgin pill (Start Free / Generate) | Pill, altın | Aynı mantık; border’ı biraz daha yumuşak (0.25 opacity) |

---

## 4. Notlar Alanı

| Özellik | Artlist Toolkit | Bizim Toolbar | Öneri |
|--------|------------------|----------------|--------|
| **Notlar** | Bar içinde yok | Sağda sütun (desktop), altta (mobil) | Bar’ı Artlist’e yaklaştırmak için notları bar dışında (örn. tıklanınca açılan panel) tutabilirsin; yoksa mevcut haliyle bırak, sadece ayırıcı çizgiyi çok incelt |

---

## 5. Uygulanabilecek Hızlı İyileştirmeler (Öncelik Sırasıyla)

1. **Camı biraz daha şeffaf yap**  
   `backgroundColor` → `rgba(255,255,255,0.04)`; `border` → `0.02` veya `none`.

2. **Tüm iç çizgileri incelt veya kaldır**  
   Tarih alt, notlar sol, alt bar üst: hepsi `rgba(255,255,255,0.02)` veya `0`.

3. **“Şirket Asistanı” label’ını kaldır**  
   Placeholder zaten yönlendiriyor; tek satır hissi güçlenir.

4. **Ana bar radius’u büyüt**  
   `20` → `24` veya `9999` (tam pill).

5. **maxWidth artır**  
   `900` → `960` veya `980`; bar daha “Artlist genişliğinde” olur.

6. **Input’u tek satır + pill sarmalayıcı**  
   Textarea’yı tek satır gibi kullan (minRows=1, maxRows 1 varsayılan); dış wrapper’a `borderRadius: 9999` ve hafif arka plan ver; isteğe “Genişlet” ile çok satıra geçilebilir.

7. **Badge font ve tıklanabilir alan**  
   Font 12px; padding 8px 14px; gap 10px; hover’da sadece hafif arka plan.

8. **Tarih satırını sadeleştir**  
   Daha küçük font (11px), daha az padding; veya sadece kapat/LIVE, tarihi kaldır.

Bu liste, [Artlist Toolkit](https://toolkit.artlist.io/image-video-generator?mode=video&modelGroupID=302) ile görsel/hissiyat farklarını azaltmak için kullanılabilir; ürün ihtiyacına göre (Catering’e özel notlar/ikonlar) hangi maddelerin uygulanacağı seçilebilir.
