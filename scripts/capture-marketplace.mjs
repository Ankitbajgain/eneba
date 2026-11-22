import { chromium } from '../.tools/browser/node_modules/playwright/index.mjs'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||(existsSync(chrome)?chrome:undefined)})
const origin=process.env.MARKETPLACE_ORIGIN||'http://127.0.0.1:5173'
mkdirSync(new URL('../docs/screenshots/',import.meta.url),{recursive:true})
try {
  for(const [name,path,heading] of [['home','/','Bestselling games'],['store','/store','Games'],['product','/products/elden-ring','ELDEN RING']]) {
    for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      const page=await browser.newPage({viewport:{width,height}})
      await page.goto(origin+path)
      await page.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:30000})
      if(name==='store') await page.locator('.product-card').first().waitFor()
      if(name==='store') {
        await page.getByRole('button',{name:'Next',exact:true}).click()
        await page.getByText('Page 2 of 2',{exact:true}).waitFor()
        await page.getByRole('button',{name:'Previous',exact:true}).click()
        await page.getByText('Page 1 of 2',{exact:true}).waitFor()
      }
      if(name==='product') await page.locator('.offer-row').first().waitFor()
      await page.evaluate(async()=>{const images=[...document.querySelectorAll('img')];for(const image of images)image.loading='eager';await Promise.all(images.map(image=>image.decode().catch(()=>{})))})
      if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)) throw new Error(`${name}/${size} has horizontal overflow`)
      await page.screenshot({path:fileURLToPath(new URL(`../docs/screenshots/${name}-${size}.png`,import.meta.url)),fullPage:true})
      await page.close()
      console.log(`PASS: ${name}/${size}, screenshot saved.`)
    }
  }
}finally{await browser.close()}
