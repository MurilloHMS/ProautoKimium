import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';

import { EventDetail, EventLocation, EventTalk, Speaker } from '../../../../domain/models/events.model';
import { formatAddress } from '../../../../domain/utils/address';
import {
  SaoPauloNow, TalkStatus, dayTab, downloadText, eventDays, formatPeriod, googleCalendarLink, hhmm,
  icsFileName, icsForEvent, icsForTalk, initialDay, initials, instagramUrl, linkedinUrl, talkStatuses, websiteUrl,
} from '../../../../domain/utils/events';
import { urlDeMidia } from '../../../../infrastructure/config/media-url';
import { DirectionsMenuComponent } from '../../shared/directions-menu/directions-menu.component';
import { MapPreviewComponent } from '../../shared/map-preview/map-preview.component';

/**
 * Um evento aberto: capa, onde fica, abas de dia e a programação.
 *
 * Serve as duas portas — Documentos e o "Ver como fica" do cadastro — para as
 * duas mostrarem exatamente a mesma coisa. Não busca dado: recebe o evento e o
 * "agora".
 */
@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [DirectionsMenuComponent, MapPreviewComponent],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss',
})
export class EventDetailComponent {
  readonly event = input.required<EventDetail>();
  readonly now = input.required<SaoPauloNow>();
  readonly backLabel = input('Eventos');
  /** No "Ver como fica" de um rascunho, a faixa avisa que ninguém vê ainda. */
  readonly preview = input(false);

  readonly back = output<void>();

  readonly hhmm = hhmm;
  readonly formatPeriod = formatPeriod;
  readonly initials = initials;
  readonly instagramUrl = instagramUrl;
  readonly linkedinUrl = linkedinUrl;
  readonly websiteUrl = websiteUrl;

  readonly dias = computed(() => eventDays(this.event().startDate, this.event().endDate));

  /** A aba escolhida à mão. Nula enquanto ninguém clicou: aí vale a do dia de hoje. */
  private readonly escolhido = signal<string | null>(null);

  readonly diaSelecionado = computed(() => {
    const manual = this.escolhido();
    return manual && this.dias().includes(manual) ? manual : initialDay(this.dias(), this.now().date);
  });

  readonly abas = computed(() => this.dias().map(d => {
    const tab = dayTab(d);
    const quantas = this.event().talks.filter(t => t.date === d && t.speakers.length).length;
    return { data: d, ...tab, quantas, hoje: d === this.now().date };
  }));

  readonly status = computed(() => talkStatuses(this.event().talks, this.now()));

  readonly palestrasDoDia = computed(() => this.event().talks
    .filter(t => t.date === this.diaSelecionado())
    .sort((a, b) => (hhmm(a.startTime) + hhmm(a.endTime)).localeCompare(hhmm(b.startTime) + hhmm(b.endTime))));

  readonly rotuloDoDia = computed(() => {
    const d = this.diaSelecionado();
    return d ? dayTab(d).rotulo : '';
  });

  readonly local = computed(() => this.event().location);
  readonly enderecoDoEvento = computed(() => this.texto(this.local()));
  readonly capa = computed(() => this.event().coverUrl ? urlDeMidia(this.event().coverUrl, '') : null);

  /** O menu "Salvar no calendário" aberto, por palestra. */
  readonly calendarioAberto = signal<string | null>(null);

  constructor() {
    // Trocou de evento: volta para a aba de hoje, e não para a do evento anterior.
    effect(() => {
      this.event().id;
      untracked(() => this.escolhido.set(null));
    });
  }

  escolherDia(d: string): void {
    this.escolhido.set(d);
  }

  statusDe(t: EventTalk): TalkStatus {
    return this.status().get(t.id) ?? 'depois';
  }

  /** Palestra noutro lugar que não o do evento ganha o endereço e o mapa próprios. */
  foraDoEvento(t: EventTalk): boolean {
    return t.locationType !== 'EVENT' && !!t.location;
  }

  texto(local: EventLocation | null | undefined): string {
    const a = local?.address;
    return a ? (a.formatted || formatAddress(a)) : '';
  }

  foto(s: Speaker): string | null {
    return s.photoUrl ? urlDeMidia(s.photoUrl, '') : null;
  }

  salvarEvento(): void {
    downloadText(icsForEvent(this.event()), icsFileName(this.event().name));
  }

  salvarPalestra(t: EventTalk): void {
    downloadText(icsForTalk(this.event(), t), icsFileName(`${this.event().name} - ${t.title}`));
    this.calendarioAberto.set(null);
  }

  googleAgenda(t: EventTalk): string {
    return googleCalendarLink(this.event(), t);
  }

  alternarCalendario(t: EventTalk): void {
    this.calendarioAberto.set(this.calendarioAberto() === t.id ? null : t.id);
  }
}
