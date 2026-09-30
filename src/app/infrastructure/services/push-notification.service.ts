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
export type PushStatus = 'unsupported' | 'denied' | 'enabled' | 'available';

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

  /**
   * O que dá para fazer com as notificações NESTE aparelho:
   * - `unsupported`: sem push aqui (dev sem service worker; iPhone fora do app
   *   instalado — o iOS só tem push com o app na tela de início);
   * - `denied`: a pessoa bloqueou, e o navegador não deixa o site perguntar de novo;
   * - `enabled`: já recebe;
   * - `available`: ainda não ativou, e dá para ativar com um toque.
   */
  async status(): Promise<PushStatus> {
    if (!this.swPush.isEnabled || typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted' && await this.isSubscribed()) return 'enabled';
    return 'available';
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
