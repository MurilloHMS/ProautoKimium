import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Web Push nativo via service worker (PWA). Funciona apenas em produção (HTTPS + SW ativo).
 * O payload enviado pelo backend já vem no formato { notification: {...} }, então o
 * service worker do Angular exibe a notificação automaticamente — inclusive com o app fechado.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  constructor(private swPush: SwPush, private http: HttpClient, private router: Router) {}

  get isEnabled(): boolean {
    return this.swPush.isEnabled;
  }

  /** Já existe uma inscrição de push ativa neste navegador? (estado real, persistente) */
  async isSubscribed(): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;
    try {
      const sub = await firstValueFrom(this.swPush.subscription);
      return !!sub;
    } catch {
      return false;
    }
  }

  /** Navega para a rota da notificação quando o usuário clica nela. */
  initClickHandling(): void {
    if (!this.swPush.isEnabled) return;
    this.swPush.notificationClicks.subscribe(({ notification }) => {
      const url = (notification as any)?.data?.url;
      if (url) this.router.navigateByUrl(url);
    });
  }

  /** Pede permissão, assina o push e registra a inscrição no backend. Idempotente. */
  async enable(): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;
    try {
      // Reusa a inscrição existente; só pede uma nova se ainda não houver.
      let sub = await firstValueFrom(this.swPush.subscription);
      if (!sub) {
        const res = await firstValueFrom(
          this.http.get<{ publicKey: string }>(`${environment.apiUrl}/push/public-key`)
        );
        if (!res?.publicKey) return false;
        sub = await this.swPush.requestSubscription({ serverPublicKey: res.publicKey });
      }

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/push/subscribe`, sub.toJSON(), { responseType: 'text' })
      );
      return true;
    } catch {
      return false;
    }
  }
}
