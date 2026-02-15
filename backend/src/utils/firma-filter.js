/**
 * Firma bazlı veri filtreleme yardımcı fonksiyonları.
 *
 * req.user.firma_id JWT'den gelir.
 * - Varsa → sadece o firmanın verisi döner.
 * - Yoksa (super_admin firma seçmeden girdiyse) → tüm veri döner.
 *
 * Kullanım:
 *   const { clause, params, idx } = firmaProjeFilter(req, startIndex);
 *   sql += clause;          // "AND p.firma_id = $3"
 *   queryParams.push(...params); // [firmaId]
 */

/**
 * projeler tablosu (alias p) üzerinden firma filtresi oluşturur.
 * @param {object} req - Express request (req.user.firma_id)
 * @param {number} startIndex - SQL parametre başlangıç indexi
 * @param {string} alias - projeler tablo aliası (varsayılan "p")
 * @returns {{ clause: string, params: any[], idx: number }}
 */
export function firmaProjeFilter(req, startIndex = 1, alias = 'p') {
  const firmaId = req.user?.firma_id;
  if (!firmaId) return { clause: '', params: [], idx: startIndex };
  return {
    clause: ` AND ${alias}.firma_id = $${startIndex}`,
    params: [firmaId],
    idx: startIndex + 1,
  };
}

/**
 * Doğrudan firma_id sütunu olan tablolar için filtre.
 * @param {object} req - Express request
 * @param {number} startIndex - SQL parametre başlangıç indexi
 * @param {string} alias - tablo aliası (varsayılan "")
 * @returns {{ clause: string, params: any[], idx: number }}
 */
export function firmaDirectFilter(req, startIndex = 1, alias = '') {
  const firmaId = req.user?.firma_id;
  if (!firmaId) return { clause: '', params: [], idx: startIndex };
  const prefix = alias ? `${alias}.` : '';
  return {
    clause: ` AND ${prefix}firma_id = $${startIndex}`,
    params: [firmaId],
    idx: startIndex + 1,
  };
}

/**
 * Bir proje_id'nin kullanıcının firmasına ait olup olmadığını doğrular.
 * @param {import('pg').Pool} queryFn - DB query fonksiyonu
 * @param {number} projeId
 * @param {number|null} firmaId - req.user.firma_id
 * @returns {Promise<boolean>}
 */
export async function validateProjeAccess(queryFn, projeId, firmaId) {
  if (!firmaId) return true; // firma_id yoksa → filtre yok
  const result = await queryFn('SELECT id FROM projeler WHERE id = $1 AND firma_id = $2', [projeId, firmaId]);
  return result.rows.length > 0;
}

/**
 * req.user.firma_id varsa döndürür, yoksa null.
 * SQL sorgularında koşullu filtre için kullanışlı.
 */
export function getFirmaId(req) {
  return req.user?.firma_id || null;
}
