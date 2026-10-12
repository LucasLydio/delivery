import { Component, Input } from '@angular/core';
import { MenuItem } from '../core/app-config';

@Component({
  selector: 'app-dish-image',
  standalone: true,
  template: `
    @if (item.imagePosition) {
      <span class="dish-image" role="img" [attr.aria-label]="item.name" [style.background-position]="item.imagePosition"></span>
    } @else {
      <img class="dish-image-placeholder" src="/images/product-placeholder.webp" [alt]="'Imagem ilustrativa para ' + item.name" width="1024" height="1024" loading="lazy" decoding="async">
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .dish-image { display: block; width: 100%; height: 100%; background: url('/images/menu-dishes.png') no-repeat; background-size: 200% 200%; filter: drop-shadow(0 .65rem .55rem rgb(36 36 36 / .14)); }
    .dish-image-placeholder { display: block; width: 100%; height: 100%; object-fit: contain; border-radius: 1rem; }
  `],
})
export class DishImageComponent {
  @Input({ required: true }) item!: MenuItem;
}
