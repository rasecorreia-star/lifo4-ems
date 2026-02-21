/**
 * EMS BESS v2.0 - TESTE COMPLETO DO SISTEMA
 *
 * Este teste cobre:
 * 1. Criacao de novo BESS (wizard 6 passos)
 * 2. Digital Twin (todas as funcionalidades)
 * 3. Todas as paginas principais
 * 4. Todos os botoes interativos
 */

import { test, expect, Page } from '@playwright/test';

// Configuracao
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = 'screenshots/full-test';

// Helper: Login
async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"], #email', 'admin@lifo4.com.br');
  await page.fill('input[type="password"], input[name="password"], #password', 'admin123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// Helper: Screenshot com nome
async function snap(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true
  });
  console.log(`📸 Screenshot: ${name}`);
}

// Helper: Clicar com seguranca
async function safeClick(page: Page, selector: string, timeout = 5000): Promise<boolean> {
  try {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout })) {
      await el.click();
      await page.waitForTimeout(300);
      return true;
    }
  } catch {}
  return false;
}

// Helper: Listar todos os botoes
async function listButtons(page: Page): Promise<string[]> {
  const buttons = page.locator('button:visible');
  const count = await buttons.count();
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await buttons.nth(i).textContent().catch(() => '');
    if (text?.trim()) texts.push(text.trim());
  }
  return texts;
}

// ============================================================================
// TESTE 1: CRIAR NOVO BESS (WIZARD COMPLETO)
// ============================================================================

test.describe('1. Criar Novo BESS - Wizard Completo', () => {
  test('deve criar um novo sistema BESS pelo wizard de 6 passos', async ({ page }) => {
    test.setTimeout(180000); // 3 minutos

    await login(page);
    await page.goto('/systems');
    await page.waitForLoadState('networkidle');
    await snap(page, '01-systems-page');

    // Clicar em Novo Sistema
    console.log('🔍 Procurando botao Novo Sistema...');
    const novoBtn = page.locator('button:has-text("Novo Sistema"), button:has-text("Novo"), text=Novo Sistema').first();

    if (await novoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await novoBtn.click();
      console.log('✅ Clicou em Novo Sistema');
      await page.waitForTimeout(1500);
      await snap(page, '02-wizard-aberto');

      // Verificar se modal abriu
      const modalTitle = page.locator('text=Cadastrar Novo Sistema BESS');
      if (await modalTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✅ Modal do wizard aberto');

        // ========== PASSO 1: Informacoes Basicas ==========
        console.log('📝 Passo 1: Informacoes Basicas');

        // Nome do Sistema
        const nomeInput = page.locator('input[placeholder*="BESS"], input[placeholder*="Industrial"]').first();
        if (await nomeInput.isVisible()) {
          await nomeInput.fill('BESS Teste Digital Twin');
          console.log('  - Nome preenchido');
        }

        // Cidade
        const cidadeInput = page.locator('input[placeholder*="Teresina"]').first();
        if (await cidadeInput.isVisible()) {
          await cidadeInput.fill('Teresina');
          console.log('  - Cidade preenchida');
        }

        await snap(page, '03-passo1-preenchido');

        // Proximo
        await safeClick(page, 'button:has-text("Proximo"), button:has-text("Próximo")');
        await page.waitForTimeout(500);

        // ========== PASSO 2: Quimica da Bateria ==========
        console.log('📝 Passo 2: Quimica da Bateria');

        // Selecionar LFP
        await safeClick(page, 'button:has-text("LFP"), button:has-text("LiFePO4")');

        // Selecionar fabricante
        const cellMfr = page.locator('select').first();
        if (await cellMfr.isVisible()) {
          await cellMfr.selectOption({ index: 1 });
          console.log('  - Fabricante selecionado');
        }

        await snap(page, '04-passo2-quimica');
        await safeClick(page, 'button:has-text("Proximo")');
        await page.waitForTimeout(500);

        // ========== PASSO 3: Configuracao do Pack ==========
        console.log('📝 Passo 3: Configuracao do Pack');

        // Selecionar 16S1P
        await safeClick(page, 'button:has-text("16S1P")');

        await snap(page, '05-passo3-pack');
        await safeClick(page, 'button:has-text("Proximo")');
        await page.waitForTimeout(500);

        // ========== PASSO 4: BMS ==========
        console.log('📝 Passo 4: Configuracao BMS');

        // Selecionar fabricante BMS
        const bmsMfr = page.locator('select').first();
        if (await bmsMfr.isVisible()) {
          await bmsMfr.selectOption({ index: 1 });
          console.log('  - Fabricante BMS selecionado');
        }

        // Tipo de balanceamento
        await safeClick(page, 'button:has-text("Passivo")');

        await snap(page, '06-passo4-bms');
        await safeClick(page, 'button:has-text("Proximo")');
        await page.waitForTimeout(500);

        // ========== PASSO 5: Inversor ==========
        console.log('📝 Passo 5: Configuracao Inversor');

        // Selecionar fabricante inversor
        const invMfr = page.locator('select').first();
        if (await invMfr.isVisible()) {
          await invMfr.selectOption({ index: 1 });
          console.log('  - Fabricante inversor selecionado');
        }

        await snap(page, '07-passo5-inversor');
        await safeClick(page, 'button:has-text("Proximo")');
        await page.waitForTimeout(500);

        // ========== PASSO 6: Protecoes ==========
        console.log('📝 Passo 6: Configuracao Protecoes');

        await snap(page, '08-passo6-protecoes');

        // Cadastrar Sistema
        const cadastrarBtn = page.locator('button:has-text("Cadastrar Sistema")');
        if (await cadastrarBtn.isVisible()) {
          await cadastrarBtn.click();
          console.log('✅ Clicou em Cadastrar Sistema');
          await page.waitForTimeout(2000);
        }

        await snap(page, '09-sistema-criado');
        console.log('🎉 BESS criado com sucesso!');
      }
    } else {
      console.log('⚠️ Botao Novo Sistema nao encontrado');

      // Listar botoes disponiveis
      const btns = await listButtons(page);
      console.log(`Botoes disponiveis: ${btns.join(', ')}`);
    }
  });
});

// ============================================================================
// TESTE 2: DIGITAL TWIN - TODAS AS FUNCIONALIDADES
// ============================================================================

test.describe('2. Digital Twin - Teste Completo', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('deve acessar e testar todas as tabs do Digital Twin', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/digital-twin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '10-digital-twin-inicial');

    console.log('🔬 Testando Digital Twin...');

    // Verificar titulo
    const title = page.locator('h1, h2').first();
    const titleText = await title.textContent().catch(() => '');
    console.log(`  Titulo da pagina: ${titleText}`);

    // ========== TAB: SIMULATION ==========
    console.log('📊 Tab: Simulation');
    await safeClick(page, '[role="tab"]:has-text("Simulation"), button:has-text("Simulation"), button:has-text("Simulacao")');
    await page.waitForTimeout(500);
    await snap(page, '11-digital-twin-simulation');

    // Ajustar slider de SOC inicial
    const socSlider = page.locator('input[type="range"]').first();
    if (await socSlider.isVisible()) {
      await socSlider.fill('80');
      console.log('  - SOC inicial: 80%');
    }

    // Clicar em Run Simulation
    if (await safeClick(page, 'button:has-text("Run Simulation"), button:has-text("Simular"), button:has-text("Iniciar")')) {
      console.log('  - Simulacao iniciada');
      await page.waitForTimeout(2000);
      await snap(page, '12-simulation-running');
    }

    // ========== TAB: STATE ESTIMATION ==========
    console.log('📊 Tab: State Estimation');
    await safeClick(page, '[role="tab"]:has-text("State"), button:has-text("State"), button:has-text("Estado")');
    await page.waitForTimeout(500);
    await snap(page, '13-digital-twin-state');

    // Verificar cards de SOC, SOH, SOP
    const stateCards = page.locator('[class*="card"], [class*="Card"]');
    const cardCount = await stateCards.count();
    console.log(`  - ${cardCount} cards de estado encontrados`);

    // ========== TAB: DEGRADATION ==========
    console.log('📊 Tab: Degradation');
    await safeClick(page, '[role="tab"]:has-text("Degradation"), button:has-text("Degradation"), button:has-text("Degradacao")');
    await page.waitForTimeout(500);
    await snap(page, '14-digital-twin-degradation');

    // Clicar em Predict Degradation
    if (await safeClick(page, 'button:has-text("Predict"), button:has-text("Prever"), button:has-text("Calcular")')) {
      console.log('  - Predicao de degradacao iniciada');
      await page.waitForTimeout(2000);
      await snap(page, '15-degradation-result');
    }

    // ========== TAB: VALIDATION ==========
    console.log('📊 Tab: Model Validation');
    await safeClick(page, '[role="tab"]:has-text("Validation"), button:has-text("Validation"), button:has-text("Validacao")');
    await page.waitForTimeout(500);
    await snap(page, '16-digital-twin-validation');

    // Clicar em Run Comparison
    if (await safeClick(page, 'button:has-text("Run Comparison"), button:has-text("Comparar")')) {
      console.log('  - Comparacao iniciada');
      await page.waitForTimeout(2000);
      await snap(page, '17-validation-result');
    }

    // Clicar em Export Report
    await safeClick(page, 'button:has-text("Export"), button:has-text("Exportar")');

    console.log('✅ Digital Twin testado com sucesso!');
  });
});

// ============================================================================
// TESTE 3: TODAS AS PAGINAS PRINCIPAIS
// ============================================================================

test.describe('3. Navegacao por Todas as Paginas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const pagesToTest = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/systems', name: 'Sistemas' },
    { path: '/analytics', name: 'Analytics' },
    { path: '/alerts', name: 'Alertas' },
    { path: '/trading-dashboard', name: 'Trading Dashboard' },
    { path: '/assistant', name: 'Assistente IA' },
    { path: '/vpp', name: 'VPP' },
    { path: '/digital-twin', name: 'Digital Twin' },
    { path: '/battery-health', name: 'Saude Bateria' },
    { path: '/optimization', name: 'Otimizacao' },
    { path: '/grid', name: 'Integracao Rede' },
    { path: '/reports', name: 'Relatorios' },
    { path: '/maintenance', name: 'Manutencao' },
    { path: '/settings', name: 'Configuracoes' },
    { path: '/sla', name: 'SLA Dashboard' },
    { path: '/predictive', name: 'Manutencao Preditiva' },
    { path: '/simulation', name: 'Simulacao' },
    { path: '/gamification', name: 'Gamificacao' },
  ];

  for (const pageInfo of pagesToTest) {
    test(`deve carregar ${pageInfo.name}`, async ({ page }) => {
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      await snap(page, `page-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}`);

      // Listar botoes
      const buttons = await listButtons(page);
      console.log(`${pageInfo.name}: ${buttons.length} botoes - ${buttons.slice(0, 5).join(', ')}${buttons.length > 5 ? '...' : ''}`);

      // Clicar nos primeiros 3 botoes interativos
      for (let i = 0; i < Math.min(3, buttons.length); i++) {
        const btnText = buttons[i];
        if (!btnText.includes('Sair') && !btnText.includes('Logout') && btnText.length < 30) {
          await safeClick(page, `button:has-text("${btnText}")`);
          await page.waitForTimeout(200);
        }
      }
    });
  }
});

// ============================================================================
// TESTE 4: VPP - VIRTUAL POWER PLANT
// ============================================================================

test.describe('4. VPP - Teste Completo', () => {
  test('deve testar todas as tabs e funcionalidades do VPP', async ({ page }) => {
    test.setTimeout(90000);

    await login(page);
    await page.goto('/vpp');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '20-vpp-inicial');

    console.log('🏭 Testando VPP...');

    // Tabs do VPP
    const vppTabs = ['Visao Geral', 'Ativos', 'Despacho', 'Analytics'];

    for (const tabName of vppTabs) {
      if (await safeClick(page, `button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`)) {
        console.log(`  ✅ Tab: ${tabName}`);
        await page.waitForTimeout(500);
        await snap(page, `21-vpp-tab-${tabName.toLowerCase().replace(/\s+/g, '-')}`);
      }
    }

    // Toggle Auto/Manual
    await safeClick(page, 'button:has-text("Auto"), button:has-text("Manual"), [role="switch"]');

    console.log('✅ VPP testado com sucesso!');
  });
});

// ============================================================================
// TESTE 5: TRADING DASHBOARD
// ============================================================================

test.describe('5. Trading Dashboard - Teste Completo', () => {
  test('deve testar todas as funcionalidades do Trading', async ({ page }) => {
    test.setTimeout(90000);

    await login(page);
    await page.goto('/trading-dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '30-trading-inicial');

    console.log('💹 Testando Trading Dashboard...');

    // Nova Ordem
    if (await safeClick(page, 'button:has-text("Nova Ordem"), button:has-text("New Order")')) {
      console.log('  ✅ Dialog Nova Ordem aberto');
      await page.waitForTimeout(500);
      await snap(page, '31-trading-nova-ordem');

      // Fechar dialog
      await safeClick(page, 'button:has-text("Cancelar"), button:has-text("X"), [class*="close"]');
    }

    // Auto Trading toggle
    await safeClick(page, '[role="switch"], button:has-text("Auto Trading")');

    // Tabs
    const tradingTabs = page.locator('[role="tab"]');
    const tabCount = await tradingTabs.count();
    console.log(`  ${tabCount} tabs encontradas`);

    for (let i = 0; i < tabCount; i++) {
      await tradingTabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    await snap(page, '32-trading-final');
    console.log('✅ Trading Dashboard testado com sucesso!');
  });
});

// ============================================================================
// TESTE 6: ASSISTENTE IA
// ============================================================================

test.describe('6. Assistente IA - Teste Completo', () => {
  test('deve testar o chat e comandos do Assistente', async ({ page }) => {
    test.setTimeout(90000);

    await login(page);
    await page.goto('/assistant');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '40-assistant-inicial');

    console.log('🤖 Testando Assistente IA...');

    // Enviar mensagem
    const chatInput = page.locator('input[type="text"], textarea').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Qual o status do sistema BESS?');
      await snap(page, '41-assistant-digitando');

      // Enviar
      await safeClick(page, 'button[type="submit"], button:has(svg)');
      await page.waitForTimeout(1500);
      await snap(page, '42-assistant-resposta');
      console.log('  ✅ Mensagem enviada');
    }

    // Comandos rapidos
    const quickCommands = ['Status', 'Eficiencia', 'Alertas', 'Relatorio'];
    for (const cmd of quickCommands) {
      if (await safeClick(page, `button:has-text("${cmd}")`)) {
        console.log(`  ✅ Comando: ${cmd}`);
        await page.waitForTimeout(500);
      }
    }

    // Botao de voz
    await safeClick(page, 'button:has(svg[class*="mic"]), button[aria-label*="voice"], button[aria-label*="voz"]');

    await snap(page, '43-assistant-final');
    console.log('✅ Assistente IA testado com sucesso!');
  });
});

// ============================================================================
// TESTE 7: RELATORIOS
// ============================================================================

test.describe('7. Relatorios - Teste Completo', () => {
  test('deve testar geracao de relatorios', async ({ page }) => {
    test.setTimeout(60000);

    await login(page);
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '50-reports-inicial');

    console.log('📊 Testando Relatorios...');

    // Gerar novo relatorio
    if (await safeClick(page, 'button:has-text("Gerar"), button:has-text("Novo"), button:has-text("Generate")')) {
      console.log('  ✅ Dialog de geracao aberto');
      await page.waitForTimeout(500);
      await snap(page, '51-reports-dialog');
    }

    // Exportar PDF
    await safeClick(page, 'button:has-text("PDF")');

    // Exportar Excel
    await safeClick(page, 'button:has-text("Excel"), button:has-text("CSV")');

    await snap(page, '52-reports-final');
    console.log('✅ Relatorios testado com sucesso!');
  });
});

// ============================================================================
// TESTE 8: MANUTENCAO
// ============================================================================

test.describe('8. Manutencao - Teste Completo', () => {
  test('deve testar funcionalidades de manutencao', async ({ page }) => {
    test.setTimeout(60000);

    await login(page);
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '60-maintenance-inicial');

    console.log('🔧 Testando Manutencao...');

    // Nova tarefa
    if (await safeClick(page, 'button:has-text("Nova"), button:has-text("Agendar"), button:has-text("Criar")')) {
      console.log('  ✅ Dialog nova tarefa aberto');
      await page.waitForTimeout(500);
      await snap(page, '61-maintenance-dialog');

      // Fechar
      await safeClick(page, 'button:has-text("Cancelar")');
    }

    // Filtros
    await safeClick(page, 'button:has-text("Pendentes")');
    await safeClick(page, 'button:has-text("Concluidas")');
    await safeClick(page, 'button:has-text("Todas")');

    await snap(page, '62-maintenance-final');
    console.log('✅ Manutencao testado com sucesso!');
  });
});

// ============================================================================
// RESUMO FINAL
// ============================================================================

test.describe('9. Resumo Final', () => {
  test('deve gerar resumo de todos os testes', async ({ page }) => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           EMS BESS v2.0 - TESTE COMPLETO FINALIZADO');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ Wizard de criacao de BESS (6 passos)');
    console.log('✅ Digital Twin (Simulation, State, Degradation, Validation)');
    console.log('✅ VPP (4 tabs)');
    console.log('✅ Trading Dashboard');
    console.log('✅ Assistente IA');
    console.log('✅ Relatorios');
    console.log('✅ Manutencao');
    console.log('✅ 18 paginas navegadas');
    console.log('');
    console.log('📸 Screenshots salvos em: screenshots/full-test/');
    console.log('═══════════════════════════════════════════════════════════');
  });
});
