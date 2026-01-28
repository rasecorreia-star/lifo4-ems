import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  slowMo: 500 // Lento para visualizar
});

const context = await browser.newContext({
  viewport: { width: 1400, height: 900 }
});

const page = await context.newPage();

console.log('Abrindo navegador...');

// Ir para login
await page.goto('http://localhost:5173/login');
await page.waitForLoadState('networkidle');

console.log('Pagina de login carregada!');

// Preencher credenciais
await page.fill('input[type="email"], input[name="email"], #email', 'admin@lifo4.com.br');
await page.fill('input[type="password"], input[name="password"], #password', 'admin123');

console.log('Credenciais preenchidas!');

// Clicar em Entrar
await page.click('button[type="submit"]');

console.log('Login enviado!');

// Aguardar redirecionamento
await page.waitForTimeout(3000);

console.log('Login realizado! Navegador aberto.');
console.log('URL atual:', page.url());

// Manter navegador aberto por 5 minutos
console.log('\nNavegador ficara aberto por 5 minutos para voce testar.');
console.log('Pressione Ctrl+C para fechar antes.\n');

await page.waitForTimeout(300000); // 5 minutos

await browser.close();
