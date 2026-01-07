import browserManager from './browser-manager.js';
import loginService from './login-service.js';
import { query } from '../database.js';

class DocumentScraper {
    constructor() {
        this.retryDelay = 2000;
        this.maxRetries = 3;
    }

    /**
     * İhale ilanı içeriğini çeker (text olarak)
     */
    async scrapeAnnouncementContent(page) {
        try {
            const content = await page.evaluate(() => {
                // İhale İlanı bölümünü bul
                const cards = document.querySelectorAll('.card');
                for (const card of cards) {
                    const header = card.querySelector('.card-header, h5, h4');
                    if (header && header.textContent.includes('İhale İlanı')) {
                        const body = card.querySelector('.card-body, .card-content');
                        if (body) {
                            // Tüm text içeriğini al, HTML taglerini temizle
                            return body.innerText.trim();
                        }
                    }
                }
                
                // Alternatif: tablo formatında olabilir
                const tables = document.querySelectorAll('table');
                for (const table of tables) {
                    const prevEl = table.previousElementSibling;
                    if (prevEl && prevEl.textContent.includes('İhale İlanı')) {
                        const rows = [];
                        table.querySelectorAll('tr').forEach(tr => {
                            const cells = [];
                            tr.querySelectorAll('td, th').forEach(td => {
                                cells.push(td.innerText.trim());
                            });
                            if (cells.length > 0) rows.push(cells.join(': '));
                        });
                        return rows.join('\n');
                    }
                }
                
                return null;
            });
            
            return content;
        } catch (error) {
            console.error(`     ⚠️ İhale ilanı çekme hatası: ${error.message}`);
            return null;
        }
    }

    /**
     * Mal/Hizmet listesini çeker (JSON array olarak)
     */
    async scrapeGoodsServicesList(page) {
        try {
            const content = await page.evaluate(() => {
                // Mal/Hizmet Listesi tablosunu bul
                const tables = document.querySelectorAll('table');
                
                for (const table of tables) {
                    // Önceki elementi veya parent'ı kontrol et
                    const parent = table.closest('.card');
                    const prevEl = table.previousElementSibling;
                    const headerText = parent?.querySelector('.card-header')?.textContent || 
                                      prevEl?.textContent || '';
                    
                    if (headerText.includes('Mal') || headerText.includes('Hizmet') || 
                        table.innerHTML.includes('Miktar') || table.innerHTML.includes('Birim')) {
                        
                        const rows = [];
                        const headers = [];
                        
                        // Header'ları al
                        const headerRow = table.querySelector('thead tr, tr:first-child');
                        if (headerRow) {
                            headerRow.querySelectorAll('th, td').forEach(cell => {
                                headers.push(cell.innerText.trim());
                            });
                        }
                        
                        // Data satırlarını al
                        const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                        dataRows.forEach(tr => {
                            const row = {};
                            tr.querySelectorAll('td').forEach((td, idx) => {
                                const key = headers[idx] || `col_${idx}`;
                                row[key] = td.innerText.trim();
                            });
                            if (Object.keys(row).length > 0) {
                                rows.push(row);
                            }
                        });
                        
                        if (rows.length > 0) {
                            return rows;
                        }
                    }
                }
                
                return null;
            });
            
            return content;
        } catch (error) {
            console.error(`     ⚠️ Mal/Hizmet listesi çekme hatası: ${error.message}`);
            return null;
        }
    }

    /**
     * Tüm içerikleri çeker (döküman linkleri + içerikler)
     * Tab'ları da kontrol eder
     */
    async scrapeAllContent(page, tenderUrl) {
        try {
            console.log(`🔗 İçerik çekiliyor: ${tenderUrl}`);

            await page.goto(tenderUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await page.waitForSelector('body', { timeout: 10000 });

            // Önce mevcut sayfadaki dökümanları çek
            let allDocumentLinks = await this.scrapeDocumentLinksFromPage(page);

            // Tab'ları kontrol et ve tıkla
            const tabDocuments = await this.scrapeTabContents(page);

            // Tab'lardan gelen dökümanları birleştir
            allDocumentLinks = { ...allDocumentLinks, ...tabDocuments };

            // İhale ilanı içeriğini çek
            const announcementContent = await this.scrapeAnnouncementContent(page);

            // Mal/Hizmet listesini çek
            const goodsServicesList = await this.scrapeGoodsServicesList(page);

            const docCount = Object.keys(allDocumentLinks).length;
            console.log(`     ✅ ${docCount} döküman, İlan: ${announcementContent ? 'var' : 'yok'}, Mal/Hizmet: ${goodsServicesList ? goodsServicesList.length + ' kalem' : 'yok'}`);

            return {
                documentLinks: allDocumentLinks,
                announcementContent,
                goodsServicesList
            };

        } catch (error) {
            console.error(`     ❌ İçerik scraping hatası: ${error.message}`);
            return {
                documentLinks: {},
                announcementContent: null,
                goodsServicesList: null
            };
        }
    }

    /**
     * Tab içeriklerini tarar (Zeyilname, Dökümanlar, vb.)
     */
    async scrapeTabContents(page) {
        const allTabDocuments = {};

        try {
            // Tab butonlarını bul
            const tabs = await page.evaluate(() => {
                const tabElements = document.querySelectorAll(
                    '.nav-tabs .nav-link, .nav-pills .nav-link, [role="tab"], .tab-link, [data-bs-toggle="tab"], [data-toggle="tab"]'
                );

                return Array.from(tabElements).map((tab, index) => ({
                    index,
                    text: tab.textContent?.trim() || '',
                    id: tab.id || null,
                    href: tab.getAttribute('href') || tab.getAttribute('data-bs-target') || null
                }));
            });

            console.log(`     📑 ${tabs.length} tab bulundu`);

            // Her tab'ı tıkla ve dökümanları çek
            for (const tab of tabs) {
                try {
                    // Tab'ı tıkla
                    const clicked = await page.evaluate((tabIndex) => {
                        const tabElements = document.querySelectorAll(
                            '.nav-tabs .nav-link, .nav-pills .nav-link, [role="tab"], .tab-link, [data-bs-toggle="tab"], [data-toggle="tab"]'
                        );
                        if (tabElements[tabIndex]) {
                            tabElements[tabIndex].click();
                            return true;
                        }
                        return false;
                    }, tab.index);

                    if (clicked) {
                        // Tab içeriğinin yüklenmesini bekle
                        await this.sleep(500);

                        // Bu tab'daki dökümanları çek
                        const tabDocs = await this.scrapeDocumentLinksFromPage(page);

                        // Tab ismini prefix olarak ekle (zeyilname tab'ı için)
                        const lowerTabText = tab.text.toLowerCase();
                        for (const [key, value] of Object.entries(tabDocs)) {
                            // Eğer bu döküman zaten ana listede yoksa ekle
                            if (!allTabDocuments[key]) {
                                // Zeyilname tab'ındaysa ve tip belirlenmemişse, zeyilname olarak işaretle
                                if (lowerTabText.includes('zeyil') && key.startsWith('document_')) {
                                    const newKey = `zeyilname_${key.replace('document_', '')}`;
                                    allTabDocuments[newKey] = {
                                        ...value,
                                        name: value.name || `Zeyilname ${key.replace('document_', '')}`,
                                        fromTab: tab.text
                                    };
                                } else {
                                    allTabDocuments[key] = {
                                        ...value,
                                        fromTab: tab.text
                                    };
                                }
                            }
                        }
                    }
                } catch (tabError) {
                    // Tab hatası - devam et
                    console.log(`     ⚠️ Tab hatası (${tab.text}): ${tabError.message}`);
                }
            }
        } catch (error) {
            console.log(`     ⚠️ Tab tarama hatası: ${error.message}`);
        }

        return allTabDocuments;
    }

    /**
     * Sayfa içinden TÜM döküman linklerini çeker (sayfa zaten yüklü)
     * Sitede ne varsa hepsini yakalar
     */
    async scrapeDocumentLinksFromPage(page) {
        return await page.evaluate(() => {
            const documents = {};
            const seenUrls = new Set();
            let unknownCounter = 1;

            // Geniş selector - download, file, dosya, attachment içeren tüm linkler
            const selectors = [
                'a[href*="download"]',
                'a[href*="file"]',
                'a[href*="dosya"]',
                'a[href*="attachment"]',
                'a[href*="document"]',
                'a[href*=".pdf"]',
                'a[href*=".doc"]',
                'a[href*=".xls"]',
                'a[href*=".zip"]',
                'a[href*=".rar"]'
            ];

            const allLinks = document.querySelectorAll(selectors.join(', '));

            for (const link of allLinks) {
                if (!link.href || !link.href.includes('http')) continue;

                const href = link.href;

                // Aynı URL'yi tekrar ekleme
                if (seenUrls.has(href)) continue;
                seenUrls.add(href);

                // Döküman bilgilerini çıkar
                let docType = null;
                let docName = null;
                let fileName = null;

                try {
                    const url = new URL(href);
                    const hash = url.searchParams.get('hash');

                    if (hash) {
                        // Base64 decode et
                        const decodedHash = atob(hash.replace(/%3d/gi, '=').replace(/%3D/gi, '='));
                        fileName = decodedHash;

                        // Bilinen döküman tiplerini algıla
                        const lowerHash = decodedHash.toLowerCase();

                        if (lowerHash.includes('.idari.') || lowerHash.includes('idari')) {
                            docType = 'admin_spec';
                            docName = 'İdari Şartname';
                        } else if (lowerHash.includes('.teknik.') || lowerHash.includes('teknik')) {
                            docType = 'tech_spec';
                            docName = 'Teknik Şartname';
                        } else if (lowerHash.includes('.proje.') || lowerHash.includes('proje')) {
                            docType = 'project_files';
                            docName = 'Proje Dosyaları';
                        } else if (lowerHash.includes('.ilan.') || lowerHash.includes('ilan')) {
                            docType = 'announcement';
                            docName = 'İhale İlanı';
                        } else if (lowerHash.includes('zeyilname') || lowerHash.includes('zeyil')) {
                            docType = 'zeyilname';
                            docName = 'Zeyilname';
                        } else if (lowerHash.includes('sozlesme') || lowerHash.includes('sözleşme')) {
                            docType = 'contract';
                            docName = 'Sözleşme Tasarısı';
                        } else if (lowerHash.includes('birim_fiyat') || lowerHash.includes('birimfiyat')) {
                            docType = 'unit_price';
                            docName = 'Birim Fiyat Teklif Cetveli';
                        } else if (lowerHash.includes('pursantaj')) {
                            docType = 'pursantaj';
                            docName = 'Pursantaj Listesi';
                        } else if (lowerHash.includes('mahal') || lowerHash.includes('metraj')) {
                            docType = 'quantity_survey';
                            docName = 'Mahal Listesi / Metraj';
                        } else if (lowerHash.includes('standart_form') || lowerHash.includes('standartform')) {
                            docType = 'standard_forms';
                            docName = 'Standart Formlar';
                        }
                    }
                } catch (e) {
                    // Hash decode hatası - devam et
                }

                // Link text'inden isim çıkar
                const linkText = link.textContent?.trim() || link.innerText?.trim();
                if (linkText && linkText.length > 2 && linkText.length < 100) {
                    if (!docName) {
                        docName = linkText;
                    }

                    // Link text'inden de tip çıkarmaya çalış
                    if (!docType) {
                        const lowerText = linkText.toLowerCase();
                        if (lowerText.includes('idari')) {
                            docType = 'admin_spec';
                        } else if (lowerText.includes('teknik')) {
                            docType = 'tech_spec';
                        } else if (lowerText.includes('zeyilname') || lowerText.includes('zeyil')) {
                            docType = 'zeyilname';
                        } else if (lowerText.includes('ilan')) {
                            docType = 'announcement';
                        } else if (lowerText.includes('sözleşme') || lowerText.includes('sozlesme')) {
                            docType = 'contract';
                        }
                    }
                }

                // Hala tip belirlenemadiyse, sıralı numara ver
                if (!docType) {
                    docType = `document_${unknownCounter}`;
                    unknownCounter++;
                }

                // Aynı tip zaten varsa, numara ekle
                let finalType = docType;
                if (documents[docType]) {
                    let counter = 2;
                    while (documents[`${docType}_${counter}`]) {
                        counter++;
                    }
                    finalType = `${docType}_${counter}`;
                }

                // Dökümanı kaydet (hem URL hem metadata)
                documents[finalType] = {
                    url: href,
                    name: docName || finalType,
                    fileName: fileName || null,
                    scrapedAt: new Date().toISOString()
                };
            }

            return documents;
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new DocumentScraper();

