/**
 * Prompt Security Middleware
 * AI prompt alanlarında uzunluk ve temel güvenlik kontrolü
 */

const DEFAULT_MAX_LENGTH = 50000; // ~50k karakter

/**
 * @param {{ fieldName: string; maxLength?: number }} options
 * @returns {import('express').RequestHandler}
 */
export function promptSecurityMiddleware(options = {}) {
  const { fieldName = 'question', maxLength = DEFAULT_MAX_LENGTH } = options;

  return (req, res, next) => {
    const value = req.body?.[fieldName];
    if (value === undefined || value === null) {
      return next();
    }
    const str = typeof value === 'string' ? value : String(value);
    if (str.length > maxLength) {
      return res.status(400).json({
        success: false,
        error: `Metin çok uzun (maksimum ${maxLength} karakter)`,
      });
    }
    next();
  };
}

export default promptSecurityMiddleware;
