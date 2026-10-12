import { Injectable, signal } from '@angular/core';
import type { BrandConfig } from '../../../shared/commerce-contract';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  category: string;
  emoji: string;
  color: string;
  tag?: string;
  imagePosition?: string;
}

export interface PublicAppConfig extends BrandConfig {
  /** Demo catalog until the products API and its local cache are implemented. */
  menu: MenuItem[];
}

const fallback: PublicAppConfig = {
  brandName: 'Goodside',
  tagline: 'Comida fresquinha, na hora certa.',
  accentColor: '#ef704f',
  currency: 'BRL',
  locale: 'pt-BR',
  realtimeUrl: null,
  menu: [],
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  readonly config = signal<PublicAppConfig>(fallback);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Configuration unavailable');
      const value = await response.json() as Partial<PublicAppConfig>;
      if (typeof value.brandName !== 'string' || !Array.isArray(value.menu)) throw new Error('Invalid configuration');
      const next = { ...fallback, ...value };
      this.config.set(next);
      document.title = `${next.brandName} · ${next.tagline}`;
      if (/^#[0-9a-fA-F]{6}$/.test(next.accentColor)) {
        document.documentElement.style.setProperty('--brand-medium', next.accentColor);
        document.documentElement.style.setProperty('--brand-lighter', `color-mix(in srgb, ${next.accentColor} 14%, white)`);
        document.documentElement.style.setProperty('--brand-dark', `color-mix(in srgb, ${next.accentColor} 72%, #20201e)`);
      }
    } catch {
      // The shell remains usable if public branding is temporarily unavailable.
    } finally {
      this.loaded.set(true);
    }
  }
}
