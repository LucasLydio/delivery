import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface PushKeyConfig {
  enabled: boolean;
  publicKey: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  pushKey(): Promise<PushKeyConfig> {
    return firstValueFrom(this.http.get<PushKeyConfig>('/api/config/push-key'));
  }

  registerPush(
    installId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<{ registered: boolean }> {
    return firstValueFrom(
      this.http.post<{ registered: boolean }>('/api/push/subscriptions', {
        installId,
        subscription,
      }),
    );
  }

  unregisterPush(installId: string, endpoint: string): Promise<{ removed: boolean }> {
    return firstValueFrom(
      this.http.request<{ removed: boolean }>('DELETE', '/api/push/subscriptions', {
        body: { installId, endpoint },
      }),
    );
  }
}
