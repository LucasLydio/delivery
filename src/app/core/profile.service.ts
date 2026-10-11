import { Injectable, signal } from '@angular/core';

export interface CustomerProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  bio: string;
}

const defaultProfile: CustomerProfile = {
  name: 'Sophia Williams',
  email: 'sophia@example.com',
  phone: '+1 555 010 2024',
  address: '100A Ealing Rd',
  bio: 'Good food and good company.',
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  readonly profile = signal<CustomerProfile>(this.read());

  update(profile: CustomerProfile): void {
    this.profile.set(profile);
    localStorage.setItem('delivery-profile', JSON.stringify(profile));
  }

  private read(): CustomerProfile {
    try {
      const stored = JSON.parse(localStorage.getItem('delivery-profile') ?? 'null') as Partial<CustomerProfile> | null;
      return stored ? { ...defaultProfile, ...stored } : defaultProfile;
    } catch {
      return defaultProfile;
    }
  }
}
