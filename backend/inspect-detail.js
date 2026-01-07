import browserManager from './src/scraper/browser-manager.js';
import loginService from './src/scraper/login-service.js';
import { query } from './src/database.js';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function inspectDetailPage() {
  let page = null;
  
  try {
    console.log('🚀 Browser başlatılıyor...');
    page = await browserManager.createPage();
    
    console.log('🔑 Login oluyor...');
    await loginService.ensureLoggedIn(page);
    
    // Bir ihale seç
    const sample = await query('SELECT external_id, url, title FROM tenders LIMIT 1');
    const tender = sample.rows[0];
    
    console.log('🎯 Test edilecek ihale:');
    console.log('  ID:', tender.external_id);
    console.log('  URL:', tender.url);
    console.log('  Title:', tender.title.substring(0, 80) + '...');
    
    console.log('\n🌐 Detay sayfasına gidiliyor...');
    await page.goto(tender.url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    await delay(3000);
    
    console.log('\n🔍 SAYFA YAPISI ANALİZİ:');
    
    const pageData = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText,
        detailSelectors: [
          { selector: '.tender-detail', exists: !!document.querySelector('.tender-detail') },
          { selector: '.detail-content', exists: !!document.querySelector('.detail-content') },
          { selector: '.tender-info', exists: !!document.querySelector('.tender-info') },
          { selector: '.content', exists: !!document.querySelector('.content') },
          { selector: 'table', count: document.querySelectorAll('table').length },
          { selector: '.table', count: document.querySelectorAll('.table').length },
          { selector: '.row', count: document.querySelectorAll('.row').length }
        ],
        firstTable: document.querySelector('table') ? document.querySelector('table').outerHTML.substring(0, 800) : null,
        allText: document.body.innerText.substring(0, 2000)
      };
    });
    
    console.log('📊 Sayfa Bilgisi:');
    console.log('  Title:', pageData.title);
    console.log('  URL:', pageData.url);
    
    console.log('\n📦 Sayfa Element Analizi:');
    pageData.detailSelectors.forEach(item => {
      if (item.exists !== undefined) {
        console.log('  ', item.selector, ':', item.exists ? '✅ VAR' : '❌ YOK');
      } else {
        console.log('  ', item.selector, ':', item.count, 'adet');
      }
    });
    
    if (pageData.firstTable) {
      console.log('\n📋 İlk Tablo Yapısı:');
      console.log('---');
      console.log(pageData.firstTable);
      console.log('---');
    }
    
    console.log('\n📝 Sayfa İçeriği (İlk 1000 karakter):');
    console.log('---');
    console.log(pageData.allText.substring(0, 1000));
    console.log('---');
    
  } catch (error) {
    console.error('❌ Hata:', error.message);
  } finally {
    if (page) {
      await page.close();
    }
    await browserManager.close();
    process.exit(0);
  }
}

await inspectDetailPage();