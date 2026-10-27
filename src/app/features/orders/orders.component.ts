import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { OrderSummary } from '../../../../shared/commerce-contract';
import { OrdersApiService } from '../../core/orders-api.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(OrdersApiService);
  readonly orders = signal<OrderSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly loadingMore = signal(false);
  readonly nextCursor = signal<string | null>(null);
  ngOnInit(): void {
    void this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const page = await this.api.list();
      this.orders.set(page.items);
      this.nextCursor.set(page.nextCursor);
      this.error.set(null);
    } catch {
      this.error.set(
        navigator.onLine
          ? 'Não foi possível carregar seus pedidos.'
          : 'Você está sem conexão. Tente novamente quando voltar.',
      );
    } finally {
      this.loading.set(false);
    }
  }
  async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    try {
      const page = await this.api.list(cursor);
      this.orders.update((current) => [...current, ...page.items]);
      this.nextCursor.set(page.nextCursor);
      this.error.set(null);
    } catch {
      this.error.set('Não foi possível carregar mais pedidos.');
    } finally {
      this.loadingMore.set(false);
    }
  }
  statusLabel(status: OrderSummary['status']): string {
    return {
      PAYMENT_PENDING: 'Aguardando pagamento',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Em preparo',
      READY: 'Pronto',
      OUT_FOR_DELIVERY: 'Saiu para entrega',
      COMPLETED: 'Concluído',
      PAYMENT_FAILED: 'Pagamento recusado',
      CANCELLED: 'Cancelado',
    }[status];
  }
}
