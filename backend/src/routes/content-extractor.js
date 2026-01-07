import express from 'express';
import { query } from '../database.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Font dosyaları
const FONT_REGULAR = path.join(__dirname, '../../fonts/Roboto-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../../fonts/Roboto-Bold.ttf');

const router = express.Router();

/**
 * İhale İlanı içeriğini DB'den çekip PDF yap
 * GET /api/content/announcement/:tenderId
 * ⚡ HIZLI - Direkt DB'den okur
 */
router.get('/announcement/:tenderId', async (req, res) => {
    try {
        const { tenderId } = req.params;
        
        // DB'den ilan içeriğini al
        const result = await query(
            'SELECT id, title, organization_name, city, tender_date, announcement_content FROM tenders WHERE id = $1', 
            [tenderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        const tender = result.rows[0];
        
        if (!tender.announcement_content) {
            return res.status(404).json({ error: 'Bu ihale için ilan içeriği henüz çekilmemiş. Scraper yeniden çalıştırılmalı.' });
        }
        
        console.log(`📄 İhale İlanı PDF oluşturuluyor: ${tenderId}`);
        
        // PDF oluştur - Türkçe font ile
        const doc = new PDFDocument({ margin: 50 });
        
        // Türkçe fontları kaydet
        doc.registerFont('Roboto', FONT_REGULAR);
        doc.registerFont('Roboto-Bold', FONT_BOLD);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="ihale-ilani-${tenderId}.pdf"`);
        
        doc.pipe(res);
        
        // PDF içeriği - Türkçe font kullan
        doc.font('Roboto-Bold').fontSize(20).text('İHALE İLANI', { align: 'center' });
        doc.moveDown();
        
        doc.font('Roboto-Bold').fontSize(14).text(`${tender.title}`, { align: 'center' });
        doc.moveDown();
        
        doc.font('Roboto').fontSize(11)
           .text(`Kurum: ${tender.organization_name || '-'}`)
           .text(`Şehir: ${tender.city || '-'}`)
           .text(`İhale Tarihi: ${tender.tender_date ? new Date(tender.tender_date).toLocaleDateString('tr-TR') : '-'}`);
        doc.moveDown();
        
        doc.fontSize(10).text('─'.repeat(80));
        doc.moveDown();
        
        // İlan içeriği
        doc.font('Roboto').fontSize(11).text(tender.announcement_content, { 
            width: 500, 
            align: 'left',
            lineGap: 4
        });
        
        doc.moveDown(2);
        doc.font('Roboto').fontSize(9).fillColor('gray')
           .text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR')}`, 
                 { align: 'right' });
        
        doc.end();
        
        console.log(`✅ İhale İlanı PDF oluşturuldu: ${tenderId}`);
        
    } catch (error) {
        console.error('❌ İhale İlanı PDF hatası:', error);
        res.status(500).json({ error: 'PDF oluşturulamadı' });
    }
});

/**
 * Mal/Hizmet Listesini DB'den çekip CSV yap
 * GET /api/content/goods-services/:tenderId
 * ⚡ HIZLI - Direkt DB'den okur
 */
router.get('/goods-services/:tenderId', async (req, res) => {
    try {
        const { tenderId } = req.params;
        
        // DB'den mal/hizmet listesini al
        const result = await query(
            'SELECT id, title, goods_services_content FROM tenders WHERE id = $1', 
            [tenderId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        const tender = result.rows[0];
        
        if (!tender.goods_services_content) {
            return res.status(404).json({ error: 'Bu ihale için mal/hizmet listesi henüz çekilmemiş. Scraper yeniden çalıştırılmalı.' });
        }
        
        console.log(`📋 Mal/Hizmet Listesi CSV oluşturuluyor: ${tenderId}`);
        
        const serviceData = tender.goods_services_content;
        
        // CSV oluştur
        let csvContent = '';
        
        if (Array.isArray(serviceData) && serviceData.length > 0) {
            // Header'ları al (ilk satırın key'leri)
            const headers = Object.keys(serviceData[0]);
            csvContent = headers.map(h => `"${h}"`).join(';') + '\n';
            
            // Data satırları
            serviceData.forEach(row => {
                const values = headers.map(h => {
                    const val = row[h] || '';
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csvContent += values.join(';') + '\n';
            });
        } else {
            // JSON olarak kaydetmiş olabiliriz
            csvContent = 'İçerik\n';
            csvContent += `"${JSON.stringify(serviceData)}"\n`;
        }
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="mal-hizmet-listesi-${tenderId}.csv"`);
        
        res.write('\uFEFF'); // BOM for Excel
        res.write(csvContent);
        res.end();
        
        console.log(`✅ Mal/Hizmet Listesi CSV oluşturuldu: ${tenderId}`);
        
    } catch (error) {
        console.error('❌ Mal/Hizmet Listesi CSV hatası:', error);
        res.status(500).json({ error: 'CSV oluşturulamadı' });
    }
});

/**
 * İçerik durumunu kontrol et
 * GET /api/content/status/:tenderId
 */
router.get('/status/:tenderId', async (req, res) => {
    try {
        const { tenderId } = req.params;
        
        const result = await query(`
            SELECT 
                id,
                title,
                announcement_content IS NOT NULL as has_announcement,
                goods_services_content IS NOT NULL as has_goods_services,
                document_links IS NOT NULL as has_document_links
            FROM tenders 
            WHERE id = $1
        `, [tenderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('❌ Status hatası:', error);
        res.status(500).json({ error: 'Durum kontrol edilemedi' });
    }
});

export default router;
