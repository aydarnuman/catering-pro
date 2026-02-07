/**
 * Document Scraper - İhale Döküman ve İçerik Çekici
 *
 * İhale detay sayfasından çeker:
 * - Döküman linkleri (download URL'leri)
 * - İhale ilanı içeriği (TEXT)
 * - Mal/Hizmet listesi (JSON tablo)
 * - Tab içerikleri (Zeyilname, Dökümanlar, vb.)
 *
 * v3.1 - Tab tarama özelliği eklendi
 */

class DocumentScraper {

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
          if (header?.textContent.includes('İhale İlanı')) {
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
          if (prevEl?.textContent.includes('İhale İlanı')) {
            const rows = [];
            table.querySelectorAll('tr').forEach((tr) => {
              const cells = [];
              tr.querySelectorAll('td, th').forEach((td) => {
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
    } catch (_error) {
      return null;
    }
  }

  /**
   * Mal/Hizmet listesini çeker (JSON array olarak)
   * ihalebul.com'da DataTable formatında: #, Kalem, Miktar, Birim
   */
  async scrapeGoodsServicesList(page) {
    try {
      const content = await page.evaluate(() => {
        // 1. ÖNCE: "Mal/Hizmet Listesi" başlıklı card'ı bul
        const cards = document.querySelectorAll('.card');
        let targetCard = null;

        for (const card of cards) {
          const header = card.querySelector('.card-header');
          if (header?.textContent.includes('Mal/Hizmet Listesi')) {
            targetCard = card;
            break;
          }
        }

        // 2. Card bulunamadıysa, tab içinde olabilir
        if (!targetCard) {
          const tabPanes = document.querySelectorAll('.tab-pane, [id*="mal"], [id*="hizmet"]');
          for (const pane of tabPanes) {
            if (pane.innerHTML.includes('Kalem') && pane.innerHTML.includes('Miktar')) {
              targetCard = pane;
              break;
            }
          }
        }

        // 3. Hala bulunamadıysa, DataTable ara
        if (!targetCard) {
          targetCard = document;
        }

        // 4. DataTable'ı bul (ihalebul DataTable kullanıyor)
        const table = targetCard.querySelector('table.dataTable, table[id*="DataTable"], .dataTables_wrapper table');

        // 5. Normal table da olabilir
        const finalTable = table || targetCard.querySelector('table');

        if (!finalTable) return null;

        // 6. Header'ları al - DataTable thead kullanır
        const headers = [];
        const headerRow = finalTable.querySelector('thead tr');
        if (headerRow) {
          headerRow.querySelectorAll('th').forEach((th) => {
            const text = th.textContent.trim();
            // Boş veya sadece simge olan header'ları atla
            if (text && text !== '#' && text.length > 0) {
              headers.push(text);
            } else if (text === '#') {
              headers.push('sira');
            } else {
              headers.push(null); // Boş header
            }
          });
        }

        // Header bulunamadıysa standart header kullan
        if (headers.length === 0 || headers.every((h) => !h)) {
          // Standart: sira, kalem, miktar, birim
          headers.length = 0;
          headers.push('sira', 'kalem', 'miktar', 'birim');
        }

        // 7. Data satırlarını al
        const rows = [];
        const dataRows = finalTable.querySelectorAll('tbody tr');

        dataRows.forEach((tr) => {
          const cells = tr.querySelectorAll('td');
          if (cells.length === 0) return;

          // Sıra, Kalem, Miktar, Birim formatında
          const row = {};
          let hasValidData = false;

          cells.forEach((td, idx) => {
            const value = td.textContent.trim();

            // Header varsa kullan, yoksa index bazlı key
            let key;
            if (headers[idx] && headers[idx] !== null) {
              key = headers[idx]
                .toLowerCase()
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/\s+/g, '_');
            } else {
              // Standart mapping
              const standardKeys = ['sira', 'kalem', 'miktar', 'birim', 'aciklama'];
              key = standardKeys[idx] || `col_${idx}`;
            }

            if (value && value.length > 0) {
              row[key] = value;
              if (key !== 'sira' && value.length > 0) {
                hasValidData = true;
              }
            }
          });

          // Sadece geçerli veri içeren satırları ekle
          if (hasValidData && Object.keys(row).length >= 2) {
            rows.push(row);
          }
        });

        return rows.length > 0 ? rows : null;
      });

      return content;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Zeyilname içeriğini çeker
   */
  async scrapeZeyilnameContent(page) {
    try {
      return await page.evaluate(() => {
        for (const el of document.querySelectorAll('.card, .tab-pane')) {
          const header = el.querySelector('.card-header, h5, h4');
          const id = el.id || '';

          if (header?.textContent.toLowerCase().includes('zeyil') || id.toLowerCase().includes('zeyil')) {
            const body = el.querySelector('.card-body') || el;
            const text = body.innerText.trim();
            if (text.length > 50) return { content: text, foundIn: header?.textContent || id };
          }
        }
        return null;
      });
    } catch (_error) {
      return null;
    }
  }

  /**
   * Düzeltme ilanı içeriğini çeker
   */
  async scrapeCorrectionNotice(page) {
    try {
      return await page.evaluate(() => {
        for (const card of document.querySelectorAll('.card')) {
          const header = card.querySelector('.card-header, h5, h4');
          if (header?.textContent.includes('Düzeltme') || header?.textContent.includes('Değişiklik')) {
            const body = card.querySelector('.card-body');
            if (body) return body.innerText.trim();
          }
        }
        return null;
      });
    } catch (_error) {
      return null;
    }
  }

  /**
   * Tüm içerikleri çeker (döküman linkleri + içerikler)
   * Tab'ları da kontrol eder
   */
  async scrapeAllContent(page, tenderUrl) {
    try {
      await page.goto(tenderUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
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

      // Zeyilname içeriğini çek
      const zeyilnameContent = await this.scrapeZeyilnameContent(page);

      // Düzeltme ilanı içeriğini çek
      const correctionNoticeContent = await this.scrapeCorrectionNotice(page);

      return {
        documentLinks: allDocumentLinks,
        announcementContent,
        goodsServicesList,
        zeyilnameContent,
        correctionNoticeContent,
      };
    } catch (_error) {
      return {
        documentLinks: {},
        announcementContent: null,
        goodsServicesList: null,
        zeyilnameContent: null,
        correctionNoticeContent: null,
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
          href: tab.getAttribute('href') || tab.getAttribute('data-bs-target') || null,
        }));
      });

      if (tabs.length > 0) {
      }

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
                    fromTab: tab.text,
                  };
                } else {
                  allTabDocuments[key] = {
                    ...value,
                    fromTab: tab.text,
                  };
                }
              }
            }
          }
        } catch (_tabError) {}
      }
    } catch (_error) {}

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
        'a[href*=".rar"]',
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
        } catch (_e) {
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
            } else if (lowerText.includes('düzeltme')) {
              docType = 'correction_notice';
            } else if (lowerText.includes('malzeme') || lowerText.includes('liste')) {
              docType = 'goods_list';
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
          scrapedAt: new Date().toISOString(),
        };
      }

      return documents;
    });
  }

  /**
   * Tek ihale için tüm detayları çek (URL ile ekleme için)
   */
  async scrapeTenderDetails(page, url) {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.sleep(1500);

    // Detay bilgileri
    const details = await page.evaluate(() => {
      const getValue = (label) => {
        for (const row of document.querySelectorAll('tr')) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2 && cells[0].textContent.toLowerCase().includes(label.toLowerCase())) {
            return cells[1].textContent.trim();
          }
        }
        return null;
      };

      const kayitNo = getValue('Kayıt no');
      const ihaleBasligi = getValue('İhale başlığı');
      const isinAdi = getValue('İşin adı');
      const idareAdi = getValue('İdare adı');

      // Şehir bul
      const cities = [
        'Ankara',
        'İstanbul',
        'İzmir',
        'Bursa',
        'Antalya',
        'Adana',
        'Konya',
        'Gaziantep',
        'Kayseri',
        'Mersin',
        'Diyarbakır',
        'Samsun',
        'Denizli',
        'Eskişehir',
        'Şanlıurfa',
        'Malatya',
        'Trabzon',
        'Erzurum',
        'Van',
      ];
      let city = null;
      if (idareAdi) {
        for (const c of cities) {
          if (idareAdi.includes(c)) {
            city = c;
            break;
          }
        }
      }

      return {
        title: kayitNo && ihaleBasligi ? `${kayitNo} - ${ihaleBasligi}` : ihaleBasligi || isinAdi?.substring(0, 150),
        kayitNo,
        organization: idareAdi,
        city,
        teklifTarihi: getValue('Teklif tarihi') || getValue('Son teklif'),
        yaklasikMaliyet: getValue('Yaklaşık maliyet'),
        isinSuresi: getValue('İşin süresi'),
      };
    });

    // İçerikleri çek (sayfa zaten yüklü)
    // Önce mevcut sayfadaki dökümanları çek
    let allDocumentLinks = await this.scrapeDocumentLinksFromPage(page);

    // Tab'ları kontrol et ve tıkla
    const tabDocuments = await this.scrapeTabContents(page);

    // Tab'lardan gelen dökümanları birleştir
    allDocumentLinks = { ...allDocumentLinks, ...tabDocuments };

    // İçerikleri çek
    const announcementContent = await this.scrapeAnnouncementContent(page);
    const goodsServicesList = await this.scrapeGoodsServicesList(page);
    const zeyilnameContent = await this.scrapeZeyilnameContent(page);
    const correctionNoticeContent = await this.scrapeCorrectionNotice(page);

    return {
      ...details,
      documentLinks: allDocumentLinks,
      announcementContent,
      goodsServicesList,
      zeyilnameContent,
      correctionNoticeContent,
    };
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default new DocumentScraper();
