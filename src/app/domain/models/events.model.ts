// ═══════════════════════════════════════════════════════════════════════════
// Eventos da empresa — os DTOs de `/api/events` e `/api/speakers`
//
// Datas chegam como "2026-09-22" e horários como "14:00:00" (LocalDate e
// LocalTime do Java, sem fuso). O evento acontece em São Paulo.
// ═══════════════════════════════════════════════════════════════════════════

import { Address } from './address.model';

export type EventLocationType = 'COMPANY' | 'ADDRESS' | 'ONLINE';
export type TalkLocationType = 'EVENT' | 'COMPANY' | 'ADDRESS';

/** Onde algo acontece, já resolvido pela API. */
export interface EventLocation {
  source: 'EVENT' | 'COMPANY' | 'ADDRESS' | 'ONLINE';
  companyId: string | null;
  name: string | null;
  /** Nulo quando não há endereço usável — empresa sem endereço, evento online. */
  address: Address | null;
  /** O link da transmissão; só em evento online (e nas palestras "no local do evento" dele). */
  onlineUrl: string | null;
}

export interface Speaker {
  id: string;
  name: string;
  role: string | null;
  companyName: string | null;
  photoUrl: string | null;
  /** Só o usuário: `marina.quimica`. O link é montado aqui. */
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  talkCount: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SpeakerRequest {
  name: string;
  role: string | null;
  companyName: string | null;
  instagram: string | null;
  linkedin: string | null;
  website: string | null;
  removePhoto: boolean;
}

export interface EventTalk {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  locationType: TalkLocationType;
  location: EventLocation | null;
  speakers: Speaker[];
}

export interface TalkRequest {
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  locationType: TalkLocationType;
  companyId: string | null;
  placeName: string | null;
  address: Address | null;
  speakerIds: string[];
}

export interface EventSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  coverUrl: string | null;
  location: EventLocation | null;
  talkCount: number;
  awayTalkCount: number;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Horário do evento online ("09:00:00"); nulo no presencial. */
  startTime: string | null;
  endTime: string | null;
}

export interface EventDetail {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  coverUrl: string | null;
  locationType: EventLocationType | null;
  location: EventLocation | null;
  publishedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  talks: EventTalk[];
  /** Quando começa: o horário da live, ou a primeira palestra do primeiro dia. */
  startsAt: string;
  /** Público e avisos. Só chega para quem cadastra. */
  settings: EventSettings | null;
  startTime: string | null;
  endTime: string | null;
  /** Quando acaba: o fim do "Ao vivo". */
  endsAt: string;
  /** Até quando dá para responder: o início no presencial, o fim na live. */
  answersUntil: string;
}

/** Uma empresa, um setor ou uma pessoa nos seletores do público. */
export interface AudienceOption {
  id: string;
  name: string;
  /** "Matriz · Comercial" ao lado do nome da pessoa. */
  detail: string | null;
  /** Só nas Solicitações: false = sem login; recebe, e o RH registra a resposta. */
  hasAccess?: boolean;
}

export interface AudienceOptions {
  companies: AudienceOption[];
  departments: AudienceOption[];
  employees: AudienceOption[];
}

export interface EventSettings {
  audienceAll: boolean;
  companies: AudienceOption[];
  departments: AudienceOption[];
  employees: AudienceOption[];
  reminderEnabled: boolean;
  /** "09:00:00", sempre hora cheia. */
  reminderTime: string | null;
  /** Quantos dias antes do primeiro dia o lembrete começa (1 a 60). */
  reminderDaysBefore: number | null;
  /** Avisar todos os convidados na primeira publicação. */
  announceOnPublish: boolean;
  /** Quando o aviso de publicação saiu; nulo se ainda não saiu. */
  announcedAt: string | null;
  /** "Começou agora" na hora da live. */
  notifyLiveStart: boolean;
}

export interface EventRequest {
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  locationType: EventLocationType | null;
  companyId: string | null;
  placeName: string | null;
  address: Address | null;
  removeCover: boolean;
  audienceAll: boolean;
  audienceCompanyIds: string[];
  audienceDepartmentIds: string[];
  audienceEmployeeIds: string[];
  reminderEnabled: boolean;
  reminderTime: string | null;
  reminderDaysBefore: number | null;
  /** Obrigatório com ONLINE, só https://. */
  onlineUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  announceOnPublish: boolean;
  notifyLiveStart: boolean;
}

// ─── Confirmação de presença ────────────────────────────────────────────────

/** Vou / Não vou no presencial; Estou ciente (ACKNOWLEDGED) na live. */
export type EventAnswer = 'GOING' | 'NOT_GOING' | 'ACKNOWLEDGED';

/** O limite da observação — o mesmo da coluna `event_responses.note`. */
export const NOTE_MAX = 500;

export interface InvitationAnswer {
  answer: EventAnswer;
  note: string | null;
  firstAnsweredAt: string;
  answeredAt: string;
}

/** Um card de "Meus convites". */
export interface Invitation {
  event: EventSummary;
  startsAt: string;
  /** Ainda dá para responder. */
  open: boolean;
  answer: InvitationAnswer | null;
}

/** O convite aberto: o evento inteiro e a resposta. */
export interface InvitationDetail {
  event: EventDetail;
  startsAt: string;
  open: boolean;
  answer: InvitationAnswer | null;
}

export interface Attendee {
  employeeId: string;
  name: string;
  companyName: string | null;
  departmentName: string | null;
  /** Falso: respondeu ou abriu, e depois saiu do público. Fora dos totais. */
  invited: boolean;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  answer: EventAnswer | null;
  note: string | null;
  firstAnsweredAt: string | null;
  answeredAt: string | null;
}

export interface ReminderDay {
  day: string;
  sentAt: string;
  recipients: number;
}

export interface Attendance {
  eventId: string;
  eventName: string;
  startDate: string;
  endDate: string;
  startsAt: string;
  reminderEnabled: boolean;
  reminderTime: string | null;
  reminderDaysBefore: number | null;
  reminderDays: ReminderDay[];
  invited: number;
  going: number;
  notGoing: number;
  noAnswer: number;
  neverViewed: number;
  attendees: Attendee[];
  /** Cientes, na live. */
  acknowledged: number;
  /** Live: a auditoria conta cientes em vez de vão / não vão. */
  online: boolean;
}
