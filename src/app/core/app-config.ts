import { Injectable, signal } from '@angular/core';
import type { BrandConfig } from '../../../shared/commerce-contract';

export interface PublicAppConfig extends BrandConfig {}

const fallback: PublicAppConfig = {
  brandName: 'Goodside',
  tagline: 'Comida fresquinha, na hora certa.',
  accentColor: '#ef704f',
  currency: 'BRL',
  locale: 'pt-BR',
  realtimeUrl: null,
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly config = signal<PublicAppConfig>(fallback);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration unavailable');
      const value = (await response.json()) as Partial<PublicAppConfig>;
      if (typeof value.brandName !== 'string') throw new Error('Invalid configuration');
      const next = { ...fallback, ...value };
      this.config.set(next);
      document.title = `${next.brandName} · ${next.tagline}`;
      if (/^#[0-9a-fA-F]{6}$/.test(next.accentColor)) {
        document.documentElement.style.setProperty('--brand-medium', next.accentColor);
        document.documentElement.style.setProperty(
          '--brand-lighter',
          `color-mix(in srgb, ${next.accentColor} 14%, white)`,
        );
        document.documentElement.style.setProperty(
          '--brand-dark',
          `color-mix(in srgb, ${next.accentColor} 72%, #20201e)`,
        );
      }
    } catch {
      // The shell remains usable if public branding is temporarily unavailable.
    } finally {
      this.loaded.set(true);
    }
  }
}
