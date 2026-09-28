import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensagem que a API mandou, quando ela mandou uma.
 *
 * O `GlobalExceptionHandler` responde `ErrorResponse` em JSON, mas as chamadas
 * de autenticação pedem `responseType: 'text'` — o sucesso delas é uma frase
 * solta, não um objeto. Com isso o corpo de erro também chega como string, e
 * quem quiser a mensagem precisa desembrulhar os dois formatos.
 *
 * Serve para regra de negócio recusada, onde o servidor sabe explicar melhor
 * que a tela: senha fraca, e-mail já em uso, cliente inativo. Para falha
 * inesperada continua valendo o texto da tela — "Erro interno no servidor" não
 * ajuda ninguém.
 */
export function apiMessage(err: HttpErrorResponse): string | null {
  const body = err?.error;
  if (!body) return null;

  if (typeof body === 'object') {
    return typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : null;
  }

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      return typeof parsed?.message === 'string' ? parsed.message : body;
    } catch {
      // Resposta em texto puro: os endpoints antigos respondem assim.
      return body;
    }
  }

  return null;
}

/**
 * {@link apiMessage} para pedido de arquivo, que devolve o erro como **Blob**.
 *
 * Com `responseType: 'blob'`, o corpo do 400/404 também chega como Blob — e
 * Blob é `object` sem `.message`, então `apiMessage` devolveria `null` e a tela
 * cairia no texto genérico mesmo com a API explicando ("O período pode ter no
 * máximo um ano"). Por isso é assíncrona: o Blob precisa ser lido antes.
 *
 * 5xx nunca mostra o corpo: é falha técnica, e o texto da API é genérico de
 * propósito (o detalhe fica no log).
 */
export async function apiMessageOrFallback(err: unknown, fallback: string): Promise<string> {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return 'Sem conexão com o servidor. Tente de novo.';
  if (err.status >= 500) return fallback;

  let readable = err;
  if (err.error instanceof Blob) {
    const text = await err.error.text();
    readable = new HttpErrorResponse({ error: text, status: err.status, statusText: err.statusText, url: err.url ?? undefined });
  }
  return apiMessage(readable) ?? fallback;
}
