import { test, expect, Page } from '@playwright/test';

// Helper function to login via form
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('#email', 'admin@lifo4.com.br');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('CRUD Operations - Systems', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate to Systems and find Novo Sistema button', async ({ page }) => {
    await page.goto('/systems');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-systems-page.png', fullPage: true });

    // Look for "Novo Sistema" or "New System" button
    const novoSistemaBtn = page.locator('button:has-text("Novo"), button:has-text("Add"), button:has-text("Criar"), a:has-text("Novo")').first();
    const isVisible = await novoSistemaBtn.isVisible().catch(() => false);

    console.log(`"Novo Sistema" button visible: ${isVisible}`);

    if (isVisible) {
      const btnText = await novoSistemaBtn.textContent();
      console.log(`Button text: ${btnText}`);
    }

    // List all buttons on the page
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`\nFound ${buttonCount} buttons on Systems page:`);

    for (let i = 0; i < Math.min(buttonCount, 15); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  ${i + 1}. ${text.trim()}`);
      }
    }
  });

  test('should click Novo Sistema and see form/dialog', async ({ page }) => {
    await page.goto('/systems');
    await page.waitForLoadState('networkidle');

    // Try different selectors for "New System" button
    const selectors = [
      'button:has-text("Novo Sistema")',
      'button:has-text("Novo")',
      'button:has-text("Adicionar")',
      'button:has-text("Add")',
      'button:has-text("Criar")',
      'a:has-text("Novo")',
      '[data-testid="new-system"]',
      'button svg.lucide-plus',
    ];

    let clicked = false;
    for (const selector of selectors) {
      const btn = page.locator(selector).first();
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
        console.log(`Found button with selector: ${selector}`);
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (clicked) {
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/crud-novo-sistema-dialog.png', fullPage: true });

      // Look for form fields
      const inputs = page.locator('input:visible, select:visible, textarea:visible');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} form inputs`);

      // Check for dialog/modal
      const dialog = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"], [class*="dialog"], [class*="Dialog"]');
      const hasDialog = await dialog.isVisible().catch(() => false);
      console.log(`Dialog/Modal visible: ${hasDialog}`);
    } else {
      console.log('Could not find "Novo Sistema" button');
      await page.screenshot({ path: 'screenshots/crud-no-novo-sistema-btn.png', fullPage: true });
    }
  });

  test('should interact with system list items', async ({ page }) => {
    await page.goto('/systems');
    await page.waitForLoadState('networkidle');

    // Look for system cards or list items
    const systemItems = page.locator('[class*="card"], [class*="Card"], tr, [class*="list-item"], [class*="ListItem"]');
    const itemCount = await systemItems.count();
    console.log(`Found ${itemCount} potential system items`);

    // Look for specific system links
    const systemLinks = page.locator('a[href*="/systems/"]');
    const linkCount = await systemLinks.count();
    console.log(`Found ${linkCount} system links`);

    if (linkCount > 0) {
      const firstLink = systemLinks.first();
      const href = await firstLink.getAttribute('href');
      const text = await firstLink.textContent();
      console.log(`First system: "${text?.trim()}" -> ${href}`);

      // Click on first system
      await firstLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'screenshots/crud-system-detail.png', fullPage: true });

      console.log(`Navigated to: ${page.url()}`);
    }
  });
});

test.describe('CRUD Operations - Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should view and interact with alerts', async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-alerts-page.png', fullPage: true });

    // Look for alert items
    const alerts = page.locator('[class*="alert"], [class*="Alert"], tr, [role="row"]');
    const alertCount = await alerts.count();
    console.log(`Found ${alertCount} potential alert items`);

    // Look for action buttons (acknowledge, dismiss, etc.)
    const actionBtns = page.locator('button:has-text("Reconhecer"), button:has-text("Dismiss"), button:has-text("Ack"), button:has-text("Marcar")');
    const actionCount = await actionBtns.count();
    console.log(`Found ${actionCount} action buttons`);

    // List all buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`\nAll buttons on Alerts page:`);
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  ${i + 1}. ${text.trim()}`);
      }
    }
  });
});

test.describe('CRUD Operations - Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should generate a new report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-reports-page.png', fullPage: true });

    // Look for "Generate Report" or similar button
    const generateBtn = page.locator('button:has-text("Gerar"), button:has-text("Generate"), button:has-text("Novo"), button:has-text("Criar")').first();
    const isVisible = await generateBtn.isVisible().catch(() => false);

    console.log(`"Generate Report" button visible: ${isVisible}`);

    if (isVisible) {
      await generateBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/crud-report-dialog.png', fullPage: true });

      // Check for form/dialog
      const inputs = page.locator('input:visible, select:visible');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} form inputs in report dialog`);
    }

    // List all buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`\nAll buttons on Reports page:`);
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  ${i + 1}. ${text.trim()}`);
      }
    }
  });
});

test.describe('CRUD Operations - Maintenance', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should create maintenance task', async ({ page }) => {
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-maintenance-page.png', fullPage: true });

    // Look for "New Task" or similar button
    const newTaskBtn = page.locator('button:has-text("Nova"), button:has-text("Agendar"), button:has-text("Criar"), button:has-text("Add")').first();
    const isVisible = await newTaskBtn.isVisible().catch(() => false);

    console.log(`"New Task" button visible: ${isVisible}`);

    if (isVisible) {
      const btnText = await newTaskBtn.textContent();
      console.log(`Button text: ${btnText}`);

      await newTaskBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/crud-maintenance-dialog.png', fullPage: true });
    }

    // List all buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`\nAll buttons on Maintenance page:`);
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  ${i + 1}. ${text.trim()}`);
      }
    }
  });
});

test.describe('Interactive Features - Trading Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should interact with Trading Dashboard features', async ({ page }) => {
    await page.goto('/trading-dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-trading-full.png', fullPage: true });

    // Look for Auto Trading toggle
    const autoToggle = page.locator('button:has-text("Auto"), [role="switch"], input[type="checkbox"]').first();
    const toggleVisible = await autoToggle.isVisible().catch(() => false);
    console.log(`Auto trading toggle visible: ${toggleVisible}`);

    // Look for "Nova Ordem" button
    const novaOrdemBtn = page.locator('button:has-text("Nova Ordem"), button:has-text("New Order"), button:has-text("Ordem")').first();
    const novaOrdemVisible = await novaOrdemBtn.isVisible().catch(() => false);
    console.log(`"Nova Ordem" button visible: ${novaOrdemVisible}`);

    if (novaOrdemVisible) {
      await novaOrdemBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/crud-trading-nova-ordem.png', fullPage: true });

      // Check for dialog
      const dialog = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]');
      const hasDialog = await dialog.isVisible().catch(() => false);
      console.log(`Order dialog visible: ${hasDialog}`);

      if (hasDialog) {
        // List form fields
        const inputs = page.locator('[role="dialog"] input, [role="dialog"] select, [class*="Modal"] input, [class*="Modal"] select');
        const inputCount = await inputs.count();
        console.log(`Found ${inputCount} form fields in dialog`);
      }
    }

    // List all buttons
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    console.log(`\nAll buttons on Trading Dashboard:`);
    for (let i = 0; i < Math.min(buttonCount, 15); i++) {
      const text = await buttons.nth(i).textContent();
      if (text?.trim()) {
        console.log(`  ${i + 1}. ${text.trim()}`);
      }
    }
  });
});

test.describe('Interactive Features - VPP', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should interact with VPP tabs and controls', async ({ page }) => {
    await page.goto('/vpp');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-vpp-overview.png', fullPage: true });

    // Click through all tabs
    const tabs = ['Visao Geral', 'Ativos', 'Despacho', 'Analytics'];
    for (const tabName of tabs) {
      const tab = page.locator(`button:has-text("${tabName}")`).first();
      const isVisible = await tab.isVisible().catch(() => false);

      if (isVisible) {
        await tab.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `screenshots/crud-vpp-tab-${tabName.toLowerCase().replace(' ', '-')}.png`, fullPage: true });
        console.log(`✅ Clicked VPP tab: ${tabName}`);
      }
    }

    // Try Auto/Manual toggle
    const modeToggle = page.locator('button:has-text("Auto"), button:has-text("Manual")').first();
    const toggleVisible = await modeToggle.isVisible().catch(() => false);

    if (toggleVisible) {
      const currentMode = await modeToggle.textContent();
      console.log(`Current VPP mode: ${currentMode}`);

      await modeToggle.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/crud-vpp-mode-changed.png', fullPage: true });
    }
  });
});

test.describe('Interactive Features - Assistant', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should send message in Assistant chat', async ({ page }) => {
    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-assistant-initial.png', fullPage: true });

    // Look for chat input
    const chatInput = page.locator('input[placeholder*="mensagem"], input[placeholder*="message"], textarea[placeholder*="mensagem"], textarea[placeholder*="message"], input[type="text"]').first();
    const inputVisible = await chatInput.isVisible().catch(() => false);
    console.log(`Chat input visible: ${inputVisible}`);

    if (inputVisible) {
      // Type a message
      await chatInput.fill('Qual o status do sistema?');
      await page.screenshot({ path: 'screenshots/crud-assistant-typing.png', fullPage: true });

      // Look for send button
      const sendBtn = page.locator('button:has-text("Enviar"), button[type="submit"], button svg.lucide-send').first();
      const sendVisible = await sendBtn.isVisible().catch(() => false);

      if (sendVisible) {
        await sendBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/crud-assistant-sent.png', fullPage: true });
        console.log('✅ Message sent in Assistant');
      }
    }

    // Try quick commands
    const quickCmds = page.locator('button:has-text("Status"), button:has-text("Eficiencia"), button:has-text("Alertas")');
    const cmdCount = await quickCmds.count();
    console.log(`Found ${cmdCount} quick command buttons`);

    if (cmdCount > 0) {
      await quickCmds.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/crud-assistant-quick-cmd.png', fullPage: true });
      console.log('✅ Clicked quick command');
    }
  });
});

test.describe('Form Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should validate Settings form', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/crud-settings-page.png', fullPage: true });

    // Look for form inputs
    const inputs = page.locator('input:visible, select:visible, textarea:visible');
    const inputCount = await inputs.count();
    console.log(`Found ${inputCount} form inputs on Settings page`);

    // Look for save button
    const saveBtn = page.locator('button:has-text("Salvar"), button:has-text("Save"), button[type="submit"]').first();
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    console.log(`Save button visible: ${saveVisible}`);

    // List all input labels/placeholders
    for (let i = 0; i < Math.min(inputCount, 10); i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder') || '';
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      console.log(`  Input ${i + 1}: placeholder="${placeholder}", name="${name}", id="${id}"`);
    }
  });
});
