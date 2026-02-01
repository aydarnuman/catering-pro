#!/bin/bash
# Eksik reçetelere AI ile malzeme ekle
# Kullanım: ./scripts/tamamla-receteler.sh

API_URL="http://localhost:3001/api/menu-planlama"

echo "=========================================="
echo "REÇETE MALZEME TAMAMLAMA SCRIPTİ"
echo "=========================================="

# Eksik reçeteleri al
curl -s "$API_URL/receteler?limit=300" | jq '[.data[] | select(.malzeme_sayisi == "0")] | .[].id' > /tmp/eksik_receteler.txt
TOPLAM=$(wc -l < /tmp/eksik_receteler.txt | tr -d ' ')
echo "Toplam eksik reçete: $TOPLAM"
echo ""

TAMAMLANAN=0
HATALI=0

# 3'erli batch'ler halinde işle
while IFS= read -r line1 && IFS= read -r line2 && IFS= read -r line3; do
  BATCH="[$line1"
  [ -n "$line2" ] && BATCH="$BATCH,$line2"
  [ -n "$line3" ] && BATCH="$BATCH,$line3"
  BATCH="$BATCH]"
  
  echo "İşleniyor: $BATCH"
  
  # AI önerisi al
  RESPONSE=$(curl -s -X POST "$API_URL/receteler/batch-ai-malzeme-oneri" \
    -H "Content-Type: application/json" \
    -d "{\"recete_ids\": $BATCH}" 2>/dev/null)
  
  if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
    echo "  HATA: API yanıt vermedi"
    HATALI=$((HATALI + 3))
    continue
  fi
  
  # Her reçete için malzemeleri ekle
  echo "$RESPONSE" | jq -r '.data.sonuclar[]? | "\(.recete_id)|\(.malzemeler | @json)"' | while IFS='|' read -r recete_id malzemeler_json; do
    if [ -z "$recete_id" ] || [ "$recete_id" = "null" ]; then
      continue
    fi
    
    echo "  Reçete $recete_id için malzemeler ekleniyor..."
    
    echo "$malzemeler_json" | jq -r '.[]? | @base64' | while read -r malzeme_b64; do
      malzeme=$(echo "$malzeme_b64" | base64 -d 2>/dev/null)
      malzeme_adi=$(echo "$malzeme" | jq -r '.malzeme_adi // empty')
      miktar=$(echo "$malzeme" | jq -r '.miktar // 0')
      birim=$(echo "$malzeme" | jq -r '.birim // "gr"')
      urun_kart_id=$(echo "$malzeme" | jq -r '.urun_kart_id // empty')
      
      if [ -z "$malzeme_adi" ]; then
        continue
      fi
      
      # Malzeme ekle
      if [ -n "$urun_kart_id" ] && [ "$urun_kart_id" != "null" ]; then
        curl -s -X POST "$API_URL/receteler/$recete_id/malzemeler" \
          -H "Content-Type: application/json" \
          -d "{\"malzeme_adi\": \"$malzeme_adi\", \"miktar\": $miktar, \"birim\": \"$birim\", \"urun_kart_id\": $urun_kart_id}" > /dev/null
      else
        curl -s -X POST "$API_URL/receteler/$recete_id/malzemeler" \
          -H "Content-Type: application/json" \
          -d "{\"malzeme_adi\": \"$malzeme_adi\", \"miktar\": $miktar, \"birim\": \"$birim\"}" > /dev/null
      fi
    done
    
    # Maliyet hesapla
    curl -s -X POST "$API_URL/receteler/$recete_id/maliyet-hesapla" > /dev/null
    
    TAMAMLANAN=$((TAMAMLANAN + 1))
    echo "    ✓ Tamamlandı"
  done
  
  # Rate limiting
  sleep 2
  
done < /tmp/eksik_receteler.txt

echo ""
echo "=========================================="
echo "SONUÇ"
echo "=========================================="
echo "Tamamlanan: $TAMAMLANAN"
echo "Hatalı: $HATALI"
echo "=========================================="
