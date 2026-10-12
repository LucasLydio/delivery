import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';
import { AppShellComponent } from './layout/app-shell.component';
import { CartComponent } from './features/cart/cart.component';
import { ProductDetailComponent } from './features/product/product-detail.component';
import { ProfileComponent } from './features/profile/profile.component';
import { PersonalInfoComponent } from './features/profile/personal-info.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', component: HomeComponent, data: { showHeader: true, showNav: true } },
      { path: 'product/:id', component: ProductDetailComponent, data: { showHeader: false, showNav: false } },
      { path: 'offers', component: PlaceholderComponent, data: { title: 'Ofertas', icon: '✦' } },
      { path: 'orders', component: PlaceholderComponent, data: { title: 'Seus pedidos', icon: '▤' } },
      { path: 'cart', component: CartComponent, data: { showHeader: false, showNav: false } },
      { path: 'profile/edit', component: PersonalInfoComponent, data: { showHeader: false, showNav: false } },
      { path: 'profile', component: ProfileComponent, data: { showHeader: false, showNav: true } },
      { path: 'addresses', component: PlaceholderComponent, data: { title: 'Endereços', icon: '⌖' } },
      { path: 'payments', component: PlaceholderComponent, data: { title: 'Formas de pagamento', icon: '▱' } },
      { path: 'settings', component: PlaceholderComponent, data: { title: 'Configurações', icon: '⚙' } },
      { path: 'support', component: PlaceholderComponent, data: { title: 'Ajuda e suporte', icon: '?' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
