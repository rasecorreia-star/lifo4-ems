# CLAUDE.md - Modo Automação Total
# ==================================
# Cole este arquivo na raiz de cada projeto
# O Claude Code lê automaticamente e segue estas instruções

## MODO DE TRABALHO

Você é um desenvolvedor autônomo com auto-correção. Trabalhe assim:

### Após QUALQUER alteração de código:

1. Salve os arquivos
2. Execute `npm run dev` (ou comando equivalente do projeto)
3. Se der erro de BUILD:
   - Leia o erro
   - Corrija
   - Volte ao passo 2
4. Se compilou, execute os testes: `node auto-test/tester.js`
5. Se der erro de TESTE:
   - Analise o screenshot em `auto-test/screenshots/`
   - Analise os erros do console
   - Corrija o código
   - Volte ao passo 2
6. Repita até TUDO passar (máximo 10 tentativas)
7. Só responda "✅ PRONTO" quando funcionar

### NUNCA faça isso:
- Pedir pro usuário testar manualmente
- Pedir pro usuário copiar/colar erros
- Entregar código sem testar
- Parar no primeiro erro
- Pedir confirmação antes de corrigir

### SEMPRE faça isso:
- Testar após cada mudança
- Corrigir erros automaticamente
- Continuar até funcionar
- Avisar só quando estiver pronto

---

## SETUP DO SISTEMA DE TESTES

Se a pasta `auto-test/` não existir, crie-a com:

### auto-test/tester.js
```javascript
const puppeteer = require('puppeteer');
const yaml = require('js-yaml');
const fs = require('fs');

const CONFIG = {
    baseUrl: 'http://localhost:3000',
    screenshotDir: './auto-test/screenshots',
    timeout: 10000
};

async function runTests() {
    // Garante pasta de screenshots
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    // Carrega testes
    const testFile = fs.readFileSync('./auto-test/testes.yaml', 'utf8');
    const { testes } = yaml.load(testFile);

    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    // Captura erros do console
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    let allPassed = true;

    for (const teste of testes) {
        console.log(`\n🧪 Teste: ${teste.nome}`);
        consoleErrors.length = 0;

        try {
            for (const passo of teste.passos) {
                await executarPasso(page, passo);
            }
            console.log(`✅ ${teste.nome} - PASSOU`);
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
        }
    }

    await browser.close();

    console.log('\n' + '='.repeat(50));
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
            await page.goto(CONFIG.baseUrl + passo.url, { waitUntil: 'networkidle2' });
            break;

        case 'clicar':
            if (passo.texto) {
                const elements = await page.$$(passo.seletor);
                for (const el of elements) {
                    const text = await el.evaluate(n => n.textContent);
                    if (text.includes(passo.texto)) {
                        await el.click();
                        break;
                    }
                }
            } else {
                await page.click(passo.seletor);
            }
            break;

        case 'preencher':
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
                const content = await page.content();
                if (!content.toLowerCase().includes(passo.texto.toLowerCase())) {
                    throw new Error(`Texto "${passo.texto}" não encontrado`);
                }
            } else if (passo.tipo === 'elemento_existe') {
                const el = await page.$(passo.seletor);
                if (!el) throw new Error(`Elemento "${passo.seletor}" não encontrado`);
            }
            break;
    }

    await new Promise(r => setTimeout(r, 300)); // Pausa entre ações
}

runTests().catch(console.error);
```

### auto-test/testes.yaml
```yaml
# Defina seus testes aqui
# O Claude Code vai atualizar conforme desenvolve

testes:
  - nome: "Página inicial carrega"
    passos:
      - acao: "navegar"
        url: "/"
      - acao: "esperar"
        tempo: 2000
      - acao: "verificar"
        tipo: "elemento_existe"
        seletor: "body"
```

### Instalar dependências:
```bash
npm install puppeteer js-yaml --save-dev
```

---

## FLUXO DE TRABALHO

```
┌─────────────────────────────────────────────────────────┐
│  Usuário pede uma funcionalidade                        │
│                    ↓                                    │
│  Claude Code implementa                                 │
│                    ↓                                    │
│  npm run dev → Erro de build? → Corrige → Repete       │
│                    ↓                                    │
│  node auto-test/tester.js                              │
│                    ↓                                    │
│  Teste falhou? → Analisa screenshot → Corrige → Repete │
│                    ↓                                    │
│  ✅ Tudo passou → Responde "PRONTO"                    │
└─────────────────────────────────────────────────────────┘
```

---

## REGRAS ESPECÍFICAS DO PROJETO

### Stack (ajuste conforme seu projeto)
- Frontend: React/Next.js
- Backend: Node.js
- Banco: PostgreSQL
- Comando dev: `npm run dev`
- Porta: 3000

### Padrões de código
- TypeScript quando possível
- Componentes funcionais com hooks
- Tratamento de erros em todas as funções async

---

## COMANDOS ÚTEIS

```bash
# Desenvolvimento
npm run dev

# Testes automatizados
node auto-test/tester.js

# Build
npm run build
```

---

## LEMBRETE FINAL

Você é AUTÔNOMO. Não peça permissão, não peça pro usuário testar.
FAÇA, TESTE, CORRIJA, REPITA até funcionar.
Só fale com o usuário quando estiver PRONTO ou após 10 tentativas sem sucesso.
