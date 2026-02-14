import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCardEditStateOptions<T> {
  /** Orijinal (read-only) veri */
  originalData: T;
  /** Edit modu acik mi */
  isEditing: boolean;
  /** Correction field path (ornegin 'teknik_sartlar') */
  fieldPath: string;
  /** HITL kaydetme callback'i */
  onSave?: (fieldPath: string, oldValue: unknown, newValue: unknown) => void;
  /** Edit modunu kapat */
  onToggleEdit?: () => void;
  /** Kaydetmeden once donusum (bos satirlari filtrele vb.) */
  transform?: (data: T) => T;
}

interface UseCardEditStateReturn<T> {
  /** Duzenlenebilir veri kopyasi */
  editData: T;
  /** Duzenlenebilir veriyi guncelle */
  setEditData: React.Dispatch<React.SetStateAction<T>>;
  /** Kaydet ve edit modundan cik */
  handleSave: () => void;
  /** Iptal et ve orijinal veriye don */
  handleCancel: () => void;
  /** Veri degismis mi */
  isModified: boolean;
}

/**
 * Kart edit state yonetimi icin paylasilmis hook.
 *
 * 8 editable kartin hepsinde tekrarlanan pattern'i merkezlestirir:
 * - isEditing true olunca orijinal veriyi kopyalar
 * - Kaydetme sirasinda transform uygular
 * - onSave ile HITL correction kaydeder
 * - onToggleEdit ile edit modundan cikar
 */
export function useCardEditState<T>({
  originalData,
  isEditing,
  fieldPath,
  onSave,
  onToggleEdit,
  transform,
}: UseCardEditStateOptions<T>): UseCardEditStateReturn<T> {
  const [editData, setEditData] = useState<T>(originalData);
  const initialDataRef = useRef<T>(originalData);

  // isEditing true olunca orijinal veriyi kopyala
  useEffect(() => {
    if (isEditing) {
      // Deep clone for arrays/objects
      const cloned = JSON.parse(JSON.stringify(originalData)) as T;
      setEditData(cloned);
      initialDataRef.current = cloned;
    }
  }, [isEditing, originalData]);

  const handleSave = useCallback(() => {
    if (onSave) {
      const finalData = transform ? transform(editData) : editData;
      onSave(fieldPath, originalData, finalData);
    }
    onToggleEdit?.();
  }, [editData, fieldPath, onSave, onToggleEdit, originalData, transform]);

  const handleCancel = useCallback(() => {
    setEditData(initialDataRef.current);
    onToggleEdit?.();
  }, [onToggleEdit]);

  // Basit degisiklik kontrolu (JSON karsilastirma)
  const isModified = JSON.stringify(editData) !== JSON.stringify(initialDataRef.current);

  return {
    editData,
    setEditData,
    handleSave,
    handleCancel,
    isModified,
  };
}
