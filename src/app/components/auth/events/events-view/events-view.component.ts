import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';

import { EventDetail, EventSummary, EventTalk } from '../../../../domain/models/events.model';
import {
  coverDateBox, eventPhase, formatPeriod, hhmm, phaseLabel, talkStatuses,
} from '../../../../domain/utils/events';
import { urlDeMidia } from '../../../../infrastructure/config/media-url';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { saoPauloNowSignal } from '../../../../infrastructure/state/sao-paulo-now';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { EventDetailComponent } from '../event-detail/event-detail.component';

interface NoAr {
  evento: EventDetail;
  palestra: EventTalk;
  seguinte: EventTalk | null;
}

/**
 * Documentos → Eventos: só visualização.
 *
 * A lista e o evento aberto moram na mesma rota; o evento é `?evento=<id>`.
 * Lido de `queryParamMap` e não de `snapshot`: clicar num card não recria a tela,
 * e o `snapshot` continuaria com a URL de quando ela abriu.
 */
@Component({
  selector: 'app-events-view',
  standalone: true,
  imports: [PageHeaderComponent, EventDetailComponent],
  templateUrl: './events-view.component.html',
  styleUrl: './events-view.component.scss',
})
export class EventsViewComponent implements OnInit {
  private readonly service = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly agora = saoPauloNowSignal();

  readonly carregando = signal(true);
  readonly erro = signal(false);
  readonly eventos = signal<EventSummary[]>([]);

  /**
   * O detalhe dos eventos de hoje, para a faixa "Acontecendo agora". A lista não
   * traz palestras; só os eventos em andamento — quase sempre um — são buscados.
   */
  private readonly deHoje = signal<EventDetail[]>([]);

  readonly aberto = signal<EventDetail | null>(null);
  readonly abrindo = signal(false);
  readonly naoEncontrado = signal(false);

  readonly grupos = computed(() => {
    const hoje = this.agora().date;
    const porFase = (fase: string) => this.eventos().filter(e => eventPhase(e, hoje) === fase);
    return [
      { titulo: 'Acontecendo', itens: porFase('acontecendo') },
      // Próximos do mais perto para o mais longe; a API manda do mais novo.
      { titulo: 'Próximos', itens: porFase('proximo').sort((a, b) => a.startDate.localeCompare(b.startDate)) },
      { titulo: 'Anteriores', itens: porFase('encerrado') },
    ].filter(g => g.itens.length);
  });

  readonly noAr = computed<NoAr[]>(() => {
    const agora = this.agora();
    return this.deHoje().flatMap(evento => {
      const status = talkStatuses(evento.talks, agora);
      const palestra = evento.talks.find(t => status.get(t.id) === 'agora' && t.speakers.length)
        ?? evento.talks.find(t => status.get(t.id) === 'agora');
      if (!palestra) return [];
      const seguinte = evento.talks.find(t => status.get(t.id) === 'a-seguir') ?? null;
      return [{ evento, palestra, seguinte }];
    });
  });

  readonly formatPeriod = formatPeriod;
  readonly coverDateBox = coverDateBox;
  readonly hhmm = hhmm;

  ngOnInit(): void {
    this.carregar();

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.abrirPorId(params.get('evento')));
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);

    this.service.listPublished().subscribe({
      next: lista => {
        this.eventos.set(lista);
        this.carregando.set(false);
        this.carregarDeHoje(lista);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  private carregarDeHoje(lista: EventSummary[]): void {
    const hoje = this.agora().date;
    const ids = lista.filter(e => eventPhase(e, hoje) === 'acontecendo').map(e => e.id);
    if (!ids.length) {
      this.deHoje.set([]);
      return;
    }
    // Um evento que falhar não derruba a faixa dos outros.
    forkJoin(ids.map(id => this.service.get(id).pipe(catchError(() => of(null)))))
      .subscribe(detalhes => this.deHoje.set(detalhes.filter((d): d is EventDetail => !!d)));
  }

  private abrirPorId(id: string | null): void {
    this.naoEncontrado.set(false);
    if (!id) {
      this.aberto.set(null);
      return;
    }
    if (this.aberto()?.id === id) return;

    this.abrindo.set(true);
    this.service.get(id).subscribe({
      next: evento => {
        this.aberto.set(evento);
        this.abrindo.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.abrindo.set(false);
        this.aberto.set(null);
        // 404 é também o rascunho: para quem só vê, ele não existe.
        this.naoEncontrado.set(err?.status === 404);
        if (err?.status !== 404) this.erro.set(true);
      },
    });
  }

  abrir(evento: { id: string }): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { evento: evento.id } });
  }

  fechar(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { evento: null } });
  }

  faseDe(e: EventSummary): string {
    return eventPhase(e, this.agora().date);
  }

  rotuloDe(e: EventSummary): string {
    return phaseLabel(e, this.agora().date);
  }

  capa(e: EventSummary): string | null {
    return e.coverUrl ? urlDeMidia(e.coverUrl, '') : null;
  }

  nomesDe(t: EventTalk): string {
    return t.speakers.map(s => s.name).join(', ');
  }
}
