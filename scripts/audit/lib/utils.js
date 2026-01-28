/**
 * Audit Utilities
 * Paylaşılan yardımcı fonksiyonlar
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Glob pattern ile dosya bul (basit implementasyon)
 * @param {string} pattern - Glob pattern
 * @param {string} cwd - Working directory
 * @param {Array} ignore - Ignore patterns
 * @returns {Promise<string[]>} Dosya listesi
 */
export async function findFiles(pattern, cwd, ignore = []) {
  const results = [];
  const extensions = extractExtensions(pattern);

  async function walkDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(cwd, fullPath);

        // Ignore kontrolü
        if (shouldIgnore(relativePath, ignore)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          if (matchesPattern(entry.name, extensions)) {
            results.push(relativePath);
          }
        }
      }
    } catch (error) {
      // Erişim hatası durumunda devam et
    }
  }

  await walkDir(cwd);
  return results;
}

/**
 * Pattern'den extension'ları çıkar
 */
function extractExtensions(pattern) {
  const match = pattern.match(/\*\.(\{[^}]+\}|[a-z]+)/i);
  if (!match) return [];

  const extPart = match[1];
  if (extPart.startsWith('{')) {
    return extPart
      .slice(1, -1)
      .split(',')
      .map((e) => '.' + e.trim());
  }
  return ['.' + extPart];
}

/**
 * Dosya adının pattern'e uyup uymadığını kontrol et
 */
function matchesPattern(filename, extensions) {
  if (extensions.length === 0) return true;
  return extensions.some((ext) => filename.endsWith(ext));
}

/**
 * Path'in ignore listesinde olup olmadığını kontrol et
 */
function shouldIgnore(relativePath, ignorePatterns) {
  for (const pattern of ignorePatterns) {
    const cleanPattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '').replace(/\//g, path.sep);

    if (cleanPattern.startsWith('.')) {
      // .env, .git gibi dosyalar
      if (relativePath.includes(cleanPattern)) return true;
    } else if (relativePath.includes('node_modules') || relativePath.includes('.git') || relativePath.includes('dist')) {
      return true;
    }
  }
  return false;
}

/**
 * Dosya içeriğini oku
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<string|null>} Dosya içeriği veya null
 */
export async function readFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * JSON dosyası oku
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<Object|null>} JSON objesi veya null
 */
export async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Komut çalıştır
 * @param {string} command - Komut
 * @param {Object} options - Seçenekler
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function runCommand(command, options = {}) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: options.timeout || 60000,
      cwd: options.cwd,
    });
    return { stdout, stderr, success: true };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      success: false,
      code: error.code,
    };
  }
}

/**
 * Dosya var mı kontrol et
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Satır numarası bul
 * @param {string} content - Dosya içeriği
 * @param {number} index - Karakter indexi
 * @returns {number} Satır numarası
 */
export function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Kod snippet'i çıkar
 * @param {string} content - Dosya içeriği
 * @param {number} line - Satır numarası
 * @param {number} maxLength - Maksimum uzunluk
 * @returns {string} Snippet
 */
export function extractSnippet(content, line, maxLength = 200) {
  const lines = content.split('\n');
  const targetLine = lines[line - 1] || '';
  const trimmed = targetLine.trim();
  return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
}

/**
 * Path'i normalize et
 * @param {string} p - Path
 * @returns {string} Normalized path
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Dosya boyutunu al (MB)
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<number>} Boyut (MB)
 */
export async function getFileSizeMB(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size / (1024 * 1024);
  } catch {
    return 0;
  }
}

/**
 * Dizindeki dosyaları listele
 * @param {string} dirPath - Dizin yolu
 * @returns {Promise<string[]>} Dosya listesi
 */
export async function listDirectory(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

/**
 * Regex ile metin ara
 * @param {string} content - İçerik
 * @param {RegExp} pattern - Pattern
 * @returns {Array} Eşleşmeler
 */
export function findMatches(content, pattern) {
  const matches = [];
  let match;
  const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  while ((match = regex.exec(content)) !== null) {
    matches.push({
      match: match[0],
      index: match.index,
      groups: match.groups || {},
    });
  }

  return matches;
}

/**
 * Redact secret value
 * @param {string} text - Text containing secret
 * @returns {string} Redacted text
 */
export function redactSecret(text) {
  const parts = text.split(/[:=]/);
  if (parts.length > 1) {
    const secret = parts[1].replace(/['"]/g, '').trim();
    if (secret.length > 8) {
      return `${parts[0]}=${secret.substring(0, 4)}****${secret.slice(-4)}`;
    }
  }
  return text.substring(0, 10) + '****';
}
