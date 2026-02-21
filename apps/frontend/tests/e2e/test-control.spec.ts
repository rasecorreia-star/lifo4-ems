import { test, expect } from '@playwright/test';

test('Testar botão Iniciar Descarga', async ({ page }) => {
  // Ir direto para o sistema (modo demo já está logado)
  await page.goto('http://localhost:5174/systems/bess-001');
  await page.waitForLoadState('networkidle');
  console.log('✅ Página do sistema carregada');

  // Esperar a página carregar completamente
  await page.waitForTimeout(3000);

  // Screenshot inicial
  await page.screenshot({ path: 'screenshots/01-pagina-sistema.png', fullPage: true });

  // Definir mock para charging primeiro
  console.log('Definindo Mock para solar-charging...');
  await page.evaluate(async () => {
    await fetch('http://localhost:3002/api/devices/bess-001/scenario', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({scenario: 'solar-charging'})
    });
  });

  // Esperar atualização
  await page.waitForTimeout(2000);

  // Verificar estado do Mock
  const mockBefore = await page.evaluate(async () => {
    const res = await fetch('http://localhost:3002/api/devices/bess-001');
    const data = await res.json();
    return data.data.scenario;
  });
  console.log('Estado Mock ANTES:', mockBefore);

  // Procurar o botão "Iniciar Descarga"
  const btnDescarga = page.locator('button:has-text("Iniciar Descarga")');
  const btnCount = await btnDescarga.count();
  console.log('Botões "Iniciar Descarga" encontrados:', btnCount);

  if (btnCount === 0) {
    console.log('❌ Botão não encontrado! Tirando screenshot...');
    await page.screenshot({ path: 'screenshots/02-botao-nao-encontrado.png', fullPage: true });

    // Listar todos os botões na página
    const allButtons = await page.locator('button').allTextContents();
    console.log('Botões disponíveis:', allButtons);
  } else {
    const isDisabled = await btnDescarga.first().isDisabled();
    console.log('Botão disabled:', isDisabled);

    if (!isDisabled) {
      // Clicar no botão
      await btnDescarga.first().click();
      console.log('✅ Clicou no botão Iniciar Descarga');

      // Esperar processamento
      await page.waitForTimeout(3000);

      // Verificar Mock DEPOIS
      const mockAfter = await page.evaluate(async () => {
        const res = await fetch('http://localhost:3002/api/devices/bess-001');
        const data = await res.json();
        return data.data.scenario;
      });
      console.log('Estado Mock DEPOIS:', mockAfter);

      await page.screenshot({ path: 'screenshots/03-apos-clique.png', fullPage: true });

      if (mockAfter === 'discharging') {
        console.log('✅ SUCESSO! Mock mudou para discharging!');
      } else {
        console.log('❌ FALHOU! Mock ainda está em:', mockAfter);
      }
    } else {
      console.log('⚠️ Botão está desabilitado');
      await page.screenshot({ path: 'screenshots/02-botao-disabled.png', fullPage: true });
    }
  }
});
