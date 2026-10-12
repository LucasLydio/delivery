import { inject, Injectable, signal } from '@angular/core';
import { ApiService, LatestState } from './api.service';
import { AppConfigService } from './app-config';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly api = inject(ApiService);
  private readonly config = inject(AppConfigService);
  private socket?: WebSocket;
  private retry?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pongTimeout?: ReturnType<typeof setTimeout>;
  private attempts = 0;
  private started = false;
  private refreshing = false;
  readonly connection = signal<'offline' | 'connecting' | 'live' | 'catching-up' | 'on-open'>('connecting');
  readonly latest = signal<LatestState>({ state: null, updatedAt: null });
  readonly error = signal<string | null>(null);

  start(): void {
    if (this.started) return;
    this.started = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pageshow', this.onResume);
    window.addEventListener('online', this.onResume);
    window.addEventListener('offline', this.onOffline);
    void this.resume();
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible') void this.resume();
    else this.pause();
  };
  private readonly onResume = () => { void this.resume(); };
  private readonly onOffline = () => { this.pause(); this.connection.set('offline'); };

  private async resume(): Promise<void> {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    // Always fetch fresh state after waking, even when a socket reconnects.
    await this.catchUp();
    const url = this.config.config().realtimeUrl;
    if (url) this.connect(url);
    else if (!this.error()) this.connection.set('on-open');
  }

  async catchUp(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    this.connection.set('catching-up');
    try {
      this.latest.set(await this.api.latestState());
      this.error.set(null);
    } catch {
      this.error.set('Não foi possível atualizar as informações. Tentaremos novamente quando você abrir o aplicativo.');
    } finally {
      this.refreshing = false;
      this.connection.set(!navigator.onLine ? 'offline' : this.socket?.readyState === WebSocket.OPEN ? 'live' : 'on-open');
    }
  }

  private connect(url: string): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (!/^wss:\/\//.test(url) && !/^ws:\/\/localhost(?::\d+)?(?:\/|$)/.test(url)) {
      this.error.set('A conexão em tempo real precisa ser segura.');
      return;
    }
    this.connection.set('connecting');
    try {
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.onopen = () => {
        this.attempts = 0;
        this.connection.set('live');
        this.heartbeat = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          socket.send(JSON.stringify({ type: 'ping' }));
          this.pongTimeout = setTimeout(() => socket.close(), 15000);
        }, 60000);
        void this.catchUp();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string };
          if (message.type === 'pong') {
            clearTimeout(this.pongTimeout);
          } else if (message.type === 'state_changed') {
            void this.catchUp();
          }
        } catch { /* Ignore malformed gateway messages. */ }
      };
      socket.onclose = () => {
        this.clearHeartbeat();
        if (this.socket === socket) this.socket = undefined;
        if (document.visibilityState === 'visible' && navigator.onLine) this.scheduleRetry(url);
      };
      socket.onerror = () => socket.close();
    } catch {
      this.scheduleRetry(url);
    }
  }

  private scheduleRetry(url: string): void {
    if (this.retry) return;
    this.connection.set('connecting');
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5)) + Math.random() * 500;
    this.retry = setTimeout(() => { this.retry = undefined; this.connect(url); }, delay);
  }

  private clearHeartbeat(): void {
    clearInterval(this.heartbeat);
    clearTimeout(this.pongTimeout);
    this.heartbeat = undefined;
    this.pongTimeout = undefined;
  }

  private pause(): void {
    clearTimeout(this.retry);
    this.retry = undefined;
    this.clearHeartbeat();
    this.socket?.close();
    this.socket = undefined;
  }
}
