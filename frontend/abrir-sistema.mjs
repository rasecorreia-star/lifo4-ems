import { chromium } from 'playwright';

console.log('=== LIFO4 EMS - Abrindo Sistema ===\n');

const browser = await chromium.launch({
  headless: false,
  slowMo: 50
});

const context = await browser.newContext({
  viewport: { width: 1500, height: 900 }
});

const page = await context.newPage();

// Ir direto para o Dashboard
console.log('Abrindo Dashboard...');
await page.goto('http://localhost:5173/dashboard');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

const url = page.url();
console.log('URL:', url);

if (!url.includes('/login')) {
  console.log('\n✅ DASHBOARD ACESSADO COM SUCESSO!\n');
  console.log('O navegador esta aberto. Explore o sistema!');
  console.log('Paginas disponiveis:');
  console.log('  - /dashboard');
  console.log('  - /systems');
  console.log('  - /digital-twin');
  console.log('  - /vpp');
  console.log('  - /trading-dashboard');
  console.log('  - /assistant');
  console.log('  - /analytics');
  console.log('\nNavegador ficara aberto por 1 hora.');
  console.log('Pressione Ctrl+C para fechar.\n');
} else {
  console.log('\n❌ Ainda redirecionando para login...');
  console.log('Aguarde o hot reload do servidor.\n');
}

// Manter aberto por 1 hora
await page.waitForTimeout(3600000);

await browser.close();
