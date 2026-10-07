/**
 * Fila de e-mails e Remetentes — espelha os DTOs de `/api/dev/email-queue` e
 * `/api/dev/email-senders` (contrato de 2026-10-07).
 *
 * Nesta fase não existe "entregue": "Enviado" é o servidor SMTP ter aceitado o
 * e-mail. A confirmação de entrega fica para depois.
 */

export type EmailStatus = 'PENDING' | 'SCHEDULED' | 'SENT' | 'FAILED';
/** O filtro da lista aceita também `QUEUE` (= PENDING + SCHEDULED). */
export type EmailStatusFilter = EmailStatus | 'QUEUE' | null;

export type EmailOrigin =
  | 'FIRST_ACCESS' | 'PASSWORD_RESET' | 'CLIENT_INVITE' | 'TALENT_BANK' | 'RECRUITMENT' | 'CHECKLIST'
  | 'MACHINE_ALERT' | 'DOCUMENT_ALERT' | 'REIMBURSEMENT_REPORT' | 'NEWSLETTER' | 'MANUAL';

export type FailureKind = 'TIMEOUT' | 'MAILBOX_NOT_FOUND' | 'AUTH' | 'INVALID_ADDRESS' | 'MAILBOX_FULL' | 'OTHER';

export type PeriodDays = 1 | 7 | 30;

export interface EmailRow {
  id: string;
  to: string;
  subject: string;
  /** null nos e-mails de antes da mudança. */
  origin: EmailOrigin | null;
  originLabel: string | null;
  /** Texto: valores antigos (`ERROR`, `RETRYING`, `CANCELED`) ainda podem chegar. */
  status: string;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  failureKind: FailureKind | null;
  failureLabel: string | null;
  hasAttachments: boolean;
  /** A API decide: só o que falhou, e nunca e-mail com código de acesso (o código já não vale). */
  resendable: boolean;
}

export interface EmailPage {
  total: number;
  items: EmailRow[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface EmailDetail extends EmailRow {
  from: string;
  fromName: string | null;
  replyTo: string | null;
  body: string | null;
  /** Primeiro acesso, senha, convite, banco de talentos: o corpo dá acesso a uma conta. */
  bodyHidden: boolean;
  attachments: EmailAttachment[];
}

export interface PerDay {
  date: string;
  sent: number;
  failed: number;
  retried: number;
}

export interface FailureReason {
  kind: FailureKind;
  label: string;
  count: number;
  sample: string | null;
}

export interface OriginCount {
  origin: EmailOrigin | null;
  label: string | null;
  total: number;
  failed: number;
}

export interface EmailSummary {
  days: number;
  failed: number;
  queued: number;
  oldestQueuedAt: string | null;
  sent: number;
  /** null quando o período não tem nenhum envio concluído. */
  successRate: number | null;
  retried: number;
  avgAttempts: number;
  lastActivityAt: string | null;
  perDay: PerDay[];
  reasons: FailureReason[];
  origins: OriginCount[];
}

export interface EmailListQuery {
  status: EmailStatusFilter;
  origin: EmailOrigin | null;
  days: PeriodDays;
  q: string;
  page: number;
  size: number;
}

// ── Remetentes ──

export interface Sender {
  id: string;
  name: string;
  address: string;
  displayName: string;
  active: boolean;
  isDefault: boolean;
  usedBy: EmailOrigin[];
}

export interface SenderRoute {
  origin: EmailOrigin;
  label: string;
  hint: string | null;
  /** null = usa o remetente padrão. */
  senderId: string | null;
  /** null = ninguém (não responder). */
  replyToId: string | null;
  last30Days: number;
}

export const SENDER_DOMAIN = '@envios.proautokimium.com.br';
export const MAX_ATTEMPTS = 5;

// ── Rótulos ──

export const ORIGIN_LABELS: Record<string, string> = {
  FIRST_ACCESS: 'Primeiro acesso',
  PASSWORD_RESET: 'Redefinição de senha',
  CLIENT_INVITE: 'Convite da Área do Cliente',
  TALENT_BANK: 'Banco de talentos',
  RECRUITMENT: 'Candidaturas',
  CHECKLIST: 'Checklist de vendas',
  MACHINE_ALERT: 'Alertas de máquinas',
  DOCUMENT_ALERT: 'Vencimento de documentos',
  REIMBURSEMENT_REPORT: 'Relatório de reembolsos',
  NEWSLETTER: 'Newsletter',
  MANUAL: 'Envio manual',
};

export const ORIGIN_ORDER = Object.keys(ORIGIN_LABELS) as EmailOrigin[];

export interface StatusInfo { label: string; chip: string; icon: string }

export const EMAIL_STATUS_INFO: Record<string, StatusInfo> = {
  PENDING:   { label: 'Na fila',  chip: 'warning', icon: 'pi pi-clock' },
  SCHEDULED: { label: 'Agendado', chip: 'info',    icon: 'pi pi-calendar' },
  SENT:      { label: 'Enviado',  chip: 'success', icon: 'pi pi-check' },
  FAILED:    { label: 'Falhou',   chip: 'danger',  icon: 'pi pi-times-circle' },
};

export const PERIOD_OPTIONS: { label: string; value: PeriodDays }[] = [
  { label: 'Hoje', value: 1 },
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
];

/** Erro de endereço: reenviar sem corrigir o cadastro falha de novo. */
const ADDRESS_FAILURES = new Set<string>(['MAILBOX_NOT_FOUND', 'INVALID_ADDRESS']);

// ── Funções puras ──

/** Status conhecido vira rótulo e cor; status antigo aparece cru, em cor neutra. */
export function statusInfo(status: string | null | undefined): StatusInfo {
  return (status && EMAIL_STATUS_INFO[status]) || { label: status || '—', chip: 'neutral', icon: 'pi pi-question-circle' };
}

export function originLabel(origin: string | null | undefined, apiLabel?: string | null): string {
  if (!origin) return 'Sem origem';
  return apiLabel || ORIGIN_LABELS[origin] || origin;
}

export function isFailed(row: { status: string }): boolean {
  return row.status === 'FAILED';
}

/** Pode voltar para a fila: a regra é da API (`resendable`); o status confere a linha recém-alterada. */
export function canBeResent(row: { status: string; resendable?: boolean }): boolean {
  return row.status === 'FAILED' && row.resendable !== false;
}

export function isAddressFailure(kind: string | null | undefined): boolean {
  return !!kind && ADDRESS_FAILURES.has(kind);
}

/** As cinco bolinhas das tentativas: quantas acesas e em que tom. */
export function attemptDots(attempts: number): { on: boolean }[] {
  const n = Math.max(0, Math.min(MAX_ATTEMPTS, attempts || 0));
  return Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({ on: i < n }));
}

export function attemptsTone(status: string): 'dead' | 'ok' | '' {
  return status === 'FAILED' ? 'dead' : status === 'SENT' ? 'ok' : '';
}

/** Minutos entre o e-mail mais antigo da fila e agora. */
export function minutesWaiting(oldestIso: string | null, now: Date = new Date()): number | null {
  const d = parseLocal(oldestIso);
  if (!d) return null;
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
}

/** "HH:mm" de um LocalDateTime, lido por partes (sem fuso para errar). */
export function timeOf(iso: string | null | undefined): string | null {
  const m = iso ? /[T ](\d{2}):(\d{2})/.exec(iso) : null;
  return m ? `${m[1]}:${m[2]}` : null;
}

export function activityText(lastActivityAt: string | null | undefined): string {
  const t = timeOf(lastActivityAt);
  return t ? `última atividade às ${t}` : 'nenhuma atividade no período';
}

/** Número em pt-BR: 98,6 · 1,04. */
export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return (value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

// ── Gráfico ──

export interface ChartBar {
  date: string;
  label: string;
  x: number;
  width: number;
  /** Topo e altura de cada camada, em unidades do viewBox. */
  sentY: number; sentH: number;
  failedY: number; failedH: number;
  retriedY: number; retriedH: number;
  showLabel: boolean;
  title: string;
}

export interface ChartModel {
  width: number;
  height: number;
  /** Linhas de grade: 0, metade e topo. */
  ticks: { value: number; y: number }[];
  bars: ChartBar[];
  plotLeft: number;
  baseline: number;
}

/**
 * Barras empilhadas do "Envios por dia": verde (enviados) embaixo, vermelho
 * (falharam) em cima, e os que precisaram insistir por cima do verde — eles
 * são parte dos enviados, não um terceiro grupo.
 */
export function buildChart(perDay: PerDay[], width = 560, height = 180): ChartModel {
  const pl = 28, pb = 22, pt = 8;
  const baseline = height - pb;
  const maxVal = Math.max(5, ...perDay.map(d => d.sent + d.failed));
  const top = Math.ceil(maxVal / 10) * 10;
  const y = (v: number) => baseline - (v / top) * (baseline - pt);
  const bw = perDay.length ? (width - pl - 6) / perDay.length : 0;
  const every = perDay.length > 14 ? 5 : perDay.length > 7 ? 2 : 1;
  const bars = perDay.map((d, i) => {
    const retried = Math.min(d.retried, d.sent);
    const label = dayMonth(d.date);
    return {
      date: d.date,
      label,
      x: pl + i * bw + bw * 0.18,
      width: bw * 0.64,
      sentY: y(d.sent), sentH: baseline - y(d.sent),
      failedY: y(d.sent + d.failed), failedH: y(d.sent) - y(d.sent + d.failed),
      retriedY: y(retried), retriedH: baseline - y(retried),
      showLabel: i % every === 0 || i === perDay.length - 1,
      title: `${label}: ${d.sent} enviado(s), ${d.failed} falharam, ${d.retried} precisaram insistir`,
    };
  });
  return {
    width, height, plotLeft: pl, baseline, bars,
    ticks: [0, top / 2, top].map(value => ({ value, y: y(value) })),
  };
}

/** "2026-10-01" → "01/10". */
export function dayMonth(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}/${m[2]}` : date;
}

export function barPercent(n: number, max: number): number {
  return max > 0 ? Math.round((n / max) * 100) : 0;
}

// ── Lista ──

export interface StatusChip {
  key: EmailStatus | null;
  label: string;
  count: number | null;
}

/**
 * Os chips de situação com contagem. A API não manda contagem por status para
 * a lista, então os números vêm do resumo do mesmo período: falharam, enviados
 * e "na fila" (PENDING + SCHEDULED juntos — o resumo não separa os dois).
 */
export function statusChips(summary: EmailSummary | null): StatusChip[] {
  const s = summary;
  return [
    { key: null, label: 'Todos', count: s ? s.failed + s.queued + s.sent : null },
    { key: 'FAILED', label: 'Falhou', count: s ? s.failed : null },
    { key: 'PENDING', label: 'Na fila', count: null },
    { key: 'SCHEDULED', label: 'Agendado', count: null },
    { key: 'SENT', label: 'Enviado', count: s ? s.sent : null },
  ];
}

/**
 * O filtro por motivo de erro roda NA TELA, sobre a página já carregada: a
 * API da lista não tem parâmetro `failureKind`. Com `status=FAILED` e uma
 * página de 200, cobre os casos reais; se o total passar disso, a tela avisa.
 */
export function filterByFailure(rows: EmailRow[], kind: FailureKind | null): EmailRow[] {
  return kind ? rows.filter(r => r.failureKind === kind) : rows;
}

/** Só os reenviáveis entram na seleção: os outros nem têm caixinha. */
export function selectableIds(rows: EmailRow[]): string[] {
  return rows.filter(canBeResent).map(r => r.id);
}

/** A seleção só guarda ids que ainda estão FAILED entre as linhas carregadas. */
export function onlyFailedSelection(selected: Iterable<string>, rows: EmailRow[]): string[] {
  const failed = new Set(selectableIds(rows));
  return [...selected].filter(id => failed.has(id));
}

/** Coluna "Último erro ou envio". */
export function lastEventText(row: EmailRow): string {
  if (row.status === 'SENT') return row.sentAt ? `enviado ${shortStamp(row.sentAt)}` : 'enviado';
  if (row.failureLabel || row.lastError) return row.failureLabel || row.lastError || '';
  if (row.status === 'SCHEDULED') return 'aguardando o horário';
  if (row.status === 'PENDING') return 'aguardando a próxima passada';
  return '—';
}

/** "07/10 14:22". */
export function shortStamp(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso) : null;
  return m ? `${m[3]}/${m[2]} ${m[4]}:${m[5]}` : '—';
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatDecimal(bytes / 1024, 0)} KB`;
  return `${formatDecimal(bytes / (1024 * 1024), 1)} MB`;
}

// ── Remetentes ──

/** A mesma regra da API: só `a-z 0-9 . _ -` antes do @, e nome de exibição obrigatório. */
export function validateNewSender(name: string, displayName: string, existing: Sender[]): string | null {
  const n = name.trim().toLowerCase();
  if (!displayName.trim()) return 'Dê o nome que aparece para quem recebe.';
  if (!/^[a-z0-9._-]+$/.test(n)) return 'Use só letras minúsculas, números, ponto, hífen ou sublinhado antes do @.';
  if (existing.some(s => s.name === n)) return `${n}${SENDER_DOMAIN} já está cadastrado.`;
  return null;
}

/** Por que o Desativar está travado; null quando pode desativar. */
export function deactivateBlock(sender: Sender): string | null {
  if (sender.isDefault) return 'O padrão não se desativa: torne outro padrão antes.';
  if (sender.usedBy.length) return 'Troque os serviços dele antes de desativar.';
  return null;
}

export function usedByText(sender: Sender, routes: SenderRoute[]): string {
  if (!sender.usedBy.length) return 'Nenhum serviço usa este endereço.';
  const labels = sender.usedBy.map(o => routes.find(r => r.origin === o)?.label ?? ORIGIN_LABELS[o] ?? o);
  return `Usado por ${labels.length} serviço(s): ${labels.join(', ')}`;
}

export function senderOptionLabel(sender: Sender): string {
  return `${sender.displayName} <${sender.address}>${sender.active ? '' : ' (inativo)'}`;
}

/**
 * Remetentes que aparecem num select de rota: os ativos, mais o escolhido
 * hoje se ele estiver inativo (senão o select ficaria em branco, mentindo).
 */
export function senderChoices(senders: Sender[], currentId: string | null): Sender[] {
  return senders.filter(s => s.active || s.id === currentId);
}

function parseLocal(iso: string | null | undefined): Date | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso) : null;
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
}
