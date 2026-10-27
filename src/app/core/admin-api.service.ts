import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminCategory,
  AdminOrderPage,
  AdminOrderSummary,
  AdminProduct,
  OrderSummary,
} from '../../../shared/commerce-contract';

export type AdminOrderStatus = OrderSummary['status'];
export type FulfillmentStatus = Extract<
  AdminOrderStatus,
  'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'COMPLETED'
>;

export interface CategoryWrite {
  name?: string;
  sortOrder?: number;
  available?: boolean;
}

export interface ProductWrite {
  name?: string;
  description?: string;
  categoryId?: string;
  basePriceMinor?: number;
  sortOrder?: number;
  available?: boolean;
}

export interface OptionGroupWrite {
  name?: string;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
}

export interface ProductOptionWrite {
  name?: string;
  priceDeltaMinor?: number;
  sortOrder?: number;
  available?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  listOrders(status?: AdminOrderStatus, cursor?: string, limit = 20): Promise<AdminOrderPage> {
    let params = new HttpParams().set('limit', limit);
    if (status) params = params.set('status', status);
    if (cursor) params = params.set('cursor', cursor);
    return firstValueFrom(this.http.get<AdminOrderPage>('/api/admin/orders', { params }));
  }

  updateOrderStatus(orderId: string, status: FulfillmentStatus): Promise<AdminOrderSummary> {
    return firstValueFrom(
      this.http.patch<AdminOrderSummary>(
        `/api/admin/orders/${encodeURIComponent(orderId)}/status`,
        { status },
      ),
    );
  }

  listCategories(): Promise<AdminCategory[]> {
    return firstValueFrom(
      this.http.get<{ categories: AdminCategory[] }>('/api/admin/categories'),
    ).then((response) => response.categories);
  }

  createCategory(
    input: Required<Pick<CategoryWrite, 'name' | 'sortOrder'>>,
  ): Promise<AdminCategory> {
    return firstValueFrom(this.http.post<AdminCategory>('/api/admin/categories', input));
  }

  updateCategory(categoryId: string, input: CategoryWrite): Promise<AdminCategory> {
    return firstValueFrom(
      this.http.patch<AdminCategory>(
        `/api/admin/categories/${encodeURIComponent(categoryId)}`,
        input,
      ),
    );
  }

  listProducts(): Promise<AdminProduct[]> {
    return firstValueFrom(this.http.get<{ products: AdminProduct[] }>('/api/admin/products')).then(
      (response) => response.products,
    );
  }

  getProduct(productId: string): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.get<AdminProduct>(`/api/admin/products/${encodeURIComponent(productId)}`),
    );
  }

  createProduct(
    input: Required<
      Pick<ProductWrite, 'name' | 'description' | 'categoryId' | 'basePriceMinor' | 'sortOrder'>
    >,
  ): Promise<AdminProduct> {
    return firstValueFrom(this.http.post<AdminProduct>('/api/admin/products', input));
  }

  updateProduct(productId: string, input: ProductWrite): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.patch<AdminProduct>(`/api/admin/products/${encodeURIComponent(productId)}`, input),
    );
  }

  createOptionGroup(
    productId: string,
    input: Required<
      Pick<OptionGroupWrite, 'name' | 'minSelections' | 'maxSelections' | 'sortOrder'>
    >,
  ): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.post<AdminProduct>(
        `/api/admin/products/${encodeURIComponent(productId)}/option-groups`,
        input,
      ),
    );
  }

  updateOptionGroup(groupId: string, input: OptionGroupWrite): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.patch<AdminProduct>(
        `/api/admin/products/option-groups/${encodeURIComponent(groupId)}`,
        input,
      ),
    );
  }

  createProductOption(
    groupId: string,
    input: Required<Pick<ProductOptionWrite, 'name' | 'priceDeltaMinor' | 'sortOrder'>>,
  ): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.post<AdminProduct>(
        `/api/admin/products/option-groups/${encodeURIComponent(groupId)}/options`,
        input,
      ),
    );
  }

  updateProductOption(optionId: string, input: ProductOptionWrite): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.patch<AdminProduct>(
        `/api/admin/products/options/${encodeURIComponent(optionId)}`,
        input,
      ),
    );
  }
}
