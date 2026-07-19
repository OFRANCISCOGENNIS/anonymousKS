/**
 * Camada de persistência.
 *
 * - IndexedDB para volumes altos (giros, estratégias): API assíncrona
 *   baseada em Promises, preparada para 100k+ registros (índice por data,
 *   leitura via cursor será adicionada quando houver virtualização).
 * - LocalStorage apenas para configurações pequenas (síncrono e barato).
 *
 * Todos os dados ficam exclusivamente no navegador do usuário.
 */

export const NOME_BD = 'roleta-stats';
export const VERSAO_BD = 1;

/** Nomes dos object stores. */
export const LOJAS = Object.freeze({
  GIROS: 'giros',
  ESTRATEGIAS: 'estrategias',
});

const PREFIXO_LS = 'roleta-stats.';

let bdPromessa = null;

/** Indica se o ambiente suporta IndexedDB. */
export function suportaIndexedDB() {
  return typeof indexedDB !== 'undefined';
}

/**
 * Abre (ou cria/migra) o banco. Reutiliza a mesma conexão em chamadas
 * subsequentes. `nomeBd` é parametrizável para permitir testes isolados.
 * @param {string} [nomeBd]
 * @returns {Promise<IDBDatabase>}
 */
export function abrirBanco(nomeBd = NOME_BD) {
  if (nomeBd === NOME_BD && bdPromessa) return bdPromessa;

  const promessa = new Promise((resolver, rejeitar) => {
    if (!suportaIndexedDB()) {
      rejeitar(new Error('IndexedDB não suportado neste navegador'));
      return;
    }
    const pedido = indexedDB.open(nomeBd, VERSAO_BD);

    pedido.onupgradeneeded = (evento) => {
      const bd = evento.target.result;
      // Store de giros: id autoincremento; índice por data para consultas
      // cronológicas e futura paginação incremental.
      if (!bd.objectStoreNames.contains(LOJAS.GIROS)) {
        const loja = bd.createObjectStore(LOJAS.GIROS, { keyPath: 'id', autoIncrement: true });
        loja.createIndex('porData', 'dataHora', { unique: false });
      }
      if (!bd.objectStoreNames.contains(LOJAS.ESTRATEGIAS)) {
        bd.createObjectStore(LOJAS.ESTRATEGIAS, { keyPath: 'id', autoIncrement: true });
      }
    };

    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('Falha ao abrir IndexedDB'));
    pedido.onblocked = () => rejeitar(new Error('Abertura do banco bloqueada por outra aba'));
  });

  if (nomeBd === NOME_BD) bdPromessa = promessa;
  return promessa;
}

/**
 * Converte um IDBRequest em Promise.
 * @param {IDBRequest} pedido
 */
function promessaDePedido(pedido) {
  return new Promise((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

/**
 * Adiciona um registro. Retorna a chave gerada.
 * @param {string} loja - um dos valores de LOJAS
 * @param {object} registro
 * @param {IDBDatabase} [bd] - conexão alternativa (testes)
 * @returns {Promise<IDBValidKey>}
 */
export async function adicionar(loja, registro, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readwrite');
  return promessaDePedido(tx.objectStore(loja).add(registro));
}

/**
 * Atualiza (ou insere) um registro completo pela sua chave (keyPath).
 * @returns {Promise<IDBValidKey>}
 */
export async function salvar(loja, registro, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readwrite');
  return promessaDePedido(tx.objectStore(loja).put(registro));
}

/**
 * Obtém um registro pela chave.
 * @returns {Promise<object|undefined>}
 */
export async function obter(loja, chave, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readonly');
  return promessaDePedido(tx.objectStore(loja).get(chave));
}

/**
 * Lista todos os registros da loja.
 * Atenção: para 100k+ registros as fases futuras usarão cursores
 * paginados; getAll aqui atende diagnóstico e volumes moderados.
 * @returns {Promise<object[]>}
 */
export async function listarTodos(loja, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readonly');
  return promessaDePedido(tx.objectStore(loja).getAll());
}

/**
 * Conta os registros da loja (operação nativa, O(1) para o chamador).
 * @returns {Promise<number>}
 */
export async function contar(loja, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readonly');
  return promessaDePedido(tx.objectStore(loja).count());
}

/**
 * Remove um registro pela chave.
 * @returns {Promise<void>}
 */
export async function remover(loja, chave, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readwrite');
  await promessaDePedido(tx.objectStore(loja).delete(chave));
}

/**
 * Esvazia uma loja inteira.
 * @returns {Promise<void>}
 */
export async function limparLoja(loja, bd) {
  const banco = bd ?? (await abrirBanco());
  const tx = banco.transaction(loja, 'readwrite');
  await promessaDePedido(tx.objectStore(loja).clear());
}

/**
 * Apaga o banco inteiro (usado em "apagar todos os dados" e nos testes).
 * Fecha a conexão compartilhada antes, senão o delete fica bloqueado.
 * @param {string} [nomeBd]
 * @returns {Promise<void>}
 */
export async function apagarBanco(nomeBd = NOME_BD) {
  if (nomeBd === NOME_BD && bdPromessa) {
    try {
      (await bdPromessa).close();
    } catch { /* conexão já fechada */ }
    bdPromessa = null;
  }
  await new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.deleteDatabase(nomeBd);
    pedido.onsuccess = () => resolver();
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onblocked = () => resolver(); // apagará quando as conexões fecharem
  });
}

/* ---------- Configurações (LocalStorage) ---------- */

/**
 * Lê uma configuração serializada em JSON.
 * @param {string} chave
 * @param {any} [padrao] - valor devolvido se ausente/corrompido
 */
export function lerConfig(chave, padrao = null) {
  try {
    const bruto = localStorage.getItem(PREFIXO_LS + chave);
    return bruto === null ? padrao : JSON.parse(bruto);
  } catch (erro) {
    console.warn(`[persistencia] config "${chave}" ilegível, usando padrão`, erro);
    return padrao;
  }
}

/**
 * Grava uma configuração em JSON. Retorna false se o storage falhar
 * (ex.: modo privado com quota zerada).
 * @returns {boolean}
 */
export function gravarConfig(chave, valor) {
  try {
    localStorage.setItem(PREFIXO_LS + chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    console.error(`[persistencia] falha ao gravar config "${chave}"`, erro);
    return false;
  }
}

/** Remove todas as configurações do app do LocalStorage. */
export function limparConfigs() {
  const remover = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (chave && chave.startsWith(PREFIXO_LS)) remover.push(chave);
  }
  remover.forEach((chave) => localStorage.removeItem(chave));
}
