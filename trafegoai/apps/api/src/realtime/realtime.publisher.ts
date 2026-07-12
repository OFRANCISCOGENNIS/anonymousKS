import IORedis from 'ioredis';

export const REALTIME_CHANNEL = 'trafegoai:realtime';

/**
 * Publicador de eventos em tempo real via Redis pub/sub.
 * Usado por processos SEM o WebSocket local (ex.: o worker de jobs): publica no
 * canal Redis e a(s) instância(s) da API relaiam para as salas das organizações.
 * Expõe `emitToOrg` com a mesma assinatura do RealtimeGateway (duck typing),
 * então pode ser passado ao RulesEngine no lugar do gateway.
 */
export class RealtimeRedisPublisher {
  private pub = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });

  emitToOrg(orgId: string, event: string, payload: unknown) {
    this.pub.publish(REALTIME_CHANNEL, JSON.stringify({ orgId, event, payload })).catch(() => {});
  }
}
