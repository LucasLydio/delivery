import { Injectable, signal } from '@angular/core';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  color: string;
  tag?: string;
}

export interface PublicAppConfig {
  brandName: string;
  tagline: string;
  accentColor: string;
  currency: string;
  locale: string;
  realtimeUrl: string | null;
  menu: MenuItem[];
}

const fallback: PublicAppConfig = {
  brandName: 'Goodside',
  tagline: 'Fresh food, right on time.',
  accentColor: '#ef704f',
  currency: 'USD',
  locale: 'en-US',
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
