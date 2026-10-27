import { Injectable, signal } from '@angular/core';
import type { OrderSummary } from '../../../shared/commerce-contract';
import { OrdersApiService } from './orders-api.service';

const TERMINAL = new Set<OrderSummary['status']>(['CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED']);

@Injectable()
export class OrderTrackingService {
  readonly order = signal<OrderSummary | null>(null);
  readonly loading = signal(false);
  readonly offline = signal(!navigator.onLine);
  readonly error = signal<string | null>(null);
  private orderId?: string;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private failures = 0;
  private readonly inFlight = new Set<number>();

  constructor(private readonly api: OrdersApiService) {}

  start(orderId: string): void {
    this.stop(); this.orderId = orderId; this.generation++;
    addEventListener('online', this.onOnline); addEventListener('offline', this.onOffline);
    addEventListener('pageshow', this.onResume); document.addEventListener('visibilitychange', this.onVisibility);
    void this.catchUp(this.generation);
  }
  stop(): void {
    this.generation++; this.orderId = undefined; this.clearTimer();
    removeEventListener('online', this.onOnline); removeEventListener('offline', this.onOffline);
    removeEventListener('pageshow', this.onResume); document.removeEventListener('visibilitychange', this.onVisibility);
  }
  refresh(): void {
    if (this.orderId && navigator.onLine && document.visibilityState === 'visible') {
      this.clearTimer(); void this.catchUp(this.generation);
    }
  }
  private readonly onOnline = () => { this.offline.set(false); this.refresh(); };
  private readonly onOffline = () => { this.offline.set(true); this.clearTimer(); };
  private readonly onResume = () => this.refresh();
  private readonly onVisibility = () => document.visibilityState === 'visible' ? this.refresh() : this.clearTimer();

  private async catchUp(generation: number): Promise<void> {
    if (!this.orderId || generation !== this.generation || this.inFlight.has(generation) || !navigator.onLine || document.visibilityState !== 'visible') return;
    this.inFlight.add(generation);
    this.loading.set(this.order() === null);
    try {
      const order = await this.api.get(this.orderId);
      if (generation !== this.generation) return;
      this.order.set(order); this.error.set(null); this.failures = 0;
      if (!TERMINAL.has(order.status)) this.schedule(30_000, generation);
    } catch {
      if (generation !== this.generation) return;
      this.error.set('Não foi possível atualizar o pedido agora.'); this.failures++;
      this.schedule(Math.min(15_000 * 2 ** (this.failures - 1), 300_000), generation);
    } finally {
      this.inFlight.delete(generation);
      if (generation === this.generation) this.loading.set(false);
    }
  }
  private schedule(delay: number, generation: number): void { this.clearTimer(); this.timer = setTimeout(() => void this.catchUp(generation), delay); }
  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
}
