/**
 * Zod Validation Middleware
 * Gelen request body, query veya params'ı Zod şemasına göre doğrular.
 *
 * Kullanım:
 *   import { validate } from '../middleware/validate.js';
 *   import { loginSchema } from '../validations/auth.js';
 *   router.post('/login', validate(loginSchema), handler);
 *
 *   // Body dışında query/params doğrulama:
 *   router.get('/list', validate(listSchema, 'query'), handler);
 */

import { ZodError } from 'zod';

/**
 * @param {import('zod').ZodSchema} schema - Zod şeması
 * @param {'body'|'query'|'params'} source - Doğrulanacak kaynak (varsayılan: body)
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      return res.status(400).json({
        success: false,
        error: 'Geçersiz veri',
        details: errors,
      });
    }

    // Parse edilmiş (temizlenmiş) veriyi req'e yaz
    req[source] = result.data;
    next();
  };
}

/**
 * Zod hatalarını okunabilir formata çevirir
 * @param {ZodError} zodError
 * @returns {Array<{field: string, message: string}>}
 */
function formatZodErrors(zodError) {
  return zodError.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
