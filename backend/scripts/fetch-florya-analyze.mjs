#!/usr/bin/env node
/**
 * Florya Yemek Analiz Sayfası Scraper (Tek seferlik)
 * 
 * ihalebul.com'a login olup Florya Yemek'in analiz sayfasındaki
 * paywall arkası verileri çeker.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import browserManager from '../src/scraper/shared/browser.js';
import loginService from '../src/scraper/shared/ihalebul-login.js';

const ANALYZE_URL = 'https://www.ihalebul.com/analyze?workcategory_in=15&contractortitle_in=FLORYA+YEMEK+T%C4%B0CARET+ANON%C4%B0M+%C5%9E%C4%B0RKET%C4%B0';

async function main() {
  let page;
  try {
    console.log('=== Florya Yemek Analiz Sayfası Scraper ===\n');
    
    // 1. Browser & login
    console.log('1. Browser başlatılıyor...');
    page = await browserManager.createPage();
    
    console.log('2. ihalebul.com login yapılıyor...');
    const loginResult = await loginService.performLogin(page);
    console.log(`   Login sonucu: ${loginResult ? 'BAŞARILI' : 'BAŞARISIZ'}`);
    
    if (!loginResult) {
      throw new Error('Login başarısız!');
    }
    
    // 2. Analyze sayfasına git
    console.log(`3. Analyze sayfasına gidiliyor...\n   ${ANALYZE_URL}`);
    await page.goto(ANALYZE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(5000); // JS render bekle
    
    // Login hala aktif mi kontrol
    const isStillLoggedIn = await loginService.isLoggedIn(page);
    console.log(`   Login durumu: ${isStillLoggedIn ? 'AKTİF' : 'KAYIP (paywall verileri maskelenmiş olabilir)'}`);
    
    // 3. Sayfanın tüm text içeriğini çek
    console.log('\n4. Sayfa içeriği çekiliyor...\n');
    
    // Tüm sayfanın ham text'i
    const fullPageText = await page.evaluate(() => document.body.innerText);
    console.log('=== TAM SAYFA TEXT ===');
    console.log(fullPageText);
    console.log('=== TAM SAYFA TEXT SONU ===\n');
    
    // 4. Yapısal veri çekimi - her section ayrı ayrı
    console.log('\n5. Yapısal veri analizi...\n');
    
    const structuredData = await page.evaluate(() => {
      const data = {};
      
      // Tüm tabloları çek
      const tables = document.querySelectorAll('table');
      data.tableCount = tables.length;
      data.tables = [];
      
      tables.forEach((table, idx) => {
        const tableData = {
          index: idx,
          headers: [],
          rows: [],
          parentHeading: null
        };
        
        // Tablonun üstündeki heading'i bul
        let el = table;
        while (el && el.previousElementSibling) {
          el = el.previousElementSibling;
          if (['H1','H2','H3','H4','H5','H6'].includes(el.tagName)) {
            tableData.parentHeading = el.textContent.trim();
            break;
          }
        }
        // Eğer bulamadıysa, en yakın card/section heading'i dene
        if (!tableData.parentHeading) {
          const closestCard = table.closest('.card, .panel, section, [class*="card"]');
          if (closestCard) {
            const heading = closestCard.querySelector('h1,h2,h3,h4,h5,h6,.card-header,.panel-heading,[class*="title"],[class*="header"]');
            if (heading) {
              tableData.parentHeading = heading.textContent.trim();
            }
          }
        }
        
        // Header
        const ths = table.querySelectorAll('thead th, thead td');
        ths.forEach(th => tableData.headers.push(th.textContent.trim()));
        
        // Rows
        const trs = table.querySelectorAll('tbody tr');
        trs.forEach(tr => {
          const row = [];
          tr.querySelectorAll('td').forEach(td => row.push(td.textContent.trim()));
          if (row.length > 0) tableData.rows.push(row);
        });
        
        data.tables.push(tableData);
      });
      
      // Tüm card/panel başlıklarını çek
      data.sectionHeadings = [];
      document.querySelectorAll('.card-header, .panel-heading, h2, h3, h4').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length < 200) {
          data.sectionHeadings.push(text);
        }
      });
      
      // Maskelenmiş veri var mı?
      data.hasMaskedData = document.body.innerText.includes('***');
      data.hasPaywallWarning = document.body.innerText.includes('Bu bölüm sadece aktif üye');
      
      // Grafik/chart canvas var mı?
      data.canvasCount = document.querySelectorAll('canvas').length;
      
      // Chart.js verileri varsa çek
      data.chartData = [];
      if (typeof Chart !== 'undefined') {
        const charts = Object.values(Chart.instances || {});
        charts.forEach(chart => {
          data.chartData.push({
            type: chart.config.type,
            labels: chart.data.labels,
            datasets: chart.data.datasets.map(ds => ({
              label: ds.label,
              data: ds.data
            }))
          });
        });
      }
      
      // Sayfa URL'si
      data.url = window.location.href;
      data.title = document.title;
      
      return data;
    });
    
    console.log('=== YAPISAL VERİ ===');
    console.log(JSON.stringify(structuredData, null, 2));
    console.log('=== YAPISAL VERİ SONU ===\n');
    
    // 5. HTML snapshot (debug için)
    const htmlContent = await page.content();
    console.log(`\nSayfa HTML boyutu: ${htmlContent.length} karakter`);
    
    // Paywall bölümlerini özel olarak kontrol et
    console.log('\n=== PAYWALL KONTROL ===');
    const paywallCheck = await page.evaluate(() => {
      const checks = {};
      const text = document.body.innerText;
      
      checks.idareler = text.includes('İdareler') || text.includes('idareler');
      checks.yukleniciler = text.includes('Yükleniciler') || text.includes('yükleniciler');
      checks.ortakGirisim = text.includes('Ortak Girişim') || text.includes('ortak girişim');
      checks.rakipler = text.includes('Rakipler') || text.includes('rakipler');
      checks.maskedStars = (text.match(/\*\*\*/g) || []).length;
      checks.paywalledSections = (text.match(/sadece aktif üye/gi) || []).length;
      
      // Her bölümün içeriğini de çek
      checks.sections = {};
      document.querySelectorAll('[class*="card"], [class*="panel"], section').forEach(el => {
        const heading = el.querySelector('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="header"]');
        if (heading) {
          const title = heading.textContent.trim();
          if (title.length < 100) {
            checks.sections[title] = {
              textLength: el.innerText.length,
              hasTable: !!el.querySelector('table'),
              hasMask: el.innerText.includes('***'),
              firstLines: el.innerText.substring(0, 300)
            };
          }
        }
      });
      
      return checks;
    });
    
    console.log(JSON.stringify(paywallCheck, null, 2));
    console.log('=== PAYWALL KONTROL SONU ===');
    
    // 6. Screenshot al
    const screenshotPath = path.join(__dirname, 'florya-analyze-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\nScreenshot kaydedildi: ${screenshotPath}`);
    
    console.log('\n=== TAMAMLANDI ===');
    
  } catch (error) {
    console.error('HATA:', error.message);
    console.error(error.stack);
  } finally {
    await browserManager.close();
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
