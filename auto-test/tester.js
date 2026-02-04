const puppeteer = require('puppeteer');
const yaml = require('js-yaml');
const fs = require('fs');

const CONFIG = {
    baseUrl: process.env.TEST_URL || 'http://76.13.164.252:8081',
    screenshotDir: './auto-test/screenshots',
    timeout: 15000
};

async function runTests() {
    console.log('\n========================================');
    console.log('  EMS BESS - Auto Test Runner');
    console.log(`  URL: ${CONFIG.baseUrl}`);
    console.log('========================================\n');

    // Garante pasta de screenshots
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    // Carrega testes
    const testFile = fs.readFileSync('./auto-test/testes.yaml', 'utf8');
    const { testes } = yaml.load(testFile);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Captura erros do console
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    let allPassed = true;
    let passed = 0;
    let failed = 0;

    for (const teste of testes) {
        console.log(`\n🧪 Teste: ${teste.nome}`);
        consoleErrors.length = 0;

        try {
            for (const passo of teste.passos) {
                await executarPasso(page, passo);
            }
            console.log(`✅ ${teste.nome} - PASSOU`);
            passed++;
        } catch (error) {
            console.log(`❌ ${teste.nome} - FALHOU`);
            console.log(`   Erro: ${error.message}`);

            // Screenshot do erro
            const screenshotPath = `${CONFIG.screenshotDir}/erro-${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`   Screenshot: ${screenshotPath}`);

            // Erros do console
            if (consoleErrors.length > 0) {
                console.log(`   Console errors:`);
                consoleErrors.forEach(e => console.log(`     - ${e}`));
            }

            allPassed = false;
            failed++;
        }
    }

    await browser.close();

    console.log('\n' + '='.repeat(50));
    console.log(`Resultados: ${passed} passou, ${failed} falhou`);
    if (allPassed) {
        console.log('✅ TODOS OS TESTES PASSARAM!');
        process.exit(0);
    } else {
        console.log('❌ ALGUNS TESTES FALHARAM');
        process.exit(1);
    }
}

async function executarPasso(page, passo) {
    const { acao } = passo;

    switch (acao) {
        case 'navegar':
            await page.goto(CONFIG.baseUrl + passo.url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
            break;

        case 'clicar':
            if (passo.texto) {
                // Procura elemento pelo texto
                const elements = await page.$$(passo.seletor || '*');
                let clicked = false;
                for (const el of elements) {
                    const text = await el.evaluate(n => n.textContent);
                    if (text && text.includes(passo.texto)) {
                        await el.click();
                        clicked = true;
                        break;
                    }
                }
                if (!clicked) throw new Error(`Elemento com texto "${passo.texto}" não encontrado`);
            } else {
                await page.waitForSelector(passo.seletor, { timeout: CONFIG.timeout });
                await page.click(passo.seletor);
            }
            break;

        case 'preencher':
            await page.waitForSelector(passo.seletor, { timeout: CONFIG.timeout });
            await page.type(passo.seletor, passo.valor, { delay: 30 });
            break;

        case 'esperar':
            if (passo.seletor) {
                await page.waitForSelector(passo.seletor, { timeout: CONFIG.timeout });
            } else if (passo.tempo) {
                await new Promise(r => setTimeout(r, passo.tempo));
            }
            break;

        case 'verificar':
            if (passo.tipo === 'texto_visivel') {
                await page.waitForFunction(
                    (texto) => document.body.innerText.toLowerCase().includes(texto.toLowerCase()),
                    { timeout: CONFIG.timeout },
                    passo.texto
                );
            } else if (passo.tipo === 'elemento_existe') {
                const el = await page.$(passo.seletor);
                if (!el) throw new Error(`Elemento "${passo.seletor}" não encontrado`);
            } else if (passo.tipo === 'url_contem') {
                const url = page.url();
                if (!url.includes(passo.valor)) {
                    throw new Error(`URL "${url}" não contém "${passo.valor}"`);
                }
            }
            break;

        case 'screenshot':
            const filename = passo.nome || `screenshot-${Date.now()}`;
            await page.screenshot({
                path: `${CONFIG.screenshotDir}/${filename}.png`,
                fullPage: passo.fullPage !== false
            });
            console.log(`   📸 Screenshot: ${filename}.png`);
            break;
    }

    await new Promise(r => setTimeout(r, 300)); // Pausa entre ações
}

runTests().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});
