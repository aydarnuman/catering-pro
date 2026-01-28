/**
 * useFaturaForm - Fatura Form Yönetimi Hook'u
 *
 * Bu hook fatura formunun tüm state ve iş mantığını yönetir:
 * - Form verileri (tip, seri, no, cari, tarih, vade, durum, notlar)
 * - Kalem yönetimi (ekleme, silme, güncelleme)
 * - Toplam hesaplamaları (ara toplam, KDV, genel toplam)
 * - Validasyon
 */

import { notifications } from '@mantine/notifications';
import { useCallback, useMemo, useState } from 'react';
import type { Fatura, FaturaFormData, FaturaFormErrors, FaturaKalem } from '../types';
import { createKalem, DEFAULT_FORM_DATA, hesaplaKalemTutar } from '../types';

export interface UseFaturaFormOptions {
  initialData?: Fatura;
  onSuccess?: () => void;
}

export interface UseFaturaFormReturn {
  // Form state
  formData: FaturaFormData;
  kalemler: FaturaKalem[];
  errors: FaturaFormErrors;
  isDirty: boolean;

  // Hesaplanan değerler
  araToplam: number;
  kdvToplam: number;
  genelToplam: number;

  // Form metodları
  setField: <K extends keyof FaturaFormData>(field: K, value: FaturaFormData[K]) => void;
  setFormData: React.Dispatch<React.SetStateAction<FaturaFormData>>;

  // Kalem metodları
  addKalem: () => void;
  removeKalem: (id: string) => void;
  updateKalem: (
    id: string,
    field: keyof FaturaKalem,
    value: FaturaKalem[keyof FaturaKalem]
  ) => void;
  setKalemler: React.Dispatch<React.SetStateAction<FaturaKalem[]>>;

  // Validasyon ve reset
  validate: () => string[];
  reset: () => void;
  loadFatura: (fatura: Fatura) => void;

  // Fatura nesnesi oluştur
  buildFatura: (existingId?: string, existingCreatedAt?: string) => Fatura;
}

export function useFaturaForm(options: UseFaturaFormOptions = {}): UseFaturaFormReturn {
  const { initialData } = options;

  // Form state
  const [formData, setFormData] = useState<FaturaFormData>(() => {
    if (initialData) {
      return {
        tip: initialData.tip,
        seri: initialData.seri,
        no: initialData.no,
        cariId: initialData.cariId,
        cariUnvan: initialData.cariUnvan,
        tarih: new Date(initialData.tarih),
        vadeTarihi: new Date(initialData.vadeTarihi),
        durum: initialData.durum,
        notlar: initialData.notlar,
      };
    }
    return { ...DEFAULT_FORM_DATA };
  });

  // Kalemler state
  const [kalemler, setKalemler] = useState<FaturaKalem[]>(() => {
    if (initialData?.kalemler?.length) {
      return initialData.kalemler;
    }
    return [createKalem()];
  });

  // Errors state
  const [errors, setErrors] = useState<FaturaFormErrors>({});

  // isDirty tracking
  const [isDirty, setIsDirty] = useState(false);

  // === HESAPLANAN DEĞERLER ===

  const araToplam = useMemo(() => {
    return kalemler.reduce((acc, k) => acc + k.miktar * k.birimFiyat, 0);
  }, [kalemler]);

  const kdvToplam = useMemo(() => {
    return kalemler.reduce((acc, k) => {
      const tutar = k.miktar * k.birimFiyat;
      return acc + (tutar * k.kdvOrani) / 100;
    }, 0);
  }, [kalemler]);

  const genelToplam = useMemo(() => {
    return araToplam + kdvToplam;
  }, [araToplam, kdvToplam]);

  // === FORM METODLARI ===

  const setField = useCallback(
    <K extends keyof FaturaFormData>(field: K, value: FaturaFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);

      // İlgili hatayı temizle
      if (errors[field as keyof FaturaFormErrors]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field as keyof FaturaFormErrors];
          return newErrors;
        });
      }
    },
    [errors]
  );

  // === KALEM METODLARI ===

  const addKalem = useCallback(() => {
    setKalemler((prev) => [...prev, createKalem()]);
    setIsDirty(true);
  }, []);

  const removeKalem = useCallback((id: string) => {
    setKalemler((prev) => {
      if (prev.length <= 1) {
        notifications.show({
          title: 'Uyarı',
          message: 'En az bir kalem olmalıdır',
          color: 'orange',
        });
        return prev;
      }
      return prev.filter((k) => k.id !== id);
    });
    setIsDirty(true);
  }, []);

  const updateKalem = useCallback(
    (id: string, field: keyof FaturaKalem, value: FaturaKalem[keyof FaturaKalem]) => {
      // Validasyon kontrolleri
      if (field === 'miktar' && typeof value === 'number' && value < 0) {
        notifications.show({
          title: 'Uyarı',
          message: 'Miktar negatif olamaz',
          color: 'orange',
        });
        return;
      }

      if (field === 'birimFiyat' && typeof value === 'number' && value < 0) {
        notifications.show({
          title: 'Uyarı',
          message: 'Birim fiyat negatif olamaz',
          color: 'orange',
        });
        return;
      }

      if (field === 'kdvOrani' && typeof value === 'number' && (value < 0 || value > 100)) {
        notifications.show({
          title: 'Uyarı',
          message: 'KDV oranı 0-100 arasında olmalıdır',
          color: 'orange',
        });
        return;
      }

      setKalemler((prev) =>
        prev.map((k) => {
          if (k.id === id) {
            const updated = { ...k, [field]: value };
            // Tutarı yeniden hesapla
            updated.tutar = hesaplaKalemTutar(updated);
            return updated;
          }
          return k;
        })
      );
      setIsDirty(true);
    },
    []
  );

  // === VALİDASYON ===

  const validate = useCallback((): string[] => {
    const validationErrors: string[] = [];
    const newErrors: FaturaFormErrors = {};

    // Zorunlu alan kontrolleri
    if (!formData.cariId && !formData.cariUnvan) {
      validationErrors.push('Cari seçimi veya cari ünvanı zorunludur');
      newErrors.cari = 'Cari seçimi zorunlu';
    }

    if (!formData.seri || formData.seri.trim().length === 0) {
      validationErrors.push('Fatura serisi boş olamaz');
      newErrors.seri = 'Seri zorunlu';
    }

    // Tarih kontrolleri
    if (formData.vadeTarihi < formData.tarih) {
      validationErrors.push('Vade tarihi fatura tarihinden önce olamaz');
      newErrors.vade = 'Geçersiz vade tarihi';
    }

    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    if (formData.tarih > futureLimit) {
      validationErrors.push('Fatura tarihi 1 yıldan fazla ileri tarihli olamaz');
      newErrors.tarih = 'Geçersiz tarih';
    }

    // Kalem kontrolleri
    if (kalemler.length === 0) {
      validationErrors.push('En az bir fatura kalemi olmalıdır');
      newErrors.kalemler = 'En az bir kalem gerekli';
    }

    kalemler.forEach((kalem, index) => {
      if (!kalem.aciklama || kalem.aciklama.trim().length === 0) {
        validationErrors.push(`${index + 1}. kalem açıklaması boş olamaz`);
      }
      if (kalem.miktar <= 0) {
        validationErrors.push(`${index + 1}. kalem miktarı 0'dan büyük olmalıdır`);
      }
      if (kalem.birimFiyat < 0) {
        validationErrors.push(`${index + 1}. kalem birim fiyatı negatif olamaz`);
      }
      if (kalem.kdvOrani < 0 || kalem.kdvOrani > 100) {
        validationErrors.push(`${index + 1}. kalem KDV oranı 0-100 arasında olmalıdır`);
      }
    });

    // Tutar kontrolleri
    if (genelToplam <= 0 && formData.durum !== 'iptal') {
      validationErrors.push('Fatura toplamı 0 veya negatif olamaz');
      newErrors.toplam = 'Geçersiz toplam';
    }

    if (genelToplam > 10000000) {
      validationErrors.push("Fatura toplamı 10.000.000 TL'yi aşamaz");
      newErrors.toplam = 'Limit aşıldı';
    }

    setErrors(newErrors);
    return validationErrors;
  }, [formData, kalemler, genelToplam]);

  // === RESET ===

  const reset = useCallback(() => {
    setFormData({ ...DEFAULT_FORM_DATA });
    setKalemler([createKalem()]);
    setErrors({});
    setIsDirty(false);
  }, []);

  // === LOAD FATURA ===

  const loadFatura = useCallback((fatura: Fatura) => {
    setFormData({
      tip: fatura.tip,
      seri: fatura.seri,
      no: fatura.no,
      cariId: fatura.cariId,
      cariUnvan: fatura.cariUnvan,
      tarih: new Date(fatura.tarih),
      vadeTarihi: new Date(fatura.vadeTarihi),
      durum: fatura.durum,
      notlar: fatura.notlar,
    });

    if (fatura.kalemler?.length) {
      setKalemler(fatura.kalemler);
    } else {
      setKalemler([createKalem()]);
    }

    setErrors({});
    setIsDirty(false);
  }, []);

  // === BUILD FATURA ===

  const buildFatura = useCallback(
    (existingId?: string, existingCreatedAt?: string): Fatura => {
      return {
        id: existingId || Date.now().toString(),
        tip: formData.tip,
        seri: formData.seri,
        no: formData.no || `${new Date().getFullYear()}-001`,
        cariId: formData.cariId,
        cariUnvan: formData.cariUnvan,
        tarih: formData.tarih.toISOString().split('T')[0],
        vadeTarihi: formData.vadeTarihi.toISOString().split('T')[0],
        kalemler,
        araToplam,
        kdvToplam,
        genelToplam,
        durum: formData.durum,
        notlar: formData.notlar,
        createdAt: existingCreatedAt || new Date().toISOString(),
        kaynak: 'manuel',
      };
    },
    [formData, kalemler, araToplam, kdvToplam, genelToplam]
  );

  return {
    // State
    formData,
    kalemler,
    errors,
    isDirty,

    // Hesaplanan değerler
    araToplam,
    kdvToplam,
    genelToplam,

    // Form metodları
    setField,
    setFormData,

    // Kalem metodları
    addKalem,
    removeKalem,
    updateKalem,
    setKalemler,

    // Validasyon ve reset
    validate,
    reset,
    loadFatura,

    // Build
    buildFatura,
  };
}
