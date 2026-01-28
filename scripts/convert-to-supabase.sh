#!/bin/bash
# Supabase Migrations Dönüştürme Script'i
# Mevcut migration dosyalarını Supabase timestamp formatına dönüştürür

set -e

SOURCE_DIR="/Users/numanaydar/Desktop/CATERİNG/backend/src/migrations"
TARGET_DIR="/Users/numanaydar/Desktop/CATERİNG/supabase/migrations"

echo "🔄 Supabase Migrations Dönüştürme Başlıyor..."
echo "📂 Kaynak: $SOURCE_DIR"
echo "📂 Hedef: $TARGET_DIR"
echo ""

# Supabase migrations klasöründeki eski SQL dosyalarını temizle (.gitkeep hariç)
echo "🧹 Eski migration dosyaları temizleniyor..."
find "$TARGET_DIR" -name "*.sql" -delete 2>/dev/null || true

# Timestamp başlangıcı (28 Ocak 2026, 00:00:00)
BASE_DATE="20260128"

# Sayaç
count=0
errors=0

# Tüm SQL dosyalarını sıralı şekilde işle
for file in $(ls "$SOURCE_DIR"/*.sql | sort -t'_' -k1 -n); do
    filename=$(basename "$file")

    # Numarayı al (001, 002, vb.)
    num=$(echo "$filename" | grep -oE '^[0-9]+' | sed 's/^0*//')

    # Eğer numara boşsa veya geçersizse atla
    if [ -z "$num" ]; then
        echo "⚠️  Atlanıyor (geçersiz numara): $filename"
        ((errors++))
        continue
    fi

    # İsmi al (numara ve alt çizgi sonrası)
    name=$(echo "$filename" | sed 's/^[0-9]*_//')

    # Timestamp oluştur (YYYYMMDDHHMMSS formatında)
    # Her migration için benzersiz timestamp (numara * 100 saniye)
    timestamp="${BASE_DATE}$(printf '%06d' $num)"

    # Yeni dosya adı
    new_filename="${timestamp}_${name}"

    # Kopyala
    cp "$file" "$TARGET_DIR/$new_filename"

    echo "✅ $filename → $new_filename"
    ((count++))
done

echo ""
echo "=========================================="
echo "🎉 Dönüştürme Tamamlandı!"
echo "   ✅ Başarılı: $count dosya"
echo "   ⚠️  Hata: $errors dosya"
echo "   📂 Hedef: $TARGET_DIR"
echo "=========================================="

# Sonucu doğrula
echo ""
echo "📋 İlk 5 dosya:"
ls "$TARGET_DIR"/*.sql 2>/dev/null | head -5 | xargs -I {} basename {}

echo ""
echo "📋 Son 5 dosya:"
ls "$TARGET_DIR"/*.sql 2>/dev/null | tail -5 | xargs -I {} basename {}

echo ""
echo "📊 Toplam dosya sayısı: $(ls "$TARGET_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')"
