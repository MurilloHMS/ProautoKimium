import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WebAuthnDevice } from '../../../domain/models/webauthn.model';
import { AuthService } from '../auth.service';
import {
  BrowserCredentials, BiometricWords, assertionPayload, biometricWords, creationOptions, registrationPayload, requestOptions,
} from '../../webauthn/webauthn-browser';
import { WebAuthnApiService } from './webauthn-api.service';

/** O aparelho lembra quem ativou a digital nele — é o que a tela de login mostra. */
export interface RememberedDevice {
  credentialId: string;
  login: string;
  name: string;
}

export type BiometricFailure = 'cancelled' | 'rejected' | 'blocked' | 'already' | 'failed';

/** Uma recusa com a frase que a tela mostra. */
export class BiometricError extends Error {
  constructor(readonly kind: BiometricFailure, message: string) {
    super(message);
  }
}

const DEVICE_KEY = 'pk-digital';
const DECLINED_PREFIX = 'pk-digital-recusado:';
const INVITE_KEY = 'pk-digital-convite';

/**
 * Entrar com a digital, do lado do site.
 *
 * O que fica no aparelho é só o id público da credencial e o nome de quem a
 * ativou. A chave privada nunca sai do leitor, e a digital nunca sai do
 * aparelho — o site só pede "confirme" e recebe uma assinatura.
 *
 * Tudo o que vai para o `localStorage` passa por try/catch: em janela anônima
 * ou com o armazenamento bloqueado ele lança, e a falta dele só desliga o
 * atalho — a senha continua funcionando.
 */
@Injectable({ providedIn: 'root' })
export class BiometricLoginService {

  private readonly api = inject(WebAuthnApiService);
  private readonly browser = inject(BrowserCredentials);
  private readonly auth = inject(AuthService);

  readonly words: BiometricWords = biometricWords();

  available(): Promise<boolean> {
    return this.browser.available();
  }

  // ── O que o aparelho lembra ──────────────────────────────────────────────

  remembered(): RememberedDevice | null {
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      const device = raw ? JSON.parse(raw) as RememberedDevice : null;
      return device?.credentialId && device.login ? device : null;
    } catch {
      return null;
    }
  }

  forget(): void {
    try { localStorage.removeItem(DEVICE_KEY); } catch { /* sem armazenamento, nada a esquecer */ }
  }

  /** "Não perguntar de novo" vale para esta pessoa, neste aparelho. */
  declined(login: string): boolean {
    try { return localStorage.getItem(DECLINED_PREFIX + login) === '1'; } catch { return false; }
  }

  decline(login: string): void {
    try { localStorage.setItem(DECLINED_PREFIX + login, '1'); } catch { /* ignora */ }
  }

  /**
   * Quem acabou de entrar COM A SENHA. O convite aparece uma vez, depois disso,
   * dentro do sistema — o login só marca, e o layout pergunta.
   */
  markInvite(login: string): void {
    try { sessionStorage.setItem(INVITE_KEY, login); } catch { /* ignora */ }
  }

  takeInvite(): string | null {
    try {
      const login = sessionStorage.getItem(INVITE_KEY);
      sessionStorage.removeItem(INVITE_KEY);
      return login;
    } catch {
      return null;
    }
  }

  // ── As duas cerimônias ───────────────────────────────────────────────────

  /** Ativa a digital neste aparelho para quem está logado. */
  async enable(): Promise<WebAuthnDevice> {
    const options = await firstValueFrom(this.api.registrationOptions());
    let credential: Credential | null;
    try {
      credential = await this.browser.create(creationOptions(options));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'InvalidStateError') {
        throw new BiometricError('already', `${capitalize(this.words.withArticle)} deste aparelho já está ativad${this.words.name === 'digital' ? 'a' : 'o'}.`);
      }
      throw new BiometricError('cancelled', `${capitalize(this.words.withArticle)} não foi confirmad${this.words.name === 'digital' ? 'a' : 'o'}. Tente de novo quando quiser.`);
    }
    if (!credential) {
      throw new BiometricError('cancelled', 'Nada foi ativado. Tente de novo quando quiser.');
    }
    try {
      const device = await firstValueFrom(this.api.register(registrationPayload(options.challengeId, credential as PublicKeyCredential)));
      this.remember({ credentialId: device.credentialId, login: options.userName, name: options.userDisplayName });
      return device;
    } catch (e) {
      throw new BiometricError('failed', apiMessage(e) ?? `Não foi possível ativar ${this.words.withArticle} neste aparelho. Tente de novo.`);
    }
  }

  /** Entra com a digital lembrada neste aparelho e grava a sessão, como o login com senha. */
  async signIn(): Promise<void> {
    const device = this.remembered();
    const rejected = `Não deu para confirmar ${this.words.through}. Tente de novo, ou entre com a senha.`;
    if (!device) throw new BiometricError('rejected', rejected);

    let credential: Credential | null;
    try {
      const options = await firstValueFrom(this.api.authenticationOptions());
      credential = await this.browser.get(requestOptions(options, device.credentialId));
      if (!credential) throw new BiometricError('cancelled', rejected);
      const session = await firstValueFrom(this.api.authenticate(assertionPayload(options.challengeId, credential as PublicKeyCredential)));
      this.auth.logout();
      this.auth.guardarSessao(session);
    } catch (e) {
      if (e instanceof BiometricError) throw e;
      // Conta bloqueada: a API diz o motivo, e ele vale mais que a frase genérica.
      if (e instanceof HttpErrorResponse && e.status === 403) {
        throw new BiometricError('blocked', apiMessage(e) ?? 'Acesso bloqueado. Entre em contato com o RH.');
      }
      throw new BiometricError(e instanceof DOMException ? 'cancelled' : 'rejected', rejected);
    }
  }

  private remember(device: RememberedDevice): void {
    try { localStorage.setItem(DEVICE_KEY, JSON.stringify(device)); } catch { /* o atalho só não fica lembrado */ }
  }
}

function apiMessage(e: unknown): string | null {
  return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
