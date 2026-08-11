/**
 * Conversão entre a data "sem hora" da API e o `Date` que o datepicker usa.
 *
 * A API manda `LocalDate` como `"1990-05-20"`. O `p-datepicker` só entende
 * `Date`, então uma string chega ao campo e ele renderiza vazio — o dado está
 * no formulário, o componente é que não sabe mostrar.
 *
 * O cuidado que parece bobo e não é: `new Date('1990-05-20')` é interpretado
 * como meia-noite **UTC**. No Brasil (UTC-3) isso vira 19/05 às 21h, e o campo
 * mostra o dia anterior. Por isso montamos a data pelos componentes, que o
 * construtor trata como hora local.
 */
export function parseDateOnly(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Formata uma data-only para exibição (`dd/MM/yyyy`).
 *
 * Substitui o `new Date(iso).toLocaleDateString('pt-BR')` que estava copiado
 * em nove telas: com `"2026-08-10"` aquilo é lido como meia-noite UTC e a tela
 * mostra **09/08**. Três telas já tinham contornado com `iso + 'T00:00:00'`,
 * cada uma por conta própria — sinal de que o lugar certo era um só.
 *
 * Só para campo `LocalDate`. Para `LocalDateTime` (que vem com hora e é lido
 * como horário local) o `new Date(iso)` já está correto.
 */
export function formatDateBr(value: Date | string | null | undefined): string {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
}

/**
 * Formata um `LocalDateTime` da API (`"2026-08-11T14:32:10"`) para exibição.
 *
 * Lê a string por partes de propósito. `new Date(iso)` funcionaria — sem fuso
 * na string, o padrão manda ler como hora local — mas essa regra é o oposto da
 * data-only logo acima, e trocar as duas é o erro que já custou caro aqui.
 * Fatiar texto não tem fuso nenhum para errar.
 *
 * @param short `11/08/26 14:32` em vez de `11/08/2026 14:32`, para caber em célula.
 */
export function formatStampBr(value: string | null | undefined, short = false): string {
  if (!value) return '—';

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
  if (!match) return '—';

  const [, year, month, day, hour, minute] = match;
  return `${day}/${month}/${short ? year.slice(2) : year} ${hour}:${minute}`;
}

/**
 * Formata para `yyyy-MM-dd` usando o fuso local.
 *
 * `toISOString()` converte para UTC antes de cortar a string: dependendo do
 * fuso, 20/05 local vira 19/05 na ida. Aqui o que o usuário escolheu é o que
 * a API recebe.
 */
export function formatDateOnly(value: Date | string | null | undefined): string | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}
