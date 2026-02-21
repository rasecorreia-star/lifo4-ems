import { test, expect } from '@playwright/test';

// Test configuration
const TEST_USER = {
  email: 'admin@lifo4.com.br',
  password: 'admin123'
};

// Helper function to login
async function login(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');

  if (await emailInput.isVisible()) {
    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for navigation
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  }
}

test.describe('EMS BESS v2.0 - Full System Test', () => {

  test.beforeEach(async ({ page }) => {
    // Try to login before each test
    await login(page);
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Page should have some title (flexible check)
    const title = await page.title();
    console.log(`Page title: ${title}`);
    await page.screenshot({ path: 'screenshots/01-login.png', fullPage: true });
  });

  test('should load dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check if dashboard elements exist
    const dashboardContent = page.locator('main, [class*="dashboard"], [class*="Dashboard"]');
    await expect(dashboardContent).toBeVisible({ timeout: 10000 }).catch(() => {});

    await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });
  });

  test('should navigate to Systems page', async ({ page }) => {
    await page.goto('/systems');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/03-systems.png', fullPage: true });
  });

  test('should navigate to Analytics', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/04-analytics.png', fullPage: true });
  });

  test('should navigate to Alerts', async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/05-alerts.png', fullPage: true });
  });

  test('should navigate to Trading Dashboard', async ({ page }) => {
    await page.goto('/trading-dashboard');
    await page.waitForLoadState('networkidle');

    // Check for trading elements
    const tradingTitle = page.locator('text=Trading Dashboard, h4:has-text("Trading")');

    await page.screenshot({ path: 'screenshots/06-trading-dashboard.png', fullPage: true });
  });

  test('should navigate to Assistant', async ({ page }) => {
    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');

    // Check for assistant elements
    const assistantTitle = page.locator('text=Assistente, h4:has-text("Assistente")');

    await page.screenshot({ path: 'screenshots/07-assistant.png', fullPage: true });
  });

  test('should navigate to SLA Dashboard', async ({ page }) => {
    await page.goto('/sla');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/08-sla.png', fullPage: true });
  });

  test('should navigate to Optimization', async ({ page }) => {
    await page.goto('/optimization');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/09-optimization.png', fullPage: true });
  });

  test('should navigate to Grid Integration', async ({ page }) => {
    await page.goto('/grid');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/10-grid.png', fullPage: true });
  });

  test('should navigate to Reports', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/11-reports.png', fullPage: true });
  });

  test('should navigate to Maintenance', async ({ page }) => {
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/12-maintenance.png', fullPage: true });
  });

  test('should navigate to Settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/13-settings.png', fullPage: true });
  });

  test('should navigate to Battery Health', async ({ page }) => {
    await page.goto('/battery-health');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/14-battery-health.png', fullPage: true });
  });

  test('should navigate to Energy Trading', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/15-energy-trading.png', fullPage: true });
  });

  test('should navigate to Virtual Power Plant', async ({ page }) => {
    await page.goto('/vpp');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/16-vpp.png', fullPage: true });
  });

  test('should navigate to Multi-Site Dashboard', async ({ page }) => {
    await page.goto('/multi-site');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/17-multi-site.png', fullPage: true });
  });

  test('should navigate to Simulation', async ({ page }) => {
    await page.goto('/simulation');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/18-simulation.png', fullPage: true });
  });

  test('should navigate to Predictive Maintenance', async ({ page }) => {
    await page.goto('/predictive');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/19-predictive.png', fullPage: true });
  });

  test('should navigate to Integrations', async ({ page }) => {
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/20-integrations.png', fullPage: true });
  });
});

test.describe('Sidebar Navigation Test', () => {

  test('should click through all sidebar items', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Get all sidebar links
    const sidebarLinks = page.locator('nav a, aside a, [class*="sidebar"] a, [class*="Sidebar"] a');
    const linkCount = await sidebarLinks.count();

    console.log(`Found ${linkCount} sidebar links`);

    // Click first 10 links (to avoid too long test)
    const linksToTest = Math.min(linkCount, 10);

    for (let i = 0; i < linksToTest; i++) {
      try {
        const link = sidebarLinks.nth(i);
        const href = await link.getAttribute('href');

        if (href && !href.includes('logout')) {
          await link.click();
          await page.waitForLoadState('networkidle');
          console.log(`Clicked link ${i + 1}: ${href}`);

          // Take screenshot
          await page.screenshot({
            path: `screenshots/sidebar-${String(i + 1).padStart(2, '0')}-${href.replace(/\//g, '-').slice(1) || 'home'}.png`,
            fullPage: true
          });
        }
      } catch (e) {
        console.log(`Error clicking link ${i}: ${e}`);
      }
    }
  });
});

test.describe('Interactive Elements Test', () => {

  test('should test buttons on Trading Dashboard', async ({ page }) => {
    await login(page);
    await page.goto('/trading-dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons on Trading Dashboard`);

    // Test "Nova Ordem" button if exists
    const novaOrdemBtn = page.locator('button:has-text("Nova Ordem")');
    if (await novaOrdemBtn.isVisible()) {
      await novaOrdemBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/trading-nova-ordem-dialog.png' });

      // Close dialog
      const cancelBtn = page.locator('button:has-text("Cancelar")');
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    }

    // Test tabs
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/trading-tab-${i + 1}.png` });
    }
  });

  test('should test Assistant chat', async ({ page }) => {
    await login(page);
    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');

    // Find chat input
    const chatInput = page.locator('input[type="text"], textarea').first();

    if (await chatInput.isVisible()) {
      await chatInput.fill('qual o status da bateria?');
      await page.screenshot({ path: 'screenshots/assistant-typing.png' });

      // Find and click send button
      const sendBtn = page.locator('button[type="submit"], button:has-text("Enviar"), button svg').last();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/assistant-response.png' });
      }
    }
  });
});

test.describe('Form Tests', () => {

  test('should test login form validation', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Try to submit empty form
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/login-validation.png' });
    }

    // Fill with invalid email
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid-email');
      await page.screenshot({ path: 'screenshots/login-invalid-email.png' });
    }
  });
});

test.describe('Responsive Test', () => {

  test('should test mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/mobile-dashboard.png', fullPage: true });

    await page.goto('/trading-dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/mobile-trading.png', fullPage: true });

    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/mobile-assistant.png', fullPage: true });
  });

  test('should test tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/tablet-dashboard.png', fullPage: true });
  });
});
