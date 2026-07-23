'use client';

import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';
import { DEMO_MODE } from './mock';

let socket: Socket | null = null;

/** Conexão WebSocket única (singleton) para alertas em tempo real. */
export function getSocket(): Socket | null {
  if (DEMO_MODE) return null; // sem backend: tempo real desativado
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket'], autoConnect: true });
  }
  return socket;
}

/** Entra na sala da organização para receber os eventos dela. */
export function joinOrg(orgId: string) {
  const s = getSocket();
  if (!s) return;
  const emit = () => s.emit('join-org', orgId);
  if (s.connected) emit();
  s.on('connect', emit);
}

export interface RealtimeNotification {
  type: 'anomaly' | 'rule';
  severity: string;
  title: string;
  message: string;
  at: string;
}
