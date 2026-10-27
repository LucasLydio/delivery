import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found-page" aria-labelledby="not-found-title">
      <img
        class="not-found-image"
        src="/images/notfound-placeholder.webp"
        alt="Ilustração de uma página triste com uma lupa e o número 404"
        width="1280"
        height="1280"
        decoding="async"
      />
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>O endereço que você procurou não existe ou foi alterado.</p>
      <a class="button button--dark" routerLink="/">Voltar ao cardápio</a>
    </section>
  `,
  styles: [
    `
      .not-found-page {
        display: grid;
        min-height: 100dvh;
        place-items: center;
        align-content: center;
        padding: 2rem 1.5rem calc(2rem + env(safe-area-inset-bottom));
        text-align: center;
      }
      .not-found-image {
        display: block;
        width: min(100%, 19rem);
        height: auto;
      }
      h1 {
        margin: 0.5rem 0 0;
        font-size: clamp(1.7rem, 7vw, 2.5rem);
        letter-spacing: -0.05em;
      }
      p {
        max-width: 24rem;
        margin: 0.5rem 0 1.5rem;
        color: var(--color-light);
      }
    `,
  ],
})
export class NotFoundComponent {}
