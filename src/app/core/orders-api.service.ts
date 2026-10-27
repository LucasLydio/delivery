import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { OrderPage, OrderSummary } from '../../../shared/commerce-contract';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  list(cursor?: string): Promise<OrderPage> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return firstValueFrom(this.http.get<OrderPage>(`/api/orders${query}`));
  }
  get(id: string): Promise<OrderSummary> { return firstValueFrom(this.http.get<OrderSummary>(`/api/orders/${encodeURIComponent(id)}`)); }
}
