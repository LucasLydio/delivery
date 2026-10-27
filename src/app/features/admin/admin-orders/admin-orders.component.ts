import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { AdminOrderSummary, OrderSummary } from '../../../../../shared/commerce-contract';
import {
  AdminApiService,
  type AdminOrderStatus,
  type FulfillmentStatus,
} from '../../../core/admin-api.service';
import { apiErrorMessage } from '../../../core/api-error';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

interface OrderFilter {
  label: string;
  status?: AdminOrderStatus;
}

const filters: readonly OrderFilter[] = [
  { label: 'Novos', status: 'CONFIRMED' },
  { label: 'Em preparo', status: 'PREPARING' },
  { label: 'Prontos', status: 'READY' },
  { label: 'Em entrega', status: 'OUT_FOR_DELIVERY' },
  { label: 'Todos' },
];

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ConfirmDialogComponent],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.css',
})
export class AdminOrdersComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly confirmDialog = viewChild.required(ConfirmDialogComponent);
  private lastLoadedAt = 0;

  readonly filters = filters;
  readonly selectedStatus = signal<AdminOrderStatus | undefined>('CONFIRMED');
  readonly orders = signal<AdminOrderSummary[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly updatingOrderId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly hasOrders = computed(() => this.orders().length > 0);

  ngOnInit(): void {
    void this.load();
  }

  @HostListener('window:focus')
  refreshWhenReturning(): void {
    if (Date.now() - this.lastLoadedAt > 30_000 && !this.loading()) void this.load();
  }

  async selectFilter(status?: AdminOrderStatus): Promise<void> {
    if (this.selectedStatus() === status) return;
    this.selectedStatus.set(status);
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await this.api.listOrders(this.selectedStatus());
      this.orders.set(page.items);
      this.nextCursor.set(page.nextCursor);
      this.lastLoadedAt = Date.now();
    } catch (error) {
      this.error.set(
        apiErrorMessage(
          error,
          navigator.onLine
            ? 'Não conseguimos consultar os pedidos agora. Use Atualizar para tentar novamente.'
            : 'Você está sem conexão. Reconecte e tente novamente.',
        ),
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
      const page = await this.api.listOrders(this.selectedStatus(), cursor);
      this.orders.update((current) => [...current, ...page.items]);
      this.nextCursor.set(page.nextCursor);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível carregar mais pedidos.'));
    } finally {
      this.loadingMore.set(false);
    }
  }

  async updateStatus(order: AdminOrderSummary, status: FulfillmentStatus): Promise<void> {
    if (this.updatingOrderId()) return;
    if (status === 'COMPLETED') {
      const confirmed = await this.confirmDialog().request({
        title: 'Concluir pedido?',
        message: `Confirme que o pedido #${this.shortId(order.id)} foi concluído.`,
        confirmLabel: 'Concluir pedido',
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.updatingOrderId.set(order.id);
    this.error.set(null);
    this.notice.set(null);
    try {
      const updated = await this.api.updateOrderStatus(order.id, status);
      if (this.selectedStatus() && updated.status !== this.selectedStatus()) {
        this.orders.update((current) => current.filter((item) => item.id !== order.id));
      } else {
        this.orders.update((current) =>
          current.map((item) => (item.id === order.id ? updated : item)),
        );
      }
      this.notice.set(
        `Pedido #${this.shortId(order.id)} atualizado para ${this.statusLabel(updated.status)}.`,
      );
    } catch (error) {
      this.error.set(
        apiErrorMessage(
          error,
          'Não foi possível atualizar o pedido. Atualize a lista e tente novamente.',
        ),
      );
    } finally {
      this.updatingOrderId.set(null);
    }
  }

  nextActions(
    status: OrderSummary['status'],
  ): readonly { label: string; status: FulfillmentStatus; secondary?: boolean }[] {
    switch (status) {
      case 'CONFIRMED':
        return [{ label: 'Iniciar preparo', status: 'PREPARING' }];
      case 'PREPARING':
        return [{ label: 'Marcar como pronto', status: 'READY' }];
      case 'READY':
        return [
          { label: 'Saiu para entrega', status: 'OUT_FOR_DELIVERY' },
          { label: 'Concluir retirada', status: 'COMPLETED', secondary: true },
        ];
      case 'OUT_FOR_DELIVERY':
        return [{ label: 'Concluir entrega', status: 'COMPLETED' }];
      default:
        return [];
    }
  }

  statusLabel(status: OrderSummary['status']): string {
    return {
      PAYMENT_PENDING: 'Aguardando pagamento',
      CONFIRMED: 'Novo',
      PREPARING: 'Em preparo',
      READY: 'Pronto',
      OUT_FOR_DELIVERY: 'Em entrega',
      COMPLETED: 'Concluído',
      PAYMENT_FAILED: 'Pagamento recusado',
      CANCELLED: 'Cancelado',
    }[status];
  }

  paymentLabel(method: OrderSummary['paymentMethod']): string {
    return {
      MERCADO_PAGO_PIX: 'Pix',
      MERCADO_PAGO_CARD: 'Cartão no app',
      PAY_ON_DELIVERY: 'Pagamento na entrega',
      PAY_AT_STORE: 'Pagamento na loja',
    }[method];
  }

  shortId(id: string): string {
    return id.slice(-6).toUpperCase();
  }

  optionsLabel(orderLine: AdminOrderSummary['lines'][number]): string {
    return orderLine.selectedOptions.map((option) => option.name).join(', ');
  }

  addressLine(order: AdminOrderSummary): string {
    const address = order.deliveryAddress;
    if (!address) return 'Retirada na loja';
    return [address['line1'], address['line2'], address['city']]
      .filter((value) => typeof value === 'string' && value)
      .join(' · ');
  }
}
