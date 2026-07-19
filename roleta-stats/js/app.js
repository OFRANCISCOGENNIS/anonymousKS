/**
 * Ponto de entrada da aplicação — Fase 1 (fundação).
 * Registra os módulos e dispara a inicialização em ordem:
 * persistência/configurações antes da UI.
 */

import { registrar, iniciarTodos } from './core/registroModulos.js';
import * as barramento from './core/barramento.js';
import { moduloConfiguracoes } from './modules/configuracoes.js';
import { moduloUi, mostrarToast } from './modules/ui.js';

registrar(moduloConfiguracoes);
registrar(moduloUi);

async function iniciarApp() {
  const { falhas } = await iniciarTodos({ barramento });
  if (falhas.length > 0) {
    // A UI pode não ter subido; console é o canal garantido.
    console.error('[app] módulos com falha:', falhas.map((f) => f.nome).join(', '));
    mostrarToast('Parte da aplicação falhou ao iniciar. Veja o console.', 'erro');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarApp);
} else {
  iniciarApp();
}
