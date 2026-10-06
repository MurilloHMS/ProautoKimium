import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Observable, catchError, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { PkSheetComponent } from '../../../theme/ProautoKimium/pk-sheet/pk-sheet.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { ButtonDirective } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { ReimbursementService } from '../../../../infrastructure/services/hr/reimbursement.service';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { MedicalCertificateService } from '../../../../infrastructure/services/hr/medical-certificate.service';
import { DocumentRequestService } from '../../../../infrastructure/services/hr/document-request.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { Reimbursement } from '../../../../domain/models/hr/reimbursement.model';
import { VacationRequest } from '../../../../domain/models/hr/vacation-request.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { Recipient } from '../../../../domain/models/hr/document-request.model';
import { RequestReviewComponent } from '../document-requests/request-review/request-review.component';
import { formatDateBr, formatStampBr } from '../../../../domain/utils/date-only';
import { apiMessage } from '../../../../domain/utils/api-error';
import {
  ReimbursementAlert,
  ReimbursementGroup,
  alertsFor,
  groupByEmployee,
  isPdfReceipt,
  usualByCategory,
  waitingFor,
} from './pending-queue.logic';

export type PendingKind = 'REEMBOLSO' | 'FERIAS' | 'ATESTADO' | 'SOLICITACAO';
type ReimbursementFilter = 'ALL' | 'ALERT' | 'SMALL';

/** O valor que conta como "pedido pequeno" no chip "Até R$ 100". */
export const SMALL_AMOUNT = 100;

/** A tela de cada tipo — quem não tem a tela não vê a fila dele. */
const SCREEN: Record<PendingKind, string> = {
  REEMBOLSO: 'rh/reimbursements',
  FERIAS: 'rh/vacation-requests',
  ATESTADO: 'rh/medical-certificates',
  SOLICITACAO: 'rh/document-requests',
};

/**
 * Conferência de um pedido só: férias ou atestado.
 *
 * Abre pelo clique na linha (2026-10-05, pedido dele: "quero visualizar o que
 * foi enviado"). `focus` é só por onde a janela começa: o ✗ da linha já põe o
 * cursor no motivo. A decisão é sempre o botão que a pessoa aperta no rodapé.
 */
interface SingleReview {
  kind: 'FERIAS' | 'ATESTADO';
  focus?: 'reject';
  vacation?: VacationRequest;
  certificate?: MedicalCertificate;
}

/**
 * Pendências do RH (opção 2, aprovada em 2026-10-02): uma fila por tipo.
 *
 * Com ~100 reembolsos por dia, uma lista misturada enterrava férias e atestados.
 * Aqui cada tipo tem a sua fila; os reembolsos vêm agrupados por pessoa, com
 * alertas, aprovação em lote para o que não tem alerta, e a conferência em
 * sequência: um comprovante por vez, aberto na tela, com atalho de teclado.
 *
 * Não há endpoint novo: a tela compõe as listas de pendentes que já existem, e
 * o lote é a aprovação de hoje chamada uma vez por pedido.
 */
@Component({
  selector: 'app-pending-queue',
  standalone: true,
  imports: [
    CommonModule, FormsModule, Toast, PkButtonComponent, PkDialogComponent, PkSheetComponent, PkTableComponent,
    ToolbarComponent, ButtonDirective, Tooltip, RequestReviewComponent,
  ],
  templateUrl: './pending-queue.component.html',
  styleUrl: './pending-queue.component.scss',
  providers: [MessageService],
})
export class PendingQueueComponent implements OnInit, OnDestroy {
  private readonly reimbursements = inject(ReimbursementService);
  private readonly vacations = inject(VacationRequestService);
  private readonly certificates = inject(MedicalCertificateService);
  private readonly requests = inject(DocumentRequestService);
  private readonly employees = inject(EmployeeStore);
  private readonly permissions = inject(PermissionStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly messages = inject(MessageService);

  readonly ehCelular = ehCelular();
  readonly now = signal(new Date());
  readonly smallAmount = SMALL_AMOUNT;

  readonly loading = signal(false);
  readonly pendingReimbursements = signal<Reimbursement[]>([]);
  /** Os pedidos do mês e do anterior, todos os status: a base da mediana por categoria. */
  readonly baseline = signal<Reimbursement[]>([]);
  readonly pendingVacations = signal<VacationRequest[]>([]);
  readonly pendingCertificates = signal<MedicalCertificate[]>([]);
  /** Respostas de Solicitações do RH esperando conferência, a mais antiga primeiro. */
  readonly pendingAnswers = signal<Recipient[]>([]);
  /** A resposta aberta na conferência. */
  readonly reviewing = signal<Recipient | null>(null);
  /** Quem só consulta a tela das Solicitações vê a fila, mas não aprova nem devolve. */
  readonly canDecideAnswers = computed(() => this.permissions.can(SCREEN.SOLICITACAO, 'ALTERAR'));

  /** Os tipos que esta pessoa pode ver, na ordem da tela. */
  readonly kinds = computed<PendingKind[]>(() =>
    (['REEMBOLSO', 'FERIAS', 'ATESTADO', 'SOLICITACAO'] as PendingKind[]).filter(k => this.permissions.canOpen(SCREEN[k])));
  readonly kind = signal<PendingKind>('REEMBOLSO');
  readonly filter = signal<ReimbursementFilter>('ALL');
  /** A busca da barra, por nome, nas três filas. */
  readonly query = signal('');
  readonly emptySelection: ReadonlySet<string> = new Set();

  readonly alerts = computed(() =>
    alertsFor(this.pendingReimbursements(), usualByCategory([...this.baseline(), ...this.pendingReimbursements()])));

  readonly groups = computed<ReimbursementGroup[]>(() =>
    groupByEmployee(this.pendingReimbursements(), id => this.employees.nameOf(id), this.alerts()));

  /** O filtro age nos pedidos de dentro do grupo; grupo que esvazia some. */
  readonly visibleGroups = computed<ReimbursementGroup[]>(() => {
    const f = this.filter();
    const named = this.groups().filter(g => this.matches(g.employeeName));
    if (f === 'ALL') return named;
    return named
      .map(g => {
        const items = g.items.filter(r => f === 'ALERT' ? g.alerts.has(r.id) : Number(r.amount) <= SMALL_AMOUNT);
        return { ...g, items, total: items.reduce((s, r) => s + Number(r.amount), 0) };
      })
      .filter(g => g.items.length > 0);
  });

  readonly visibleVacations = computed(() =>
    this.pendingVacations().filter(v => this.matches(this.employees.nameOf(v.employeeId))));
  readonly visibleCertificates = computed(() =>
    this.pendingCertificates().filter(c => this.matches(c.employeeName)));
  readonly visibleAnswers = computed(() =>
    this.pendingAnswers().filter(a => this.matches(a.employeeName) || this.matches(a.requestTitle)));

  readonly alertCount = computed(() => this.alerts().size);
  readonly smallCount = computed(() => this.pendingReimbursements().filter(r => Number(r.amount) <= SMALL_AMOUNT).length);
  readonly reimbursementTotal = computed(() => this.pendingReimbursements().reduce((s, r) => s + Number(r.amount), 0));

  // ---- Seleção e lote ----
  readonly selected = signal<ReadonlySet<string>>(new Set());
  /** Os pedidos que o lote aprovaria: dos grupos marcados, só os visíveis e sem alerta. */
  readonly selectedItems = computed<Reimbursement[]>(() => {
    const ids = this.selected();
    return this.visibleGroups()
      .filter(g => ids.has(g.employeeId))
      .flatMap(g => g.items.filter(r => !g.alerts.has(r.id)));
  });
  readonly selectedTotal = computed(() => this.selectedItems().reduce((s, r) => s + Number(r.amount), 0));
  readonly batchRunning = signal(false);
  readonly batchConfirm = signal(false);

  // ---- Conferência em sequência ----
  readonly sequence = signal<Reimbursement[]>([]);
  readonly position = signal(0);
  readonly current = computed<Reimbursement | null>(() => this.sequence()[this.position()] ?? null);
  readonly isFirst = computed(() => this.position() === 0);
  readonly isLast = computed(() => this.position() >= this.sequence().length - 1);
  /** O que já foi decidido nesta sequência, para a fileira de bolinhas. */
  readonly decided = signal<ReadonlyMap<string, 'approved' | 'rejected'>>(new Map());
  /** O que já foi decidido no pedido aberto — voltando a ele, não se decide de novo. */
  readonly currentDecision = computed(() => {
    const r = this.current();
    return r ? this.decided().get(r.id) ?? null : null;
  });
  sequenceNotes = '';
  readonly sequenceSaving = signal(false);
  readonly preview = signal<{ url: SafeResourceUrl; raw: string; isPdf: boolean } | null>(null);
  readonly previewError = signal(false);

  // ---- Revisão de um pedido só (férias e atestados) ----
  readonly single = signal<SingleReview | null>(null);
  singleNotes = '';
  readonly singleSaving = signal(false);

  ngOnInit(): void {
    const first = this.kinds()[0];
    if (first) this.kind.set(first);
    this.employees.load();
    this.load();
  }

  ngOnDestroy(): void {
    this.releasePreview();
    this.releaseSinglePreview();
  }

  load(): void {
    this.loading.set(true);
    this.now.set(new Date());
    const kinds = this.kinds();
    const months = [monthOf(this.now(), 0), monthOf(this.now(), -1)];

    const reimbursements$: Observable<[Reimbursement[], Reimbursement[]]> = kinds.includes('REEMBOLSO')
      ? forkJoin([
          this.reimbursements.getAll('PENDING'),
          forkJoin(months.map(m => this.reimbursements.getAll(undefined, m).pipe(catchError(() => of([]))))).pipe(
            map(lists => lists.flat())),
        ])
      : of([[], []] as [Reimbursement[], Reimbursement[]]);
    const vacations$ = kinds.includes('FERIAS') ? this.vacations.getAll('PENDING') : of([] as VacationRequest[]);
    const certificates$ = kinds.includes('ATESTADO') ? this.certificates.getAll('PENDING') : of([] as MedicalCertificate[]);
    const answers$ = kinds.includes('SOLICITACAO') ? this.requests.awaitingReview() : of([] as Recipient[]);

    forkJoin([reimbursements$, vacations$, certificates$, answers$]).subscribe({
      next: ([[pending, baseline], vacations, certificates, answers]) => {
        this.pendingAnswers.set(answers);
        this.pendingReimbursements.set(pending);
        this.baseline.set(baseline);
        this.pendingVacations.set([...vacations].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)));
        this.pendingCertificates.set([...certificates].sort((a, b) =>
          (a.resubmittedAt ?? a.submittedAt).localeCompare(b.resubmittedAt ?? b.submittedAt)));
        this.selected.set(new Set());
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error(err, 'Não foi possível carregar as pendências.');
      },
    });
  }

  // ---- Leitura ----

  count(kind: PendingKind): number {
    switch (kind) {
      case 'REEMBOLSO': return this.pendingReimbursements().length;
      case 'FERIAS': return this.pendingVacations().length;
      case 'SOLICITACAO': return this.pendingAnswers().length;
      default: return this.pendingCertificates().length;
    }
  }

  oldest(kind: PendingKind): string | null {
    const dates = kind === 'REEMBOLSO' ? this.pendingReimbursements().map(r => r.requestedAt)
      : kind === 'FERIAS' ? this.pendingVacations().map(v => v.requestedAt)
      : kind === 'SOLICITACAO' ? this.pendingAnswers().map(a => a.submittedAt ?? a.addedAt)
      : this.pendingCertificates().map(c => c.resubmittedAt ?? c.submittedAt);
    if (!dates.length) return null;
    return waitingFor(dates.reduce((a, b) => (a < b ? a : b)), this.now());
  }

  icon(kind: PendingKind): string {
    return kind === 'REEMBOLSO' ? 'pi pi-wallet' : kind === 'FERIAS' ? 'pi pi-sun'
      : kind === 'SOLICITACAO' ? 'pi pi-inbox' : 'pi pi-file-check';
  }

  search(term: string): void {
    this.query.set(term);
  }

  isSelected(group: ReimbursementGroup): boolean {
    return this.selected().has(group.employeeId);
  }

  /** Sem acento e sem caixa: "joao" acha "João". */
  private matches(name: string | null | undefined): boolean {
    const q = fold(this.query().trim());
    return !q || fold(name ?? '').includes(q);
  }

  label(kind: PendingKind): string {
    return kind === 'REEMBOLSO' ? 'Reembolsos' : kind === 'FERIAS' ? 'Férias'
      : kind === 'SOLICITACAO' ? 'Solicitações' : 'Atestados';
  }

  waiting(since: string): string {
    return waitingFor(since, this.now());
  }

  nameOf(employeeId: string): string {
    return this.employees.nameOf(employeeId);
  }

  groupAlerts(group: ReimbursementGroup): ReimbursementAlert[] {
    const seen = new Set<string>();
    return [...group.alerts.values()].flat().filter(a => !seen.has(a.label) && !!seen.add(a.label));
  }

  alertsOf(r: Reimbursement): ReimbursementAlert[] {
    return this.alerts().get(r.id) ?? [];
  }

  formatDate(iso: string | null): string {
    return iso ? formatDateBr(iso) : '';
  }

  formatStamp(iso: string | null): string {
    return iso ? formatStampBr(iso) : '';
  }

  // ---- Seleção ----

  /** Grupo só com pedidos em alerta não entra no lote: precisa ser conferido um a um. */
  canSelect(group: ReimbursementGroup): boolean {
    return group.items.some(r => !group.alerts.has(r.id));
  }

  toggle(group: ReimbursementGroup): void {
    if (!this.canSelect(group)) return;
    const next = new Set(this.selected());
    if (next.has(group.employeeId)) next.delete(group.employeeId); else next.add(group.employeeId);
    this.selected.set(next);
  }

  toggleAll(): void {
    const selectable = this.visibleGroups().filter(g => this.canSelect(g)).map(g => g.employeeId);
    const all = selectable.length > 0 && selectable.every(id => this.selected().has(id));
    this.selected.set(all ? new Set() : new Set(selectable));
  }

  allSelected(): boolean {
    const selectable = this.visibleGroups().filter(g => this.canSelect(g));
    return selectable.length > 0 && selectable.every(g => this.selected().has(g.employeeId));
  }

  setFilter(f: ReimbursementFilter): void {
    this.filter.set(f);
    this.selected.set(new Set());
  }

  // ---- Lote ----

  /**
   * Aprova os selecionados, um pedido por vez — é a aprovação de hoje, sem
   * endpoint novo. Um que falhe (o próprio pedido de quem aprova, por exemplo)
   * não para os outros: no fim, o resumo diz quantos foram e o porquê dos que
   * não foram.
   */
  approveSelected(): void {
    const items = this.selectedItems();
    if (!items.length || this.batchRunning()) return;
    this.batchConfirm.set(false);
    this.batchRunning.set(true);

    from(items).pipe(
      concatMap(r => this.reimbursements.approve(r.id, { notes: '' }).pipe(
        map(() => null as string | null),
        catchError((err: HttpErrorResponse) => of(`${this.nameOf(r.employeeId)}: ${apiMessage(err) ?? 'falhou'}`)),
      )),
      toArray(),
    ).subscribe(results => {
      this.batchRunning.set(false);
      const failures = results.filter((x): x is string => x !== null);
      const ok = results.length - failures.length;
      if (ok) {
        this.messages.add({ severity: 'success', summary: 'Aprovados', detail: `${ok} reembolso(s) aprovado(s).` });
      }
      if (failures.length) {
        this.messages.add({
          severity: 'warn', summary: `${failures.length} não aprovado(s)`, detail: unique(failures).join(' · '), life: 10000,
        });
      }
      this.load();
    });
  }

  // ---- Sequência ----

  startSequence(group?: ReimbursementGroup, event?: Event): void {
    event?.stopPropagation();
    const items = group ? group.items
      : this.visibleGroups().filter(g => this.selected().has(g.employeeId)).flatMap(g => g.items);
    if (!items.length) return;
    this.sequence.set(items);
    this.decided.set(new Map());
    this.position.set(0);
    this.openCurrent();
  }

  closeSequence(): void {
    const hadDecisions = this.decided().size > 0;
    this.sequence.set([]);
    this.releasePreview();
    if (hadDecisions) this.load();
  }

  decide(action: 'approve' | 'reject'): void {
    const r = this.current();
    // Decidido já não está pendente: a API recusaria a segunda decisão.
    if (!r || this.sequenceSaving() || this.currentDecision()) return;
    const notes = this.sequenceNotes.trim();
    if (action === 'reject' && !notes) return;

    this.sequenceSaving.set(true);
    const call = action === 'approve'
      ? this.reimbursements.approve(r.id, { notes })
      : this.reimbursements.reject(r.id, { notes });
    call.subscribe({
      next: () => {
        this.sequenceSaving.set(false);
        this.decided.set(new Map(this.decided()).set(r.id, action === 'approve' ? 'approved' : 'rejected'));
        this.next();
      },
      error: (err: HttpErrorResponse) => {
        this.sequenceSaving.set(false);
        this.error(err, 'Não foi possível registrar a decisão.');
      },
    });
  }

  /** Volta um pedido. No primeiro, não faz nada. */
  previous(): void {
    if (this.isFirst()) return;
    this.position.set(this.position() - 1);
    this.openCurrent();
  }

  next(): void {
    if (this.position() + 1 >= this.sequence().length) {
      const n = this.decided().size;
      this.messages.add({ severity: 'success', summary: 'Sequência concluída', detail: `${n} de ${this.sequence().length} decidido(s).` });
      this.closeSequence();
      return;
    }
    this.position.set(this.position() + 1);
    this.openCurrent();
  }

  /** A, R, ← e →. Dentro do campo de motivo as letras são texto, não atalho. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (!this.current() || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
    const key = event.key.toLowerCase();
    if (key === 'a') { event.preventDefault(); this.decide('approve'); }
    else if (key === 'r') {
      event.preventDefault();
      if (this.sequenceNotes.trim()) this.decide('reject');
      else document.getElementById('sequenceNotes')?.focus();
    }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.next(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); this.previous(); }
  }

  private openCurrent(): void {
    this.sequenceNotes = '';
    this.releasePreview();
    // O foco vai para o comprovante a cada pedido: depois de recusar, ele
    // estava no campo de motivo, e o atalho seguinte virava texto.
    setTimeout(() => document.getElementById('sequenceReceipt')?.focus());
    const r = this.current();
    if (!r) return;
    this.reimbursements.downloadReceipt(r.id).subscribe({
      next: resp => {
        if (this.current()?.id !== r.id || !resp.body) return;
        const raw = URL.createObjectURL(resp.body);
        const isPdf = isPdfReceipt(resp.body.type, r.receiptOriginalFilename);
        this.preview.set({ raw, isPdf, url: this.sanitizer.bypassSecurityTrustResourceUrl(raw) });
      },
      error: () => this.previewError.set(true),
    });
  }

  private releasePreview(): void {
    const p = this.preview();
    if (p) URL.revokeObjectURL(p.raw);
    this.preview.set(null);
    this.previewError.set(false);
  }

  // ---- Férias e atestados ----

  openSingle(review: SingleReview, event?: Event): void {
    event?.stopPropagation();
    this.singleNotes = '';
    this.releaseSinglePreview();
    this.single.set(review);
    if (review.certificate) this.loadCertificatePreview(review.certificate);
    if (review.focus === 'reject') setTimeout(() => document.getElementById('singleNotes')?.focus(), 50);
  }

  closeSingle(): void {
    this.single.set(null);
    this.releaseSinglePreview();
  }

  /** Recusar exige o motivo: é o que a pessoa lê para saber o que fazer. */
  get canRejectSingle(): boolean {
    return this.singleNotes.trim().length > 0;
  }

  confirmSingle(action: 'approve' | 'reject'): void {
    const s = this.single();
    if (!s || this.singleSaving()) return;
    if (action === 'reject' && !this.canRejectSingle) return;
    const notes = this.singleNotes.trim();
    let call: Observable<unknown>;
    if (s.kind === 'FERIAS') {
      call = action === 'approve'
        ? this.vacations.approve(s.vacation!.id, { notes })
        : this.vacations.reject(s.vacation!.id, { notes });
    } else {
      call = action === 'approve'
        ? this.certificates.confirmReceipt(s.certificate!.id, notes || null)
        : this.certificates.reject(s.certificate!.id, notes);
    }
    this.singleSaving.set(true);
    call.subscribe({
      next: () => {
        this.singleSaving.set(false);
        this.closeSingle();
        this.messages.add({ severity: 'success', summary: 'Pronto', detail: 'Decisão registrada. A pessoa foi avisada.' });
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.singleSaving.set(false);
        this.error(err, 'Não foi possível registrar a decisão.');
      },
    });
  }

  singleTitle(): string {
    const s = this.single();
    if (!s) return '';
    return s.kind === 'FERIAS'
      ? `Férias · ${this.nameOf(s.vacation!.employeeId)}`
      : `Atestado · ${s.certificate!.employeeName}`;
  }

  // ---- O arquivo do atestado, na tela ----

  readonly singlePreview = signal<{ url: SafeResourceUrl; raw: string; isPdf: boolean } | null>(null);
  readonly singlePreviewError = signal(false);

  private loadCertificatePreview(c: MedicalCertificate): void {
    this.certificates.download(c.id).subscribe({
      next: resp => {
        if (this.single()?.certificate?.id !== c.id || !resp.body) return;
        const raw = URL.createObjectURL(resp.body);
        const isPdf = isPdfReceipt(resp.body.type, c.originalFilename);
        this.singlePreview.set({ raw, isPdf, url: this.sanitizer.bypassSecurityTrustResourceUrl(raw) });
      },
      error: () => this.singlePreviewError.set(true),
    });
  }

  private releaseSinglePreview(): void {
    const p = this.singlePreview();
    if (p) URL.revokeObjectURL(p.raw);
    this.singlePreview.set(null);
    this.singlePreviewError.set(false);
  }

  /** Um arquivo recusado da trilha do atestado. */
  downloadAttempt(c: MedicalCertificate, attemptId: string, filename: string): void {
    this.certificates.downloadAttempt(c.id, attemptId).subscribe({
      next: resp => resp.body && saveBlob(resp.body, filename),
      error: (err: HttpErrorResponse) => this.error(err, 'Não foi possível baixar o arquivo anterior.'),
    });
  }

  /** O RH precisa ver o atestado antes de confirmar; abre o arquivo atual. */
  downloadCertificate(c: MedicalCertificate, event?: Event): void {
    event?.stopPropagation();
    this.certificates.download(c.id).subscribe({
      next: resp => resp.body && saveBlob(resp.body, c.originalFilename),
      error: (err: HttpErrorResponse) => this.error(err, 'Não foi possível baixar o atestado.'),
    });
  }

  // ---- Solicitações do RH ----

  /** Os arquivos e as respostas, em uma linha: "RG · Camisa: M". */
  answerSummary(a: Recipient): string {
    const files = a.files.length ? `${a.files.length} arquivo(s)` : '';
    const choices = a.form.filter(f => f.type === 'CHOICE' && a.answers[f.key] != null)
      .map(f => `${f.label}: ${a.answers[f.key]}`);
    return [files, ...choices].filter(Boolean).join(' · ') || 'Respostas de texto';
  }

  answerDecided(updated: Recipient): void {
    this.reviewing.set(null);
    this.messages.add({
      severity: 'success', summary: 'Pronto',
      detail: updated.status === 'APPROVED' ? 'Resposta aprovada. A pessoa foi avisada.' : 'Resposta devolvida com o motivo.',
    });
    this.load();
  }

  private error(err: HttpErrorResponse, fallback: string): void {
    this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? fallback });
  }
}

/** "2026-10" do mês de `date`, deslocado `offset` meses. */
function monthOf(date: Date, offset: number): string {
  const d = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
