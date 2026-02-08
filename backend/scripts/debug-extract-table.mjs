/**
 * Debug: extractTable fonksiyonunu doğrudan test et
 */
import puppeteer from 'puppeteer';
import loginService from '../src/scraper/shared/ihalebul-login.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  console.log('Logging in...');
  await loginService.ensureLoggedIn(page);
  await delay(2000);

  const name = 'DEGSAN GIDA TEMİZLİK HİZMETLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ';
  const encoded = encodeURIComponent(name).replace(/%20/g, '+');
  const url = `https://www.ihalebul.com/analyze?workcategory_in=15&contractortitle_in=${encoded}`;
  
  console.log('Going to:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  await delay(5000);

  // Scroll
  await page.evaluate(async () => {
    let total = 0;
    while (total < document.body.scrollHeight) {
      window.scrollBy(0, 500);
      total += 500;
      await new Promise((r) => setTimeout(r, 300));
    }
    window.scrollTo(0, 0);
  });
  await delay(2000);

  // Test: card-based extraction directly
  const testResult = await page.evaluate((kwList) => {
    const debug = [];
    const cards = document.querySelectorAll('.card');
    debug.push(`Found ${cards.length} .card elements`);
    
    let table = null;
    for (let ci = 0; ci < cards.length; ci++) {
      const card = cards[ci];
      const header = card.querySelector('.card-header, .card-title, h1, h2, h3, h4, h5, h6');
      if (!header) {
        debug.push(`Card ${ci}: no header found`);
        continue;
      }
      
      const headerText = header.textContent.toLowerCase().trim();
      debug.push(`Card ${ci}: header="${headerText.substring(0, 40)}" | tag=${header.tagName} | class=${header.className.substring(0, 60)}`);
      
      let matched = false;
      for (const kw of kwList) {
        const kwLower = kw.toLowerCase();
        const includes = headerText.includes(kwLower);
        debug.push(`  kw="${kw}" → includes=${includes} (headerText="${headerText}", kwLower="${kwLower}")`);
        if (includes) {
          matched = true;
          break;
        }
      }
      
      if (matched) {
        table = card.querySelector('table');
        debug.push(`  MATCHED! table found: ${!!table}`);
        if (table) {
          debug.push(`  Table rows: ${table.querySelectorAll('tbody tr').length}`);
          const ths = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
          debug.push(`  Headers: ${ths.join(' | ')}`);
          break;
        }
      }
    }
    
    return { debug, hasTable: !!table };
  }, ['yıllık', 'yillik', 'trend']);

  console.log('\n=== DEBUG OUTPUT ===');
  testResult.debug.forEach(d => console.log(d));
  console.log('\nTable found:', testResult.hasTable);

  await browser.close();
}

main().catch(console.error);
