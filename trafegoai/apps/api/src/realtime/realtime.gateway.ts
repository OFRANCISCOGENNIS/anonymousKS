import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import IORedis from 'ioredis';
import { REALTIME_CHANNEL } from './realtime.publisher';

/**
 * Atualização em tempo real. O frontend entra na sala da organização e recebe
 * eventos de anomalia, execução de regra e sync sem recarregar.
 *
 * Todos os eventos passam pelo Redis pub/sub: `emitToOrg` PUBLICA no canal e o
 * subscriber (presente em toda instância da API) relaia para as salas locais.
 * Assim, eventos gerados no WORKER (regras agendadas) ou em qualquer réplica da
 * API chegam a todos os clientes conectados — não só aos da instância atual.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private pub = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: true });
  private sub = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null, lazyConnect: true });

  @WebSocketServer()
  server: Server;

  async onModuleInit() {
    try {
      await this.pub.connect();
      await this.sub.connect();
      await this.sub.subscribe(REALTIME_CHANNEL);
      this.sub.on('message', (_channel, raw) => {
        try {
          const { orgId, event, payload } = JSON.parse(raw);
          this.server?.to(`org:${orgId}`).emit(event, payload);
        } catch (e) {
          this.logger.warn(`Mensagem realtime inválida: ${e}`);
        }
      });
    } catch (e) {
      this.logger.warn(`Redis indisponível — tempo real limitado a esta instância (${(e as Error).message})`);
    }
  }

  handleConnection(client: Socket) {
    this.logger.debug(`ws conectado: ${client.id}`);
  }

  @SubscribeMessage('join-org')
  join(client: Socket, orgId: string) {
    client.join(`org:${orgId}`);
    return { joined: orgId };
  }

  /** Publica um evento no Redis; o subscriber relaia para a sala da organização. */
  emitToOrg(orgId: string, event: string, payload: unknown) {
    const msg = JSON.stringify({ orgId, event, payload });
    // Se o Redis não estiver pronto, emite localmente como fallback
    if (this.pub.status === 'ready') this.pub.publish(REALTIME_CHANNEL, msg).catch(() => this.server?.to(`org:${orgId}`).emit(event, payload));
    else this.server?.to(`org:${orgId}`).emit(event, payload);
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
  }
}
