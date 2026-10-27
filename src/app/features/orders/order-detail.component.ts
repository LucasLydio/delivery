import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { OrderSummary } from '../../../../shared/commerce-contract';
import { OrderTrackingService } from '../../core/order-tracking.service';

@Component({ selector: 'app-order-detail', standalone: true, imports: [CurrencyPipe, DatePipe, RouterLink], providers: [OrderTrackingService], templateUrl: './order-detail.component.html', styleUrl: './order-detail.component.css' })
export class OrderDetailComponent implements OnInit, OnDestroy {
  readonly tracking = inject(OrderTrackingService); private readonly route = inject(ActivatedRoute);
  ngOnInit(): void { this.tracking.start(this.route.snapshot.paramMap.get('id') ?? ''); }
  ngOnDestroy(): void { this.tracking.stop(); }
  statusLabel(status: OrderSummary['status']): string { return ({ PAYMENT_PENDING: 'Aguardando pagamento', CONFIRMED: 'Pedido confirmado', PAYMENT_FAILED: 'Pagamento recusado', CANCELLED: 'Pedido cancelado' })[status]; }
}
