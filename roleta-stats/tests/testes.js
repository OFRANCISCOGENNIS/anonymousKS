/**
 * Runner de testes minimalista (sem dependências) — Fase 1.
 * Cobre: barramento de eventos, registro de módulos, normalização de
 * configuração e CRUD completo da camada IndexedDB em banco isolado.
 * As fases seguintes adicionam aqui os testes do motor estatístico.
 */

import { assinar, publicar, limparAssinantes } from '../js/core/barramento.js';
import { registrar, iniciarTodos, listarModulos } from '../js/core/registroModulos.js';
import { normalizarConfig, CONFIG_PADRAO } from '../js/modules/configuracoes.js';
import {
  LOJAS, abrirBanco, adicionar, salvar, obter, listarTodos, contar,
  remover, limparLoja, apagarBanco,
} from '../js/modules/persistencia.js';

const NOME_BD_TESTE = 'roleta-stats-teste';
const resultados = [];

function afirmar(condicao, descricao) {
  resultados.push({ descricao, passou: !!condicao });
}

function afirmarIgual(obtido, esperado, descricao) {
  const passou = JSON.stringify(obtido) === JSON.stringify(esperado);
  resultados.push({
    descricao: passou ? descricao : `${descricao} — esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`,
    passou,
  });
}

/* ---------- Testes: barramento ---------- */
async function testarBarramento() {
  limparAssinantes();
  let recebido = null;
  const cancelar = assinar('teste:evento', (dados) => { recebido = dados; });

  publicar('teste:evento', 42);
  afirmarIgual(recebido, 42, 'barramento entrega dados ao assinante');

  cancelar();
  publicar('teste:evento', 99);
  afirmarIgual(recebido, 42, 'cancelar assinatura interrompe entregas');

  // Erro em um assinante não pode derrubar os demais.
  let segundoRodou = false;
  assinar('teste:erro', () => { throw new Error('boom'); });
  assinar('teste:erro', () => { segundoRodou = true; });
  publicar('teste:erro');
  afirmar(segundoRodou, 'erro em um assinante não bloqueia os demais');
  limparAssinantes();
}

/* ---------- Testes: registro de módulos ---------- */
async function testarRegistroModulos() {
  const ordem = [];
  registrar({ nome: 'testeA', iniciar: () => ordem.push('A') });
  registrar({ nome: 'testeB', iniciar: async () => ordem.push('B') });
  registrar({ nome: 'testeQuebra', iniciar: () => { throw new Error('falha proposital'); } });

  const { ok, falhas } = await iniciarTodos({});
  afirmarIgual(ordem, ['A', 'B'], 'módulos iniciam na ordem de registro');
  afirmar(ok.includes('testeA') && ok.includes('testeB'), 'módulos saudáveis reportados em ok');
  afirmarIgual(falhas.map((f) => f.nome), ['testeQuebra'], 'falha isolada não derruba os demais');
  afirmar(listarModulos().includes('testeQuebra'), 'listarModulos enxerga todos os registrados');

  let erroTipo = false;
  try { registrar({ nome: 'semIniciar' }); } catch { erroTipo = true; }
  afirmar(erroTipo, 'registrar rejeita módulo sem iniciar()');
}

/* ---------- Testes: normalização de configuração ---------- */
async function testarConfiguracoes() {
  afirmarIgual(normalizarConfig(null), CONFIG_PADRAO, 'config nula vira padrão');
  afirmarIgual(
    normalizarConfig({ tipoRoleta: 'americana' }).tipoRoleta,
    'americana',
    'tipo válido é preservado',
  );
  afirmarIgual(
    normalizarConfig({ tipoRoleta: 'marciana', lixo: 1 }),
    CONFIG_PADRAO,
    'valores inválidos/desconhecidos são descartados',
  );
}

/* ---------- Testes: persistência (IndexedDB em banco isolado) ---------- */
async function testarPersistencia() {
  await apagarBanco(NOME_BD_TESTE); // garante estado limpo
  const bd = await abrirBanco(NOME_BD_TESTE);

  const chave = await adicionar(LOJAS.GIROS, { numero: 17, dataHora: '2026-07-19T10:00:00' }, bd);
  afirmar(typeof chave === 'number' && chave > 0, 'adicionar retorna chave autoincrementada');

  const registro = await obter(LOJAS.GIROS, chave, bd);
  afirmarIgual(registro?.numero, 17, 'obter recupera o registro gravado');

  await salvar(LOJAS.GIROS, { ...registro, numero: 0 }, bd);
  const atualizado = await obter(LOJAS.GIROS, chave, bd);
  afirmarIgual(atualizado?.numero, 0, 'salvar atualiza registro existente');

  await adicionar(LOJAS.GIROS, { numero: 32, dataHora: '2026-07-19T10:01:00' }, bd);
  afirmarIgual(await contar(LOJAS.GIROS, bd), 2, 'contar reflete inserções');
  afirmarIgual((await listarTodos(LOJAS.GIROS, bd)).length, 2, 'listarTodos retorna todos');

  await remover(LOJAS.GIROS, chave, bd);
  afirmarIgual(await contar(LOJAS.GIROS, bd), 1, 'remover apaga apenas o registro alvo');

  await limparLoja(LOJAS.GIROS, bd);
  afirmarIgual(await contar(LOJAS.GIROS, bd), 0, 'limparLoja esvazia a loja');

  bd.close();
  await apagarBanco(NOME_BD_TESTE);
}

/* ---------- Execução e relatório ---------- */
async function executar() {
  const suites = [testarBarramento, testarRegistroModulos, testarConfiguracoes, testarPersistencia];
  for (const suite of suites) {
    try {
      await suite();
    } catch (erro) {
      resultados.push({ descricao: `EXCEÇÃO em ${suite.name}: ${erro.message}`, passou: false });
    }
  }

  const lista = document.getElementById('resultados');
  for (const { descricao, passou } of resultados) {
    const item = document.createElement('li');
    item.className = passou ? 'passou' : 'falhou';
    item.textContent = `${passou ? '✔' : '✘'} ${descricao}`;
    lista.appendChild(item);
  }

  const total = resultados.length;
  const ok = resultados.filter((r) => r.passou).length;
  const resumo = document.getElementById('resumo');
  resumo.textContent = `${ok}/${total} testes passaram${ok === total ? ' ✅' : ' — há falhas ❌'}`;
}

executar();
