import {
  assertionPayload, biometricWords, creationOptions, isAppleMobile, registrationPayload, requestOptions, toBase64Url, toBuffer,
} from './webauthn-browser';
import { activatedText, isMobileLabel, lastUseText } from './device-texts';

const bytes = (...b: number[]) => new Uint8Array(b).buffer;

/** A ponte base64url ↔ ArrayBuffer e os pedidos que vão ao leitor do aparelho. */
describe('webauthn-browser', () => {

  it('base64url vai e volta sem perder byte, inclusive os que viram "-" e "_"', () => {
    const original = bytes(0xfb, 0xff, 0xbf, 0x00, 0x01);
    expect(toBase64Url(original)).toBe('-_-_AAE');
    expect(new Uint8Array(toBuffer('-_-_AAE'))).toEqual(new Uint8Array(original));
  });

  it('o cadastro pede o leitor do PRÓPRIO aparelho e exige a digital', () => {
    const o = creationOptions({
      challengeId: 'c1', challenge: 'AQID', rpId: 'proautokimium.com.br', rpName: 'KimiumHub',
      userId: 'dS0x', userName: 'diego', userDisplayName: 'Diego Martins', excludeCredentialIds: ['BAU'], timeoutMs: 300000,
    });

    expect(o.authenticatorSelection).toEqual({ authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' });
    expect(o.attestation).toBe('none');
    expect(o.pubKeyCredParams.map(p => p.alg)).toEqual([-7, -257]);
    expect(o.rp).toEqual({ id: 'proautokimium.com.br', name: 'KimiumHub' });
    expect(new Uint8Array(o.challenge as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(o.excludeCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([4, 5]));
    expect(o.timeout).toBe(300000);
  });

  it('o login só aceita a credencial que ESTE aparelho guardou, e exige a digital', () => {
    const o = requestOptions({ challengeId: 'c1', challenge: 'AQID', rpId: 'localhost', timeoutMs: 1 }, 'BAU');

    expect(o.userVerification).toBe('required');
    expect(o.allowCredentials!.length).toBe(1);
    expect(new Uint8Array(o.allowCredentials![0].id as ArrayBuffer)).toEqual(new Uint8Array([4, 5]));
  });

  it('a resposta do aparelho vira o que a API espera, em base64url', () => {
    const reg = registrationPayload('c1', {
      rawId: bytes(9),
      response: { clientDataJSON: bytes(1), attestationObject: bytes(2), getTransports: () => ['internal'] },
    } as unknown as PublicKeyCredential);
    expect(reg).toEqual({ challengeId: 'c1', clientDataJSON: 'AQ', attestationObject: 'Ag', transports: ['internal'] });

    const login = assertionPayload('c2', {
      rawId: bytes(9),
      response: { clientDataJSON: bytes(1), authenticatorData: bytes(2), signature: bytes(3), userHandle: null },
    } as unknown as PublicKeyCredential);
    expect(login).toEqual({ challengeId: 'c2', credentialId: 'CQ', clientDataJSON: 'AQ', authenticatorData: 'Ag', signature: 'Aw', userHandle: null });
  });

  it('"digital" no Android e no computador; "Face ID" no iPhone e no iPad', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBeTrue();
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).withContext('iPad que se diz Mac').toBeTrue();
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).withContext('Mac de verdade').toBeFalse();
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 14)', 5)).toBeFalse();

    expect(biometricWords(false)).toEqual({ name: 'digital', withArticle: 'a digital', through: 'pela digital' });
    expect(biometricWords(true)).toEqual({ name: 'Face ID', withArticle: 'o Face ID', through: 'pelo Face ID' });
  });
});

describe('device-texts', () => {
  const agora = new Date(2026, 8, 30, 15, 0);

  it('último uso: hoje com hora, ontem com hora, depois em dias', () => {
    expect(lastUseText(new Date(2026, 8, 30, 8, 12).toISOString(), agora)).toBe('usado hoje, 08:12');
    expect(lastUseText(new Date(2026, 8, 29, 17, 40).toISOString(), agora)).toBe('usado ontem, 17:40');
    expect(lastUseText(new Date(2026, 8, 25, 9, 0).toISOString(), agora)).toBe('usado há 5 dias');
    expect(lastUseText(null, agora)).toBe('ainda não usado');
  });

  it('ativado em dd/mm/aaaa, e o ícone de celular só para celular', () => {
    expect(activatedText(new Date(2026, 8, 12, 10, 0).toISOString())).toBe('Ativado em 12/09/2026');
    expect(isMobileLabel('Android · Chrome')).toBeTrue();
    expect(isMobileLabel('iPhone · Safari')).toBeTrue();
    expect(isMobileLabel('Windows · Edge')).toBeFalse();
  });
});
