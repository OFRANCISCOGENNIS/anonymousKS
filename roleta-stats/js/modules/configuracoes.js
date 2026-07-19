/**
 * Módulo de configurações do usuário.
 * Persistidas em LocalStorage via camada de persistência.
 * Publica "config:alterada" no barramento a cada mudança.
 */

import { lerConfig, gravarConfig } from './persistencia.js';
import { publicar } from '../core/barramento.js';

const CHAVE = 'config';

/** Valores padrão de configuração. */
export const CONFIG_PADRAO = Object.freeze({
  tipoRoleta: 'europeia', // 'europeia' (0–36) | 'americana' (0, 00, 1–36)
});

const TIPOS_VALIDOS = ['europeia', 'americana'];

let atual = { ...CONFIG_PADRAO };

/**
 * Valida e normaliza um objeto de configuração vindo de fora
 * (storage pode estar corrompido ou de versão antiga).
 * @param {any} bruta
 * @returns {object} configuração válida
 */
export function normalizarConfig(bruta) {
  const cfg = { ...CONFIG_PADRAO };
  if (bruta && typeof bruta === 'object') {
    if (TIPOS_VALIDOS.includes(bruta.tipoRoleta)) cfg.tipoRoleta = bruta.tipoRoleta;
  }
  return cfg;
}

/** Retorna uma cópia da configuração atual. */
export function obterConfig() {
  return { ...atual };
}

/**
 * Atualiza parcialmente a configuração, persiste e notifica.
 * @param {object} mudancas
 * @returns {object} configuração resultante
 */
export function atualizarConfig(mudancas) {
  atual = normalizarConfig({ ...atual, ...mudancas });
  gravarConfig(CHAVE, atual);
  publicar('config:alterada', obterConfig());
  return obterConfig();
}

export const moduloConfiguracoes = {
  nome: 'configuracoes',
  iniciar() {
    atual = normalizarConfig(lerConfig(CHAVE, CONFIG_PADRAO));
  },
};
