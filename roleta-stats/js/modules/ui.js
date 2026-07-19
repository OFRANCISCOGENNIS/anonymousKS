/**
 * Módulo de interface: roteador hash, alternância de visões,
 * toasts e ligação do painel/configurações ao restante do app.
 * Nenhuma regra de negócio vive aqui — só DOM e navegação.
 */

import { assinar, publicar } from '../core/barramento.js';
import {
  LOJAS, contar, suportaIndexedDB, apagarBanco, limparConfigs,
} from './persistencia.js';
import { obterConfig, atualizarConfig } from './configuracoes.js';

const ROTA_PADRAO = 'painel';

/** Extrai a rota atual do hash (#/painel -> "painel"). */
function rotaAtual() {
  const rota = window.location.hash.replace(/^#\/?/, '');
  return rota || ROTA_PADRAO;
}

/** Mostra a visão da rota e marca o item de navegação ativo. */
function aplicarRota() {
  const rota = rotaAtual();
  const visoes = document.querySelectorAll('.visao');
  let encontrada = false;

  visoes.forEach((visao) => {
    const ativa = visao.dataset.visao === rota;
    visao.hidden = !ativa;
    if (ativa) encontrada = true;
  });

  // Rota desconhecida: volta para o painel sem loop de hashchange.
  if (!encontrada) {
    window.location.replace('#/' + ROTA_PADRAO);
    return;
  }

  document.querySelectorAll('.navegacao__item').forEach((item) => {
    if (item.dataset.rota === rota) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  publicar('rota:alterada', rota);
}

/**
 * Exibe um toast temporário.
 * @param {string} mensagem
 * @param {'info'|'ok'|'erro'} [tipo]
 */
export function mostrarToast(mensagem, tipo = 'info') {
  const area = document.getElementById('area-toast');
  if (!area) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (tipo !== 'info' ? ` toast--${tipo}` : '');
  toast.textContent = mensagem;
  area.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/** Atualiza os cartões do painel e o status do cabeçalho. */
async function atualizarPainel() {
  const cfg = obterConfig();
  const elTipo = document.getElementById('painel-tipo-roleta');
  if (elTipo) elTipo.textContent = cfg.tipoRoleta === 'americana' ? 'Americana' : 'Europeia';

  const elArmazenamento = document.getElementById('painel-armazenamento');
  const elStatus = document.getElementById('status-persistencia');
  const elTotal = document.getElementById('painel-total-giros');

  if (!suportaIndexedDB()) {
    if (elArmazenamento) elArmazenamento.textContent = 'Indisponível';
    if (elStatus) {
      elStatus.textContent = '● armazenamento indisponível';
      elStatus.className = 'cabecalho__status cabecalho__status--erro';
    }
    return;
  }

  try {
    const total = await contar(LOJAS.GIROS);
    if (elTotal) elTotal.textContent = total.toLocaleString('pt-BR');
    if (elArmazenamento) elArmazenamento.textContent = 'IndexedDB ativo';
    if (elStatus) {
      elStatus.textContent = '● dados locais ok';
      elStatus.className = 'cabecalho__status cabecalho__status--ok';
    }
  } catch (erro) {
    console.error('[ui] falha ao consultar persistência:', erro);
    if (elArmazenamento) elArmazenamento.textContent = 'Erro';
    if (elStatus) {
      elStatus.textContent = '● erro no armazenamento';
      elStatus.className = 'cabecalho__status cabecalho__status--erro';
    }
  }
}

/** Preenche o formulário de configurações com o estado atual. */
function preencherFormularioConfig() {
  const cfg = obterConfig();
  const form = document.getElementById('form-config');
  if (!form) return;
  const radio = form.querySelector(`input[name="tipoRoleta"][value="${cfg.tipoRoleta}"]`);
  if (radio) radio.checked = true;
}

function ligarFormularioConfig() {
  const form = document.getElementById('form-config');
  if (!form) return;

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const dados = new FormData(form);
    atualizarConfig({ tipoRoleta: dados.get('tipoRoleta') });
    mostrarToast('Configurações salvas.', 'ok');
  });

  const btnLimpar = document.getElementById('btn-limpar-dados');
  btnLimpar?.addEventListener('click', async () => {
    // Ação destrutiva: exige confirmação explícita do usuário.
    const confirmou = window.confirm(
      'Apagar TODOS os dados locais (giros, estratégias e configurações)? Esta ação não pode ser desfeita.',
    );
    if (!confirmou) return;
    try {
      await apagarBanco();
      limparConfigs();
      mostrarToast('Dados locais apagados.', 'ok');
      publicar('dados:apagados');
      atualizarPainel();
      preencherFormularioConfig();
    } catch (erro) {
      console.error('[ui] falha ao apagar dados:', erro);
      mostrarToast('Não foi possível apagar os dados.', 'erro');
    }
  });
}

export const moduloUi = {
  nome: 'ui',
  iniciar() {
    window.addEventListener('hashchange', aplicarRota);
    aplicarRota();

    ligarFormularioConfig();
    preencherFormularioConfig();
    atualizarPainel();

    // Reage a mudanças vindas de outros módulos.
    assinar('config:alterada', () => {
      atualizarPainel();
      preencherFormularioConfig();
    });
    assinar('giros:alterados', atualizarPainel);
  },
};
