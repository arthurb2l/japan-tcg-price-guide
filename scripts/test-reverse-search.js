const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const IMG_DIR = path.join(__dirname, '../onepiece/images/don/_pdf_rendered/');
const testImages = ['don-001.png', 'don-007.png', 'don-024.png'];

(async () => {
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--lang=en-US'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  for (const img of testImages) {
    const imgPath = path.join(IMG_DIR, img);
    console.log(`\n=== ${img} ===`);
    
    // Go directly to Google Images
    await page.goto('https://www.google.com/imghp?hl=en', { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));
    
    // Accept cookies if present
    try {
      const acceptBtn = await page.$('[id="L2AGLb"]');
      if (acceptBtn) await acceptBtn.click();
      await new Promise(r => setTimeout(r, 500));
    } catch {}
    
    // Screenshot to debug
    await page.screenshot({ path: `/tmp/gimg-${img.replace('.png','')}.jpg`, quality: 50 });
    
    // Find ALL inputs on page
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, accept: i.accept, visible: i.offsetParent !== null
      }));
    });
    console.log('  Inputs:', JSON.stringify(inputs));
    
    // Find file input (might be hidden)
    const fileInputs = await page.$$('input[type="file"]');
    console.log(`  File inputs found: ${fileInputs.length}`);
    
    if (fileInputs.length > 0) {
      await fileInputs[0].uploadFile(imgPath);
      await new Promise(r => setTimeout(r, 6000));
      
      const text = await page.evaluate(() => document.body.innerText.substring(0, 1500));
      const matches = text.split('\n').filter(l => l.length > 5 && l.length < 200).slice(0, 10);
      matches.forEach(m => console.log(`  → ${m}`));
    } else {
      console.log('  No file input — trying to click camera icon...');
      // Try clicking anything that looks like a camera/lens
      await page.evaluate(() => {
        const svgs = document.querySelectorAll('svg');
        if (svgs.length > 0) svgs[0].closest('div[role="button"], button, a')?.click();
      });
      await new Promise(r => setTimeout(r, 2000));
      
      const fileInputs2 = await page.$$('input[type="file"]');
      console.log(`  After click: ${fileInputs2.length} file inputs`);
      
      if (fileInputs2.length > 0) {
        await fileInputs2[0].uploadFile(imgPath);
        await new Promise(r => setTimeout(r, 6000));
        const text = await page.evaluate(() => document.body.innerText.substring(0, 1500));
        const matches = text.split('\n').filter(l => l.length > 5 && l.length < 200).slice(0, 10);
        matches.forEach(m => console.log(`  → ${m}`));
      }
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
