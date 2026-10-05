import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { CompanyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { PositionStore } from '../../../../infrastructure/state/position.store';
import { PayslipTypeStore } from '../../../../infrastructure/state/payslip-type.store';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { TabsService } from '../../../../infrastructure/services/tabs.service';
import { CareerHistoryService } from '../../../../infrastructure/services/hr/career-history.service';
import { EmployeeDocumentService } from '../../../../infrastructure/services/hr/employee-document.service';
import { EquipmentAssignmentService } from '../../../../infrastructure/services/hr/equipment-assignment.service';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { MedicalCertificateService } from '../../../../infrastructure/services/hr/medical-certificate.service';
import { ReimbursementService } from '../../../../infrastructure/services/hr/reimbursement.service';
import { HoleriteService } from '../../../../infrastructure/services/hr/holerite.service';
import { CareerHistoryResponse } from '../../../../domain/models/hr/career.model';
import { DOCUMENT_STATUS_INFO, EmployeeDocument } from '../../../../domain/models/hr/employee-document.model';
import { EquipmentAssignment } from '../../../../domain/models/hr/equipment-assignment.model';
import { VacationRequest } from '../../../../domain/models/hr/vacation-request.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { Reimbursement, ReimbursementStatus } from '../../../../domain/models/hr/reimbursement.model';
import { AUDITORIA_SITUACAO_INFO, HoleriteAuditoria, situacaoDe } from '../../../../domain/models/hr/holerite.model';
import { formatDateBr } from '../../../../domain/utils/date-only';
import { REASON_LABEL, absenceTimeline, careerNewestFirst, documentsByAttention, initials } from './employee-profile.logic';

/** Uma seção da ficha: carrega sozinha, e a falha de uma não derruba as outras. */
interface Section<T> {
  state: 'loading' | 'ok' | 'error';
  data: T;
}

export type SectionKey = 'dados' | 'carreira' | 'documentos' | 'equipamentos' | 'ausencias' | 'reembolsos' | 'holerites';

const REIMBURSEMENT_STATUS: Record<ReimbursementStatus, { label: string; chip: string }> = {
  PENDING: { label: 'Em análise', chip: 'warning' },
  APPROVED: { label: 'A pagar', chip: 'info' },
  PAID: { label: 'Pago', chip: 'success' },
  REJECTED: { label: 'Recusado', chip: 'danger' },
};

const SEVERITY_CHIP: Record<string, string> = { success: 'success', warning: 'warning', danger: 'danger', neutral: 'neutral' };
const TONE_CHIP: Record<string, string> = { active: 'success', warning: 'warning', danger: 'danger', neutral: 'neutral' };

/**
 * A ficha do funcionário (2026-10-05): tudo de uma pessoa numa página.
 *
 * Antes o RH passava por quatro telas para ver uma pessoa. Aqui cada seção vem
 * da tela que já existia, **com a permissão dela**: quem não tem Reembolsos não
 * vê a seção — e nem a pede à API. As seções são uma página só, com atalhos no
 * topo, e não abas: dá para rolar e ver tudo.
 */
@Component({
  selector: 'app-employee-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, PkButtonComponent],
  templateUrl: './employee-profile.component.html',
  styleUrl: './employee-profile.component.scss',
})
export class EmployeeProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly employees = inject(EmployeeStore);
  private readonly companies = inject(CompanyStore);
  private readonly teams = inject(TeamStore);
  private readonly positions = inject(PositionStore);
  private readonly payslipTypes = inject(PayslipTypeStore);
  private readonly permissions = inject(PermissionStore);
  private readonly tabs = inject(TabsService);
  private readonly careerService = inject(CareerHistoryService);
  private readonly documentService = inject(EmployeeDocumentService);
  private readonly equipmentService = inject(EquipmentAssignmentService);
  private readonly vacationService = inject(VacationRequestService);
  private readonly certificateService = inject(MedicalCertificateService);
  private readonly reimbursementService = inject(ReimbursementService);
  private readonly holeriteService = inject(HoleriteService);

  readonly employeeId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  private readonly started = signal(false);

  readonly employee = computed(() => this.employees.items().find(e => e.id === this.employeeId()) ?? null);
  readonly notFound = computed(() => this.started() && !this.employees.loading() && !this.employee());

  // ---- Quem vê o quê: a permissão da tela de cada seção ----
  readonly canEdit = computed(() => this.permissions.can('rh/employees', 'ALTERAR'));
  readonly can = computed(() => ({
    carreira: ['rh/employees', 'rh/career-structure', 'rh/organizational-structure']
      .some(s => this.permissions.can(s, 'CONSULTAR')),
    documentos: this.permissions.can('rh/employee-documents', 'CONSULTAR'),
    equipamentos: this.permissions.can('rh/equipment-assignments', 'CONSULTAR'),
    ferias: this.permissions.can('rh/vacation-requests', 'CONSULTAR'),
    atestados: this.permissions.can('rh/medical-certificates', 'CONSULTAR'),
    reembolsos: this.permissions.can('rh/reimbursements', 'CONSULTAR'),
    holerites: this.permissions.can('rh/holerit', 'CONSULTAR'),
  }));

  /** Os atalhos do topo, só das seções que a pessoa vê. */
  readonly anchors = computed<{ key: SectionKey; label: string }[]>(() => {
    const c = this.can();
    return [
      { key: 'dados' as const, label: 'Dados', show: true },
      { key: 'carreira' as const, label: 'Cargo e carreira', show: c.carreira },
      { key: 'documentos' as const, label: 'Documentos', show: c.documentos },
      { key: 'equipamentos' as const, label: 'Equipamentos', show: c.equipamentos },
      { key: 'ausencias' as const, label: 'Ausências', show: c.ferias || c.atestados },
      { key: 'reembolsos' as const, label: 'Reembolsos', show: c.reembolsos },
      { key: 'holerites' as const, label: 'Holerites', show: c.holerites },
    ].filter(a => a.show).map(({ key, label }) => ({ key, label }));
  });

  readonly career = signal<Section<CareerHistoryResponse[]>>({ state: 'loading', data: [] });
  readonly documents = signal<Section<EmployeeDocument[]>>({ state: 'loading', data: [] });
  readonly equipment = signal<Section<EquipmentAssignment[]>>({ state: 'loading', data: [] });
  readonly vacations = signal<Section<VacationRequest[]>>({ state: 'loading', data: [] });
  readonly certificates = signal<Section<MedicalCertificate[]>>({ state: 'loading', data: [] });
  readonly certificatesThisYear = signal<number | null>(null);
  readonly reimbursements = signal<Section<Reimbursement[]>>({ state: 'loading', data: [] });
  readonly payslips = signal<Section<HoleriteAuditoria[]>>({ state: 'loading', data: [] });

  readonly careerList = computed(() => careerNewestFirst(this.career().data));
  readonly documentList = computed(() => documentsByAttention(this.documents().data));
  readonly equipmentWith = computed(() => this.equipment().data.filter(e => e.withEmployee));
  readonly equipmentReturned = computed(() => this.equipment().data.filter(e => !e.withEmployee));
  readonly absences = computed(() => absenceTimeline(this.vacations().data, this.certificates().data));
  readonly absencesState = computed(() => {
    const parts = [this.can().ferias ? this.vacations().state : 'ok', this.can().atestados ? this.certificates().state : 'ok'];
    return parts.includes('loading') ? 'loading' : parts.includes('error') ? 'error' : 'ok';
  });
  readonly reimbursementOpen = computed(() =>
    this.reimbursements().data.filter(r => r.status === 'PENDING' || r.status === 'APPROVED')
      .reduce((s, r) => s + Number(r.amount), 0));

  /** Quantas linhas cada lista mostra antes do "ver todos". */
  readonly limit = 6;
  readonly expanded = signal<ReadonlySet<SectionKey>>(new Set());

  constructor() {
    // O rótulo da aba vira o nome da pessoa assim que ele chega.
    effect(() => {
      const e = this.employee();
      if (e) this.tabs.rename(this.router.url, e.name);
    });
  }

  ngOnInit(): void {
    this.employees.load();
    this.companies.load();
    this.teams.load();
    this.started.set(true);

    const id = this.employeeId();
    const c = this.can();
    if (c.carreira) { this.positions.load(); this.fill(this.career, this.careerService.listByEmployee(id)); }
    if (c.documentos) this.fill(this.documents, this.documentService.getByEmployee(id));
    if (c.equipamentos) this.fill(this.equipment, this.equipmentService.getByEmployee(id));
    if (c.ferias) this.fill(this.vacations, this.vacationService.getByEmployee(id));
    if (c.atestados) {
      this.certificateService.getForEmployee(id).subscribe({
        next: r => { this.certificates.set({ state: 'ok', data: r.history }); this.certificatesThisYear.set(r.countThisYear); },
        error: () => this.certificates.set({ state: 'error', data: [] }),
      });
    }
    if (c.reembolsos) this.fill(this.reimbursements, this.reimbursementService.getByEmployee(id));
    if (c.holerites) { this.payslipTypes.load(); this.fill(this.payslips, this.holeriteService.doFuncionario(id)); }
  }

  // ---- Leitura ----

  initials(name: string): string { return initials(name); }
  formatDate(iso: string | Date | null | undefined): string { return iso ? formatDateBr(iso) : '—'; }
  companyName(id: string | null | undefined): string | null { return this.companies.items().find(c => c.id === id)?.name ?? null; }
  teamName(id: string | null | undefined): string | null { return this.teams.items().find(t => t.id === id)?.name ?? null; }
  positionName(id: string): string { return this.positions.items().find(p => p.id === id)?.name ?? 'Cargo'; }
  reasonLabel(r: CareerHistoryResponse): string { return REASON_LABEL[r.reason] ?? r.reason; }
  documentStatus(d: EmployeeDocument) { return DOCUMENT_STATUS_INFO[d.status]; }
  documentChip(d: EmployeeDocument): string { return SEVERITY_CHIP[DOCUMENT_STATUS_INFO[d.status].severity]; }
  toneChip(tone: string): string { return TONE_CHIP[tone] ?? 'neutral'; }
  reimbursementStatus(r: Reimbursement) { return REIMBURSEMENT_STATUS[r.status]; }
  payslipLabel(code: string): string { return this.payslipTypes.labelOf(code); }
  payslipSituation(h: HoleriteAuditoria) { return AUDITORIA_SITUACAO_INFO[situacaoDe(h)]; }
  competencia(iso: string): string { const [y, m] = iso.split('-'); return `${m}/${y}`; }

  visible<T>(key: SectionKey, list: T[]): T[] {
    return this.expanded().has(key) ? list : list.slice(0, this.limit);
  }

  expand(key: SectionKey): void {
    this.expanded.set(new Set([...this.expanded(), key]));
  }

  /** Rola até a seção. Sem `#` na URL: âncora com hash quebra o roteador. */
  goTo(key: SectionKey): void {
    document.getElementById('ficha-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  edit(): void {
    this.router.navigate(['/rh/employees'], { queryParams: { editar: this.employeeId() } });
  }

  private fill<T>(target: ReturnType<typeof signal<Section<T[]>>>, source: Observable<T[]>): void {
    source.subscribe({
      next: data => target.set({ state: 'ok', data }),
      error: () => target.set({ state: 'error', data: [] }),
    });
  }
}
