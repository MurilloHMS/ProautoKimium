// ═══════════════════════════════════════════════════════════════════════════
// Eventos da empresa — os DTOs de `/api/events` e `/api/speakers`
//
// Datas chegam como "2026-09-22" e horários como "14:00:00" (LocalDate e
// LocalTime do Java, sem fuso). O evento acontece em São Paulo.
// ═══════════════════════════════════════════════════════════════════════════

import { Address } from './address.model';

export type EventLocationType = 'COMPANY' | 'ADDRESS';
export type TalkLocationType = 'EVENT' | 'COMPANY' | 'ADDRESS';

/** Onde algo acontece, já resolvido pela API. */
export interface EventLocation {
  source: 'EVENT' | 'COMPANY' | 'ADDRESS';
  companyId: string | null;
  name: string | null;
  /** Nulo quando não há endereço usável — empresa sem endereço, por exemplo. */
  address: Address | null;
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
}
