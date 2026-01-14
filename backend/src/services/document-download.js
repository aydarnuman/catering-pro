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
            // Session cookie'lerini al (varsa)
            let headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.ihalebul.com/',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            };

            try {
                const session = await sessionManager.loadSession();
                if (session && session.cookies && session.cookies.length > 0) {
                    // Cookie'leri header formatına çevir
                    const cookieHeader = session.cookies
                        .map(c => `${c.name}=${c.value}`)
                        .join('; ');
                    
                    headers['Cookie'] = cookieHeader;
                    console.log(`🍪 ${session.cookies.length} cookie kullanılıyor`);
                } else {
                    console.log(`⚠️ Session bulunamadı, cookie olmadan deneniyor...`);
                }
            } catch (sessionError) {
                console.log(`⚠️ Session yüklenemedi: ${sessionError.message}, cookie olmadan deneniyor...`);
            }
            
            // Fetch ile indir (cookie ile veya olmadan)
            const response = await fetch(documentUrl, {
                headers,
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

