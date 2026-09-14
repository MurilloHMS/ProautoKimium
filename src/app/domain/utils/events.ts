// ═══════════════════════════════════════════════════════════════════════════
// Eventos — as regras da tela que não dependem de Angular
//
// Tudo em "horário de São Paulo" como texto (AAAA-MM-DD e HH:mm). O "agora" vem
// de `nowInSaoPaulo`, e não de `new Date()` direto: o computador de quem abre
// pode estar noutro fuso, e a palestra das 14h é às 14h em Maringá.
// ═══════════════════════════════════════════════════════════════════════════

import { EventDetail, EventSummary, EventTalk, Speaker } from '../models/events.model';
import { formatAddress } from './address';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** "Agora" em São Paulo, separado em data e hora de parede. */
export interface SaoPauloNow {
  date: string;   // 2026-09-23
  time: string;   // 14:20
}

export function nowInSaoPaulo(instante: Date = new Date()): SaoPauloNow {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instante);
  const v = (t: string) => partes.find(p => p.type === t)?.value ?? '00';
  return { date: `${v('year')}-${v('month')}-${v('day')}`, time: `${v('hour')}:${v('minute')}` };
}

/** Datas de "AAAA-MM-DD" como números, sem `Date` — evita o fuso por completo. */
function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

function somarDias(iso: string, dias: number): string {
  const [y, m, d] = partes(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  const [y1, m1, d1] = partes(de);
  const [y2, m2, d2] = partes(ate);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "14:00:00" → "14:00". */
export function hhmm(hora: string | null | undefined): string {
  return (hora ?? '').slice(0, 5);
}

/** Os dias do evento, do primeiro ao último, inclusive. De 22 a 25 são quatro. */
export function eventDays(inicio: string, fim: string): string[] {
  const total = diasEntre(inicio, fim);
  if (total < 0) return [];
  return Array.from({ length: total + 1 }, (_, i) => somarDias(inicio, i));
}

/**
 * A aba que abre: **hoje**, se hoje estiver no evento. Antes do evento, o
 * primeiro dia; depois, o último — é quando se consulta "o que teve".
 */
export function initialDay(dias: string[], hoje: string): string | null {
  if (!dias.length) return null;
  if (dias.includes(hoje)) return hoje;
  return hoje < dias[0] ? dias[0] : dias[dias.length - 1];
}

export type TalkStatus = 'passou' | 'agora' | 'a-seguir' | 'depois';

/**
 * Início inclusivo, fim exclusivo: às 15:30 a palestra de 14:00–15:30 já passou.
 * "A seguir" é só a primeira que ainda não começou **hoje** — marca o que vem,
 * e não tudo que falta.
 */
export function talkStatuses(talks: EventTalk[], agora: SaoPauloNow): Map<string, TalkStatus> {
  const resultado = new Map<string, TalkStatus>();
  let seguinteMarcada = false;

  const ordenadas = [...talks].sort((a, b) =>
    (a.date + hhmm(a.startTime)).localeCompare(b.date + hhmm(b.startTime)));

  for (const t of ordenadas) {
    const ini = hhmm(t.startTime);
    const fim = hhmm(t.endTime);
    let status: TalkStatus;

    if (t.date < agora.date) status = 'passou';
    else if (t.date > agora.date) status = 'depois';
    else if (agora.time >= fim) status = 'passou';
    else if (agora.time >= ini) status = 'agora';
    else if (!seguinteMarcada) { status = 'a-seguir'; seguinteMarcada = true; }
    else status = 'depois';

    resultado.set(t.id, status);
  }
  return resultado;
}

export type EventPhase = 'acontecendo' | 'proximo' | 'encerrado';

export function eventPhase(e: Pick<EventSummary, 'startDate' | 'endDate'>, hoje: string): EventPhase {
  if (hoje < e.startDate) return 'proximo';
  if (hoje > e.endDate) return 'encerrado';
  return 'acontecendo';
}

/** O chip do card: "Hoje", "Amanhã", "Em 8 dias", "Encerrado". */
export function phaseLabel(e: Pick<EventSummary, 'startDate' | 'endDate'>, hoje: string): string {
  const fase = eventPhase(e, hoje);
  if (fase === 'acontecendo') return 'Hoje';
  if (fase === 'encerrado') return 'Encerrado';
  const faltam = diasEntre(hoje, e.startDate);
  return faltam === 1 ? 'Amanhã' : `Em ${faltam} dias`;
}

/** "22 a 25 de setembro", "30 de setembro a 2 de outubro", "10 de novembro". */
export function formatPeriod(inicio: string, fim: string): string {
  const [y1, m1, d1] = partes(inicio);
  const [y2, m2, d2] = partes(fim);
  if (inicio === fim) return `${d1} de ${MESES[m1 - 1]}`;
  if (y1 === y2 && m1 === m2) return `${d1} a ${d2} de ${MESES[m2 - 1]}`;
  if (y1 === y2) return `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]}`;
  return `${d1}/${String(m1).padStart(2, '0')}/${y1} a ${d2}/${String(m2).padStart(2, '0')}/${y2}`;
}

/** A caixinha da capa: "22–25" e "set 2026". */
export function coverDateBox(inicio: string, fim: string): { dias: string; mes: string } {
  const [y1, m1, d1] = partes(inicio);
  const [, m2, d2] = partes(fim);
  const dias = inicio === fim ? `${d1}` : (m1 === m2 ? `${d1}–${d2}` : `${d1}/${m1}–${d2}/${m2}`);
  return { dias, mes: `${MESES_CURTOS[m1 - 1]} ${y1}` };
}

export function dayTab(iso: string): { semana: string; dia: number; rotulo: string } {
  const [y, m, d] = partes(iso);
  const semana = DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { semana, dia: d, rotulo: `${semana}, ${d} de ${MESES[m - 1]}` };
}

export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = partes(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [data, hora] = iso.split('T');
  const [, m, d] = partes(data);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} ${hhmm(hora)}`;
}

// ─── Redes ────────────────────────────────────────────────────────────────

export function instagramUrl(usuario: string | null | undefined): string | null {
  return usuario ? `https://www.instagram.com/${encodeURIComponent(usuario)}/` : null;
}

export function linkedinUrl(usuario: string | null | undefined): string | null {
  return usuario ? `https://www.linkedin.com/in/${encodeURIComponent(usuario)}/` : null;
}

/** Site digitado sem `https://` não pode virar link relativo dentro do app. */
export function websiteUrl(site: string | null | undefined): string | null {
  if (!site?.trim()) return null;
  const s = site.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function initials(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

// ─── Calendário ───────────────────────────────────────────────────────────

/**
 * Escapa texto do iCalendar (RFC 5545 §3.3.11): barra, ponto e vírgula,
 * vírgula e quebra de linha. Sem isso, "Painel: pH, diluição" corta a descrição
 * na primeira vírgula no Outlook.
 */
export function icsEscape(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Linhas de mais de 75 octetos são dobradas com CRLF + espaço (RFC 5545 §3.1). */
export function icsFold(linha: string): string {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;

  const pedacos: string[] = [];
  let atual = '';
  let tamanho = 0;
  for (const ch of linha) {
    const n = new TextEncoder().encode(ch).length;
    const limite = pedacos.length === 0 ? 75 : 74;
    if (tamanho + n > limite) {
      pedacos.push(atual);
      atual = '';
      tamanho = 0;
    }
    atual += ch;
    tamanho += n;
  }
  pedacos.push(atual);
  return pedacos.join('\r\n ');
}

function icsDateTime(data: string, hora: string): string {
  return `${data.replace(/-/g, '')}T${hhmm(hora).replace(':', '')}00`;
}

/** São Paulo sem horário de verão desde 2019: um VTIMEZONE fixo em -03. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo',
  'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD',
  'END:VTIMEZONE',
];

function onde(t: EventTalk | null, e: Pick<EventDetail, 'location'>): string {
  const loc = t?.location ?? e.location;
  if (!loc) return '';
  const endereco = loc.address ? (loc.address.formatted || formatAddress(loc.address)) : '';
  return [loc.name, t?.room, endereco].filter(Boolean).join(' · ');
}

function vevent(e: EventDetail, t: EventTalk, agoraUtc: string): string[] {
  const nomes = t.speakers.map(s => s.name).join(', ');
  const descricao = [nomes ? `Com ${nomes}` : '', t.description ?? ''].filter(Boolean).join('\n\n');
  return [
    'BEGIN:VEVENT',
    `UID:${t.id}@proautokimium.com.br`,
    `DTSTAMP:${agoraUtc}`,
    `DTSTART;TZID=America/Sao_Paulo:${icsDateTime(t.date, t.startTime)}`,
    `DTEND;TZID=America/Sao_Paulo:${icsDateTime(t.date, t.endTime)}`,
    `SUMMARY:${icsEscape(`${t.title} · ${e.name}`)}`,
    ...(descricao ? [`DESCRIPTION:${icsEscape(descricao)}`] : []),
    ...(onde(t, e) ? [`LOCATION:${icsEscape(onde(t, e))}`] : []),
    'END:VEVENT',
  ];
}

function calendario(eventos: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Proauto Kimium//Eventos//PT-BR', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', ...VTIMEZONE, ...eventos, 'END:VCALENDAR']
    .map(icsFold).join('\r\n') + '\r\n';
}

function utcStamp(agora: Date): string {
  return agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * O evento inteiro: uma entrada por palestra. Sem palestras ainda, um bloco de
 * dia inteiro cobrindo o período — senão "Salvar evento" baixaria um arquivo
 * vazio.
 */
export function icsForEvent(e: EventDetail, agora: Date = new Date()): string {
  const stamp = utcStamp(agora);
  if (!e.talks.length) {
    return calendario([
      'BEGIN:VEVENT', `UID:${e.id}@proautokimium.com.br`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.startDate.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${somarDias(e.endDate, 1).replace(/-/g, '')}`,
      `SUMMARY:${icsEscape(e.name)}`,
      ...(onde(null, e) ? [`LOCATION:${icsEscape(onde(null, e))}`] : []),
      'END:VEVENT',
    ]);
  }
  return calendario(e.talks.flatMap(t => vevent(e, t, stamp)));
}

export function icsForTalk(e: EventDetail, t: EventTalk, agora: Date = new Date()): string {
  return calendario(vevent(e, t, utcStamp(agora)));
}

/** "Poseidon Week - 23-09.ics": nome que o sistema de arquivos aceita. */
export function icsFileName(nome: string): string {
  return `${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\- ]+/g, '').trim() || 'evento'}.ics`;
}

/**
 * Google Agenda por link, sem login: no Android o `.ics` baixado nem sempre
 * abre a agenda sozinho. Horário de parede com `ctz`, sem converter para UTC.
 */
export function googleCalendarLink(e: EventDetail, t: EventTalk): string {
  const nomes = t.speakers.map((s: Speaker) => s.name).join(', ');
  const detalhes = [nomes ? `Com ${nomes}` : '', t.description ?? ''].filter(Boolean).join('\n\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${t.title} · ${e.name}`,
    dates: `${icsDateTime(t.date, t.startTime)}/${icsDateTime(t.date, t.endTime)}`,
    ctz: 'America/Sao_Paulo',
  });
  if (detalhes) params.set('details', detalhes);
  const local = onde(t, e);
  if (local) params.set('location', local);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Baixa um texto como arquivo, no molde do `saveContact()` do contato-eventos. */
export function downloadText(conteudo: string, nomeArquivo: string, tipo = 'text/calendar;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
