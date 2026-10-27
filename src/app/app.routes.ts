import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { CartComponent } from './features/cart/cart.component';
import { HomeComponent } from './features/home/home.component';
import { NotFoundComponent } from './features/not-found/not-found.component';
import { OrderDetailComponent } from './features/orders/order-detail.component';
import { OrdersComponent } from './features/orders/orders.component';
import { PlaceholderComponent } from './features/placeholder/placeholder.component';
import { ProductDetailComponent } from './features/product/product-detail.component';
import { PersonalInfoComponent } from './features/profile/personal-info.component';
import { ProfileComponent } from './features/profile/profile.component';
import { AppShellComponent } from './layout/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', component: HomeComponent, data: { showHeader: true, showNav: true } },
      { path: 'login', component: LoginComponent, data: { showHeader: false, showNav: false } },
      { path: 'product/:id', component: ProductDetailComponent, data: { showHeader: false, showNav: false } },
      { path: 'offers', component: PlaceholderComponent, data: { title: 'Ofertas', image: '/images/offer-placeholder.webp', imageAlt: 'Ilustração de cupons com a mensagem: Sem ofertas' } },
      { path: 'orders', component: OrdersComponent, canActivate: [authGuard] },
      { path: 'orders/:id', component: OrderDetailComponent, canActivate: [authGuard], data: { showHeader: false, showNav: false } },
      { path: 'cart', component: CartComponent, canActivate: [authGuard], data: { showHeader: false, showNav: false } },
      { path: 'profile/edit', component: PersonalInfoComponent, canActivate: [authGuard], data: { showHeader: false, showNav: false } },
      { path: 'profile', component: ProfileComponent, canActivate: [authGuard], data: { showHeader: false, showNav: true } },
      { path: 'addresses', component: PlaceholderComponent, canActivate: [authGuard], data: { title: 'Endereços', image: '/images/address-placeholder.webp', imageAlt: 'Ilustração de uma casa e uma entrega com a mensagem: Facilite a entrega!' } },
      { path: 'payments', component: PlaceholderComponent, canActivate: [authGuard], data: { title: 'Formas de pagamento', image: '/images/payment-placeholder.webp', imageAlt: 'Ilustração de um cartão e dinheiro com a mensagem: Pague no app' } },
      { path: 'settings', component: PlaceholderComponent, data: { title: 'Configurações', icon: '⚙' } },
      { path: 'support', component: PlaceholderComponent, data: { title: 'Ajuda e suporte', icon: '?' } },
      { path: '**', component: NotFoundComponent, data: { showHeader: false, showNav: false } },
    ],
  },
];

