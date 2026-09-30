/**
 * Entrar com a digital (WebAuthn). Os binários viajam em base64url; quem
 * converte para `ArrayBuffer` é `infrastructure/webauthn/webauthn-browser.ts`.
 */

export interface RegistrationOptions {
  challengeId: string;
  challenge: string;
  rpId: string;
  rpName: string;
  /** O "user handle": o id interno da pessoa, nunca login ou e-mail. */
  userId: string;
  userName: string;
  userDisplayName: string;
  excludeCredentialIds: string[];
  timeoutMs: number;
}

export interface RegisterCredential {
  challengeId: string;
  clientDataJSON: string;
  attestationObject: string;
  transports: string[] | null;
}

export interface AuthenticationOptions {
  challengeId: string;
  challenge: string;
  rpId: string;
  timeoutMs: number;
}

export interface AuthenticateCredential {
  challengeId: string;
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
  userHandle: string | null;
}

/** Um aparelho com a digital ativada, como o Perfil e o RH mostram. */
export interface WebAuthnDevice {
  id: string;
  /** Público: é com ele que a tela marca "Você está nele". */
  credentialId: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string | null;
}
