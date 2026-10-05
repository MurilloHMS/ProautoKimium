import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { Observable, catchError, forkJoin, of } from 'rxjs';

import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { ToolbarComponent } from '../../shared/toolbar/toolbar.component';
import { CalendarService } from '../../../../infrastructure/services/hr/calendar.service';
import { MedicalCertificateService } from '../../../../infrastructure/services/hr/medical-certificate.service';
import { TeamOverviewService } from '../../../../infrastructure/services/hr/team-overview.service';
import { CompanyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { ehCelular } from '../../../../infrastructure/state/eh-celular';
import { CalendarEvent } from '../../../../domain/models/hr/calendar.model';
import { MedicalCertificate } from '../../../../domain/models/hr/medical-certificate.model';
import { TeamOverviewEntry } from '../../../../domain/models/hr/team-overview.model';
import { formatDateBr } from '../../../../domain/utils/date-only';
import { apiMessage } from '../../../../domain/utils/api-error';
import {
  Absence, DayMark, addDays, buildRows, fromCalendar, fromCertificates, inWindow, isoDay, summarize, weekStart,
  windowDays,
} from './absences.logic';

/** Duas semanas na faixa: cabe no computador e mostra a próxima semana inteira. */
export const WINDOW_DAYS = 14;

const WEEKDAY = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Ausências (2026-10-05): Visão de Equipe e Calendário numa tela.
 *
 * As duas mostravam "quem está fora" de jeitos diferentes. Aqui é uma faixa de
 * duas semanas, com férias e atestados juntos, e o pedido de férias ainda não
 * aprovado tracejado — o RH vê o choque antes de aprovar.
 *
 * Cada parte com a tela dela na grade:
 * - a faixa vem do calendário (`rh/calendar`);
 * - os atestados só entram para quem já vê a tela de Atestados — é dado de
 *   saúde, e a faixa não pode ser o atalho para ele;
 * - quem só tinha a Visão de Equipe continua vendo quem está de férias hoje.
 */
@Component({
  selector: 'app-absences',
  standalone: true,
  imports: [CommonModule, FormsModule, Toast, SelectModule, PkButtonComponent, ToolbarComponent],
  templateUrl: './absences.component.html',
  styleUrl: './absences.component.scss',
  providers: [MessageService],
})
export class AbsencesComponent implements OnInit {
  private readonly calendar = inject(CalendarService);
  private readonly certificates = inject(MedicalCertificateService);
  private readonly teamOverview = inject(TeamOverviewService);
  private readonly teams = inject(TeamStore);
  private readonly companies = inject(CompanyStore);
  private readonly employees = inject(EmployeeStore);
  private readonly permissions = inject(PermissionStore);
  private readonly messages = inject(MessageService);

  readonly ehCelular = ehCelular();

  readonly canCalendar = computed(() => this.permissions.canOpen('rh/calendar'));
  readonly canCertificates = computed(() => this.permissions.can('rh/medical-certificates', 'CONSULTAR'));
  readonly canTeamOverview = computed(() => this.permissions.canOpen('rh/team-overview'));

  readonly today = signal(new Date());
  readonly start = signal(weekStart(new Date()));
  readonly days = computed(() => windowDays(this.start(), WINDOW_DAYS));

  teamFilter: string | null = null;
  companyFilter: string | null = null;
  readonly teamOptions = computed(() => this.teams.items().map(t => ({ label: t.name, value: t.id })));
  readonly companyOptions = computed(() => this.companies.items().map(c => ({ label: c.name, value: c.id })));

  readonly loading = signal(false);
  readonly absences = signal<Absence[]>([]);
  /** Só para quem tem a Visão de Equipe e não tem o calendário. */
  readonly away = signal<TeamOverviewEntry[]>([]);

  readonly rows = computed(() => buildRows(this.absences(), this.days()));
  readonly summary = computed(() => summarize(this.absences(), this.today()));
  readonly list = computed(() => inWindow(this.absences(), this.days()));
  readonly isCurrentWeek = computed(() => isoDay(this.start()) === isoDay(weekStart(this.today())));

  ngOnInit(): void {
    this.teams.load();
    this.companies.load();
    if (this.canCertificates()) this.employees.load();
    this.load();
  }

  load(): void {
    this.today.set(new Date());
    if (!this.canCalendar()) {
      if (this.canTeamOverview()) this.loadTeamOverview();
      return;
    }

    this.loading.set(true);
    const days = this.days();
    const events$: Observable<CalendarEvent[]> = this.calendar.getEvents({
      start: isoDay(days[0]), end: isoDay(days[days.length - 1]),
      teamId: this.teamFilter ?? undefined, companyId: this.companyFilter ?? undefined,
    });
    // Falhar o atestado não pode derrubar as férias: a faixa sai sem ele.
    const certificates$: Observable<MedicalCertificate[]> = this.canCertificates()
      ? this.certificates.getAll().pipe(catchError(() => of([])))
      : of([]);

    forkJoin([events$, certificates$]).subscribe({
      next: ([events, certificates]) => {
        this.absences.set([...fromCalendar(events), ...fromCertificates(this.filterCertificates(certificates))]);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? 'Não foi possível carregar as ausências.' });
      },
    });
  }

  move(weeks: number): void {
    this.start.set(addDays(this.start(), weeks * 7));
    this.load();
  }

  goToday(): void {
    this.start.set(weekStart(new Date()));
    this.load();
  }

  // ---- Faixa ----

  weekday(d: Date): string {
    return WEEKDAY[d.getDay()];
  }

  isWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  isToday(d: Date): boolean {
    return isoDay(d) === isoDay(this.today());
  }

  markLabel(mark: DayMark): string {
    switch (mark) {
      case 'CERTIFICATE': return 'Atestado';
      case 'VACATION': return 'Férias';
      case 'VACATION_PENDING': return 'Férias pedidas, ainda não aprovadas';
      default: return '';
    }
  }

  markLetter(mark: DayMark): string {
    return mark === 'CERTIFICATE' ? 'A' : mark ? 'F' : '';
  }

  rangeLabel(): string {
    const days = this.days();
    return `${formatDateBr(days[0]).slice(0, 5)} – ${formatDateBr(days[days.length - 1])}`;
  }

  formatDay(iso: string): string {
    return formatDateBr(iso).slice(0, 5);
  }

  /**
   * O calendário já filtra setor e empresa na API; o atestado não tem esses
   * filtros, então o recorte é feito aqui, pelo cadastro de funcionários.
   */
  private filterCertificates(list: MedicalCertificate[]): MedicalCertificate[] {
    if (!this.teamFilter && !this.companyFilter) return list;
    const byId = new Map(this.employees.items().map(e => [e.id, e]));
    return list.filter(c => {
      const e = byId.get(c.employeeId);
      return (!this.teamFilter || e?.teamId === this.teamFilter)
        && (!this.companyFilter || e?.companyId === this.companyFilter);
    });
  }

  private loadTeamOverview(): void {
    this.loading.set(true);
    this.teamOverview.getOverview(this.teamFilter ?? undefined, this.companyFilter ?? undefined).subscribe({
      next: list => {
        this.away.set(list.filter(e => e.availabilityStatus !== 'AVAILABLE'));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.messages.add({ severity: 'warn', summary: 'Erro', detail: apiMessage(err) ?? 'Não foi possível carregar a equipe.' });
      },
    });
  }
}
