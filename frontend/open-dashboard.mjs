import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  slowMo: 100
});

const context = await browser.newContext({
  viewport: { width: 1400, height: 900 }
});

const page = await context.newPage();

console.log('=== LIFO4 EMS - Abrindo Dashboard ===\n');

// Primeiro, ir para a pagina base para poder injetar o localStorage
await page.goto('http://localhost:5173');
await page.waitForTimeout(500);

// Injetar usuario no localStorage para simular login
await page.evaluate(() => {
  const mockUser = {
    id: 'user-1',
    email: 'admin@lifo4.com.br',
    name: 'Administrador',
    role: 'super_admin',
    organizationId: 'org-1'
  };

  const mockAuth = {
    user: mockUser,
    token: 'mock-token-' + Date.now(),
    refreshToken: 'mock-refresh-token',
    isAuthenticated: true
  };

  localStorage.setItem('auth', JSON.stringify(mockAuth));
  localStorage.setItem('user', JSON.stringify(mockUser));
  localStorage.setItem('token', 'mock-token-' + Date.now());

  console.log('Auth injetado no localStorage');
});

console.log('Auth configurado!');

// Agora navegar para o dashboard
await page.goto('http://localhost:5173/dashboard');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// Verificar se estamos no dashboard
const url = page.url();
console.log('URL atual:', url);

if (url.includes('/login')) {
  console.log('Ainda no login, tentando navegar diretamente...');

  // Tentar recarregar com o auth
  await page.reload();
  await page.waitForTimeout(2000);
}

// Verificar novamente
const finalUrl = page.url();
console.log('URL final:', finalUrl);

if (finalUrl.includes('/dashboard') || !finalUrl.includes('/login')) {
  console.log('\n✅ DASHBOARD ACESSADO COM SUCESSO!\n');
} else {
  console.log('\n⚠️ Ainda na pagina de login');
  console.log('O sistema requer backend para autenticacao real.');
  console.log('Mas voce pode ver a interface de login!\n');
}

console.log('Navegador aberto! Ficara disponivel por 30 minutos.');
console.log('Pressione Ctrl+C no terminal para fechar.\n');

// Manter aberto por 30 minutos
await page.waitForTimeout(1800000);

await browser.close();
