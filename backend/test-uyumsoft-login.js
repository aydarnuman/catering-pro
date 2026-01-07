import puppeteer from 'puppeteer';

async function testLogin() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();
  
  console.log('🔐 Login sayfasına gidiliyor...');
  await page.goto('https://portal.uyumsoft.com.tr', { waitUntil: 'networkidle2' });

  // Sayfadaki tüm input'ları listele
  const inputs = await page.$$eval('input', (els) => {
    return els.map(el => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className,
    }));
  });
  console.log('📋 Input elementleri:', JSON.stringify(inputs, null, 2));

  // Sayfadaki tüm butonları listele
  const buttons = await page.$$eval('button, input[type="submit"]', (els) => {
    return els.map(el => ({
      type: el.type || 'button',
      text: el.innerText || el.value,
      className: el.className,
      id: el.id,
    }));
  });
  console.log('📋 Button elementleri:', JSON.stringify(buttons, null, 2));

  // Sayfanın HTML'ini kaydet
  const html = await page.content();
  const fs = await import('fs');
  fs.writeFileSync('/Users/numanaydar/Desktop/CATERİNG/backend/uyumsoft-login-page.html', html);
  console.log('✅ HTML kaydedildi: uyumsoft-login-page.html');

  // 30 saniye bekle (manuel inceleme için)
  console.log('⏳ 30 saniye bekleniyor... Manuel inceleme yapabilirsiniz.');
  await new Promise(r => setTimeout(r, 30000));

  await browser.close();
}

testLogin().catch(console.error);

