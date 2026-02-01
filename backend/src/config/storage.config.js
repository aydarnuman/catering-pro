/**
 * Storage Configuration
 * Supabase Storage ve dosya yönetimi için merkezi yapılandırma
 */

export const storageConfig = {
  // Supabase Storage ayarları
  supabase: {
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'tender-documents',
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '52428800', 10), // 50MB
    signedUrlExpiry: parseInt(process.env.STORAGE_SIGNED_URL_EXPIRY || '3600', 10), // 1 saat
  },

  // Dosya yolu şablonları
  paths: {
    tenderDocuments: 'tenders/{tenderId}/{docType}',
    extractedFiles: 'tenders/{tenderId}/extracted',
    uploads: 'uploads/{userId}',
    temp: 'temp',
  },

  // Desteklenen dosya türleri
  supportedTypes: {
    documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.odt', '.ods'],
    archives: ['.zip', '.rar', '.7z'],
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff'],
    text: ['.txt', '.csv', '.json', '.xml'],
  },

  // MIME type mapping
  mimeTypes: {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.json': 'application/json',
  },

  // Magic bytes for file type detection
  magicBytes: {
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    zip: [0x50, 0x4b, 0x03, 0x04], // PK..
    rar: [0x52, 0x61, 0x72, 0x21], // Rar!
    png: [0x89, 0x50, 0x4e, 0x47], // .PNG
    jpg: [0xff, 0xd8, 0xff], // JPEG SOI
    gif: [0x47, 0x49, 0x46], // GIF
  },

  // ZIP/Archive işleme
  archive: {
    maxExtractedFiles: parseInt(process.env.STORAGE_MAX_EXTRACTED_FILES || '100', 10),
    maxExtractedSize: parseInt(process.env.STORAGE_MAX_EXTRACTED_SIZE || '104857600', 10), // 100MB
    skipPatterns: ['__MACOSX', '.DS_Store', 'Thumbs.db', '~$'],
  },

  // Dosya adı sanitize ayarları
  filename: {
    maxLength: 200,
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Dosya adı sanitize için kontrol karakterleri kasıtlı
    replaceChars: /[<>:"/\\|?*\x00-\x1f]/g,
    replaceSpaces: true,
  },
};

export default storageConfig;
