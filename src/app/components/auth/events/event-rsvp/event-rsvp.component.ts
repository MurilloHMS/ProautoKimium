import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { EventAnswer, InvitationAnswer, NOTE_MAX } from '../../../../domain/models/events.model';
import { formatDeadline } from '../../../../domain/utils/events';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSegmentedComponent } from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';

/**
 * A resposta ao convite: uma faixa curta com a situação e um botão.
 *
 * Pedido dele (2026-10-01): o formulário aberto no meio do evento ficava grande
 * demais no computador e no celular. Agora a faixa diz "ainda não respondeu" ou
 * "você vai", e o botão "Confirmar participação" / "Alterar resposta" abre o
 * formulário no padrão do tema — folha de baixo no celular (`pk-sheet`),
 * diálogo no computador (`pk-dialog`), o mesmo par da palestra no cadastro.
 *
 * O prazo é o `startsAt` da API, e é a API que recusa depois dele; o `open`
 * aqui só evita mostrar um botão que vai dar erro.
 */
@Component({
  selector: 'app-event-rsvp',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, PkButtonComponent, PkDialogComponent, PkSegmentedComponent, PkSheetComponent],
  templateUrl: './event-rsvp.component.html',
  styleUrl: './event-rsvp.component.scss',
})
export class EventRsvpComponent {
  private readonly service = inject(EventsService);

  readonly eventId = input.required<string>();
  readonly startsAt = input.required<string>();
  readonly open = input.required<boolean>();
  readonly answer = input<InvitationAnswer | null>(null);
  /**
   * Live de comunicado: a resposta é um toque só, "Estou ciente", sem
   * formulário e sem observação. Não tem "alterar": confirmar que viu o
   * aviso não se desfaz.
   */
  readonly online = input(false);

  readonly answered = output<InvitationAnswer>();

  readonly NOTE_MAX = NOTE_MAX;
  readonly prazo = computed(() => formatDeadline(this.startsAt()));

  /** A resposta salva: começa com a que chegou, e passa a ser a do último "Salvar". */
  readonly salva = signal<InvitationAnswer | null>(null);
  readonly editando = signal(false);
  readonly escolha = signal<EventAnswer | null>(null);
  readonly nota = signal('');
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);

  readonly tamanho = computed(() => this.nota().length);
  readonly celular = signal(false);

  readonly opcoes = [
    { label: 'Vou', value: 'GOING' },
    { label: 'Não vou', value: 'NOT_GOING' },
  ];

  constructor() {
    // 768px é o `$bp-md`: folha de baixo no celular, diálogo no computador.
    const destroyRef = inject(DestroyRef);
    const consulta = window.matchMedia('(max-width: 768px)');
    const aplicar = () => this.celular.set(consulta.matches);
    consulta.addEventListener('change', aplicar);
    destroyRef.onDestroy(() => consulta.removeEventListener('change', aplicar));
    aplicar();

    // Outro convite (ou a mesma resposta recarregada): volta ao estado salvo.
    effect(() => {
      const a = this.answer();
      this.eventId();
      untracked(() => {
        this.salva.set(a);
        this.editando.set(false);
        this.erro.set(null);
        this.preencher(a);
      });
    });
  }

  escolher(a: EventAnswer): void {
    this.escolha.set(a);
    this.erro.set(null);
  }

  /** "Confirmar participação" e "Alterar resposta": abre o formulário com o que está salvo. */
  responder(): void {
    this.preencher(this.salva());
    this.erro.set(null);
    this.editando.set(true);
  }

  cancelar(): void {
    this.preencher(this.salva());
    this.editando.set(false);
    this.erro.set(null);
  }

  salvar(): void {
    const escolha = this.escolha();
    if (!escolha || this.salvando()) return;
    if (this.tamanho() > NOTE_MAX) {
      this.erro.set(`A observação pode ter no máximo ${NOTE_MAX} caracteres.`);
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);
    const nota = this.nota().trim() || null;
    this.service.respond(this.eventId(), escolha, nota).subscribe({
      next: resposta => {
        this.salvando.set(false);
        this.salva.set(resposta);
        this.editando.set(false);
        this.answered.emit(resposta);
      },
      error: (err: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erro.set(this.mensagem(err));
      },
    });
  }

  /** "Estou ciente": grava direto, sem abrir formulário. */
  confirmarCiencia(): void {
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erro.set(null);
    this.service.respond(this.eventId(), 'ACKNOWLEDGED', null).subscribe({
      next: resposta => {
        this.salvando.set(false);
        this.salva.set(resposta);
        this.answered.emit(resposta);
      },
      error: (err: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erro.set(this.mensagem(err));
      },
    });
  }

  quando(iso: string | null | undefined): string {
    return formatDeadline(iso);
  }

  private preencher(a: InvitationAnswer | null): void {
    this.escolha.set(a?.answer ?? null);
    this.nota.set(a?.note ?? '');
  }

  private mensagem(err: HttpErrorResponse): string {
    // Presencial: a frase fixa do prazo. Na live o prazo é outro (o fim da
    // transmissão), e quem sabe dizer é a API.
    if (err?.status === 409) {
      return this.online() && err?.error?.message
        ? err.error.message
        : 'O evento já começou: a resposta não pode mais ser alterada.';
    }
    if (err?.status === 404) return 'Este convite não está mais disponível.';
    return err?.error?.message || 'Não foi possível salvar a resposta. Tente de novo.';
  }
}
