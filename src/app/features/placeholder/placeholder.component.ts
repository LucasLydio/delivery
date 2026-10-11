import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="placeholder-page">
      <span class="placeholder-icon" aria-hidden="true">{{ icon }}</span>
      <p class="placeholder-kicker">COMING NEXT</p>
      <h1>{{ title }}</h1>
      <p>This screen now has a place in the app shell and will be built in the next UI milestone.</p>
      <a class="button button--dark" routerLink="/">Back to menu</a>
    </section>
  `,
  styles: [`
    .placeholder-page { display: grid; min-height: 65dvh; place-items: center; align-content: center; padding: 3rem 1.5rem; text-align: center; }
    .placeholder-icon { display: grid; width: 4rem; height: 4rem; place-items: center; border-radius: 1.25rem; background: var(--brand-lighter); font-size: 2rem; }
    .placeholder-kicker { margin: 1.25rem 0 .35rem; color: var(--brand-dark); font-size: .7rem; font-weight: 850; letter-spacing: .16em; }
    h1 { margin: 0; font-size: clamp(2rem, 8vw, 3.3rem); letter-spacing: -.06em; }
    p:not(.placeholder-kicker) { max-width: 28rem; margin: .75rem 0 1.5rem; color: var(--color-light); }
  `],
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly icon = this.route.snapshot.data['icon'] as string;
}
