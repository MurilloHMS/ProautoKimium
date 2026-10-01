import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { Invitation, InvitationAnswer, InvitationDetail } from '../../../../domain/models/events.model';
import { coverDateBox, eventPhase, formatPeriod } from '../../../../domain/utils/events';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { saoPauloNowSignal } from '../../../../infrastructure/state/sao-paulo-now';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { EventDetailComponent } from '../event-detail/event-detail.component';
import { EventRsvpComponent } from '../event-rsvp/event-rsvp.component';

type Situacao = 'aguardando' | 'vai' | 'nao-vai' | 'fechado';

/**
 * Meus convites — `/convites`, sem código de tela: ser convidado basta.
 *
 * A lista e o convite aberto moram na mesma rota; o convite é `?evento=<id>`,
 * que é o link do lembrete e da home. Abrir conta uma visualização para a
 * auditoria do organizador.
 */
@Component({
  selector: 'app-invitations',
  standalone: true,
  imports: [PageHeaderComponent, EventDetailComponent, EventRsvpComponent],
  templateUrl: './invitations.component.html',
  styleUrl: './invitations.component.scss',
})
export class InvitationsComponent implements OnInit {
  private readonly service = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly agora = saoPauloNowSignal();

  readonly carregando = signal(true);
  readonly erro = signal(false);
  readonly convites = signal<Invitation[]>([]);

  readonly aberto = signal<InvitationDetail | null>(null);
  readonly abrindo = signal(false);
  readonly naoEncontrado = signal(false);

  /** Os abertos primeiro, do mais perto para o mais longe; os que já começaram depois. */
  readonly grupos = computed(() => {
    const lista = this.convites();
    const abertos = lista.filter(i => i.open).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const fechados = lista.filter(i => !i.open);
    return [
      { titulo: 'Para responder', itens: abertos },
      { titulo: 'Já começaram', itens: fechados },
    ].filter(g => g.itens.length);
  });

  readonly formatPeriod = formatPeriod;
  readonly coverDateBox = coverDateBox;

  ngOnInit(): void {
    this.carregar();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.abrirPorId(params.get('evento')));
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(false);
    this.service.myInvitations().subscribe({
      next: lista => {
        this.convites.set(lista);
        this.carregando.set(false);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set(true);
      },
    });
  }

  private abrirPorId(id: string | null): void {
    this.naoEncontrado.set(false);
    if (!id) {
      this.aberto.set(null);
      return;
    }
    if (this.aberto()?.event.id === id) return;

    this.abrindo.set(true);
    this.service.invitation(id).subscribe({
      next: convite => {
        this.aberto.set(convite);
        this.abrindo.set(false);
        // A auditoria é melhor esforço: falhar aqui não pode esconder o convite.
        this.service.registerView(id).subscribe({ error: () => undefined });
      },
      error: (err: HttpErrorResponse) => {
        this.abrindo.set(false);
        this.aberto.set(null);
        this.naoEncontrado.set(err?.status === 404);
        if (err?.status !== 404) this.erro.set(true);
      },
    });
  }

  abrir(i: Invitation): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { evento: i.event.id } });
  }

  fechar(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { evento: null } });
  }

  /** A resposta salva no convite aberto vale também para o card da lista. */
  respondeu(resposta: InvitationAnswer): void {
    const id = this.aberto()?.event.id;
    this.aberto.update(c => c ? { ...c, answer: resposta } : c);
    this.convites.update(lista => lista.map(i => i.event.id === id ? { ...i, answer: resposta } : i));
  }

  situacao(i: Invitation): Situacao {
    if (i.answer?.answer === 'GOING') return 'vai';
    if (i.answer?.answer === 'NOT_GOING') return 'nao-vai';
    return i.open ? 'aguardando' : 'fechado';
  }

  rotulo(i: Invitation): string {
    const passou = eventPhase(i.event, this.agora().date) === 'encerrado';
    switch (this.situacao(i)) {
      case 'vai': return passou ? 'Você foi' : 'Você vai';
      case 'nao-vai': return 'Você não vai';
      case 'aguardando': return 'Aguardando sua resposta';
      default: return 'Sem resposta';
    }
  }
}
