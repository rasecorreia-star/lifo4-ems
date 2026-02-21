import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5177';

test('Diagnostic - What is rendering?', async ({ page }) => {
  console.log('\n=== DIAGNOSTIC TEST ===\n');

  // Set up console listener
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Navigate to page
  console.log('1. Navigating to /ev-chargers...');
  await page.goto(`${BASE_URL}/ev-chargers`);

  // Wait for any loading to complete
  console.log('2. Waiting for network idle...');
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('   Network idle timeout - continuing anyway');
  });
  await page.waitForTimeout(3000);

  // Get page content
  const content = await page.content();
  console.log(`3. Page content length: ${content.length}`);

  // Check for React root
  const rootContent = await page.locator('#root').innerHTML().catch(() => 'ERROR');
  console.log(`4. #root innerHTML length: ${rootContent.length}`);
  console.log(`   First 500 chars: ${rootContent.substring(0, 500)}`);

  // Check for specific elements
  console.log('\n5. Element counts:');
  console.log(`   - div: ${await page.locator('div').count()}`);
  console.log(`   - button: ${await page.locator('button').count()}`);
  console.log(`   - a (links): ${await page.locator('a').count()}`);
  console.log(`   - svg: ${await page.locator('svg').count()}`);
  console.log(`   - img: ${await page.locator('img').count()}`);

  // Check for loading indicators
  console.log('\n6. Loading indicators:');
  const loadingText = await page.locator('text=Carregando').count();
  const loadingSpinner = await page.locator('.animate-spin, .animate-pulse').count();
  console.log(`   - "Carregando" text: ${loadingText}`);
  console.log(`   - Animated elements: ${loadingSpinner}`);

  // Check for sidebar/navigation
  console.log('\n7. Navigation elements:');
  const sidebar = await page.locator('[class*="sidebar"], nav, aside').count();
  const navLinks = await page.locator('nav a, aside a').count();
  console.log(`   - Sidebar/nav: ${sidebar}`);
  console.log(`   - Nav links: ${navLinks}`);

  // Check body classes and styles
  console.log('\n8. Body info:');
  const bodyClass = await page.locator('body').getAttribute('class');
  const bodyStyle = await page.locator('body').getAttribute('style');
  console.log(`   - Body class: ${bodyClass}`);
  console.log(`   - Body style: ${bodyStyle}`);

  // Get all visible text
  console.log('\n9. Visible text content (first 1000 chars):');
  const visibleText = await page.locator('body').innerText().catch(() => 'ERROR');
  console.log(`   ${visibleText.substring(0, 1000)}`);

  // Console messages
  console.log('\n10. Console messages:');
  consoleMessages.slice(0, 20).forEach(msg => console.log(`   ${msg}`));

  // Take screenshot with red background to see if content is white
  await page.evaluate(() => {
    document.body.style.backgroundColor = 'red';
  });
  await page.screenshot({ path: 'test-results/diagnostic-red-bg.png', fullPage: true });

  // Restore and take normal screenshot
  await page.evaluate(() => {
    document.body.style.backgroundColor = '';
  });
  await page.screenshot({ path: 'test-results/diagnostic-normal.png', fullPage: true });

  // Try clicking first button if any
  const firstButton = page.locator('button').first();
  if (await firstButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log('\n11. First button found - clicking...');
    const btnText = await firstButton.textContent();
    console.log(`    Button text: ${btnText}`);
    await firstButton.click();
    await page.waitForTimeout(500);
  } else {
    console.log('\n11. No visible buttons found');
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');

  // Should have more than just the HTML shell
  expect(rootContent.length).toBeGreaterThan(100);
});

test('Diagnostic - Dashboard Page', async ({ page }) => {
  console.log('\n=== DASHBOARD DIAGNOSTIC ===\n');

  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const rootContent = await page.locator('#root').innerHTML().catch(() => 'ERROR');
  console.log(`Root content length: ${rootContent.length}`);
  console.log(`First 1000 chars:\n${rootContent.substring(0, 1000)}`);

  console.log('\nElement counts:');
  console.log(`- div: ${await page.locator('div').count()}`);
  console.log(`- button: ${await page.locator('button').count()}`);
  console.log(`- svg: ${await page.locator('svg').count()}`);

  await page.screenshot({ path: 'test-results/diagnostic-dashboard.png', fullPage: true });

  expect(rootContent.length).toBeGreaterThan(100);
});
