import sessionManager from '../scraper/session-manager.js';
import fetch from 'node-fetch';

/**
 * Authenticated döküman indirme servisi
 * Session cookie'leri kullanarak ihalebul.com'dan dosya indirir
 */
class DocumentDownloadService {
    constructor() {
        this.downloadTimeout = 30000; // 30 saniye
    }

    /**
     * Dökümanı indir ve buffer olarak döndür
     */
    async downloadDocument(documentUrl) {
        console.log(`📥 Döküman indiriliyor: ${documentUrl}`);
        
        try {
            // Session cookie'lerini al
            const session = await sessionManager.loadSession();
            
            if (!session || !session.cookies) {
                throw new Error('Session bulunamadı - scraper önce çalıştırılmalı');
            }
            
            // Cookie'leri header formatına çevir
            const cookieHeader = session.cookies
                .map(c => `${c.name}=${c.value}`)
                .join('; ');
            
            console.log(`🍪 ${session.cookies.length} cookie kullanılıyor`);
            
            // Fetch ile indir (cookie ile)
            const response = await fetch(documentUrl, {
                headers: {
                    'Cookie': cookieHeader,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.ihalebul.com/',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive'
                },
                timeout: this.downloadTimeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const buffer = await response.buffer();
            console.log(`✅ Döküman indirildi: ${buffer.length} bytes`);
            
            return buffer;
            
        } catch (error) {
            console.error('❌ Döküman indirme hatası:', error.message);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new DocumentDownloadService();

