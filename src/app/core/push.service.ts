import { inject, Injectable, isDevMode, signal } from '@angular/core';
import { ApiService } from './api.service';

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function vapidToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(ApiService);
  private publicKey: string | null = null;
  readonly status = signal<'loading' | 'unavailable' | 'ready' | 'enabled' | 'denied' | 'error'>('loading');
  readonly message = signal<string | null>(null);

  async initialize(): Promise<void> {
    if (isDevMode()) {
      this.status.set('unavailable');
      this.message.set('As notificações podem ser testadas na versão de produção por HTTPS ou localhost.');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !isSecureContext) {
      this.status.set('unavailable');
      return;
    }
    // iOS web push is available only when launched as a Home Screen web app.
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandalone()) {
      this.status.set('unavailable');
      this.message.set('Instale e abra o aplicativo pela tela de início para ativar as notificações.');
      return;
    }
    try {
      const config = await this.api.pushKey();
      if (!config.enabled || !config.publicKey) { this.status.set('unavailable'); return; }
      this.publicKey = config.publicKey;
      if (Notification.permission === 'denied') { this.status.set('denied'); return; }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted') {
        await this.register(subscription);
      } else {
        this.status.set('ready');
      }
    } catch {
      this.status.set('error');
      this.message.set('Não foi possível verificar as notificações agora.');
    }
  }

  async enable(): Promise<void> {
    if (!this.publicKey || this.status() === 'loading') return;
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { this.status.set(permission === 'denied' ? 'denied' : 'ready'); return; }
      }
      if (Notification.permission !== 'granted') { this.status.set('denied'); return; }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidToBytes(this.publicKey),
      });
      await this.register(subscription);
    } catch {
      this.status.set('error');
      this.message.set('Não foi possível cadastrar este dispositivo. Tente novamente.');
    }
  }

  async disable(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await this.api.unregisterPush(this.installId(), subscription.endpoint);
        await subscription.unsubscribe();
      }
      this.status.set('ready');
      this.message.set('As notificações foram desativadas neste dispositivo.');
    } catch {
      this.status.set('error');
      this.message.set('Não foi possível desativar as notificações. Tente novamente.');
    }
  }

  private async register(subscription: PushSubscription): Promise<void> {
    const { endpoint, keys } = subscription.toJSON();
    if (!endpoint || !keys?.['p256dh'] || !keys?.['auth']) throw new Error('Incomplete push subscription');
    const response = await this.api.registerPush(this.installId(), {
      endpoint,
      keys: { p256dh: keys['p256dh'], auth: keys['auth'] },
    });
    if (!response.registered) throw new Error('Registration not acknowledged');
    this.status.set('enabled');
    this.message.set(null);
  }

  private installId(): string {
    const key = 'delivery-install-id';
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  }
}
