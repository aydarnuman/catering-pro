#!/usr/bin/env python3
"""
Toplu ekran goruntusu augmentation scripti.
Bir klasordeki tum PNG/JPG dosyalarini 3 farkli efektle bozup PDF yapar.

Kullanim: python3 augment-batch.py <klasor_yolu> [cikti_klasoru]
"""

import sys
import os
import glob
import time
import numpy as np
from PIL import Image
import cv2
import img2pdf

INPUT_DIR = sys.argv[1] if len(sys.argv) > 1 else None
OUTPUT_DIR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "augmented", "batch"
)

if not INPUT_DIR:
    print("Kullanim: python3 augment-batch.py <klasor_yolu> [cikti_klasoru] [--single-random]")
    sys.exit(1)

single_random = "--single-random" in sys.argv

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Goruntu dosyalarini bul
patterns = ['*.png', '*.PNG', '*.jpg', '*.JPG', '*.jpeg', '*.JPEG']
image_files = []
for pattern in patterns:
    image_files.extend(glob.glob(os.path.join(INPUT_DIR, pattern)))
image_files.sort()

print(f"=" * 60)
print(f"TOPLU AUGMENTATION")
print(f"=" * 60)
print(f"Girdi klasoru : {INPUT_DIR}")
print(f"Cikti klasoru : {OUTPUT_DIR}")
print(f"Goruntu sayisi: {len(image_files)}")
print(f"Uretilecek PDF: {len(image_files) * 3}")
print(f"=" * 60)
print()

# ============================================
# EFEKT FONKSIYONLARI
# ============================================

def scanner_effect(image, intensity=None):
    """Flatbed tarayici efekti"""
    h, w = image.shape[:2]
    result = image.copy()
    
    # Rastgele yogunluk
    if intensity is None:
        intensity = np.random.uniform(0.5, 1.5)
    
    # 1. Hafif rotation
    angle = np.random.uniform(-1.5, 1.5) * intensity
    M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
    border_color = tuple(np.random.randint(235, 250, 3).tolist())
    result = cv2.warpAffine(result, M, (w, h), borderValue=border_color)
    
    # 2. Kontrast
    lab = cv2.cvtColor(result, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clip_limit = 1.0 + intensity
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l = clahe.apply(l)
    result = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    
    # 3. Noise
    noise_level = int(2 + 4 * intensity)
    noise = np.random.normal(0, noise_level, result.shape).astype(np.uint8)
    result = cv2.add(result, noise)
    
    # 4. Kenar karartma
    mask = np.ones_like(result, dtype=np.float32)
    border = int(20 + 20 * intensity)
    for i in range(border):
        alpha = i / border
        mask[i, :] *= alpha
        mask[-(i+1), :] *= alpha
        mask[:, i] *= alpha
        mask[:, -(i+1)] *= alpha
    result = (result.astype(np.float32) * mask).astype(np.uint8)
    
    # 5. Toz noktaciklari
    num_dots = np.random.randint(3, int(15 * intensity))
    for _ in range(num_dots):
        x, y = np.random.randint(0, w), np.random.randint(0, h)
        r = np.random.randint(1, 3)
        color = np.random.randint(80, 200)
        cv2.circle(result, (x, y), r, (color, color, color), -1)
    
    return result


def phone_camera_effect(image, intensity=None):
    """Telefon kamerasi efekti"""
    h, w = image.shape[:2]
    result = image.copy()
    
    if intensity is None:
        intensity = np.random.uniform(0.5, 1.5)
    
    # 1. Perspektif bozulmasi
    margin = int(min(w, h) * 0.015 * intensity)
    if margin < 1:
        margin = 1
    src_pts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst_pts = np.float32([
        [np.random.randint(0, margin+1), np.random.randint(0, margin+1)],
        [w - np.random.randint(0, margin+1), np.random.randint(0, margin*2+1)],
        [w - np.random.randint(0, margin*2+1), h - np.random.randint(0, margin+1)],
        [np.random.randint(0, margin*2+1), h - np.random.randint(0, margin+1)]
    ])
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    bg_color = tuple(np.random.randint(230, 245, 3).tolist())
    result = cv2.warpPerspective(result, M, (w, h), borderValue=bg_color)
    
    # 2. Isik gradyani
    cx = np.random.randint(w//4, 3*w//4)
    cy = np.random.randint(h//4, 3*h//4)
    Y, X = np.ogrid[:h, :w]
    dist = np.sqrt((X - cx)**2 + (Y - cy)**2).astype(np.float32)
    max_dist = np.sqrt(w**2 + h**2)
    gradient = 1.0 - (0.15 + 0.15 * intensity) * (dist / max_dist)
    result = (result.astype(np.float32) * gradient[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)
    
    # 3. Blur
    blur_size = 3 if intensity < 1.0 else 5
    blur_sigma = 0.5 + 0.5 * intensity
    result = cv2.GaussianBlur(result, (blur_size, blur_size), blur_sigma)
    
    # 4. Renk sicakligi kayma
    result = result.astype(np.float32)
    warm = np.random.uniform(0.95, 1.0)
    cool = np.random.uniform(1.0, 1.05)
    result[:, :, 0] *= warm   # mavi
    result[:, :, 2] *= cool   # kirmizi
    result = result.clip(0, 255).astype(np.uint8)
    
    # 5. Noise
    noise_level = int(3 + 5 * intensity)
    noise = np.random.normal(0, noise_level, result.shape).astype(np.int16)
    result = (result.astype(np.int16) + noise).clip(0, 255).astype(np.uint8)
    
    # 6. JPEG compression
    quality = max(45, int(80 - 20 * intensity))
    _, buf = cv2.imencode('.jpg', result, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    result = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    
    return result


def photocopy_effect(image, intensity=None):
    """Fotokopi efekti"""
    h, w = image.shape[:2]
    
    if intensity is None:
        intensity = np.random.uniform(0.5, 1.5)
    
    # 1. Grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 2. Kontrast
    alpha = 1.2 + 0.3 * intensity
    beta = -20 - 20 * intensity
    gray = cv2.convertScaleAbs(gray, alpha=alpha, beta=beta)
    
    # 3. Threshold blend
    _, mask = cv2.threshold(gray, 190 + int(10 * intensity), 255, cv2.THRESH_BINARY)
    blend = 0.6 + 0.1 * intensity
    gray = cv2.addWeighted(gray, blend, mask, 1 - blend, 0)
    
    # 4. Yatay cizgiler
    line_spacing = np.random.randint(60, 130)
    for y in range(0, h, line_spacing):
        thickness = np.random.randint(1, 2)
        line_alpha = np.random.uniform(0.02, 0.06 * intensity)
        line_y = y + np.random.randint(-3, 4)
        if 0 <= line_y < h - thickness:
            gray[line_y:line_y+thickness, :] = (
                gray[line_y:line_y+thickness, :].astype(np.float32) * (1 - line_alpha)
            ).astype(np.uint8)
    
    # 5. Kenar karartma
    mask_edge = np.ones((h, w), dtype=np.float32)
    border = int(15 + 15 * intensity)
    for i in range(border):
        val = 0.6 + 0.4 * (i / border)
        mask_edge[i, :] = val
        mask_edge[-(i+1), :] = val
        mask_edge[:, i] *= val
        mask_edge[:, -(i+1)] *= val
    gray = (gray.astype(np.float32) * mask_edge).astype(np.uint8)
    
    # 6. Noise
    noise_level = int(3 + 3 * intensity)
    noise = np.random.normal(0, noise_level, gray.shape).astype(np.int16)
    gray = (gray.astype(np.int16) + noise).clip(0, 255).astype(np.uint8)
    
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def save_as_pdf(cv_image, pdf_path):
    """OpenCV image -> A4 PDF"""
    rgb = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    
    temp_jpg = pdf_path.replace('.pdf', '_temp.jpg')
    pil_img.save(temp_jpg, "JPEG", quality=90)
    
    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(temp_jpg, layout_fun=img2pdf.get_layout_fun(
            fit=img2pdf.FitMode.into,
            pagesize=(img2pdf.mm_to_pt(210), img2pdf.mm_to_pt(297))
        )))
    os.remove(temp_jpg)
    return os.path.getsize(pdf_path)


# ============================================
# TOPLU ISLEME
# ============================================

effects = [
    ("scanner", scanner_effect),
    ("phone", phone_camera_effect),
    ("photocopy", photocopy_effect),
]

total_start = time.time()
success_count = 0
error_count = 0
total_pdf_size = 0

for idx, img_path in enumerate(image_files, 1):
    filename = os.path.basename(img_path)
    basename = os.path.splitext(filename)[0]
    
    # Kisa isim olustur (sayfa-01, sayfa-02, ...)
    short_name = f"sayfa-{idx:03d}"
    
    print(f"[{idx}/{len(image_files)}] {filename}")
    
    img = cv2.imread(img_path)
    if img is None:
        print(f"  HATA: Okunamadi, atlaniyor!")
        error_count += 1
        continue
    
    # --single-random modu: her goruntu icin rastgele TEK efekt
    # Normal mod: her goruntu icin 3 efekt
    if single_random:
        effect_name, effect_fn = effects[np.random.randint(0, len(effects))]
        try:
            intensity = np.random.uniform(0.4, 1.6)
            augmented = effect_fn(img, intensity=intensity)
            pdf_name = f"ekran-{idx:03d}.pdf"
            pdf_path = os.path.join(OUTPUT_DIR, pdf_name)
            pdf_size = save_as_pdf(augmented, pdf_path)
            total_pdf_size += pdf_size
            print(f"  {effect_name}: {pdf_name} ({pdf_size//1024} KB) [yogunluk: {intensity:.1f}]")
            success_count += 1
        except Exception as e:
            print(f"  HATA [{effect_name}]: {e}")
            error_count += 1
    else:
        for effect_name, effect_fn in effects:
            try:
                intensity = np.random.uniform(0.4, 1.6)
                augmented = effect_fn(img, intensity=intensity)
                pdf_name = f"{short_name}_{effect_name}.pdf"
                pdf_path = os.path.join(OUTPUT_DIR, pdf_name)
                pdf_size = save_as_pdf(augmented, pdf_path)
                total_pdf_size += pdf_size
                print(f"  {effect_name}: {pdf_name} ({pdf_size//1024} KB) [yogunluk: {intensity:.1f}]")
                success_count += 1
            except Exception as e:
                print(f"  HATA [{effect_name}]: {e}")
                error_count += 1

elapsed = time.time() - total_start

print()
print(f"=" * 60)
print(f"TAMAMLANDI!")
print(f"=" * 60)
print(f"Toplam goruntu  : {len(image_files)}")
print(f"Basarili PDF    : {success_count}")
print(f"Hata            : {error_count}")
print(f"Toplam PDF boyut: {total_pdf_size // (1024*1024)} MB")
print(f"Gecen sure      : {elapsed:.1f} saniye")
print(f"Cikti klasoru   : {OUTPUT_DIR}")
print(f"=" * 60)
