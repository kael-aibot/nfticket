const { chromium } = require('playwright');
const { resolve } = require('path');

async function runTests() {
  console.log('🚀 Starting NFTicket Playwright Tests');
  console.log('='.repeat(50));
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const baseUrl = 'http://127.0.0.1:3002';
  console.log(`\n📍 Base URL: ${baseUrl}`);
  
  // Test 1: Can we reach the buyer app?
  console.log('\n🧪 Test 1: Access buyer app home page');
  try {
    await page.goto(baseUrl, { timeout: 5000 });
    console.log('✅ Buyer app is accessible');
    console.log(`   Title: ${await page.title()}`);
    console.log(`   URL: ${page.url()}`);
  } catch (error) {
    console.log('❌ Cannot reach buyer app');
    console.log(`   Error: ${error.message}`);
  }
  
  await browser.close();
  console.log('\n' + '='.repeat(50));
  console.log('Test complete');
}

runTests().catch(console.error);
