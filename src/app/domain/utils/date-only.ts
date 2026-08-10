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
