import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { Address } from '../../../../domain/models/address.model';
import {
  AudienceOption, AudienceOptions, EventDetail, EventLocationType, EventRequest, EventTalk, Speaker, TalkLocationType,
  TalkRequest,
} from '../../../../domain/models/events.model';
import { apiMessage } from '../../../../domain/utils/api-error';
import { Coordinates, coordinatesOf, formatAddress, isUsableAddress } from '../../../../domain/utils/address';
import { dayTab, eventDays, formatDateBr, formatDeadline, formatStamp, hhmm, initials } from '../../../../domain/utils/events';
import { urlDeMidia } from '../../../../infrastructure/config/media-url';
import { PkCanDirective } from '../../../../infrastructure/directives/pk-can.directive';
import { EventsService } from '../../../../infrastructure/services/events/events.service';
import { CompanyStore } from '../../../../infrastructure/state/org-structure.store';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkCheckboxComponent } from '../../../theme/ProautoKimium/pk-checkbox/pk-checkbox.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkMultiselectComponent } from '../../../theme/ProautoKimium/pk-multiselect/pk-multiselect.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { AddressFieldsComponent, addressFromGroup, addressGroup, addressPatch } from '../../shared/address-fields/address-fields.component';
import { FormScreenComponent } from '../../shared/form-screen/form-screen.component';
import { MapPreviewComponent } from '../../shared/map-preview/map-preview.component';

const vazio = (a: Address | null) => !a || !Object.values(a).some(v => v);

/**
 * O evento no cadastro: dados, local, publicação e a programação.
 *
 * Evento novo precisa ser salvo antes de ganhar programação — a palestra pendura
 * no id. O formulário continua aberto depois de salvar, já com a programação.
 */
@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, NgTemplateOutlet, Select, TooltipModule, PkCanDirective, PkButtonComponent,
    PkCheckboxComponent, PkDialogComponent, PkInputComponent, PkMultiselectComponent, PkSheetComponent, AddressFieldsComponent, FormScreenComponent, MapPreviewComponent,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnInit {
  private readonly service = inject(EventsService);
  private readonly messages = inject(MessageService);
  private readonly companies = inject(CompanyStore);
  private readonly fb = inject(FormBuilder);

  readonly event = input<EventDetail | null>(null);
  readonly celular = input(false);
  readonly speakers = input<Speaker[]>([]);

  readonly saved = output<EventDetail>();
  readonly preview = output<{ id: string }>();
  readonly deleted = output<void>();
  readonly back = output<void>();

  readonly hhmm = hhmm;
  readonly formatDateBr = formatDateBr;
  readonly formatStamp = formatStamp;
  readonly initials = initials;

  /** O evento como está salvo agora — o input no começo, a resposta da API depois. */
  readonly atual = signal<EventDetail | null>(null);

  readonly salvando = signal(false);
  readonly capaNova = signal<File | null>(null);
  readonly capaPrevia = signal<string | null>(null);
  readonly removerCapa = signal(false);
  readonly erroCapa = signal('');
  readonly excluindo = signal(false);

  readonly opcoesEmpresa = computed(() => this.companies.items().map(c => ({
    label: c.address ? `${c.name} — ${c.address.formatted || formatAddress(c.address)}` : `${c.name} (sem endereço)`,
    value: c.id,
  })));

  // ── Evento ─────────────────────────────────────────────────────────────────

  readonly enderecoEvento: FormGroup = addressGroup(this.fb);

  readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    locationType: ['COMPANY' as EventLocationType | 'NONE'],
    companyId: [null as string | null],
    placeName: ['', Validators.maxLength(150)],
    address: this.enderecoEvento,
    audienceAll: [true],
    audienceCompanyIds: [[] as string[]],
    audienceDepartmentIds: [[] as string[]],
    audienceEmployeeIds: [[] as string[]],
    reminderEnabled: [false],
    reminderTime: ['09:00:00'],
    reminderDaysBefore: [3 as number | null],
  });

  private readonly valorEvento = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)));

  readonly tipoLocalEvento = computed(() => this.valorEvento()?.locationType ?? 'NONE');

  readonly mapaEvento = computed(() => this.mapaDe(this.valorEvento(), 'NONE'));

  // ── Convidados e lembrete ───────────────────────────────────────────────────

  /** Empresas, setores e pessoas dos seletores — por `/audience-options`, e não pelo RH. */
  readonly opcoesPublico = signal<AudienceOptions>({ companies: [], departments: [], employees: [] });

  readonly opcoesEmpresasPublico = computed(() => this.paraSelect(this.opcoesPublico().companies));
  readonly opcoesSetoresPublico = computed(() => this.paraSelect(this.opcoesPublico().departments));
  readonly opcoesPessoasPublico = computed(() => this.paraSelect(this.opcoesPublico().employees));

  /** O lembrete roda de hora em hora: só hora cheia. */
  readonly opcoesHora = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, '0');
    return { label: `${hh}:00`, value: `${hh}:00:00` };
  });

  readonly publicoTodos = computed(() => this.valorEvento()?.audienceAll !== false);
  readonly lembreteLigado = computed(() => !!this.valorEvento()?.reminderEnabled);

  readonly publicoVazio = computed(() => {
    const v = this.valorEvento();
    return v?.audienceAll === false
      && !v.audienceCompanyIds?.length && !v.audienceDepartmentIds?.length && !v.audienceEmployeeIds?.length;
  });

  /** "a partir de 03/10" — o primeiro dia do lembrete, para conferir a conta antes de salvar. */
  readonly inicioDoLembrete = computed(() => {
    const v = this.valorEvento();
    const dias = Number(v?.reminderDaysBefore);
    if (!v?.startDate || !Number.isInteger(dias) || dias < 1) return null;
    const [y, m, d] = String(v.startDate).split('-').map(Number);
    const dia = new Date(Date.UTC(y, m - 1, d - dias));
    return `${String(dia.getUTCDate()).padStart(2, '0')}/${String(dia.getUTCMonth() + 1).padStart(2, '0')}`;
  });

  /** "até o início do evento (06/10, às 08:00)" — o prazo é o mesmo das respostas. */
  readonly prazoDoLembrete = computed(() => {
    const e = this.atual();
    return e?.startsAt ? formatDeadline(e.startsAt) : null;
  });

  private paraSelect(lista: AudienceOption[]): { label: string; value: string }[] {
    return lista.map(o => ({ label: o.detail ? `${o.name} — ${o.detail}` : o.name, value: o.id }));
  }

  readonly periodoInvalido = computed(() => {
    const v = this.valorEvento();
    return !!v?.startDate && !!v?.endDate && v.endDate < v.startDate;
  });

  // ── Programação ────────────────────────────────────────────────────────────

  readonly dias = computed(() => {
    const e = this.atual();
    return e ? eventDays(e.startDate, e.endDate) : [];
  });

  readonly programacao = computed(() => {
    const e = this.atual();
    if (!e) return [];
    const ordenadas = [...e.talks].sort((a, b) =>
      (a.date + hhmm(a.startTime)).localeCompare(b.date + hhmm(b.startTime)));
    return this.dias().map(d => ({ dia: d, rotulo: dayTab(d).rotulo, palestras: ordenadas.filter(t => t.date === d) }));
  });

  readonly palestra = signal<EventTalk | 'nova' | null>(null);
  readonly salvandoPalestra = signal(false);
  readonly excluindoPalestra = signal<EventTalk | null>(null);
  readonly palestrantesEscolhidos = signal<Speaker[]>([]);
  readonly palestranteParaAdicionar = signal<string | null>(null);

  readonly enderecoPalestra: FormGroup = addressGroup(this.fb);

  readonly formPalestra: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    date: ['', Validators.required],
    startTime: ['', Validators.required],
    endTime: ['', Validators.required],
    room: ['', Validators.maxLength(100)],
    locationType: ['EVENT' as TalkLocationType],
    companyId: [null as string | null],
    placeName: ['', Validators.maxLength(150)],
    address: this.enderecoPalestra,
  });

  private readonly valorPalestra = toSignal(this.formPalestra.valueChanges.pipe(startWith(this.formPalestra.value)));

  readonly tipoLocalPalestra = computed(() => this.valorPalestra()?.locationType ?? 'EVENT');

  readonly mapaPalestra = computed(() => this.mapaDe(this.valorPalestra(), 'EVENT'));

  /**
   * O que mostrar no mapa: o texto e, quando existe, o ponto exato.
   *
   * O ponto vem pronto da empresa escolhida ou sai dos campos escondidos que o
   * `app-address-fields` preenche pelo Nominatim enquanto se digita — é o que
   * deixa o mapa cair no lugar certo em vez de procurar pelo texto, e é o que o
   * botão do Uber exige para aparecer depois, na visualização.
   *
   * @param semLocal o `locationType` que significa "não tem lugar próprio":
   *                 `NONE` no evento, `EVENT` na palestra, que herda o do evento.
   */
  private mapaDe(v: { locationType?: string; companyId?: string | null; address?: Address | null } | undefined,
                 semLocal: string): { texto: string; ponto: Coordinates | null } {
    const vazio = { texto: '', ponto: null };
    if (!v || v.locationType === semLocal) return vazio;

    if (v.locationType === 'COMPANY') {
      const empresa = this.companies.items().find(c => c.id === v.companyId);
      if (!empresa?.address) return vazio;
      return {
        texto: empresa.address.formatted || formatAddress(empresa.address),
        ponto: coordinatesOf(empresa.address),
      };
    }

    if (v.locationType === 'ADDRESS' && isUsableAddress(v.address)) {
      return { texto: formatAddress(v.address), ponto: coordinatesOf(v.address) };
    }

    return vazio;
  }

  readonly horarioInvalido = computed(() => {
    const v = this.valorPalestra();
    return !!v?.startTime && !!v?.endTime && v.endTime <= v.startTime;
  });

  readonly opcoesDia = computed(() => this.dias().map(d => ({ label: dayTab(d).rotulo, value: d })));

  readonly opcoesPalestrante = computed(() => {
    const escolhidos = new Set(this.palestrantesEscolhidos().map(s => s.id));
    return this.speakers().filter(s => !escolhidos.has(s.id)).map(s => ({
      label: s.role ? `${s.name} — ${s.role}` : s.name, value: s.id,
    }));
  });

  constructor() {
    effect(() => {
      const e = this.event();
      untracked(() => this.preencher(e));
    });
  }

  ngOnInit(): void {
    this.companies.load();
    // Sem as opções, "Escolher" fica com os seletores vazios — e o "Todos" continua funcionando.
    this.service.audienceOptions().subscribe({
      next: opcoes => this.opcoesPublico.set(opcoes),
      error: () => undefined,
    });
  }

  titulo(): string {
    return this.atual() ? 'Editar evento' : 'Novo evento';
  }

  private preencher(e: EventDetail | null): void {
    this.atual.set(e);
    this.capaNova.set(null);
    this.capaPrevia.set(e?.coverUrl ? urlDeMidia(e.coverUrl, '') : null);
    this.removerCapa.set(false);
    this.erroCapa.set('');

    const endereco = e?.locationType === 'ADDRESS' ? e.location?.address : null;
    this.form.reset({
      name: e?.name ?? '',
      description: e?.description ?? '',
      startDate: e?.startDate ?? '',
      endDate: e?.endDate ?? '',
      locationType: e ? (e.locationType ?? 'NONE') : 'COMPANY',
      companyId: e?.locationType === 'COMPANY' ? e.location?.companyId ?? null : null,
      placeName: e?.locationType === 'ADDRESS' ? e.location?.name ?? '' : '',
      address: addressPatch(endereco),
      audienceAll: e?.settings?.audienceAll ?? true,
      audienceCompanyIds: e?.settings?.companies.map(o => o.id) ?? [],
      audienceDepartmentIds: e?.settings?.departments.map(o => o.id) ?? [],
      audienceEmployeeIds: e?.settings?.employees.map(o => o.id) ?? [],
      reminderEnabled: e?.settings?.reminderEnabled ?? false,
      reminderTime: e?.settings?.reminderTime ?? '09:00:00',
      reminderDaysBefore: e?.settings?.reminderDaysBefore ?? 3,
    });
    this.incluirEscolhidosNasOpcoes(e);
  }

  /**
   * Quem foi escolhido e depois saiu do cadastro de opções (desligado, por
   * exemplo) continua aparecendo no seletor — senão o chip sumiria calado e o
   * próximo "Salvar" tiraria a pessoa sem ninguém ter pedido.
   */
  private incluirEscolhidosNasOpcoes(e: EventDetail | null): void {
    const s = e?.settings;
    if (!s) return;
    const junta = (atuais: AudienceOption[], escolhidos: AudienceOption[]) => {
      const ids = new Set(atuais.map(o => o.id));
      return [...atuais, ...escolhidos.filter(o => !ids.has(o.id))];
    };
    this.opcoesPublico.update(o => ({
      companies: junta(o.companies, s.companies),
      departments: junta(o.departments, s.departments),
      employees: junta(o.employees, s.employees),
    }));
  }

  aoEscolherCapa(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0] ?? null;
    input.value = '';
    this.erroCapa.set('');
    if (!arquivo) return;
    if (!/\.(jpe?g|png|webp)$/i.test(arquivo.name)) {
      this.erroCapa.set('Envie a capa em JPG, PNG ou WEBP.');
      return;
    }
    if (arquivo.size > 8 * 1024 * 1024) {
      this.erroCapa.set('A capa passa de 8 MB.');
      return;
    }
    this.capaNova.set(arquivo);
    this.capaPrevia.set(URL.createObjectURL(arquivo));
    this.removerCapa.set(false);
  }

  tirarCapa(): void {
    this.capaNova.set(null);
    this.capaPrevia.set(null);
    this.removerCapa.set(true);
  }

  salvar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.periodoInvalido() || this.salvando()) return;

    const v = this.form.getRawValue();
    const tipo = v.locationType === 'NONE' ? null : v.locationType as EventLocationType;
    if (tipo === 'COMPANY' && !v.companyId) {
      this.erro('Escolha a empresa do grupo.');
      return;
    }
    const endereco = addressFromGroup(this.enderecoEvento);
    const dias = Number(v.reminderDaysBefore);
    if (v.reminderEnabled && (!Number.isInteger(dias) || dias < 1 || dias > 60)) {
      this.erro('O lembrete começa de 1 a 60 dias antes do evento.');
      return;
    }
    if (this.publicoVazio()) {
      this.erro('Escolha pelo menos uma empresa, um setor ou uma pessoa para convidar.');
      return;
    }
    const todos = v.audienceAll !== false;

    const dados: EventRequest = {
      name: v.name.trim(),
      description: (v.description ?? '').trim() || null,
      startDate: v.startDate,
      endDate: v.endDate,
      locationType: tipo,
      companyId: tipo === 'COMPANY' ? v.companyId : null,
      placeName: tipo === 'ADDRESS' ? (v.placeName ?? '').trim() || null : null,
      address: tipo === 'ADDRESS' && !vazio(endereco) ? endereco : null,
      removeCover: this.removerCapa(),
      audienceAll: todos,
      audienceCompanyIds: todos ? [] : v.audienceCompanyIds ?? [],
      audienceDepartmentIds: todos ? [] : v.audienceDepartmentIds ?? [],
      audienceEmployeeIds: todos ? [] : v.audienceEmployeeIds ?? [],
      reminderEnabled: !!v.reminderEnabled,
      reminderTime: v.reminderEnabled ? v.reminderTime : null,
      reminderDaysBefore: v.reminderEnabled ? Number(v.reminderDaysBefore) : null,
    };

    const e = this.atual();
    const chamada = e ? this.service.update(e.id, dados, this.capaNova()) : this.service.create(dados, this.capaNova());

    this.salvando.set(true);
    chamada.subscribe({
      next: detalhe => {
        this.salvando.set(false);
        this.messages.add({
          severity: 'success', summary: 'Salvo',
          detail: e ? 'Alterações salvas.' : 'Evento criado como rascunho. Agora monte a programação.',
        });
        this.preencher(detalhe);
        this.saved.emit(detalhe);
      },
      error: err => {
        this.salvando.set(false);
        this.erroDaApi(err, 'Não foi possível salvar o evento.');
      },
    });
  }

  publicar(publicado: boolean): void {
    const e = this.atual();
    if (!e) return;
    const chamada = publicado ? this.service.publish(e.id) : this.service.unpublish(e.id);
    chamada.subscribe({
      next: detalhe => {
        this.atual.set(detalhe);
        this.saved.emit(detalhe);
        this.messages.add({
          severity: 'success', summary: publicado ? 'Publicado' : 'Rascunho',
          detail: publicado ? 'O evento já aparece em Documentos.' : 'O evento saiu de Documentos.',
        });
      },
      error: err => this.erroDaApi(err, 'Não foi possível mudar a publicação.'),
    });
  }

  confirmarExclusao(): void {
    const e = this.atual();
    if (!e) return;
    this.service.delete(e.id).subscribe({
      next: () => {
        this.excluindo.set(false);
        this.messages.add({ severity: 'success', summary: 'Excluído', detail: `${e.name} foi excluído.` });
        this.deleted.emit();
      },
      error: err => this.erroDaApi(err, 'Não foi possível excluir.'),
    });
  }

  // ── Palestra ───────────────────────────────────────────────────────────────

  abrirPalestra(t: EventTalk | 'nova'): void {
    const p = t === 'nova' ? null : t;
    const endereco = p?.locationType === 'ADDRESS' ? p.location?.address : null;
    this.formPalestra.reset({
      title: p?.title ?? '',
      description: p?.description ?? '',
      date: p?.date ?? this.dias()[0] ?? '',
      startTime: p ? hhmm(p.startTime) : '',
      endTime: p ? hhmm(p.endTime) : '',
      room: p?.room ?? '',
      locationType: p?.locationType ?? 'EVENT',
      companyId: p?.locationType === 'COMPANY' ? p.location?.companyId ?? null : null,
      placeName: p?.locationType === 'ADDRESS' ? p.location?.name ?? '' : '',
      address: addressPatch(endereco),
    });
    this.palestrantesEscolhidos.set(p ? [...p.speakers] : []);
    this.palestranteParaAdicionar.set(null);
    this.palestra.set(t);
  }

  fecharPalestra(): void {
    if (this.salvandoPalestra()) return;
    this.palestra.set(null);
  }

  tituloPalestra(): string {
    return this.palestra() === 'nova' ? 'Nova palestra' : 'Editar palestra';
  }

  adicionarPalestrante(id: string | null): void {
    const escolhido = this.speakers().find(s => s.id === id);
    if (escolhido) this.palestrantesEscolhidos.update(l => [...l, escolhido]);
    // Limpa no próximo ciclo: o select precisa ver o valor antes de voltar a vazio.
    setTimeout(() => this.palestranteParaAdicionar.set(null));
  }

  tirarPalestrante(id: string): void {
    this.palestrantesEscolhidos.update(l => l.filter(s => s.id !== id));
  }

  subirPalestrante(indice: number): void {
    if (indice <= 0) return;
    this.palestrantesEscolhidos.update(l => {
      const nova = [...l];
      [nova[indice - 1], nova[indice]] = [nova[indice], nova[indice - 1]];
      return nova;
    });
  }

  salvarPalestra(): void {
    this.formPalestra.markAllAsTouched();
    const e = this.atual();
    if (!e || this.formPalestra.invalid || this.horarioInvalido() || this.salvandoPalestra()) return;

    const v = this.formPalestra.getRawValue();
    const tipo = v.locationType as TalkLocationType;
    const endereco = addressFromGroup(this.enderecoPalestra);

    if (tipo === 'COMPANY' && !v.companyId) {
      this.erro('Escolha a empresa do grupo.');
      return;
    }
    if (tipo === 'ADDRESS' && (!(v.placeName ?? '').trim() || !isUsableAddress(endereco))) {
      this.erro('Informe o nome do lugar e pelo menos a rua e a cidade.');
      return;
    }

    const dados: TalkRequest = {
      title: v.title.trim(),
      description: (v.description ?? '').trim() || null,
      date: v.date,
      startTime: v.startTime,
      endTime: v.endTime,
      room: (v.room ?? '').trim() || null,
      locationType: tipo,
      companyId: tipo === 'COMPANY' ? v.companyId : null,
      placeName: tipo === 'ADDRESS' ? v.placeName.trim() : null,
      address: tipo === 'ADDRESS' ? endereco : null,
      speakerIds: this.palestrantesEscolhidos().map(s => s.id),
    };

    const atual = this.palestra();
    const chamada = atual && atual !== 'nova'
      ? this.service.updateTalk(e.id, atual.id, dados)
      : this.service.addTalk(e.id, dados);

    this.salvandoPalestra.set(true);
    chamada.subscribe({
      next: detalhe => {
        this.salvandoPalestra.set(false);
        this.palestra.set(null);
        this.atual.set(detalhe);
        this.saved.emit(detalhe);
      },
      error: err => {
        this.salvandoPalestra.set(false);
        this.erroDaApi(err, 'Não foi possível salvar a palestra.');
      },
    });
  }

  confirmarExclusaoPalestra(): void {
    const e = this.atual();
    const t = this.excluindoPalestra();
    if (!e || !t) return;
    this.service.deleteTalk(e.id, t.id).subscribe({
      next: detalhe => {
        this.excluindoPalestra.set(null);
        this.atual.set(detalhe);
        this.saved.emit(detalhe);
      },
      error: err => this.erroDaApi(err, 'Não foi possível excluir a palestra.'),
    });
  }

  ondeDe(t: EventTalk): string {
    if (t.locationType === 'EVENT') return t.room ? t.room : 'Local do evento';
    return [t.location?.name, t.room].filter(Boolean).join(' · ');
  }

  nomesDe(t: EventTalk): string {
    return t.speakers.map(s => s.name).join(', ');
  }

  foto(s: Speaker): string | null {
    return s.photoUrl ? urlDeMidia(s.photoUrl, '') : null;
  }

  private erro(detalhe: string): void {
    this.messages.add({ severity: 'warn', summary: 'Confira', detail: detalhe, life: 5000 });
  }

  private erroDaApi(err: HttpErrorResponse, padrao: string): void {
    const detalhe = err?.status === 400 || err?.status === 409 ? apiMessage(err) ?? padrao : padrao;
    this.messages.add({ severity: 'error', summary: 'Erro', detail: detalhe, life: 6000 });
  }
}
