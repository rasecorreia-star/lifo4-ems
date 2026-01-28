import { test, expect, Page } from '@playwright/test';

// Helper function to login via form
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('#email', 'admin@lifo4.com.br');
  await page.fill('#password', 'admin123');

  // Click submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

// All sidebar menu items from Sidebar.tsx
const SIDEBAR_ITEMS = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Multi-Site', href: '/multi-site' },
  { name: 'Sistemas', href: '/systems' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Benchmarking', href: '/benchmarking' },
  { name: 'SLA', href: '/sla' },
  { name: 'Saude Bateria', href: '/battery-health' },
  { name: 'Perfil de Carga', href: '/load-profile' },
  { name: 'Custos Energia', href: '/energy-costs' },
  { name: 'Meteorologia', href: '/weather' },
  { name: 'Otimizacao', href: '/optimization' },
  { name: 'Simulacao', href: '/simulation' },
  { name: 'Integracao Rede', href: '/grid' },
  { name: 'VPP', href: '/vpp' },
  { name: 'Resp. Demanda', href: '/demand-response' },
  { name: 'Trading', href: '/trading' },
  { name: 'Trading Pro', href: '/trading-dashboard' },
  { name: 'Black Start', href: '/blackstart' },
  { name: 'Alertas', href: '/alerts' },
  { name: 'Config. Alarmes', href: '/alarm-config' },
  { name: 'Relatorios', href: '/reports' },
  { name: 'Pegada Carbono', href: '/carbon' },
  { name: 'Manutencao', href: '/maintenance' },
  { name: 'Garantias', href: '/warranties' },
  { name: 'Inventario', href: '/inventory' },
  { name: 'Comissionamento', href: '/commissioning' },
  { name: 'Conformidade', href: '/compliance' },
  { name: 'Manut. Preditiva', href: '/predictive' },
  { name: 'Diag. Remoto', href: '/remote-diagnostics' },
  { name: 'Log de Eventos', href: '/events' },
  { name: 'Firmware', href: '/firmware' },
  { name: 'API Keys', href: '/api-keys' },
  { name: 'Integracoes', href: '/integrations' },
  { name: 'Auditoria', href: '/audit' },
  { name: 'Backup', href: '/backup' },
  { name: 'Licenca', href: '/license' },
  { name: 'Sessoes', href: '/sessions' },
  { name: 'Logs Sistema', href: '/logs' },
  { name: 'Rede', href: '/network' },
  { name: 'Tarefas', href: '/tasks' },
  { name: 'Contratos', href: '/contracts' },
  { name: 'Ordens Servico', href: '/work-orders' },
  { name: 'Ativos', href: '/assets' },
  { name: 'Templates Notif.', href: '/notification-templates' },
  { name: 'Importar Dados', href: '/data-import' },
  { name: 'Usuarios', href: '/users' },
  { name: 'Configuracoes', href: '/settings' },
  { name: 'Treinamentos', href: '/training' },
  { name: 'Documentacao', href: '/docs' },
  { name: 'Suporte', href: '/support' },
  { name: 'Assistente IA', href: '/assistant' },
  { name: 'Ajuda', href: '/help' },
];

test.describe('Sidebar Navigation with Real Login', () => {
  test('should login and see dashboard with sidebar', async ({ page }) => {
    await login(page);

    await page.screenshot({ path: 'screenshots/logged-in-dashboard.png', fullPage: true });

    // Check sidebar is visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Count sidebar links
    const links = page.locator('aside a');
    const count = await links.count();
    console.log(`✅ Logged in! Found ${count} sidebar links`);

    // List first 10 links
    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await links.nth(i).textContent();
      const href = await links.nth(i).getAttribute('href');
      console.log(`  ${i + 1}. ${text?.trim()} -> ${href}`);
    }
  });

  test('should click VPP in sidebar', async ({ page }) => {
    await login(page);

    // Screenshot before
    await page.screenshot({ path: 'screenshots/before-vpp-click.png', fullPage: true });

    // Find and click VPP link
    const vppLink = page.locator('aside a:has-text("VPP")').first();
    await expect(vppLink).toBeVisible();

    await vppLink.click();
    await page.waitForLoadState('networkidle');

    // Screenshot after
    await page.screenshot({ path: 'screenshots/after-vpp-click.png', fullPage: true });

    // Verify URL
    expect(page.url()).toContain('/vpp');
    console.log('✅ VPP page loaded via sidebar click');
  });

  test('should click Trading Pro in sidebar', async ({ page }) => {
    await login(page);

    const tradingLink = page.locator('aside a:has-text("Trading Pro")').first();
    await expect(tradingLink).toBeVisible();

    await tradingLink.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'screenshots/trading-pro-clicked.png', fullPage: true });

    expect(page.url()).toContain('/trading-dashboard');
    console.log('✅ Trading Pro page loaded via sidebar click');
  });

  test('should click Assistente IA in sidebar', async ({ page }) => {
    await login(page);

    const assistantLink = page.locator('aside a:has-text("Assistente IA")').first();
    await expect(assistantLink).toBeVisible();

    await assistantLink.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'screenshots/assistant-clicked.png', fullPage: true });

    expect(page.url()).toContain('/assistant');
    console.log('✅ Assistente IA page loaded via sidebar click');
  });
});

test.describe('Click ALL Sidebar Items', () => {
  test('should click through all visible sidebar items', async ({ page }) => {
    await login(page);

    // Get all sidebar links
    const links = page.locator('aside a');
    const count = await links.count();
    console.log(`Found ${count} sidebar links total`);

    const results: { name: string; href: string; status: string }[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Go back to dashboard first
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Get link info
        const link = page.locator('aside a').nth(i);
        const text = await link.textContent() || '';
        const href = await link.getAttribute('href') || '';

        if (href.includes('logout') || text.includes('Sair')) {
          console.log(`⏭️ Skipping logout link`);
          continue;
        }

        // Click the link
        await link.click();
        await page.waitForLoadState('networkidle');

        // Take screenshot
        const screenshotName = href.replace(/\//g, '-').slice(1) || 'home';
        await page.screenshot({ path: `screenshots/clicked-${String(i + 1).padStart(2, '0')}-${screenshotName}.png`, fullPage: true });

        const currentUrl = page.url();
        results.push({ name: text.trim(), href, status: '✅' });
        console.log(`✅ ${i + 1}. ${text.trim()} -> ${currentUrl}`);

      } catch (error) {
        console.log(`❌ Error clicking link ${i + 1}: ${error}`);
        results.push({ name: `Link ${i + 1}`, href: '', status: '❌' });
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total: ${results.length}`);
    console.log(`Success: ${results.filter(r => r.status === '✅').length}`);
    console.log(`Failed: ${results.filter(r => r.status === '❌').length}`);
  });
});

test.describe('VPP Page Interaction', () => {
  test('should interact with VPP page elements', async ({ page }) => {
    await login(page);

    // Navigate to VPP
    await page.goto('/vpp');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'screenshots/vpp-full-page.png', fullPage: true });

    // Check for tabs
    const tabs = page.locator('[role="tab"], button[class*="TabsTrigger"]');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tabs on VPP page`);

    // Click each tab
    for (let i = 0; i < tabCount; i++) {
      try {
        const tabText = await tabs.nth(i).textContent();
        await tabs.nth(i).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `screenshots/vpp-tab-${i + 1}.png`, fullPage: true });
        console.log(`✅ Clicked tab: ${tabText?.trim()}`);
      } catch (e) {
        console.log(`❌ Could not click tab ${i + 1}`);
      }
    }

    // Check for buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons on VPP page`);

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  Button: ${text.trim()}`);
      }
    }

    // Check for cards/sections
    const cards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} cards on VPP page`);
  });
});
