/**
 * Export Service - Dışa Aktarım Servisi
 * Excel, PDF ve Mail gönderimi için merkezi servis
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Font dosyaları
const FONT_REGULAR = path.join(__dirname, '../../fonts/Roboto-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../../fonts/Roboto-Bold.ttf');

// Temp klasörü
const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Excel dosyası oluştur
 * @param {Array} data - Veri dizisi
 * @param {Object} options - Ayarlar
 * @returns {Buffer} - Excel dosyası buffer'ı
 */
export function createExcel(data, options = {}) {
  const {
    sheetName = 'Veri',
    columns = null, // { key: 'header', ... }
    title = null,
  } = options;

  // Eğer columns tanımlıysa, veriyi düzenle
  let processedData = data;
  if (columns) {
    processedData = data.map((row) => {
      const newRow = {};
      Object.entries(columns).forEach(([key, header]) => {
        newRow[header] = row[key] ?? '';
      });
      return newRow;
    });
  }

  // Worksheet oluştur
  const ws = xlsx.utils.json_to_sheet(processedData);

  // Kolon genişlikleri
  const colWidths = [];
  if (processedData.length > 0) {
    Object.keys(processedData[0]).forEach((key, _idx) => {
      const maxLen = Math.max(key.length, ...processedData.map((row) => String(row[key] || '').length));
      colWidths.push({ wch: Math.min(maxLen + 2, 50) });
    });
    ws['!cols'] = colWidths;
  }

  // Workbook oluştur
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName);

  // Buffer olarak döndür
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * PDF dosyası oluştur
 * @param {Object} content - İçerik
 * @param {Object} options - Ayarlar
 * @returns {Promise<Buffer>} - PDF buffer'ı
 */
export function createPDF(content, _options = {}) {
  return new Promise((resolve, reject) => {
    const {
      title = 'Rapor',
      subtitle = null,
      headers = [],
      data = [],
      footer = null,
      orientation = 'landscape', // Default landscape for tables
    } = content;

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: orientation,
      bufferPages: true,
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Font kayıt - Türkçe karakter desteği için
      let fontLoaded = false;
      if (fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)) {
        doc.registerFont('Roboto', FONT_REGULAR);
        doc.registerFont('Roboto-Bold', FONT_BOLD);
        doc.font('Roboto');
        fontLoaded = true;
      } else {
      }

      const pageWidth = doc.page.width - 80;
      const startX = 40;

      // Başlık
      if (fontLoaded) doc.font('Roboto-Bold');
      doc.fontSize(18).text(title, { align: 'center' });

      if (subtitle) {
        if (fontLoaded) doc.font('Roboto');
        doc.fontSize(11).fillColor('#666').text(subtitle, { align: 'center' });
      }

      doc.moveDown(1);
      doc.fillColor('black');

      // Tarih
      if (fontLoaded) doc.font('Roboto');
      doc
        .fontSize(9)
        .text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`, {
          align: 'right',
        });
      doc.moveDown(1.5);

      // Tablo
      if (headers.length > 0 && data.length > 0) {
        const colCount = headers.length;
        const colWidth = pageWidth / colCount;
        const rowHeight = 22;
        let currentY = doc.y;

        // Header background
        doc.rect(startX, currentY - 5, pageWidth, rowHeight).fill('#f0f0f0');
        doc.fillColor('black');

        // Header text
        if (fontLoaded) doc.font('Roboto-Bold');
        doc.fontSize(9);

        headers.forEach((header, i) => {
          const cellX = startX + i * colWidth + 3;
          doc.text(truncateText(header, colWidth - 6), cellX, currentY, {
            width: colWidth - 6,
            height: rowHeight,
            lineBreak: false,
          });
        });

        currentY += rowHeight;

        // Header line
        doc.strokeColor('#333').lineWidth(1);
        doc
          .moveTo(startX, currentY)
          .lineTo(startX + pageWidth, currentY)
          .stroke();

        currentY += 3;

        // Data rows
        if (fontLoaded) doc.font('Roboto');
        doc.fontSize(8);

        data.forEach((row, rowIdx) => {
          // Sayfa kontrolü
          if (currentY > doc.page.height - 60) {
            doc.addPage();
            currentY = 40;

            // Yeni sayfada header tekrar
            doc.rect(startX, currentY - 5, pageWidth, rowHeight).fill('#f0f0f0');
            doc.fillColor('black');
            if (fontLoaded) doc.font('Roboto-Bold');
            doc.fontSize(9);
            headers.forEach((header, i) => {
              const cellX = startX + i * colWidth + 3;
              doc.text(truncateText(header, colWidth - 6), cellX, currentY, {
                width: colWidth - 6,
                height: rowHeight,
                lineBreak: false,
              });
            });
            currentY += rowHeight;
            doc.strokeColor('#333').lineWidth(1);
            doc
              .moveTo(startX, currentY)
              .lineTo(startX + pageWidth, currentY)
              .stroke();
            currentY += 3;
            if (fontLoaded) doc.font('Roboto');
            doc.fontSize(8);
          }

          // Zebra striping
          if (rowIdx % 2 === 1) {
            doc.rect(startX, currentY - 2, pageWidth, rowHeight - 2).fill('#fafafa');
            doc.fillColor('black');
          }

          // Row data
          headers.forEach((header, i) => {
            const value = row[header] ?? row[Object.keys(row)[i]] ?? '';
            const cellX = startX + i * colWidth + 3;
            doc.text(truncateText(String(value), colWidth - 6), cellX, currentY, {
              width: colWidth - 6,
              height: rowHeight - 4,
              lineBreak: false,
            });
          });

          currentY += rowHeight - 4;

          // Row separator line
          doc.strokeColor('#ddd').lineWidth(0.5);
          doc
            .moveTo(startX, currentY)
            .lineTo(startX + pageWidth, currentY)
            .stroke();
          currentY += 2;
        });
      } else if (content.text) {
        // Serbest metin
        if (fontLoaded) doc.font('Roboto');
        doc.fontSize(11).text(content.text, {
          width: pageWidth,
          align: 'left',
          lineGap: 4,
        });
      }

      // Footer
      if (footer) {
        doc.moveDown(2);
        if (fontLoaded) doc.font('Roboto');
        doc.fontSize(8).fillColor('#888').text(footer, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Metni belirli genişliğe sığacak şekilde kısalt
 */
function truncateText(text, maxWidth, fontSize = 8) {
  if (!text) return '';
  const avgCharWidth = fontSize * 0.5; // Yaklaşık karakter genişliği
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  if (text.length > maxChars) {
    return text.substring(0, maxChars - 2) + '..';
  }
  return text;
}

/**
 * Mail gönder
 * @param {Object} mailOptions - Mail ayarları
 * @param {Buffer} attachment - Ek dosya buffer'ı
 * @returns {Promise<Object>} - Gönderim sonucu
 */
export async function sendMail(mailOptions, attachment = null) {
  const {
    to,
    subject,
    text,
    html,
    attachmentName = 'rapor.xlsx',
    attachmentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } = mailOptions;

  // SMTP ayarları (.env'den alınacak)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailData = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  };

  // Ek dosya varsa ekle
  if (attachment) {
    mailData.attachments = [
      {
        filename: attachmentName,
        content: attachment,
        contentType: attachmentType,
      },
    ];
  }
  const info = await transporter.sendMail(mailData);
  return { success: true, messageId: info.messageId };
}

/**
 * Personel listesi için Excel
 */
export function createPersonelExcel(personeller) {
  return createExcel(personeller, {
    sheetName: 'Personel Listesi',
    columns: {
      tam_ad: 'Ad Soyad',
      tc_kimlik: 'TC Kimlik',
      telefon: 'Telefon',
      email: 'E-posta',
      departman: 'Departman',
      pozisyon: 'Pozisyon',
      maas: 'Maaş (TL)',
      ise_giris_tarihi: 'İşe Giriş',
      durum: 'Durum',
    },
  });
}

/**
 * Personel listesi için PDF
 */
export function createPersonelPDF(personeller) {
  return createPDF({
    title: 'PERSONEL LİSTESİ',
    subtitle: `Toplam ${personeller.length} personel`,
    headers: ['Ad Soyad', 'Departman', 'Pozisyon', 'Maaş', 'Durum'],
    data: personeller.map((p) => ({
      'Ad Soyad': p.tam_ad,
      Departman: p.departman || '-',
      Pozisyon: p.pozisyon || '-',
      Maaş: p.maas ? `${Number(p.maas).toLocaleString('tr-TR')} TL` : '-',
      Durum: p.durum || 'Aktif',
    })),
    footer: 'Catering Pro - Personel Yönetimi',
  });
}

/**
 * Fatura listesi için Excel
 */
export function createFaturaExcel(faturalar) {
  return createExcel(faturalar, {
    sheetName: 'Fatura Listesi',
    columns: {
      invoice_number: 'Fatura No',
      customer_name: 'Müşteri/Tedarikçi',
      invoice_date: 'Tarih',
      due_date: 'Vade Tarihi',
      total_amount: 'Tutar (TL)',
      vat_amount: 'KDV (TL)',
      status: 'Durum',
      type: 'Tip',
    },
  });
}

/**
 * Fatura listesi için PDF
 */
export function createFaturaPDF(faturalar) {
  return createPDF({
    title: 'FATURA LİSTESİ',
    subtitle: `Toplam ${faturalar.length} fatura`,
    headers: ['Fatura No', 'Müşteri', 'Tarih', 'Tutar', 'Durum'],
    data: faturalar.map((f) => ({
      'Fatura No': f.invoice_number || '-',
      Müşteri: f.customer_name || '-',
      Tarih: f.invoice_date ? new Date(f.invoice_date).toLocaleDateString('tr-TR') : '-',
      Tutar: f.total_amount ? `${Number(f.total_amount).toLocaleString('tr-TR')} TL` : '-',
      Durum: f.status || '-',
    })),
    footer: 'Catering Pro - Fatura Yönetimi',
  });
}

/**
 * Cari listesi için Excel
 */
export function createCariExcel(cariler) {
  return createExcel(cariler, {
    sheetName: 'Cari Listesi',
    columns: {
      unvan: 'Ünvan',
      tip: 'Tip',
      vergi_no: 'Vergi No',
      telefon: 'Telefon',
      email: 'E-posta',
      adres: 'Adres',
      bakiye: 'Bakiye (TL)',
      aktif: 'Durum',
    },
  });
}

/**
 * Cari listesi için PDF
 */
export function createCariPDF(cariler) {
  return createPDF({
    title: 'CARİ LİSTESİ',
    subtitle: `Toplam ${cariler.length} cari`,
    headers: ['Ünvan', 'Tip', 'Vergi No', 'Telefon', 'Bakiye'],
    data: cariler.map((c) => ({
      Ünvan: c.unvan || '-',
      Tip: c.tip || '-',
      'Vergi No': c.vergi_no || '-',
      Telefon: c.telefon || '-',
      Bakiye: c.bakiye ? `${Number(c.bakiye).toLocaleString('tr-TR')} TL` : '0 TL',
    })),
    footer: 'Catering Pro - Cari Yönetimi',
  });
}

/**
 * Stok listesi için Excel
 */
export function createStokExcel(stoklar) {
  return createExcel(stoklar, {
    sheetName: 'Stok Listesi',
    columns: {
      ad: 'Ürün Adı',
      kod: 'Stok Kodu',
      kategori: 'Kategori',
      birim: 'Birim',
      miktar: 'Miktar',
      birim_fiyat: 'Birim Fiyat (TL)',
      kritik_stok: 'Kritik Seviye',
    },
  });
}

/**
 * Stok listesi için PDF
 */
export function createStokPDF(stoklar) {
  return createPDF({
    title: 'STOK LİSTESİ',
    subtitle: `Toplam ${stoklar.length} ürün`,
    headers: ['Ürün Adı', 'Kod', 'Kategori', 'Miktar', 'Birim Fiyat'],
    data: stoklar.map((s) => ({
      'Ürün Adı': s.ad || '-',
      Kod: s.kod || '-',
      Kategori: s.kategori || '-',
      Miktar: `${s.miktar || 0} ${s.birim || ''}`,
      'Birim Fiyat': s.birim_fiyat ? `${Number(s.birim_fiyat).toLocaleString('tr-TR')} TL` : '-',
    })),
    footer: 'Catering Pro - Stok Yönetimi',
  });
}

/**
 * Dilekçe için PDF oluştur
 * @param {Object} dilekce - Dilekçe bilgileri
 * @returns {Promise<Buffer>} - PDF buffer'ı
 */
export function createDilekcePDF(dilekce) {
  return new Promise((resolve, reject) => {
    const { title = 'DİLEKÇE', type = 'genel', content = '', ihale = {}, footer = null } = dilekce;

    const doc = new PDFDocument({
      margin: 60,
      size: 'A4',
      layout: 'portrait',
      bufferPages: true,
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      // Font kayıt
      let fontLoaded = false;
      if (fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)) {
        doc.registerFont('Roboto', FONT_REGULAR);
        doc.registerFont('Roboto-Bold', FONT_BOLD);
        doc.font('Roboto');
        fontLoaded = true;
      }

      const pageWidth = doc.page.width - 120;
      const _startX = 60;

      // Başlık
      if (fontLoaded) doc.font('Roboto-Bold');
      doc.fontSize(14).text(title.toUpperCase(), { align: 'center' });
      doc.moveDown(0.5);

      // İhale bilgileri (varsa)
      if (ihale.baslik || ihale.kurum) {
        if (fontLoaded) doc.font('Roboto');
        doc.fontSize(10).fillColor('#555');
        if (ihale.kurum) doc.text(`Kurum: ${ihale.kurum}`, { align: 'center' });
        if (ihale.baslik) doc.text(`İhale: ${ihale.baslik}`, { align: 'center' });
        if (ihale.ihale_no) doc.text(`İhale No: ${ihale.ihale_no}`, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown(1.5);
      } else {
        doc.moveDown(1);
      }

      // Dilekçe içeriği
      if (fontLoaded) doc.font('Roboto');
      doc.fontSize(11).text(content, {
        width: pageWidth,
        align: 'justify',
        lineGap: 5,
        paragraphGap: 10,
      });

      // Footer
      doc.moveDown(2);
      if (fontLoaded) doc.font('Roboto');
      doc
        .fontSize(8)
        .fillColor('#888')
        .text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`, {
          align: 'right',
        });

      if (footer) {
        doc.text(footer, { align: 'center' });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  createExcel,
  createPDF,
  sendMail,
  createPersonelExcel,
  createPersonelPDF,
  createFaturaExcel,
  createFaturaPDF,
  createCariExcel,
  createCariPDF,
  createStokExcel,
  createStokPDF,
  createDilekcePDF,
};
