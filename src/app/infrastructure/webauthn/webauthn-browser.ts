import { Injectable } from '@angular/core';
import {
  AuthenticateCredential, AuthenticationOptions, RegisterCredential, RegistrationOptions,
} from '../../domain/models/webauthn.model';

/**
 * A ponte entre o que a API manda (base64url) e o que o navegador pede
 * (`ArrayBuffer`), nas duas direções. Funções puras: testáveis sem navegador.
 */

export function toBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return bytes.buffer;
}

export function toBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  new Uint8Array(buffer).forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * O pedido de cadastro. `platform` pede o leitor do PRÓPRIO aparelho (digital,
 * Face ID, Windows Hello), e não uma chave USB; `userVerification: required` é
 * o que obriga a digital (ou o PIN) em vez de um simples toque.
 */
export function creationOptions(o: RegistrationOptions): PublicKeyCredentialCreationOptions {
  return {
    challenge: toBuffer(o.challenge),
    rp: { id: o.rpId, name: o.rpName },
    user: { id: toBuffer(o.userId), name: o.userName, displayName: o.userDisplayName },
    // ES256 (-7) é o dos celulares e do Windows Hello; RS256 (-257) cobre leitores antigos.
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    excludeCredentials: o.excludeCredentialIds.map(id => ({ type: 'public-key' as const, id: toBuffer(id) })),
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    attestation: 'none',
    timeout: o.timeoutMs,
  };
}

/** O pedido de login: só a credencial que ESTE aparelho guardou no cadastro. */
export function requestOptions(o: AuthenticationOptions, credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge: toBuffer(o.challenge),
    rpId: o.rpId,
    allowCredentials: [{ type: 'public-key', id: toBuffer(credentialId) }],
    userVerification: 'required',
    timeout: o.timeoutMs,
  };
}

export function registrationPayload(challengeId: string, credential: PublicKeyCredential): RegisterCredential {
  const response = credential.response as AuthenticatorAttestationResponse;
  const transports = typeof response.getTransports === 'function' ? response.getTransports() : null;
  return {
    challengeId,
    clientDataJSON: toBase64Url(response.clientDataJSON),
    attestationObject: toBase64Url(response.attestationObject),
    transports: transports && transports.length ? transports : null,
  };
}

export function assertionPayload(challengeId: string, credential: PublicKeyCredential): AuthenticateCredential {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    challengeId,
    credentialId: toBase64Url(credential.rawId),
    clientDataJSON: toBase64Url(response.clientDataJSON),
    authenticatorData: toBase64Url(response.authenticatorData),
    signature: toBase64Url(response.signature),
    userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
  };
}

/** iPhone e iPad (o iPad novo se apresenta como Mac, mas tem toque). */
export function isAppleMobile(userAgent = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Como a tela chama a biometria. Decisão dele (2026-09-30): "digital" no
 * Android e no computador; no iPhone o nome que a pessoa conhece é Face ID.
 * As formas com artigo existem porque "pela digital" e "pelo Face ID" não se
 * montam juntando palavras.
 */
export interface BiometricWords {
  name: string;
  /** "a digital" / "o Face ID" */
  withArticle: string;
  /** "pela digital" / "pelo Face ID" */
  through: string;
}

export function biometricWords(appleMobile = isAppleMobile()): BiometricWords {
  return appleMobile
    ? { name: 'Face ID', withArticle: 'o Face ID', through: 'pelo Face ID' }
    : { name: 'digital', withArticle: 'a digital', through: 'pela digital' };
}

/**
 * O acesso ao leitor do aparelho, atrás de uma classe: o teste troca por uma
 * falsa. O Karma não tem leitor de digital, e o `navigator.credentials` de
 * verdade abriria uma janela do sistema no meio da suíte.
 */
@Injectable({ providedIn: 'root' })
export class BrowserCredentials {

  /** Tem leitor que confirma quem é (digital, rosto ou PIN do aparelho)? Nunca lança. */
  async available(): Promise<boolean> {
    try {
      return typeof PublicKeyCredential !== 'undefined'
        && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  create(options: PublicKeyCredentialCreationOptions): Promise<Credential | null> {
    return navigator.credentials.create({ publicKey: options });
  }

  get(options: PublicKeyCredentialRequestOptions): Promise<Credential | null> {
    return navigator.credentials.get({ publicKey: options });
  }
}
