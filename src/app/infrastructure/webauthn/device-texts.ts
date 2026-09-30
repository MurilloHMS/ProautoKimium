/**
 * Os textos de um aparelho com a digital, iguais no Perfil e no cadastro do
 * funcionário. Funções puras, com o "agora" de fora: o teste fixa a data.
 */

/** Celular ou tablet (o ícone muda), pelo rótulo que a API montou do User-Agent. */
export function isMobileLabel(label: string): boolean {
  return /^(Android|iPhone|iPad)\b/.test(label);
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ddmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function activatedText(iso: string): string {
  return `Ativado em ${ddmmyyyy(new Date(iso))}`;
}

/** "usado hoje, 08:12", "usado ontem, 17:40", "usado há 5 dias", ou "ainda não usado". */
export function lastUseText(iso: string | null, now = new Date()): string {
  if (!iso) return 'ainda não usado';
  const used = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(used)) / 86_400_000);
  if (days <= 0) return `usado hoje, ${hhmm(used)}`;
  if (days === 1) return `usado ontem, ${hhmm(used)}`;
  return `usado há ${days} dias`;
}
