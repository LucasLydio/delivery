import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { PushService } from '../../core/push.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly push = inject(PushService);
  readonly loggingOut = signal(false);
  readonly error = signal<string | null>(null);

  initials(): string {
    return (this.auth.customer()?.name ?? '').split(/\s+/).slice(0, 2).map(value => value[0]).join('').toUpperCase();
  }

  async logout(): Promise<void> {
    this.error.set(null);
    this.loggingOut.set(true);
    try {
      await this.push.detach().catch(() => undefined);
      await this.auth.logout();
      this.cart.clear();
      await this.router.navigate(['/login']);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Não foi possível encerrar sua sessão. Tente novamente.'));
    } finally {
      this.loggingOut.set(false);
    }
  }
}

