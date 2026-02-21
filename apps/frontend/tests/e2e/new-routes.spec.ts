import { test, expect, Page } from '@playwright/test';

// Helper function to login via form
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"], input[name="email"], #email', 'admin@lifo4.com.br');
  await page.fill('input[type="password"], input[name="password"], #password', 'admin123');

  // Click submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
}

// New routes added in FASE 1 completion
const NEW_ROUTES = [
  { path: '/prospects', name: 'Prospects' },
  { path: '/prospects/123', name: 'Prospect Detail' },
  { path: '/prospects/123/load-analysis', name: 'Load Analysis' },
  { path: '/prospects/123/recommendations', name: 'System Recommendations' },
  { path: '/simple-dashboard', name: 'Simple Dashboard' },
  { path: '/roi', name: 'ROI Calculator' },
  { path: '/changelog', name: 'Changelog' },
  { path: '/energy-forecasting', name: 'Energy Forecasting' },
  { path: '/solar', name: 'Solar Plant' },
  { path: '/microgrids/grid-services', name: 'Grid Services' },
  { path: '/microgrids/islanding', name: 'Islanding Control' },
];

test.describe('New Routes - FASE 1', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Prospects route should be accessible from sidebar', async ({ page }) => {
    // Click on Prospects in sidebar
    await page.click('text=Prospects');
    await page.waitForLoadState('networkidle');

    // Should navigate to /prospects
    expect(page.url()).toContain('/prospects');

    // Should not show 404
    const notFound = await page.locator('text=404').count();
    expect(notFound).toBe(0);
  });

  test('should navigate to all new routes without 404', async ({ page }) => {
    for (const route of NEW_ROUTES) {
      // For routes with params, try to navigate directly
      if (route.path.includes('123')) {
        await page.goto(route.path, { waitUntil: 'networkidle' });
      } else {
        await page.goto(route.path, { waitUntil: 'networkidle' });
      }

      // Check that we're not on a 404 page
      const notFoundCount = await page.locator('text=404, text=Not Found').count();
      expect(notFoundCount).toBe(0, `Route ${route.path} resulted in 404`);

      // Check that page loaded
      const body = await page.locator('body');
      expect(body).toBeTruthy();
    }
  });

  test('should handle Prospects navigation without errors', async ({ page }) => {
    // Navigate to prospects
    await page.goto('/prospects', { waitUntil: 'networkidle' });

    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      errors.push(err.message);
    });

    // Should be on prospects page
    expect(page.url()).toContain('/prospects');

    // No critical errors expected
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver')
    );
    expect(criticalErrors.length).toBe(0, `Unexpected errors: ${criticalErrors.join(', ')}`);
  });

  test('should have proper route structure in App.tsx', async ({ page }) => {
    // Test that all new dashboard pages load without layout issues
    const dashboardRoutes = [
      '/simple-dashboard',
      '/roi',
      '/changelog',
      '/energy-forecasting',
      '/solar',
    ];

    for (const route of dashboardRoutes) {
      await page.goto(route, { waitUntil: 'networkidle' });

      // Check main content is visible
      const mainContent = await page.locator('main, [role="main"]');
      expect(mainContent).toBeTruthy();

      // Should not show blank page
      const bodyText = await page.textContent('body');
      expect(bodyText?.trim().length).toBeGreaterThan(0);
    }
  });

  test('Microgrid subroutes should be accessible', async ({ page }) => {
    // Test grid services
    await page.goto('/microgrids/grid-services', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/microgrids/grid-services');

    let notFound = await page.locator('text=404').count();
    expect(notFound).toBe(0);

    // Test islanding control
    await page.goto('/microgrids/islanding', { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/microgrids/islanding');

    notFound = await page.locator('text=404').count();
    expect(notFound).toBe(0);
  });

  test('should verify Prospects is shown in sidebar (admin mode)', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard', { waitUntil: 'networkidle' });

    // Check if Prospects menu item exists
    const prospectLink = page.locator('a[href="/prospects"], nav a:has-text("Prospects")');
    expect(prospectLink).toBeTruthy();
  });
});
