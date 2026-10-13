import { Component, Input } from '@angular/core';
import type { CatalogProduct } from '../../../shared/commerce-contract';

@Component({
  selector: 'app-dish-image',
  standalone: true,
  template: `
    @if (item.images[0]; as image) {
      <img class="dish-image" [src]="image.url" [alt]="image.alt || item.name" [width]="image.width || 640" [height]="image.height || 640" loading="lazy" decoding="async" (error)="usePlaceholder($event)">
    } @else {
      <img class="dish-image-placeholder" src="/images/products/product-placeholder.webp" [alt]="'Imagem ilustrativa para ' + item.name" width="1024" height="1024" loading="lazy" decoding="async">
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .dish-image { display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 .65rem .55rem rgb(36 36 36 / .14)); }
    .dish-image-placeholder { display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 1rem; }
  `],
})
export class DishImageComponent {
  @Input({ required: true }) item!: CatalogProduct;

  usePlaceholder(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    image.onerror = null;
    image.src = '/images/products/product-placeholder.webp';
  }
}
