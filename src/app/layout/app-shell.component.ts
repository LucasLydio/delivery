import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { InstallButtonComponent } from '../shared/install-button.component';
import { AppConfigService } from '../core/app-config';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';
import { PushService } from '../core/push.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, InstallButtonComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent implements OnInit {
  readonly config = inject(AppConfigService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  readonly showHeader = signal(true);
  readonly showNav = signal(true);
  readonly push = inject(PushService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateChrome());
  }

  async ngOnInit(): Promise<void> {
    await this.config.load();
    if (this.auth.authenticated()) void this.push.initialize();
    this.updateChrome();
  }

  private updateChrome(): void {
    let route = this.route.firstChild;
    while (route?.firstChild) route = route.firstChild;
    this.showHeader.set(route?.snapshot.data['showHeader'] !== false);
    this.showNav.set(route?.snapshot.data['showNav'] !== false);
  }
}
