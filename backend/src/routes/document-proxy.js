import express from 'express';
import { query } from '../database.js';
import documentDownloadService from '../services/document-download.js';

const router = express.Router();

/**
 * İhale dökümanlarını proxy olarak indirme endpoint'i
 * GET /api/documents/download/:tenderId/:type
 */
router.get('/download/:tenderId/:type', async (req, res) => {
    try {
        const { tenderId, type } = req.params;
        
        console.log(`📥 Döküman indirilecek: İhale ${tenderId}, Tip: ${type}`);
        
        // İhale döküman linklerini database'den al
        const result = await query(`
            SELECT document_links, title 
            FROM tenders 
            WHERE id = $1
        `, [tenderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        const tender = result.rows[0];
        const documentLinks = tender.document_links || {};
        
        // Type'a göre ilgili linki bul
        const docData = documentLinks[type];
        
        // Object veya string formatını destekle
        let downloadUrl = null;
        if (typeof docData === 'string') {
            downloadUrl = docData;
        } else if (docData && docData.url) {
            downloadUrl = docData.url;
        }
        
        let fileName = `ihale-${tenderId}`;

        const fileNames = {
            'admin_spec': '-idari-sartname',
            'tech_spec': '-teknik-sartname',
            'project_files': '-proje-dosyalari',
            'announcement': '-ihale-ilani',
            'zeyilname': '-zeyilname',
            'contract': '-sozlesme-tasarisi',
            'unit_price': '-birim-fiyat',
            'pursantaj': '-pursantaj',
            'quantity_survey': '-mahal-listesi',
            'standard_forms': '-standart-formlar'
        };

        // Tip için dosya adını bul
        let suffix = fileNames[type];
        if (!suffix) {
            // admin_spec_2 gibi numaralı tipler için
            for (const [key, val] of Object.entries(fileNames)) {
                if (type.startsWith(key + '_')) {
                    const num = type.replace(key + '_', '');
                    suffix = `${val}-${num}`;
                    break;
                }
            }
        }
        fileName += suffix || `-${type}`;
        
        if (!downloadUrl) {
            return res.status(404).json({ 
                error: 'Bu tip döküman bulunamadı',
                availableTypes: Object.keys(documentLinks)
            });
        }
        
        console.log(`🔗 Authenticated download başlıyor: ${downloadUrl}`);
        
        // Puppeteer session ile indir
        const fileBuffer = await documentDownloadService.downloadDocument(downloadUrl);
        
        // Content-Type'ı tahmin et (URL'den)
        let contentType = 'application/octet-stream';
        let extension = '.pdf';
        
        if (downloadUrl.includes('.pdf') || downloadUrl.includes('idari') || downloadUrl.includes('teknik')) {
            contentType = 'application/pdf';
            extension = '.pdf';
        } else if (downloadUrl.includes('.zip')) {
            contentType = 'application/zip';
            extension = '.zip';
        } else if (downloadUrl.includes('.doc')) {
            contentType = 'application/msword';
            extension = '.doc';
        }
        
        // Response headers'ını ayarla
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}${extension}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        
        // Buffer'ı gönder
        res.send(fileBuffer);
        
        console.log(`✅ Döküman başarıyla indirildi: ${fileName}${extension} (${fileBuffer.length} bytes)`);
        
    } catch (error) {
        console.error('❌ Döküman proxy hatası:', error);
        res.status(500).json({ 
            error: 'Döküman indirme hatası',
            message: error.message 
        });
    }
});

/**
 * İhale için mevcut döküman tiplerini listeleme
 * GET /api/documents/list/:tenderId
 */
router.get('/list/:tenderId', async (req, res) => {
    try {
        const { tenderId } = req.params;
        
        const result = await query(`
            SELECT document_links, title 
            FROM tenders 
            WHERE id = $1
        `, [tenderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        const tender = result.rows[0];
        const documentLinks = tender.document_links || {};
        
        // Mevcut dökümanları formatla
        const availableDocuments = [];
        
        for (const [type, data] of Object.entries(documentLinks)) {
            if (data) {
                // Object veya string formatını destekle
                const url = typeof data === 'string' ? data : data.url;
                const name = (typeof data === 'object' && data.name) ? data.name : getDisplayName(type);
                
                if (url) {
                    availableDocuments.push({
                        type,
                        displayName: name,
                        downloadUrl: `/api/documents/download/${tenderId}/${type}`,
                        originalUrl: url
                    });
                }
            }
        }
        
        res.json({
            tenderId: parseInt(tenderId),
            tenderTitle: tender.title,
            documents: availableDocuments,
            totalCount: availableDocuments.length
        });
        
    } catch (error) {
        console.error('❌ Döküman listeleme hatası:', error);
        res.status(500).json({ error: 'Döküman listeleme hatası' });
    }
});

/**
 * File extension'ı content-type'dan çıkar
 */
function getFileExtension(contentType) {
    const extensions = {
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/zip': '.zip',
        'application/x-zip-compressed': '.zip',
        'image/jpeg': '.jpg',
        'image/png': '.png'
    };
    
    return extensions[contentType] || '.pdf';
}

/**
 * Type'ı okunabilir isme çevir
 */
function getDisplayName(type) {
    const names = {
        'admin_spec': 'İdari Şartname',
        'tech_spec': 'Teknik Şartname',
        'project_files': 'Proje Dosyaları',
        'announcement': 'İhale İlanı',
        'zeyilname': 'Zeyilname',
        'contract': 'Sözleşme Tasarısı',
        'unit_price': 'Birim Fiyat Teklif Cetveli',
        'pursantaj': 'Pursantaj Listesi',
        'quantity_survey': 'Mahal Listesi / Metraj',
        'standard_forms': 'Standart Formlar'
    };

    // document_1 → Döküman 1
    if (type.startsWith('document_')) {
        const num = type.replace('document_', '');
        return `Döküman ${num}`;
    }

    // admin_spec_2 → İdari Şartname 2
    for (const [key, value] of Object.entries(names)) {
        if (type.startsWith(key + '_')) {
            const num = type.replace(key + '_', '');
            return `${value} ${num}`;
        }
    }

    return names[type] || type.replace(/_/g, ' ');
}

/**
 * Tek bir ihale için dökümanları scrape et (on-demand)
 * GET /api/documents/scrape/:tenderId
 */
router.post('/scrape/:tenderId', async (req, res) => {
    try {
        const { tenderId } = req.params;
        
        // İhaleyi bul
        const result = await query('SELECT id, url, title FROM tenders WHERE id = $1', [tenderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'İhale bulunamadı' });
        }
        
        const tender = result.rows[0];
        
        // Zaten döküman varsa tekrar çekme
        const existingDocs = await query('SELECT document_links FROM tenders WHERE id = $1', [tenderId]);
        if (existingDocs.rows[0].document_links && Object.keys(existingDocs.rows[0].document_links).length > 0) {
            return res.json({
                success: true,
                message: 'Dökümanlar zaten mevcut',
                cached: true
            });
        }
        
        console.log(`📚 On-demand scraping: İhale ${tenderId}`);
        
        // Dynamic import to avoid circular dependency
        const { default: documentScraper } = await import('../scraper/document-scraper.js');
        
        // Sadece bu ihale için döküman çek
        const result2 = await documentScraper.updateDocumentLinks([tender], 1);
        
        res.json({
            success: result2.successCount > 0,
            message: result2.successCount > 0 ? 'Dökümanlar çekildi' : 'Döküman bulunamadı',
            cached: false
        });
        
    } catch (error) {
        console.error('❌ On-demand scraping hatası:', error);
        res.status(500).json({ 
            error: 'Döküman çekme hatası',
            message: error.message 
        });
    }
});

export default router;