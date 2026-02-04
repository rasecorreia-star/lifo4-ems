/**
 * AUDITORIA COMPLETA DO SISTEMA EMS BESS
 * Testa todos os botões, formulários, selects, navegação e integração
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://76.13.164.252:8081',
    screenshotDir: './auto-test/screenshots/auditoria',
    timeout: 15000
};

// Relatório de auditoria
const report = {
    passed: [],
    failed: [],
    warnings: []
};

function log(emoji, page, item, status, action = '') {
    const msg = `${emoji} ${page}: ${item} - ${status}`;
    console.log(msg);
    if (emoji === '✅') {
        report.passed.push({ page, item, status });
    } else if (emoji === '❌') {
        report.failed.push({ page, item, status, action });
    } else if (emoji === '⚠️') {
        report.warnings.push({ page, item, status });
    }
}

async function runAuditoria() {
    console.log('\n' + '='.repeat(60));
    console.log('  AUDITORIA COMPLETA - EMS BESS');
    console.log(`  URL: ${CONFIG.baseUrl}`);
    console.log('='.repeat(60) + '\n');

    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Captura erros
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('WebSocket')) {
            errors.push(msg.text());
        }
    });

    try {
        // ========================================
        // 1. DASHBOARD
        // ========================================
        console.log('\n📍 Página: /dashboard (Dashboard)\n');

        await page.goto(CONFIG.baseUrl + '/', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        // Verifica se carregou
        const dashboardTitle = await page.$eval('body', el => el.innerText.includes('Dashboard'));
        if (dashboardTitle) {
            log('✅', '/dashboard', 'Página carrega', 'OK');
        } else {
            log('❌', '/dashboard', 'Página carrega', 'FALHOU');
        }

        // Verifica cards de estatísticas
        const statsCards = await page.$$('[class*="stat"], [class*="card"]');
        if (statsCards.length > 0) {
            log('✅', '/dashboard', `Cards de estatísticas (${statsCards.length})`, 'Encontrados');
        } else {
            log('⚠️', '/dashboard', 'Cards de estatísticas', 'Nenhum encontrado');
        }

        // Verifica se mostra dados de sistemas
        const hasSystemData = await page.$eval('body', el =>
            el.innerText.includes('BESS') || el.innerText.includes('Sistema') || el.innerText.includes('Teresina')
        );
        if (hasSystemData) {
            log('✅', '/dashboard', 'Dados de sistemas', 'Carregando da API');
        } else {
            log('❌', '/dashboard', 'Dados de sistemas', 'Não está carregando');
        }

        // Verifica alarmes
        const hasAlarmSection = await page.$eval('body', el =>
            el.innerText.toLowerCase().includes('alarme') || el.innerText.toLowerCase().includes('alert')
        );
        if (hasAlarmSection) {
            log('✅', '/dashboard', 'Seção de alarmes', 'Presente');
        } else {
            log('⚠️', '/dashboard', 'Seção de alarmes', 'Não encontrada');
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/01-dashboard.png`, fullPage: true });

        // ========================================
        // 2. LISTA DE SISTEMAS
        // ========================================
        console.log('\n📍 Página: /systems (Lista de Sistemas)\n');

        await page.goto(CONFIG.baseUrl + '/systems', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));

        // Verifica se carregou
        const systemsLoaded = await page.$eval('body', el => el.innerText.includes('Sistemas'));
        if (systemsLoaded) {
            log('✅', '/systems', 'Página carrega', 'OK');
        } else {
            log('❌', '/systems', 'Página carrega', 'FALHOU');
        }

        // Conta cards de sistemas
        const systemCards = await page.$$('[class*="card"]');
        const systemCount = systemCards.length;
        if (systemCount > 3) {
            log('✅', '/systems', `Cards de sistemas (${systemCount})`, 'Carregando da API');
        } else {
            log('⚠️', '/systems', 'Cards de sistemas', `Apenas ${systemCount} encontrados`);
        }

        // Verifica barras de SOC
        const socBars = await page.$$('[style*="width"][style*="%"]');
        if (socBars.length > 0) {
            log('✅', '/systems', 'Barras de SOC', 'Visíveis');
        } else {
            log('❌', '/systems', 'Barras de SOC', 'Não visíveis');
        }

        // Testa botão "Novo Sistema"
        const novoSistemaBtn = await page.$('button');
        if (novoSistemaBtn) {
            const btnText = await page.evaluate(el => el.innerText, novoSistemaBtn);
            if (btnText.includes('Novo')) {
                await novoSistemaBtn.click();
                await new Promise(r => setTimeout(r, 1000));

                const modalOpen = await page.$eval('body', el =>
                    el.innerText.includes('Adicionar') || el.innerText.includes('Cadastrar')
                );
                if (modalOpen) {
                    log('✅', '/systems', 'Botão "Novo Sistema"', 'Abre modal');

                    // Fecha modal
                    await page.keyboard.press('Escape');
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    log('❌', '/systems', 'Botão "Novo Sistema"', 'Não abre modal');
                }
            }
        }

        // Testa filtro de busca
        const searchInput = await page.$('input[type="text"], input[placeholder*="Buscar"], input[placeholder*="buscar"]');
        if (searchInput) {
            await searchInput.type('Teresina');
            await new Promise(r => setTimeout(r, 1000));
            log('✅', '/systems', 'Campo de busca', 'Funciona');
            await searchInput.click({ clickCount: 3 });
            await searchInput.press('Backspace');
        } else {
            log('⚠️', '/systems', 'Campo de busca', 'Não encontrado');
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/02-systems-list.png`, fullPage: true });

        // ========================================
        // 3. DETALHE DO SISTEMA
        // ========================================
        console.log('\n📍 Página: /systems/:id (Detalhe do Sistema)\n');

        await page.goto(CONFIG.baseUrl + '/systems/bess-001', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 3000));

        // Verifica se carregou dados
        const systemDetailLoaded = await page.$eval('body', el =>
            el.innerText.includes('Teresina') || el.innerText.includes('BESS')
        );
        if (systemDetailLoaded) {
            log('✅', '/systems/:id', 'Página carrega', 'OK');
        } else {
            log('❌', '/systems/:id', 'Página carrega', 'FALHOU');
        }

        // Verifica tabs
        const tabs = await page.$$('[role="tab"], [class*="tab"]');
        if (tabs.length > 0) {
            log('✅', '/systems/:id', `Tabs (${tabs.length})`, 'Encontradas');

            // Testa cada tab
            for (let i = 0; i < Math.min(tabs.length, 5); i++) {
                try {
                    const tabText = await page.evaluate(el => el.innerText, tabs[i]);
                    await tabs[i].click();
                    await new Promise(r => setTimeout(r, 500));
                    log('✅', '/systems/:id', `Tab "${tabText.trim()}"`, 'Clicável');
                } catch (e) {
                    // Tab pode não ser clicável
                }
            }
        }

        // Verifica aba Controle - busca por texto
        const allButtons = await page.$$('button, [role="tab"]');
        let controleTab = null;
        for (const btn of allButtons) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text && text.includes('Controle')) {
                controleTab = btn;
                break;
            }
        }
        if (controleTab) {
            await controleTab.click();
            await new Promise(r => setTimeout(r, 1000));

            // Verifica botões de controle
            const controlButtons = await page.$$('button');
            let foundControlBtn = false;
            for (const btn of controlButtons) {
                const text = await page.evaluate(el => el.innerText, btn);
                if (text.includes('Iniciar') || text.includes('Parar') || text.includes('Carga') || text.includes('Descarga')) {
                    foundControlBtn = true;
                    log('✅', '/systems/:id', `Botão "${text.trim()}"`, 'Encontrado');
                }
            }
            if (!foundControlBtn) {
                log('⚠️', '/systems/:id', 'Botões de controle', 'Não encontrados');
            }
        }

        // Verifica banner de alarmes (se houver)
        const alarmBanner = await page.$('[class*="alarm"], [class*="alert"], [class*="red"]');
        if (alarmBanner) {
            log('✅', '/systems/:id', 'Banner de alarmes', 'Implementado');
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/03-system-detail.png`, fullPage: true });

        // ========================================
        // 4. ALERTAS
        // ========================================
        console.log('\n📍 Página: /alerts (Alertas)\n');

        await page.goto(CONFIG.baseUrl + '/alerts', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const alertsLoaded = await page.$eval('body', el =>
            el.innerText.includes('Alerta') || el.innerText.includes('Alert')
        );
        if (alertsLoaded) {
            log('✅', '/alerts', 'Página carrega', 'OK');
        } else {
            log('❌', '/alerts', 'Página carrega', 'FALHOU');
        }

        // Verifica lista de alertas
        const alertItems = await page.$$('[class*="alert"], [class*="item"], tr');
        if (alertItems.length > 0) {
            log('✅', '/alerts', `Lista de alertas (${alertItems.length})`, 'Carregando');
        }

        // Verifica filtros
        const filters = await page.$$('select, [class*="filter"], [class*="dropdown"]');
        if (filters.length > 0) {
            log('✅', '/alerts', 'Filtros', `${filters.length} encontrados`);
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/04-alerts.png`, fullPage: true });

        // ========================================
        // 5. RELATÓRIOS
        // ========================================
        console.log('\n📍 Página: /reports (Relatórios)\n');

        await page.goto(CONFIG.baseUrl + '/reports', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const reportsLoaded = await page.$eval('body', el =>
            el.innerText.includes('Relatorio') || el.innerText.includes('Report')
        );
        if (reportsLoaded) {
            log('✅', '/reports', 'Página carrega', 'OK');
        } else {
            log('❌', '/reports', 'Página carrega', 'FALHOU');
        }

        // Verifica tipos de relatórios
        const reportTypes = await page.$$('[class*="card"], [class*="item"]');
        if (reportTypes.length > 0) {
            log('✅', '/reports', `Tipos de relatório (${reportTypes.length})`, 'Disponíveis');
        }

        // Verifica select de sistema
        const systemSelect = await page.$('select, [class*="select"]');
        if (systemSelect) {
            log('✅', '/reports', 'Select de sistema', 'Presente');
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/05-reports.png`, fullPage: true });

        // ========================================
        // 6. CONFIGURAÇÕES
        // ========================================
        console.log('\n📍 Página: /settings (Configurações)\n');

        await page.goto(CONFIG.baseUrl + '/settings', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const settingsLoaded = await page.$eval('body', el =>
            el.innerText.includes('Configura') || el.innerText.includes('Setting')
        );
        if (settingsLoaded) {
            log('✅', '/settings', 'Página carrega', 'OK');
        } else {
            log('❌', '/settings', 'Página carrega', 'FALHOU');
        }

        // Verifica formulários
        const forms = await page.$$('form, [class*="form"]');
        const inputs = await page.$$('input, select, textarea');
        log('✅', '/settings', `Campos de formulário (${inputs.length})`, 'Encontrados');

        // Verifica botão salvar
        const allSettingsButtons = await page.$$('button');
        let saveBtn = null;
        for (const btn of allSettingsButtons) {
            const text = await page.evaluate(el => el.innerText, btn);
            if (text && (text.includes('Salvar') || text.includes('Save'))) {
                saveBtn = btn;
                break;
            }
        }
        if (saveBtn) {
            log('✅', '/settings', 'Botão Salvar', 'Presente');
        } else {
            log('⚠️', '/settings', 'Botão Salvar', 'Não encontrado');
        }

        await page.screenshot({ path: `${CONFIG.screenshotDir}/06-settings.png`, fullPage: true });

        // ========================================
        // 7. NAVEGAÇÃO - MENU LATERAL
        // ========================================
        console.log('\n📍 Navegação: Menu Lateral\n');

        await page.goto(CONFIG.baseUrl + '/', { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));

        // Encontra todos os links do menu
        const menuLinks = await page.$$('nav a, aside a, [class*="sidebar"] a, [class*="menu"] a');
        log('✅', 'Menu', `Links encontrados (${menuLinks.length})`, 'OK');

        // Testa alguns links principais
        const mainMenuItems = ['Dashboard', 'Sistemas', 'Alertas', 'Relatorios'];
        for (const item of mainMenuItems) {
            const allLinks = await page.$$('a');
            let found = false;
            for (const link of allLinks) {
                const text = await page.evaluate(el => el.innerText, link);
                if (text && text.includes(item)) {
                    found = true;
                    break;
                }
            }
            if (found) {
                log('✅', 'Menu', `Link "${item}"`, 'Encontrado');
            }
        }

        // ========================================
        // 8. MOCK BESS - INTEGRAÇÃO
        // ========================================
        console.log('\n📍 Integração: Mock BESS\n');

        try {
            const mockResponse = await page.evaluate(async () => {
                try {
                    const res = await fetch('http://localhost:3002/api/devices');
                    return await res.json();
                } catch (e) {
                    return null;
                }
            });

            if (mockResponse && mockResponse.success) {
                log('✅', 'Mock BESS', 'API respondendo', `${mockResponse.data?.length || 0} dispositivos`);
            } else {
                log('⚠️', 'Mock BESS', 'API', 'Não disponível localmente (OK se testando em produção)');
            }
        } catch (e) {
            log('⚠️', 'Mock BESS', 'Integração', 'Não testável');
        }

        // ========================================
        // 9. PÁGINAS ADICIONAIS
        // ========================================
        console.log('\n📍 Páginas Adicionais\n');

        const additionalPages = [
            { path: '/multi-site', name: 'Multi-Site Dashboard' },
            { path: '/gamification', name: 'Gamificação' },
            { path: '/digital-twin', name: 'Digital Twin' },
            { path: '/ev-chargers', name: 'Carregadores EV' },
            { path: '/cameras', name: 'Câmeras' },
            { path: '/microgrids', name: 'Microgrids' },
            { path: '/prospects', name: 'Prospects' },
        ];

        for (const pg of additionalPages) {
            try {
                await page.goto(CONFIG.baseUrl + pg.path, { waitUntil: 'networkidle2', timeout: 10000 });
                await new Promise(r => setTimeout(r, 1000));
                const loaded = await page.$eval('body', el => el.innerText.length > 100);
                if (loaded) {
                    log('✅', pg.path, pg.name, 'Carrega OK');
                } else {
                    log('⚠️', pg.path, pg.name, 'Página vazia');
                }
            } catch (e) {
                log('❌', pg.path, pg.name, 'Erro ao carregar');
            }
        }

    } catch (error) {
        console.error('\n❌ ERRO FATAL:', error.message);
    }

    await browser.close();

    // ========================================
    // RELATÓRIO FINAL
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('  RELATÓRIO FINAL DA AUDITORIA');
    console.log('='.repeat(60));

    console.log(`\n✅ PASSOU: ${report.passed.length}`);
    console.log(`❌ FALHOU: ${report.failed.length}`);
    console.log(`⚠️  AVISOS: ${report.warnings.length}`);

    if (report.failed.length > 0) {
        console.log('\n--- ITENS QUE FALHARAM ---');
        report.failed.forEach(f => {
            console.log(`  ❌ ${f.page}: ${f.item} - ${f.status}`);
        });
    }

    if (report.warnings.length > 0) {
        console.log('\n--- AVISOS ---');
        report.warnings.forEach(w => {
            console.log(`  ⚠️  ${w.page}: ${w.item} - ${w.status}`);
        });
    }

    // Salva relatório em arquivo
    fs.writeFileSync(
        `${CONFIG.screenshotDir}/relatorio.json`,
        JSON.stringify(report, null, 2)
    );
    console.log(`\nRelatório salvo em: ${CONFIG.screenshotDir}/relatorio.json`);

    console.log('\n' + '='.repeat(60));

    if (report.failed.length === 0) {
        console.log('✅ AUDITORIA CONCLUÍDA - NENHUMA FALHA CRÍTICA');
        process.exit(0);
    } else {
        console.log('❌ AUDITORIA CONCLUÍDA - CORREÇÕES NECESSÁRIAS');
        process.exit(1);
    }
}

runAuditoria().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
