/**
 * Registro de módulos — ciclo de vida padronizado.
 * Cada módulo expõe { nome, iniciar() } e é inicializado em ordem
 * de registro. Falha em um módulo é registrada mas não derruba o app.
 */

const modulos = [];

/**
 * Registra um módulo para inicialização.
 * @param {{nome: string, iniciar: (contexto:object)=>void|Promise<void>}} modulo
 */
export function registrar(modulo) {
  if (!modulo || typeof modulo.nome !== 'string' || typeof modulo.iniciar !== 'function') {
    throw new TypeError('registrar: módulo precisa de { nome, iniciar() }');
  }
  modulos.push(modulo);
}

/**
 * Inicializa todos os módulos registrados, na ordem.
 * @param {object} contexto - dependências compartilhadas (barramento, config...)
 * @returns {Promise<{ok:string[], falhas:{nome:string, erro:Error}[]}>}
 */
export async function iniciarTodos(contexto) {
  const ok = [];
  const falhas = [];
  for (const modulo of modulos) {
    try {
      await modulo.iniciar(contexto);
      ok.push(modulo.nome);
    } catch (erro) {
      console.error(`[registroModulos] falha ao iniciar "${modulo.nome}":`, erro);
      falhas.push({ nome: modulo.nome, erro });
    }
  }
  return { ok, falhas };
}

/** Lista os nomes registrados (diagnóstico/testes). */
export function listarModulos() {
  return modulos.map((m) => m.nome);
}
