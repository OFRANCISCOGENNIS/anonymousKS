/**
 * Barramento de eventos (pub/sub) — comunicação desacoplada entre módulos.
 * Função pura de infraestrutura: nenhum módulo importa outro diretamente
 * para reagir a acontecimentos; todos publicam/assinam aqui.
 */

const assinantes = new Map(); // evento -> Set<callback>

/**
 * Assina um evento. Retorna função para cancelar a assinatura.
 * @param {string} evento
 * @param {(dados:any)=>void} callback
 * @returns {() => void}
 */
export function assinar(evento, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError('assinar: callback deve ser uma função');
  }
  if (!assinantes.has(evento)) assinantes.set(evento, new Set());
  assinantes.get(evento).add(callback);
  return () => assinantes.get(evento)?.delete(callback);
}

/**
 * Publica um evento para todos os assinantes.
 * Erros em um assinante não interrompem os demais.
 * @param {string} evento
 * @param {any} [dados]
 */
export function publicar(evento, dados) {
  const conjunto = assinantes.get(evento);
  if (!conjunto) return;
  for (const cb of conjunto) {
    try {
      cb(dados);
    } catch (erro) {
      console.error(`[barramento] erro em assinante de "${evento}":`, erro);
    }
  }
}

/** Remove todos os assinantes (usado em testes). */
export function limparAssinantes() {
  assinantes.clear();
}
