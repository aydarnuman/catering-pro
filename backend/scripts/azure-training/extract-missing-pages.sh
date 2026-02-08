#!/bin/bash
#
# EXTRACT-MISSING-PAGES.sh (v2 - Pozisyon bazlı)
# PDF'ler taranmış görüntü olduğu için text araması yerine
# teknik şartnamelerin tipik yapısına göre pozisyon bazlı çıkarım yapar.
#
# Teknik Şartname Tipik Yapısı:
#   Sayfa 1-3    → Kapak, içindekiler (ihale_konusu, idare_adi, sure)
#   Sayfa 4-8    → Genel hükümler (toplam_personel, hizmet_gun_sayisi)
#   Sayfa 9-15   → Operasyonel detay (mutfak_tipi, ogun_dagilimi, dagitim_saatleri, kisi_sayilari)
#   Sayfa 16-25  → Personel/kalite (personel_tablosu, kalite_standartlari, gida_guvenligi)
#   Sayfa 26-35  → Ekler / listeler (ekipman_listesi, dagitim_noktalari)
#   Son 3 sayfa  → Birim fiyat cetveli / imza
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMP_DIR="$SCRIPT_DIR/temp-pdfs"
OUTPUT_DIR="$SCRIPT_DIR/extracted-pages"

mkdir -p "$TEMP_DIR" "$OUTPUT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  EKSIK ALAN SAYFASI ÇIKARICI v2 (pozisyon bazlı)"
echo "═══════════════════════════════════════════════════════════════"

declare -a PDF_URLS=(
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/11231/tech_spec/1770109603751-f120a4f4-24_Aylik_Malzeme_Dahil_Yemek_Hizmeti_Alimi_Teknik_Sartnamesi.pdf.pdf|hastane_fsm"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/29854/tech_spec/1770455099526-46b08d8d-33_AYLIK_YEMEK_HIZMET_ALIMI_TEKNIK_SARTNAMESI.pdf.pdf|hastane_afyon"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/95/tech_spec/1770455503950-7f0c8498-TEKNIK_SARTNAME.pdf.pdf|emniyet_polis"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/18389/tech_spec/1770456143823-cd895978-2._Kisim_Odemis_Ilce_Emniyet_Teknik_Sartname_ve_ekleri.pdf.pdf|emniyet_izmir"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/31002/tech_spec/1770454758655-dcaa708b-OZEL_HAREKAT_TEKNIK_SARTNAME.PDF.pdf|emniyet_mugla"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/289/tech_spec/1770364574309-e48a6e44-CEVIK_KUVVET_IASE_TEKNIK_SARTNAME.pdf.pdf|emniyet_urfa"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/9175/tech_spec/1770455269552-f65d8c3b-Gida_ve_temizlik_malzemelerine_ait_teknik_sartname.pdf.pdf|spor_bursa"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/9175/tech_spec/1770455260535-03823794-Gramajlar_ve_ornek_menu.pdf.pdf|spor_gramaj"
  "https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/16741/tech_spec/1770454713901-e0459bb4-TEKNIK_SARTNAME.pdf.pdf|tcdd_yemek"
)

TOTAL_EXTRACTED=0

extract_page() {
  local PDF_FILE="$1"
  local PAGE="$2"
  local NAME="$3"
  local TAG="$4"
  local MAX_PAGE="$5"
  
  # Sayfa aralık dışıysa atla
  if [ "$PAGE" -gt "$MAX_PAGE" ] || [ "$PAGE" -lt 1 ]; then
    return
  fi
  
  local OUT_PNG="$OUTPUT_DIR/${NAME}_s${PAGE}.png"
  if [ -f "$OUT_PNG" ]; then
    TOTAL_EXTRACTED=$((TOTAL_EXTRACTED + 1))
    return
  fi
  
  pdftoppm -f "$PAGE" -l "$PAGE" -png -r 250 "$PDF_FILE" "$TEMP_DIR/tmp_page"
  local TMP_PNG=$(ls "$TEMP_DIR"/tmp_page*.png 2>/dev/null | head -1)
  if [ -n "$TMP_PNG" ]; then
    mv "$TMP_PNG" "$OUT_PNG"
    echo "  $TAG Sayfa $PAGE → ${NAME}_s${PAGE}.png"
    TOTAL_EXTRACTED=$((TOTAL_EXTRACTED + 1))
  fi
}

for entry in "${PDF_URLS[@]}"; do
  URL="${entry%%|*}"
  NAME="${entry##*|}"
  PDF_FILE="$TEMP_DIR/${NAME}.pdf"
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📥 $NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [ ! -f "$PDF_FILE" ]; then
    curl -sL -o "$PDF_FILE" "$URL"
  fi
  
  PAGE_COUNT=$(pdfinfo "$PDF_FILE" 2>/dev/null | awk '/^Pages:/{print $2}')
  echo "  📄 $PAGE_COUNT sayfa"
  
  # ─── Kapak/Genel: ihale_konusu, idare_adi, sure ───
  for p in 1 2 3; do
    extract_page "$PDF_FILE" "$p" "$NAME" "📋" "$PAGE_COUNT"
  done
  
  # ─── Genel hükümler: toplam_personel, hizmet_gun_sayisi ───
  for p in 4 5 6 7; do
    extract_page "$PDF_FILE" "$p" "$NAME" "🔵" "$PAGE_COUNT"
  done
  
  # ─── Operasyonel: mutfak_tipi, ogun_dagilimi, dagitim_saatleri, kisi_sayilari ───
  for p in 9 11 13 15; do
    extract_page "$PDF_FILE" "$p" "$NAME" "🟡" "$PAGE_COUNT"
  done
  
  # ─── Personel/Kalite: personel_tablosu, kalite_standartlari, gida_guvenligi ───
  for p in 18 21 24 27; do
    extract_page "$PDF_FILE" "$p" "$NAME" "🟠" "$PAGE_COUNT"
  done
  
  # ─── Ekler/Listeler: ekipman, dagitim_noktalari ───
  for p in 30 35 40; do
    extract_page "$PDF_FILE" "$p" "$NAME" "🟣" "$PAGE_COUNT"
  done
  
  # ─── Son sayfalar: birim_fiyat_cetveli ───
  LAST=$PAGE_COUNT
  LAST_2=$((PAGE_COUNT - 1))
  LAST_3=$((PAGE_COUNT - 2))
  for p in $LAST_3 $LAST_2 $LAST; do
    extract_page "$PDF_FILE" "$p" "$NAME" "🔴" "$PAGE_COUNT"
  done
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SONUÇ"  
echo "  Çıkarılan toplam PNG: $TOTAL_EXTRACTED"
echo "  Klasör: $OUTPUT_DIR"
echo "═══════════════════════════════════════════════════════════════"

rm -f "$TEMP_DIR"/tmp_page*.png
