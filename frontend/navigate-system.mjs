import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  slowMo: 300
});

const context = await browser.newContext({
  viewport: { width: 1400, height: 900 }
});

const page = await context.newPage();

console.log('=== LIFO4 EMS - Navegacao Completa ===\n');

// Funcao para navegar com seguranca
async function navigateTo(path, name) {
  console.log(`Navegando para: ${name}...`);
  await page.goto(`http://localhost:5173${path}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  console.log(`  ✅ ${name} carregado!\n`);
}

// Navegar pelo sistema
await navigateTo('/dashboard', 'Dashboard');
await navigateTo('/systems', 'Sistemas');
await navigateTo('/digital-twin', 'Digital Twin');
await navigateTo('/vpp', 'Virtual Power Plant');
await navigateTo('/trading-dashboard', 'Trading Dashboard');
await navigateTo('/assistant', 'Assistente IA');
await navigateTo('/analytics', 'Analytics');
await navigateTo('/reports', 'Relatorios');

console.log('\n=== Navegacao concluida! ===');
console.log('Navegador ficara aberto por 10 minutos para voce explorar.');
console.log('Pressione Ctrl+C para fechar.\n');

// Voltar ao dashboard
await navigateTo('/dashboard', 'Dashboard (Final)');

// Manter aberto
await page.waitForTimeout(600000); // 10 minutos

await browser.close();
