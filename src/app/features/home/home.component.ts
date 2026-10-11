import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppConfigService, MenuItem } from '../../core/app-config';
import { RealtimeService } from '../../core/realtime.service';
import { PushService } from '../../core/push.service';
import { InstallButtonComponent } from '../../shared/install-button.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, InstallButtonComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly config = inject(AppConfigService);
  readonly realtime = inject(RealtimeService);
  readonly push = inject(PushService);
  readonly query = signal('');
  readonly category = signal('All');
  readonly cart = signal<Record<string, number>>({});
  readonly categories = computed(() => ['All', ...new Set(this.config.config().menu.map(item => item.category))]);
  readonly visibleMenu = computed(() => this.config.config().menu.filter(item => {
    const matchesCategory = this.category() === 'All' || item.category === this.category();
    const text = `${item.name} ${item.description}`.toLowerCase();
    return matchesCategory && text.includes(this.query().trim().toLowerCase());
  }));
  readonly cartCount = computed(() => Object.values(this.cart()).reduce((sum, quantity) => sum + quantity, 0));
  readonly cartTotal = computed(() => this.config.config().menu.reduce((sum, item) => sum + item.price * (this.cart()[item.id] ?? 0), 0));

  async ngOnInit(): Promise<void> {
    await this.config.load();
    this.realtime.start();
    void this.push.initialize();
  }

  add(item: MenuItem): void {
    this.cart.update(cart => ({ ...cart, [item.id]: (cart[item.id] ?? 0) + 1 }));
  }

  formatPrice(value: number): string {
    const { locale, currency } = this.config.config();
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }

  connectionLabel(): string {
    switch (this.realtime.connection()) {
      case 'live': return 'Live updates connected';
      case 'connecting': return 'Connecting to live updates';
      case 'catching-up': return 'Checking latest updates';
      case 'offline': return 'You are offline';
      default: return 'Updates checked when app opens';
    }
  }
}
