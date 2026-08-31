import { environment } from '../../../environments/environment';

/**
 * A base dos arquivos: o `apiUrl` sem o `/api` final.
 *
 * Os arquivos são servidos **fora** do `/api` — o `StaticResourceConfig` do
 * backend registra `/upload/images/**` na raiz do host, não sob a API.
 *
 * Em desenvolvimento o `apiUrl` é `/api`, então a base fica vazia e o caminho
 * continua relativo, que é o que o `proxy.conf.json` precisa. Em produção vira
 * `https://api.proautokimium.com`.
 */
const BASE_DE_MIDIA = environment.apiUrl.replace(/\/api\/?$/, '');

/**
 * Monta o endereço a partir de uma base explícita.
 *
 * Existe separado de `urlDeMidia` para poder ser testado com a base de
 * PRODUÇÃO. A suíte roda com o ambiente de desenvolvimento, onde a base é
 * vazia — e o defeito que esta função conserta só aparece quando ela não é.
 * Sem esta separação, o teste passaria verde afirmando exatamente o cenário em
 * que o bug não acontece.
 */
export function urlDeMidiaCom(
  base: string,
  caminho: string | null | undefined,
  reserva = 'images/products/placeholder.png',
): string {
  const valor = caminho?.trim();
  if (!valor) return reserva;

  // Imagem hospedada fora (galeria externa, avatar de terceiro) já vem pronta.
  if (/^https?:\/\//i.test(valor)) return valor;

  // `data:` e `blob:` são pré-visualização de upload, ainda na memória do
  // navegador. Prefixar host aqui quebraria a imagem que a pessoa acabou de
  // escolher — e quebraria só na conferência antes de salvar.
  if (/^(data|blob):/i.test(valor)) return valor;

  const relativo = valor.startsWith('/') ? valor : `/${valor}`;
  return `${base}${relativo}`;
}

/**
 * O endereço absoluto de um arquivo servido pela API.
 *
 * **O bug que isto conserta.** A API grava o caminho como
 * `/upload/images/2822-....png` e devolve essa string no DTO. As telas jogavam
 * isso direto no `[src]`, e um caminho que começa com `/` o navegador resolve
 * contra a **origem da página** — não contra a da API.
 *
 * Em desenvolvimento funcionava por acidente: o `proxy.conf.json` encaminha
 * `/upload` para o backend, então site e API são o mesmo host. Em produção não
 * são — o site é `proautokimium.com.br` e os arquivos estão em
 * `api.proautokimium.com`. Toda foto ia buscar no domínio errado e voltava 404,
 * e o `onerror` do `<img>` trocava pelo placeholder: a tela parecia certa e só
 * o console reclamava.
 *
 * @param caminho o que veio da API — pode ser nulo, relativo ou absoluto
 * @param reserva o que usar quando não há imagem
 */
export function urlDeMidia(
  caminho: string | null | undefined,
  reserva = 'images/products/placeholder.png',
): string {
  return urlDeMidiaCom(BASE_DE_MIDIA, caminho, reserva);
}
