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
      { path: 'offers', component: PlaceholderComponent, data: { title: 'Offers', icon: '✦' } },
      { path: 'orders', component: PlaceholderComponent, data: { title: 'Your orders', icon: '▤' } },
      { path: 'cart', component: CartComponent, data: { showHeader: false, showNav: false } },
      { path: 'profile/edit', component: PersonalInfoComponent, data: { showHeader: false, showNav: false } },
      { path: 'profile', component: ProfileComponent, data: { showHeader: false, showNav: true } },
      { path: 'addresses', component: PlaceholderComponent, data: { title: 'Addresses', icon: '⌖' } },
      { path: 'payments', component: PlaceholderComponent, data: { title: 'Payment methods', icon: '▱' } },
      { path: 'settings', component: PlaceholderComponent, data: { title: 'Settings', icon: '⚙' } },
      { path: 'support', component: PlaceholderComponent, data: { title: 'Help & support', icon: '?' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
