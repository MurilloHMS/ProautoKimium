import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { EventDetail, EventSummary, Speaker } from '../../../../domain/models/events.model';
import { apiMessage } from '../../../../domain/utils/api-error';
import {
  formatDateBr, formatPeriod, formatStamp, eventPhase, initials, instagramUrl, linkedinUrl, phaseLabel, websiteUrl,
} from '../../../../domain/utils/events';
import { urlDeMidia } from '../../../../infrastructure/config/media-url';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { saoPauloNowSignal } from '../../../../infrastructure/state/sao-paulo-now';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { EventDetailComponent } from '../event-detail/event-detail.component';
import { EventFormComponent } from '../event-form/event-form.component';
import { NgTemplateOutlet } from '@angular/common';

type Secao = 'eventos' | 'palestrantes';
type Ordem<T> = { campo: keyof T; direcao: 1 | -1 };

/**
 * Comunicação → Eventos: o cadastro. Documentos → Eventos só vê.
 *
 * Mesmo padrão da Programação, pedido dele: no computador, planilha na largura
 * toda com cabeçalho que ordena e ações no fim; no celular, cartão por linha e
 * edição na folha de baixo. Criar fica só no computador, como lá — pede teclado
 * e foto do arquivo.
 */
@Component({
  selector: 'app-events-manage',
  standalone: true,
  imports: [
    ReactiveFormsModule, Toast, TooltipModule, NgTemplateOutlet, PkCanDirective, PkButtonComponent, PkDialogComponent,
    PkInputComponent, PkSheetComponent, PageHeaderComponent, ToolbarComponent, EventDetailComponent, EventFormComponent,
  ],
  providers: [MessageService],
  templateUrl: './events-manage.component.html',
  styleUrl: './events-manage.component.scss',
})
export class EventsManageComponent implements OnInit {
  private readonly service = inject(EventsService);
  private readonly messages = inject(MessageService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly agora = saoPauloNowSignal();

  readonly secao = signal<Secao>('eventos');
  /** Lista, formulário de um evento, ou o evento como Documentos mostra. */
  readonly modo = signal<'lista' | 'formulario' | 'previa'>('lista');
  readonly ehCelular = signal(false);

  readonly formatPeriod = formatPeriod;
  readonly formatDateBr = formatDateBr;
  readonly formatStamp = formatStamp;
  readonly initials = initials;
  readonly instagramUrl = instagramUrl;
  readonly linkedinUrl = linkedinUrl;
  readonly websiteUrl = websiteUrl;

  // ── Eventos ────────────────────────────────────────────────────────────────

  readonly eventos = signal<EventSummary[]>([]);
  readonly carregandoEventos = signal(false);
  readonly buscaEventos = signal('');
  readonly ordemEventos = signal<Ordem<EventSummary>>({ campo: 'startDate', direcao: -1 });

  readonly eventosVisiveis = computed(() => {
    const q = this.buscaEventos().trim().toLowerCase();
    const { campo, direcao } = this.ordemEventos();
    return this.eventos()
      .filter(e => !q || [e.name, e.location?.name, e.location?.address?.city].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => String(a[campo] ?? '').localeCompare(String(b[campo] ?? '')) * direcao);
  });

  /** O evento no formulário: nulo é "Novo evento". */
  readonly emEdicao = signal<EventDetail | null>(null);
  readonly previa = signal<EventDetail | null>(null);
  readonly excluindoEvento = signal<EventSummary | null>(null);

  // ── Palestrantes ───────────────────────────────────────────────────────────

  readonly palestrantes = signal<Speaker[]>([]);
  readonly carregandoPalestrantes = signal(false);
  readonly buscaPalestrantes = signal('');
  readonly ordemPalestrantes = signal<Ordem<Speaker>>({ campo: 'name', direcao: 1 });

  readonly palestrantesVisiveis = computed(() => {
    const q = this.buscaPalestrantes().trim().toLowerCase();
    const { campo, direcao } = this.ordemPalestrantes();
    return this.palestrantes()
      .filter(s => !q || [s.name, s.role, s.companyName].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = a[campo], y = b[campo];
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''))) * direcao;
      });
  });

  readonly editandoPalestrante = signal<Speaker | 'novo' | null>(null);
  readonly excluindoPalestrante = signal<Speaker | null>(null);
  readonly salvandoPalestrante = signal(false);
  readonly fotoNova = signal<File | null>(null);
  readonly fotoPrevia = signal<string | null>(null);
  readonly removerFoto = signal(false);
  readonly erroFoto = signal('');

  readonly formPalestrante: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    role: ['', Validators.maxLength(120)],
    companyName: ['', Validators.maxLength(120)],
    instagram: ['', Validators.maxLength(100)],
    linkedin: ['', Validators.maxLength(100)],
    website: ['', Validators.maxLength(255)],
  });

  ngOnInit(): void {
    // 768px é o `$bp-md`, repetido aqui porque media query não chega ao
    // TypeScript. `@if` e não `display: none`: esconder por CSS deixaria a
    // planilha inteira montada num aparelho que nunca vai mostrá-la.
    const celular = window.matchMedia('(max-width: 768px)');
    const aplicar = () => this.ehCelular.set(celular.matches);
    celular.addEventListener('change', aplicar);
    this.destroyRef.onDestroy(() => celular.removeEventListener('change', aplicar));
    aplicar();

    this.carregarEventos();
    this.carregarPalestrantes();
  }

  trocarSecao(secao: Secao): void {
    this.secao.set(secao);
  }

  // ── Eventos ────────────────────────────────────────────────────────────────

  carregarEventos(): void {
    this.carregandoEventos.set(true);
    this.service.listForManagement().subscribe({
      next: lista => {
        this.eventos.set(lista);
        this.carregandoEventos.set(false);
      },
      error: err => {
        this.carregandoEventos.set(false);
        this.avisarErro(err, 'Não foi possível carregar os eventos.');
      },
    });
  }

  ordenarEventos(campo: keyof EventSummary): void {
    const atual = this.ordemEventos();
    this.ordemEventos.set({ campo, direcao: atual.campo === campo ? (atual.direcao === 1 ? -1 : 1) : 1 });
  }

  iconeOrdem(ordem: Ordem<any>, campo: string): string {
    if (ordem.campo !== campo) return 'pi pi-sort-alt';
    return ordem.direcao === 1 ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  situacao(e: EventSummary): { rotulo: string; classe: string } {
    if (!e.publishedAt) return { rotulo: 'Rascunho', classe: 'status-chip--neutral chip-rascunho' };
    const fase = eventPhase(e, this.agora().date);
    return {
      rotulo: phaseLabel(e, this.agora().date),
      classe: fase === 'acontecendo' ? 'status-chip--danger' : fase === 'proximo' ? 'status-chip--info' : 'status-chip--neutral',
    };
  }

  novoEvento(): void {
    this.emEdicao.set(null);
    this.modo.set('formulario');
  }

  editarEvento(e: EventSummary): void {
    this.service.get(e.id).subscribe({
      next: detalhe => {
        this.emEdicao.set(detalhe);
        this.modo.set('formulario');
      },
      error: err => this.avisarErro(err, 'Não foi possível abrir o evento.'),
    });
  }

  verComoFica(e: { id: string }): void {
    this.service.get(e.id).subscribe({
      next: detalhe => {
        this.previa.set(detalhe);
        this.modo.set('previa');
      },
      error: err => this.avisarErro(err, 'Não foi possível abrir o evento.'),
    });
  }

  /** O formulário salvou algo: a lista reflete, e o formulário continua aberto. */
  aoSalvarEvento(detalhe: EventDetail): void {
    this.emEdicao.set(detalhe);
    this.carregarEventos();
  }

  voltarParaLista(): void {
    this.modo.set('lista');
    this.emEdicao.set(null);
    this.previa.set(null);
    this.carregarEventos();
  }

  publicar(e: EventSummary): void {
    this.service.publish(e.id).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Publicado', detail: `${e.name} já aparece em Documentos.` });
        this.carregarEventos();
      },
      error: err => this.avisarErro(err, 'Não foi possível publicar.'),
    });
  }

  confirmarExclusaoEvento(): void {
    const alvo = this.excluindoEvento();
    if (!alvo) return;
    this.service.delete(alvo.id).subscribe({
      next: () => {
        this.excluindoEvento.set(null);
        this.messages.add({ severity: 'success', summary: 'Excluído', detail: `${alvo.name} foi excluído.` });
        this.carregarEventos();
      },
      error: err => this.avisarErro(err, 'Não foi possível excluir.'),
    });
  }

  // ── Palestrantes ───────────────────────────────────────────────────────────

  carregarPalestrantes(): void {
    this.carregandoPalestrantes.set(true);
    this.service.listSpeakers().subscribe({
      next: lista => {
        this.palestrantes.set(lista);
        this.carregandoPalestrantes.set(false);
      },
      error: err => {
        this.carregandoPalestrantes.set(false);
        // 403 aqui é quem só pode incluir evento sem ver o cadastro de
        // palestrantes; não é erro para avisar.
        if (err?.status !== 403) this.avisarErro(err, 'Não foi possível carregar os palestrantes.');
      },
    });
  }

  ordenarPalestrantes(campo: keyof Speaker): void {
    const atual = this.ordemPalestrantes();
    this.ordemPalestrantes.set({ campo, direcao: atual.campo === campo ? (atual.direcao === 1 ? -1 : 1) : 1 });
  }

  foto(s: Speaker): string | null {
    return s.photoUrl ? urlDeMidia(s.photoUrl, '') : null;
  }

  abrirPalestrante(s: Speaker | 'novo'): void {
    const p = s === 'novo' ? null : s;
    this.formPalestrante.reset({
      name: p?.name ?? '', role: p?.role ?? '', companyName: p?.companyName ?? '',
      instagram: p?.instagram ?? '', linkedin: p?.linkedin ?? '', website: p?.website ?? '',
    });
    this.fotoNova.set(null);
    this.fotoPrevia.set(p?.photoUrl ? urlDeMidia(p.photoUrl, '') : null);
    this.removerFoto.set(false);
    this.erroFoto.set('');
    this.editandoPalestrante.set(s);
  }

  fecharPalestrante(): void {
    if (this.salvandoPalestrante()) return;
    this.editandoPalestrante.set(null);
  }

  tituloPalestrante(): string {
    return this.editandoPalestrante() === 'novo' ? 'Novo palestrante' : 'Editar palestrante';
  }

  aoEscolherFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    input.value = '';
    this.erroFoto.set('');
    if (!arquivo) return;

    if (!/\.(jpe?g|png|webp)$/i.test(arquivo.name)) {
      this.erroFoto.set('Envie a foto em JPG, PNG ou WEBP.');
      return;
    }
    if (arquivo.size > 8 * 1024 * 1024) {
      this.erroFoto.set('A foto passa de 8 MB.');
      return;
    }
    this.fotoNova.set(arquivo);
    this.fotoPrevia.set(URL.createObjectURL(arquivo));
    this.removerFoto.set(false);
  }

  tirarFoto(): void {
    this.fotoNova.set(null);
    this.fotoPrevia.set(null);
    this.removerFoto.set(true);
  }

  salvarPalestrante(): void {
    this.formPalestrante.markAllAsTouched();
    if (this.formPalestrante.invalid || this.salvandoPalestrante()) return;

    const v = this.formPalestrante.getRawValue();
    const limpo = (x: string) => (x ?? '').trim() || null;
    const dados = {
      name: v.name.trim(), role: limpo(v.role), companyName: limpo(v.companyName),
      instagram: limpo(v.instagram), linkedin: limpo(v.linkedin), website: limpo(v.website),
      removePhoto: this.removerFoto(),
    };

    const atual = this.editandoPalestrante();
    const chamada = atual && atual !== 'novo'
      ? this.service.updateSpeaker(atual.id, dados, this.fotoNova())
      : this.service.createSpeaker(dados, this.fotoNova());

    this.salvandoPalestrante.set(true);
    chamada.subscribe({
      next: () => {
        this.salvandoPalestrante.set(false);
        this.editandoPalestrante.set(null);
        this.messages.add({ severity: 'success', summary: 'Salvo', detail: `${dados.name} foi salvo.` });
        this.carregarPalestrantes();
      },
      error: err => {
        this.salvandoPalestrante.set(false);
        this.avisarErro(err, 'Não foi possível salvar o palestrante.');
      },
    });
  }

  confirmarExclusaoPalestrante(): void {
    const alvo = this.excluindoPalestrante();
    if (!alvo) return;
    this.service.deleteSpeaker(alvo.id).subscribe({
      next: () => {
        this.excluindoPalestrante.set(null);
        this.messages.add({ severity: 'success', summary: 'Excluído', detail: `${alvo.name} foi excluído.` });
        this.carregarPalestrantes();
      },
      error: err => {
        this.excluindoPalestrante.set(null);
        // O 409 diz em quais eventos a pessoa está: vale mostrar como veio.
        this.avisarErro(err, 'Não foi possível excluir.');
      },
    });
  }

  private avisarErro(err: HttpErrorResponse, padrao: string): void {
    const detalhe = err?.status === 400 || err?.status === 409 ? apiMessage(err) ?? padrao : padrao;
    this.messages.add({ severity: 'error', summary: 'Erro', detail: detalhe, life: 6000 });
  }
}
