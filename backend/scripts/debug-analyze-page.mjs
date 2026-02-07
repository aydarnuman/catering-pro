/**
 * Debug: Analyze sayfasının HTML yapısını incele
 * İhalebul.com'un analiz sayfasında ne tür elementler var?
 */
import puppeteer from 'puppeteer';
import loginService from '../src/scraper/login-service.js';

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

  // Scroll down
  await page.evaluate(async () => {
    const distance = 500;
    let total = 0;
    while (total < document.body.scrollHeight) {
      window.scrollBy(0, distance);
      total += distance;
      await new Promise((r) => setTimeout(r, 300));
    }
    window.scrollTo(0, 0);
  });
  await delay(2000);

  // Take screenshot
  await page.screenshot({ path: 'scripts/debug-analyze-page.png', fullPage: true });
  console.log('Screenshot saved to scripts/debug-analyze-page.png');

  // Dump page structure
  const info = await page.evaluate(() => {
    const result = {};
    
    // All tables
    const tables = document.querySelectorAll('table');
    result.tables = [...tables].map((t, i) => ({
      index: i,
      rows: t.querySelectorAll('tr').length,
      headers: [...t.querySelectorAll('th')].map(th => th.textContent.trim()).join(' | '),
      firstRow: [...(t.querySelector('tbody tr')?.querySelectorAll('td') || [])].map(td => td.textContent.trim().substring(0, 50)).join(' | '),
      parentClasses: t.parentElement?.className?.substring(0, 100),
      nearestHeading: (() => {
        let el = t;
        for (let i = 0; i < 10; i++) {
          el = el.parentElement;
          if (!el) return null;
          const h = el.querySelector('h1,h2,h3,h4,h5,h6,.card-title,.card-header,.fw-bold');
          if (h) return h.textContent.trim().substring(0, 100);
        }
        return null;
      })(),
    }));

    // All nav tabs
    const tabs = document.querySelectorAll('[role="tab"], .nav-link, [data-bs-toggle="tab"], [data-bs-toggle="pill"]');
    result.tabs = [...tabs].map(t => ({
      text: t.textContent.trim().substring(0, 60),
      active: t.classList.contains('active') || t.getAttribute('aria-selected') === 'true',
      target: t.getAttribute('aria-controls') || t.getAttribute('data-bs-target') || null,
      tagName: t.tagName,
    }));

    // Tab panes
    const panes = document.querySelectorAll('.tab-pane, [role="tabpanel"]');
    result.tabPanes = [...panes].map(p => ({
      id: p.id,
      classes: p.className.substring(0, 100),
      hasTables: p.querySelectorAll('table').length,
      childCount: p.children.length,
      textPreview: p.textContent.trim().substring(0, 200),
    }));

    // All headings in page
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-header, .card-title');
    result.headings = [...headings].slice(0, 30).map(h => h.textContent.trim().substring(0, 100));

    // All .card elements
    const cards = document.querySelectorAll('.card');
    result.cardCount = cards.length;
    result.cards = [...cards].slice(0, 15).map(c => ({
      headerText: c.querySelector('.card-header,.card-title')?.textContent?.trim()?.substring(0, 80) || null,
      hasTable: c.querySelectorAll('table').length > 0,
      hasCanvas: c.querySelectorAll('canvas').length > 0,
      childPreview: c.textContent.trim().substring(0, 150),
    }));

    // Check for chart.js or highcharts
    result.hasChartJS = !!document.querySelector('canvas');
    result.canvasCount = document.querySelectorAll('canvas').length;

    return result;
  });

  console.log('\n=== TABLES ===');
  info.tables.forEach(t => {
    console.log(`Table ${t.index}: ${t.rows} rows, nearest heading: "${t.nearestHeading}"`);
    console.log(`  Headers: ${t.headers}`);
    console.log(`  First row: ${t.firstRow}`);
    console.log(`  Parent: ${t.parentClasses}`);
  });

  console.log('\n=== TABS ===');
  info.tabs.forEach(t => console.log(`  ${t.active ? '✓' : '○'} "${t.text}" → ${t.target} (${t.tagName})`));

  console.log('\n=== TAB PANES ===');
  info.tabPanes.forEach(p => console.log(`  #${p.id}: ${p.hasTables} tables, ${p.childCount} children, text: "${p.textPreview.substring(0, 80)}..."`));

  console.log('\n=== HEADINGS ===');
  info.headings.forEach(h => console.log(`  "${h}"`));

  console.log('\n=== CARDS ===');
  console.log(`Total: ${info.cardCount} cards`);
  info.cards.forEach(c => console.log(`  "${c.headerText}" hasTable:${c.hasTable} hasCanvas:${c.hasCanvas}`));

  console.log('\n=== CHARTS ===');
  console.log(`Canvas elements: ${info.canvasCount}, ChartJS detected: ${info.hasChartJS}`);

  await browser.close();
}

main().catch(console.error);
