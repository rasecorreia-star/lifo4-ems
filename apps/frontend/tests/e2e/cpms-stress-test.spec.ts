import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5177';

// Configure serial execution
test.describe.configure({ mode: 'serial' });

// Helper function to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

// Helper function to click buttons safely (max 5 buttons, skip dangerous ones)
async function clickSafeButtons(page: Page, description: string, maxClicks = 5) {
  const buttons = await page.locator('button:visible').all();
  const skipButtons = ['sair', 'logout', 'delete', 'excluir', 'remover', 'apagar', 'cancelar'];

  let clickedCount = 0;
  for (let i = 0; i < Math.min(buttons.length, 15) && clickedCount < maxClicks; i++) {
    try {
      const button = buttons[i];
      if (await button.isVisible().catch(() => false)) {
        const text = (await button.textContent().catch(() => '') || '').toLowerCase().trim();
        if (skipButtons.some(skip => text.includes(skip))) continue;

        await button.click({ timeout: 1000, force: true }).catch(() => {});
        clickedCount++;
        await page.waitForTimeout(200);
      }
    } catch (e) {}
  }
  console.log(`  [${description}] Clicked ${clickedCount} buttons`);
  return clickedCount;
}

// Helper to collect console errors
function setupConsoleLogger(page: Page, errors: string[]) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('WebSocket') && !text.includes('socket.io')) {
        errors.push(text.substring(0, 100));
      }
    }
  });
}

test.describe('CPMS Enterprise - Stress Tests', () => {

  test('1. EV Chargers List Page', async ({ page }) => {
    const errors: string[] = [];
    setupConsoleLogger(page, errors);

    await page.goto(`${BASE_URL}/ev-chargers`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    // Check for CPMS elements
    const evText = await page.locator('text=/Carregador|EV|CPMS/i').count();
    expect(evText).toBeGreaterThan(0);

    await clickSafeButtons(page, 'EV List');
    await page.screenshot({ path: 'test-results/cpms-01-ev-list.png', fullPage: true });

    console.log(`  Page loaded with ${content.length} bytes, ${errors.length} errors`);
  });

  test('2. CPMS Dashboard Page', async ({ page }) => {
    const errors: string[] = [];
    setupConsoleLogger(page, errors);

    await page.goto(`${BASE_URL}/ev-chargers/dashboard`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    // Check for dashboard elements
    const charts = await page.locator('svg').count();
    console.log(`  Found ${charts} SVG charts`);

    await clickSafeButtons(page, 'Dashboard');
    await page.screenshot({ path: 'test-results/cpms-02-dashboard.png', fullPage: true });
  });

  test('3. CPMS Billing Page', async ({ page }) => {
    const errors: string[] = [];
    setupConsoleLogger(page, errors);

    await page.goto(`${BASE_URL}/ev-chargers/billing`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    // Check for billing elements
    const billingText = await page.locator('text=/Billing|Tarifa|Fatura/i').count();
    console.log(`  Found ${billingText} billing elements`);

    // Click tabs
    const tabs = ['Tarifas', 'Faturas', 'Promoções', 'Transações'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first();
      if (await tabBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await tabBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    await page.screenshot({ path: 'test-results/cpms-03-billing.png', fullPage: true });
  });

  test('4. CPMS Energy Management Page', async ({ page }) => {
    const errors: string[] = [];
    setupConsoleLogger(page, errors);

    await page.goto(`${BASE_URL}/ev-chargers/energy`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    // Check for energy elements
    const energyText = await page.locator('text=/Energy|Energia|BESS|Load/i').count();
    console.log(`  Found ${energyText} energy elements`);

    await clickSafeButtons(page, 'Energy');
    await page.screenshot({ path: 'test-results/cpms-04-energy.png', fullPage: true });
  });

  test('5. CPMS Users Page', async ({ page }) => {
    const errors: string[] = [];
    setupConsoleLogger(page, errors);

    await page.goto(`${BASE_URL}/ev-chargers/users`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    // Check for user elements
    const userText = await page.locator('text=/User|Usuário|RFM|Fidelidade/i').count();
    console.log(`  Found ${userText} user elements`);

    await clickSafeButtons(page, 'Users');
    await page.screenshot({ path: 'test-results/cpms-05-users.png', fullPage: true });
  });

  test('6. CPMS Sessions Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ev-chargers/sessions`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    await clickSafeButtons(page, 'Sessions');
    await page.screenshot({ path: 'test-results/cpms-06-sessions.png', fullPage: true });
  });

  test('7. CPMS Smart Charging Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ev-chargers/smart-charging`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    await clickSafeButtons(page, 'SmartCharging');
    await page.screenshot({ path: 'test-results/cpms-07-smart.png', fullPage: true });
  });

  test('8. CPMS Config Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ev-chargers/config`);
    await waitForPageReady(page);

    const content = await page.content();
    expect(content.length).toBeGreaterThan(50000);

    await clickSafeButtons(page, 'Config');
    await page.screenshot({ path: 'test-results/cpms-08-config.png', fullPage: true });
  });

  test('9. Navigation Flow - All CPMS Pages', async ({ page }) => {
    const routes = [
      '/ev-chargers',
      '/ev-chargers/dashboard',
      '/ev-chargers/billing',
      '/ev-chargers/energy',
      '/ev-chargers/users',
      '/ev-chargers/sessions',
      '/ev-chargers/smart-charging',
      '/ev-chargers/config'
    ];

    let passed = 0;
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { timeout: 15000 });
      await waitForPageReady(page);

      const content = await page.content();
      if (content.length > 50000) {
        passed++;
        console.log(`  ✓ ${route} - OK`);
      } else {
        console.log(`  ✗ ${route} - Failed`);
      }
    }

    console.log(`  Navigation: ${passed}/${routes.length} pages loaded`);
    expect(passed).toBeGreaterThanOrEqual(6);
  });

  test('10. Stress Test - Rapid Navigation', async ({ page }) => {
    const routes = ['/ev-chargers/dashboard', '/ev-chargers/billing', '/ev-chargers/energy', '/dashboard', '/systems'];

    let navCount = 0;
    for (let round = 0; round < 2; round++) {
      for (const route of routes) {
        try {
          await page.goto(`${BASE_URL}${route}`, { timeout: 10000 });
          await page.waitForTimeout(500);
          navCount++;
        } catch (e) {}
      }
    }

    console.log(`  Rapid navigation: ${navCount}/${routes.length * 2} successful`);
    await page.screenshot({ path: 'test-results/cpms-10-stress.png', fullPage: true });

    expect(navCount).toBeGreaterThan(6);
  });
});
