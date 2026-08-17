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
