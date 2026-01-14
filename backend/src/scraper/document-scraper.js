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

            // Zeyilname ve Düzeltme İlanı içeriklerini çek
            const additionalContent = await this.scrapeAdditionalContent(page);

            const docCount = Object.keys(allDocumentLinks).length;
            console.log(`     ✅ ${docCount} döküman, İlan: ${announcementContent ? 'var' : 'yok'}, Mal/Hizmet: ${goodsServicesList ? goodsServicesList.length + ' kalem' : 'yok'}`);
            if (additionalContent.zeyilname) console.log(`     📋 Zeyilname içeriği bulundu`);
            if (additionalContent.correctionNotice) console.log(`     📋 Düzeltme ilanı içeriği bulundu`);

            return {
                documentLinks: allDocumentLinks,
                announcementContent,
                goodsServicesList,
                zeyilnameContent: additionalContent.zeyilname,
                correctionNoticeContent: additionalContent.correctionNotice
            };

        } catch (error) {
            console.error(`     ❌ İçerik scraping hatası: ${error.message}`);
            return {
                documentLinks: {},
                announcementContent: null,
                goodsServicesList: null,
                zeyilnameContent: null,
                correctionNoticeContent: null
            };
        }
    }

    /**
     * Zeyilname ve Düzeltme İlanı içeriklerini çek
     * ihalebul.com'da bu içerikler card içinde gösteriliyor
     */
    async scrapeAdditionalContent(page) {
        const result = {
            zeyilname: null,
            correctionNotice: null,
            isUpdated: false,
            lastUpdateDate: null
        };

        try {
            // ihalebul.com yapısı: Her içerik bir card içinde
            // Zeyilname ve Düzeltme İlanı başlıklarını bul ve içeriklerini çek
            
            const additionalData = await page.evaluate(() => {
                const data = {
                    zeyilname: null,
                    correctionNotice: null,
                    isUpdated: false
                };
                
                // Tüm card'ları tara
                const cards = document.querySelectorAll('.card');
                
                for (const card of cards) {
                    const cardText = card.textContent || '';
                    const cardTextLower = cardText.toLowerCase();
                    
                    // Zeyilname card'ı
                    if (cardTextLower.includes('zeyilname') && !cardTextLower.includes('teknik şartname')) {
                        // Card başlığını kontrol et
                        const header = card.querySelector('.card-header, h5, h6, .title');
                        if (header && header.textContent?.toLowerCase().includes('zeyilname')) {
                            // Card body içeriğini al
                            const body = card.querySelector('.card-body, .content');
                            if (body) {
                                const content = body.textContent?.trim();
                                if (content && content.length > 20) {
                                    data.zeyilname = {
                                        title: 'Zeyilname',
                                        content: content.substring(0, 5000), // Max 5000 karakter
                                        scrapedAt: new Date().toISOString()
                                    };
                                    data.isUpdated = true;
                                }
                            }
                        }
                    }
                    
                    // Düzeltme İlanı card'ı
                    if (cardTextLower.includes('düzeltme') && cardTextLower.includes('ilan')) {
                        const header = card.querySelector('.card-header, h5, h6, .title');
                        if (header && header.textContent?.toLowerCase().includes('düzeltme')) {
                            const body = card.querySelector('.card-body, .content');
                            if (body) {
                                const content = body.textContent?.trim();
                                if (content && content.length > 20) {
                                    data.correctionNotice = {
                                        title: 'Düzeltme İlanı',
                                        content: content.substring(0, 5000),
                                        scrapedAt: new Date().toISOString()
                                    };
                                    data.isUpdated = true;
                                }
                            }
                        }
                    }
                }
                
                // Alternatif: Sayfa içinde direkt arama
                if (!data.zeyilname) {
                    const zeyilElements = document.querySelectorAll('[class*="zeyil"], [id*="zeyil"]');
                    for (const el of zeyilElements) {
                        const content = el.textContent?.trim();
                        if (content && content.length > 50 && content.length < 10000) {
                            data.zeyilname = {
                                title: 'Zeyilname',
                                content: content.substring(0, 5000),
                                scrapedAt: new Date().toISOString()
                            };
                            data.isUpdated = true;
                            break;
                        }
                    }
                }
                
                if (!data.correctionNotice) {
                    const correctionElements = document.querySelectorAll('[class*="duzeltme"], [class*="correction"], [id*="duzeltme"]');
                    for (const el of correctionElements) {
                        const content = el.textContent?.trim();
                        if (content && content.length > 50 && content.length < 10000) {
                            data.correctionNotice = {
                                title: 'Düzeltme İlanı',
                                content: content.substring(0, 5000),
                                scrapedAt: new Date().toISOString()
                            };
                            data.isUpdated = true;
                            break;
                        }
                    }
                }
                
                // Güncellendi badge'i kontrol et
                const updateBadge = document.querySelector('[class*="badge"]:not([class*="primary"])');
                if (updateBadge) {
                    const badgeText = updateBadge.textContent?.toLowerCase() || '';
                    if (badgeText.includes('güncellendi') || badgeText.includes('düzeltme') || badgeText.includes('zeyilname')) {
                        data.isUpdated = true;
                    }
                }
                
                return data;
            });
            
            result.zeyilname = additionalData.zeyilname;
            result.correctionNotice = additionalData.correctionNotice;
            result.isUpdated = additionalData.isUpdated;
            
            if (result.zeyilname) {
                console.log(`     📋 Zeyilname içeriği bulundu (${result.zeyilname.content?.length || 0} karakter)`);
            }
            if (result.correctionNotice) {
                console.log(`     📋 Düzeltme İlanı içeriği bulundu (${result.correctionNotice.content?.length || 0} karakter)`);
            }
            
        } catch (error) {
            console.log(`     ⚠️ Ek içerik çekme hatası: ${error.message}`);
        }

        return result;
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

            // Döküman tipini belirle
            const detectDocType = (text, fileName) => {
                const lower = (text || '').toLowerCase() + ' ' + (fileName || '').toLowerCase();
                
                if (lower.includes('idari') && lower.includes('şartname')) return { type: 'admin_spec', name: 'İdari Şartname' };
                if (lower.includes('.idari.') || lower.match(/idari(?!.*düzeltme)/)) return { type: 'admin_spec', name: 'İdari Şartname' };
                if (lower.includes('teknik') && lower.includes('şartname')) return { type: 'tech_spec', name: 'Teknik Şartname' };
                if (lower.includes('.teknik.')) return { type: 'tech_spec', name: 'Teknik Şartname' };
                if (lower.includes('proje') && (lower.includes('dosya') || lower.includes('file'))) return { type: 'project_files', name: 'Proje Dosyaları' };
                if (lower.includes('.proje.')) return { type: 'project_files', name: 'Proje Dosyaları' };
                if (lower.includes('zeyilname') || lower.includes('zeyil')) return { type: 'zeyilname', name: 'Zeyilname' };
                if (lower.includes('düzeltme') && lower.includes('ilan')) return { type: 'correction_notice', name: 'Düzeltme İlanı' };
                if (lower.includes('ihale') && lower.includes('ilan')) return { type: 'tender_notice', name: 'İhale İlanı' };
                if (lower.includes('.ilan.')) return { type: 'tender_notice', name: 'İhale İlanı' };
                if (lower.includes('sözleşme') || lower.includes('sozlesme')) return { type: 'contract', name: 'Sözleşme Tasarısı' };
                if (lower.includes('birim') && lower.includes('fiyat')) return { type: 'unit_price', name: 'Birim Fiyat Teklif Cetveli' };
                if (lower.includes('pursantaj')) return { type: 'pursantaj', name: 'Pursantaj Listesi' };
                if (lower.includes('mahal') || lower.includes('metraj')) return { type: 'quantity_survey', name: 'Mahal Listesi / Metraj' };
                if (lower.includes('standart') && lower.includes('form')) return { type: 'standard_forms', name: 'Standart Formlar' };
                if (lower.includes('malzeme') && lower.includes('liste')) return { type: 'material_list', name: 'Malzeme Listesi' };
                if (lower.includes('cetvel')) return { type: 'price_schedule', name: 'Birim Fiyat Cetveli' };
                
                return null;
            };

            // 1. GENIŞ SELECTOR - Tüm potansiyel döküman linkleri
            const selectors = [
                // Download linkleri
                'a[href*="download"]',
                'a[href*="file"]',
                'a[href*="dosya"]',
                'a[href*="attachment"]',
                'a[href*="document"]',
                // Dosya uzantıları
                'a[href*=".pdf"]',
                'a[href*=".doc"]',
                'a[href*=".xls"]',
                'a[href*=".zip"]',
                'a[href*=".rar"]',
                // ihalebul.com spesifik
                'a[href*="hash="]',
                // Butonlar (ihalebul.com'da buton olarak gösteriliyor)
                'button[onclick*="download"]',
                'button[onclick*="window.open"]',
                '.btn[href*="download"]',
                '.document-link',
                '.file-link',
                // Döküman kartları içindeki linkler
                '[class*="document"] a',
                '[class*="file"] a',
                '[class*="download"] a',
                // "Dokümanı indir" linkleri (ihalebul.com Zeyilname/Düzeltme İlanı kartları)
                'a:not([href="#"])'
            ];

            const allLinks = document.querySelectorAll(selectors.join(', '));
            console.log(`[Scraper] ${allLinks.length} potansiyel link bulundu`);

            for (const link of allLinks) {
                let href = link.href;
                
                // Buton onclick'ten URL çıkar
                if (!href && link.onclick) {
                    const onclickStr = link.onclick.toString();
                    const urlMatch = onclickStr.match(/window\.open\(['"]([^'"]+)['"]/);
                    if (urlMatch) href = urlMatch[1];
                }
                
                if (!href || !href.includes('http')) continue;
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
                    }
                } catch (e) {
                    // Hash decode hatası - devam et
                }

                // Link text'inden isim çıkar
                const linkText = link.textContent?.trim() || link.innerText?.trim() || '';
                
                // Parent element'ten de text al (buton içindeki span vs.)
                const parentCard = link.closest('[class*="card"], [class*="item"], [class*="row"]');
                const parentText = parentCard?.textContent?.trim() || '';
                
                // Card başlığını al (Zeyilname, Düzeltme İlanı vs.)
                const cardHeader = parentCard?.querySelector('.card-header, .card-title, h5, h6')?.textContent?.trim() || '';
                
                // Döküman tipini belirle - önce card başlığına bak
                const detected = detectDocType(cardHeader, fileName) || detectDocType(linkText, fileName) || detectDocType(parentText, fileName);
                
                if (detected) {
                    docType = detected.type;
                    docName = detected.name;
                } else if (linkText && linkText.length > 2 && linkText.length < 150) {
                    docName = linkText;
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

                // Dökümanı kaydet
                documents[finalType] = {
                    url: href,
                    name: docName || finalType,
                    fileName: fileName || null,
                    scrapedAt: new Date().toISOString()
                };
            }

            // 2. ÖZEL ihalebul.com YAPISI - Döküman butonlarını tara
            const docButtons = document.querySelectorAll('.tender-documents a, .document-list a, [class*="doc-btn"], .btn-outline-primary');
            for (const btn of docButtons) {
                const href = btn.href;
                if (!href || seenUrls.has(href)) continue;
                seenUrls.add(href);
                
                const text = btn.textContent?.trim() || '';
                const detected = detectDocType(text, '');
                
                let finalType = detected?.type || `document_${unknownCounter++}`;
                if (documents[finalType]) {
                    let counter = 2;
                    while (documents[`${finalType}_${counter}`]) counter++;
                    finalType = `${finalType}_${counter}`;
                }
                
                documents[finalType] = {
                    url: href,
                    name: detected?.name || text || finalType,
                    fileName: null,
                    scrapedAt: new Date().toISOString()
                };
            }

            console.log(`[Scraper] Toplam ${Object.keys(documents).length} döküman bulundu`);
            return documents;
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new DocumentScraper();

