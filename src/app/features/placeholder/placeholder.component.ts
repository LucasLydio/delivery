import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="placeholder-page">
      <h1>{{ title }}</h1>
      @if (image) {
        <img class="placeholder-image" [src]="image" [alt]="imageAlt" width="1024" height="1024" decoding="async">
      } @else {
        <span class="placeholder-icon" aria-hidden="true">{{ icon }}</span>
      }
      <p>Estamos preparando esta página para você.</p>
      <a class="button button--dark" routerLink="/">Voltar ao cardápio</a>
    </section>
  `,
  styles: [`
    .placeholder-page { display: grid; min-height: 65dvh; place-items: center; align-content: center; padding: 3rem 1.5rem; text-align: center; }
    .placeholder-icon { display: grid; width: 4rem; height: 4rem; place-items: center; border-radius: 1.25rem; background: var(--brand-lighter); font-size: 2rem; }
    .placeholder-image { display: block; width: min(100%, 20rem); height: auto; margin: .25rem 0; object-fit: contain; }
    h1 { margin: 0; font-size: clamp(2rem, 8vw, 3.3rem); letter-spacing: -.06em; }
    p { max-width: 28rem; margin: .75rem 0 1.5rem; color: var(--color-light); }
  `],
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly icon = this.route.snapshot.data['icon'] as string | undefined;
  readonly image = this.route.snapshot.data['image'] as string | undefined;
  readonly imageAlt = this.route.snapshot.data['imageAlt'] as string | undefined;
}
