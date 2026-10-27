import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrls: ['./admin-shell.component.css', './admin-shell.navigation.css'],
})
export class AdminShellComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AdminAuthService);
  readonly signingOut = signal(false);

  async logout(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    try {
      await this.auth.logout().catch(() => undefined);
      await this.router.navigateByUrl('/admin/login');
    } finally {
      this.signingOut.set(false);
    }
  }
}
