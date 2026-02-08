#!/usr/bin/env python3
"""
Ekran goruntusunu taranmis/telefon cekimi gibi bozarak egitim PDF'i olusturur.
Kullanim: python3 augment-image.py <goruntu_yolu>
"""

import sys
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
import cv2
import img2pdf

INPUT_PATH = sys.argv[1] if len(sys.argv) > 1 else None
if not INPUT_PATH:
    print("Kullanim: python3 augment-image.py <goruntu_yolu>")
    sys.exit(1)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "augmented")
os.makedirs(OUTPUT_DIR, exist_ok=True)

basename = os.path.splitext(os.path.basename(INPUT_PATH))[0]

# Orijinal gorseli yukle
img = cv2.imread(INPUT_PATH)
if img is None:
    print(f"Hata: {INPUT_PATH} okunamadi!")
    sys.exit(1)

print(f"Orijinal boyut: {img.shape[1]}x{img.shape[0]}")
print(f"Cikti dizini: {OUTPUT_DIR}")
print()

# ============================================
# EFEKT 1: TARAYICI (Scanner) Efekti
# ============================================
def scanner_effect(image):
    """Flatbed tarayici efekti: hafif skew, toz, kontrast artisi"""
    h, w = image.shape[:2]
    result = image.copy()
    
    # 1. Hafif rotation (-1 ile 1 derece arasi)
    angle = np.random.uniform(-1.0, 1.0)
    M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
    result = cv2.warpAffine(result, M, (w, h), borderValue=(245, 245, 245))
    
    # 2. Kontrast artisi (tarayici genelde kontrastli tarar)
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
    l = clahe.apply(l)
    result = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    
    # 3. Hafif gaussian noise (tarayici sensoru)
    noise = np.random.normal(0, 3, result.shape).astype(np.uint8)
    result = cv2.add(result, noise)
    
    # 4. Kenar karartma (tarayici kapagi golge birakir)
    mask = np.ones_like(result, dtype=np.float32)
    border = 30
    for i in range(border):
        alpha = i / border
        mask[i, :] *= alpha
        mask[-(i+1), :] *= alpha
        mask[:, i] *= alpha
        mask[:, -(i+1)] *= alpha
    result = (result.astype(np.float32) * mask).astype(np.uint8)
    
    # 5. Hafif toz noktaciklari
    num_dots = np.random.randint(5, 20)
    for _ in range(num_dots):
        x = np.random.randint(0, w)
        y = np.random.randint(0, h)
        r = np.random.randint(1, 3)
        color = np.random.randint(100, 180)
        cv2.circle(result, (x, y), r, (color, color, color), -1)
    
    return result

# ============================================
# EFEKT 2: TELEFON CEKIMI Efekti
# ============================================
def phone_camera_effect(image):
    """Telefon kamerasi ile cekilmis gibi: perspektif, golge, noise, blur"""
    h, w = image.shape[:2]
    result = image.copy()
    
    # 1. Perspektif bozulmasi (telefon tam duz tutulmaz)
    margin = int(min(w, h) * 0.02)
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst_pts = np.float32([
        [np.random.randint(0, margin), np.random.randint(0, margin)],
        [w - np.random.randint(0, margin), np.random.randint(0, margin*2)],
        [w - np.random.randint(0, margin*2), h - np.random.randint(0, margin)],
        [np.random.randint(0, margin*2), h - np.random.randint(0, margin)]
    ])
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    result = cv2.warpPerspective(result, M, (w, h), borderValue=(240, 238, 235))
    
    # 2. Isik gradyani (bir koseden aydinlik, diger kose karanlik)
    gradient = np.zeros((h, w), dtype=np.float32)
    cx = np.random.randint(w//4, 3*w//4)
    cy = np.random.randint(h//4, 3*h//4)
    for y in range(h):
        for x in range(w):
            dist = np.sqrt((x - cx)**2 + (y - cy)**2)
            max_dist = np.sqrt(w**2 + h**2)
            gradient[y, x] = 1.0 - 0.25 * (dist / max_dist)
    
    # Optimize: numpy ile yap
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
    max_dist = np.sqrt(w**2 + h**2)
    gradient = 1.0 - 0.25 * (dist / max_dist)
    gradient = gradient.astype(np.float32)
    
    result = (result.astype(np.float32) * gradient[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)
    
    # 3. Hafif blur (focus tam net olmaz)
    result = cv2.GaussianBlur(result, (3, 3), 0.8)
    
    # 4. Renk sicakligi kayma (telefon WB her zaman dogru olmaz)
    result = result.astype(np.float32)
    result[:, :, 0] *= 0.97  # mavi biraz azalt
    result[:, :, 2] *= 1.03  # kirmizi biraz artir (sicak ton)
    result = result.clip(0, 255).astype(np.uint8)
    
    # 5. Daha fazla noise (telefon sensoru)
    noise = np.random.normal(0, 5, result.shape).astype(np.int16)
    result = (result.astype(np.int16) + noise).clip(0, 255).astype(np.uint8)
    
    # 6. JPEG compression artifact
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 72]
    _, buf = cv2.imencode('.jpg', result, encode_param)
    result = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    
    return result

# ============================================
# EFEKT 3: FOTOKOPI Efekti
# ============================================
def photocopy_effect(image):
    """Fotokopi makinesi efekti: yuksek kontrast, cizgiler, lekeler"""
    h, w = image.shape[:2]
    
    # 1. Grayscale yap (fotokopi genelde siyah-beyaz)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 2. Yuksek kontrast (fotokopi efekti)
    gray = cv2.convertScaleAbs(gray, alpha=1.4, beta=-30)
    
    # 3. Hafif threshold (fotokopi metni siyahlastirir)
    _, mask = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    gray = cv2.addWeighted(gray, 0.7, mask, 0.3, 0)
    
    # 4. Yatay cizgiler (fotokopi tambur izleri)
    for y in range(0, h, np.random.randint(80, 150)):
        thickness = np.random.randint(1, 2)
        alpha = np.random.uniform(0.02, 0.08)
        line_y = y + np.random.randint(-5, 5)
        if 0 <= line_y < h:
            gray[line_y:line_y+thickness, :] = (
                gray[line_y:line_y+thickness, :].astype(np.float32) * (1 - alpha)
            ).astype(np.uint8)
    
    # 5. Kenar karartma
    mask = np.ones((h, w), dtype=np.float32)
    border = 20
    for i in range(border):
        val = 0.7 + 0.3 * (i / border)
        mask[i, :] = val
        mask[-(i+1), :] = val
        mask[:, i] *= val
        mask[:, -(i+1)] *= val
    gray = (gray.astype(np.float32) * mask).astype(np.uint8)
    
    # 6. Noise
    noise = np.random.normal(0, 4, gray.shape).astype(np.int16)
    gray = (gray.astype(np.int16) + noise).clip(0, 255).astype(np.uint8)
    
    # BGR'ye geri cevir
    result = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    return result


# ============================================
# UYGULA VE KAYDET
# ============================================
effects = [
    ("scanner", scanner_effect, "Tarayici efekti"),
    ("phone", phone_camera_effect, "Telefon cekimi efekti"),
    ("photocopy", photocopy_effect, "Fotokopi efekti"),
]

pdf_paths = []

for effect_name, effect_fn, desc in effects:
    print(f"[{effect_name}] {desc} uygulaniyor...")
    
    augmented = effect_fn(img)
    
    # PNG olarak kaydet
    png_path = os.path.join(OUTPUT_DIR, f"{basename}_{effect_name}.png")
    cv2.imwrite(png_path, augmented)
    print(f"  PNG: {png_path}")
    
    # PDF'e cevir
    pdf_path = os.path.join(OUTPUT_DIR, f"{basename}_{effect_name}.pdf")
    
    # OpenCV -> PIL -> PDF
    augmented_rgb = cv2.cvtColor(augmented, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(augmented_rgb)
    
    # A4 boyutuna ayarla
    a4_width_pt = 595
    a4_height_pt = 842
    
    # img2pdf ile PDF olustur
    temp_jpg = os.path.join(OUTPUT_DIR, f"_temp_{effect_name}.jpg")
    pil_img.save(temp_jpg, "JPEG", quality=90)
    
    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(temp_jpg, layout_fun=img2pdf.get_layout_fun(
            fit=img2pdf.FitMode.into,
            pagesize=(img2pdf.mm_to_pt(210), img2pdf.mm_to_pt(297))  # A4
        )))
    os.remove(temp_jpg)
    
    pdf_size = os.path.getsize(pdf_path)
    print(f"  PDF: {pdf_path} ({pdf_size//1024} KB)")
    pdf_paths.append(pdf_path)
    print()

print("=" * 50)
print(f"TAMAMLANDI! {len(pdf_paths)} farkli versiyon olusturuldu:")
for p in pdf_paths:
    print(f"  - {p}")
print()
print(f"Orijinal: temiz ekran goruntusu")
print(f"Scanner:  tarayicidan gecmis gibi")
print(f"Phone:    telefonla cekilmis gibi")
print(f"Photocopy: fotokopi cekilmis gibi")
