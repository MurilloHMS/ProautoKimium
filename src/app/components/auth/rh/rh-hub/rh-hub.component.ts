import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PkDialogComponent } from '../../../theme/ProautoKimium/pk-dialog/pk-dialog.component';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { ReimbursementService } from '../../../../infrastructure/services/hr/reimbursement.service';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { TeamOverviewService } from '../../../../infrastructure/services/hr/team-overview.service';
import { EquipmentAssignmentService } from '../../../../infrastructure/services/hr/equipment-assignment.service';
import { AnnouncementService } from '../../../../infrastructure/services/hr/announcement.service';
import { CalendarService } from '../../../../infrastructure/services/hr/calendar.service';
import { HrDashboardService } from '../../../../infrastructure/services/hr/hr-dashboard.service';
import { CalendarEvent } from '../../../../domain/models/hr/calendar.model';
import { HrDashboardSummary } from '../../../../domain/models/hr/dashboard-summary.model';

type ToolKey =
  | 'vacation' | 'reimbursements' | 'employees' | 'orgStructure' | 'career'
  | 'teamOverview' | 'calendar' | 'calculators' | 'equipment' | 'notifications'
  | 'announcements' | 'medicalCertificates' | 'jobs' | 'payslip' | 'payslipExtractor';

interface RhTool {
  key: ToolKey;
  title: string;
  icon: string;
  route: string;
}

interface RhToolGroup {
  label: string;
  tools: RhTool[];
}

type ActivityType = 'vacation' | 'reimbursement' | 'equipment' | 'announcement';

interface ActivityItem {
  type: ActivityType;
  icon: string;
  colorClass: string;
  text: string;
  subtext: string;
  timestamp: number;
  route: string;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

@Component({
  selector: 'app-rh-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, PkDialogComponent],
  templateUrl: './rh-hub.component.html',
  styleUrl: './rh-hub.component.scss',
})
export class RhHubComponent implements OnInit {
  loading = true;
  weekdayLabels = WEEKDAY_LABELS;

  // ---- KPIs ----
  pendingVacations = 0;
  pendingReimbursements = 0;
  activeEmployees = 0;
  onVacationNow = 0;
  equipmentInUse = 0;
  eventsThisMonth = 0;

  get pendingTotal(): number {
    return this.pendingVacations + this.pendingReimbursements;
  }

  // ---- Distribuição (funcionários por empresa/cargo/departamento, folha e estrutura) ----
  summary: HrDashboardSummary | null = null;

  get maxCompanyTotal(): number {
    return Math.max(1, ...(this.summary?.employeesByCompany.map((c) => c.total) ?? [1]));
  }

  get maxPositionCount(): number {
    return Math.max(1, ...(this.summary?.employeesByPosition.map((p) => p.count) ?? [1]));
  }

  get maxDepartmentCount(): number {
    return Math.max(1, ...(this.summary?.employeesByDepartment.map((d) => d.count) ?? [1]));
  }

  get topPositions() {
    return (this.summary?.employeesByPosition ?? []).slice(0, 8);
  }

  get topDepartments() {
    return (this.summary?.employeesByDepartment ?? []).slice(0, 8);
  }

  pct(value: number, max: number): number {
    return max > 0 ? (value / max) * 100 : 0;
  }

  // ---- Atividade recente ----
  activity: ActivityItem[] = [];

  // ---- Calendário visual ----
  displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  calendarLoading = false;
  weeks: Date[][] = [];
  private eventsByDay = new Map<string, CalendarEvent[]>();

  dayDialogVisible = false;
  selectedDay: Date | null = null;
  selectedDayEvents: CalendarEvent[] = [];

  // ---- Atalhos ----
  toolGroups: RhToolGroup[] = [
    {
      label: 'Aprovações',
      tools: [
        { key: 'vacation', title: 'Férias', icon: 'pi pi-sun', route: '/rh/vacation-requests' },
        { key: 'reimbursements', title: 'Reembolsos', icon: 'pi pi-wallet', route: '/rh/reimbursements' },
        { key: 'medicalCertificates', title: 'Atestados', icon: 'pi pi-file-check', route: '/rh/medical-certificates' },
      ],
    },
    {
      label: 'Pessoas',
      tools: [
        { key: 'employees', title: 'Funcionários', icon: 'pi pi-user', route: '/rh/employees' },
        { key: 'teamOverview', title: 'Visão de Equipe', icon: 'pi pi-users', route: '/rh/team-overview' },
        { key: 'calendar', title: 'Calendário', icon: 'pi pi-calendar', route: '/rh/calendar' },
      ],
    },
    {
      label: 'Organização',
      tools: [
        { key: 'orgStructure', title: 'Estrutura', icon: 'pi pi-sitemap', route: '/rh/organizational-structure' },
        { key: 'career', title: 'Cargos & Níveis', icon: 'pi pi-briefcase', route: '/rh/career-structure' },
        { key: 'equipment', title: 'Equipamentos', icon: 'pi pi-desktop', route: '/rh/equipment-assignments' },
      ],
    },
    {
      label: 'Ferramentas',
      tools: [
        { key: 'calculators', title: 'Calculadoras', icon: 'pi pi-calculator', route: '/rh/calculators' },
        { key: 'payslip', title: 'Holerit', icon: 'pi pi-file', route: '/rh/holerit' },
        { key: 'payslipExtractor', title: 'Coletar Holerite', icon: 'pi pi-file-arrow-up', route: '/rh/holerit/extractor' },
      ],
    },
    {
      label: 'Comunicação',
      tools: [
        { key: 'announcements', title: 'Mural de Avisos', icon: 'pi pi-megaphone', route: '/rh/announcements' },
        { key: 'notifications', title: 'Notificações', icon: 'pi pi-bell', route: '/rh/notifications' },
        { key: 'jobs', title: 'Portal de Vagas', icon: 'pi pi-briefcase', route: '/rh/painel-de-vagas' },
      ],
    },
  ];

  tools: RhTool[] = this.toolGroups.flatMap(g => g.tools);

  constructor(
    private vacationService: VacationRequestService,
    private reimbursementService: ReimbursementService,
    private employeeService: EmployeeService,
    private teamOverviewService: TeamOverviewService,
    private equipmentService: EquipmentAssignmentService,
    private announcementService: AnnouncementService,
    private calendarService: CalendarService,
    private dashboardService: HrDashboardService
  ) {}

  ngOnInit(): void {
    const [monthStart, monthEnd] = this.monthRange(this.displayedMonth);

    forkJoin({
      vacationsPending: this.vacationService.getAll('PENDING').pipe(catchError(() => of([]))),
      vacationsAll: this.vacationService.getAll().pipe(catchError(() => of([]))),
      reimbursementsPending: this.reimbursementService.getAll('PENDING').pipe(catchError(() => of([]))),
      reimbursementsAll: this.reimbursementService.getAll().pipe(catchError(() => of([]))),
      employees: this.employeeService.getEmployes().pipe(catchError(() => of([]))),
      teamOverview: this.teamOverviewService.getOverview().pipe(catchError(() => of([]))),
      equipment: this.equipmentService.listCurrentlyWithEmployees().pipe(catchError(() => of([]))),
      announcements: this.announcementService.getAll().pipe(catchError(() => of([]))),
      monthEvents: this.calendarService.getEvents({ start: monthStart, end: monthEnd }).pipe(catchError(() => of([]))),
      summary: this.dashboardService.getSummary().pipe(catchError(() => of(null))),
    }).subscribe((r) => {
      this.summary = r.summary;
      this.pendingVacations = r.vacationsPending.length;
      this.pendingReimbursements = r.reimbursementsPending.length;
      this.activeEmployees = r.employees.filter((e) => e.ativo).length;
      this.onVacationNow = r.teamOverview.filter((e) => e.availabilityStatus === 'ON_VACATION').length;
      this.equipmentInUse = r.equipment.length;
      this.eventsThisMonth = r.monthEvents.filter((e) => e.status !== 'REJECTED').length;

      const employeeNames = new Map(r.employees.filter((e) => e.id).map((e) => [e.id as string, e.name]));

      const activity: ActivityItem[] = [];

      for (const v of r.vacationsAll) {
        const ts = new Date(v.reviewedAt ?? v.requestedAt).getTime();
        activity.push({
          type: 'vacation',
          icon: 'pi pi-sun',
          colorClass: this.statusColorClass(v.status),
          text: `${employeeNames.get(v.employeeId) ?? 'Funcionário'} — férias ${this.statusLabel(v.status)}`,
          subtext: `${this.formatDate(v.startDate)} a ${this.formatDate(v.endDate)}`,
          timestamp: ts,
          route: '/rh/vacation-requests',
        });
      }

      for (const rb of r.reimbursementsAll) {
        const ts = new Date(rb.paidAt ?? rb.reviewedAt ?? rb.requestedAt).getTime();
        activity.push({
          type: 'reimbursement',
          icon: 'pi pi-wallet',
          colorClass: this.statusColorClass(rb.status),
          text: `${employeeNames.get(rb.employeeId) ?? 'Funcionário'} — reembolso ${this.statusLabel(rb.status)}`,
          subtext: `${rb.category} · ${this.formatCurrency(rb.amount)}`,
          timestamp: ts,
          route: '/rh/reimbursements',
        });
      }

      for (const eq of r.equipment) {
        activity.push({
          type: 'equipment',
          icon: 'pi pi-desktop',
          colorClass: 'act--neutral',
          text: `${employeeNames.get(eq.employeeId) ?? 'Funcionário'} está com ${eq.equipmentType}`,
          subtext: `Entregue em ${this.formatDate(eq.deliveredAt)}`,
          timestamp: new Date(eq.deliveredAt).getTime(),
          route: '/rh/equipment-assignments',
        });
      }

      for (const a of r.announcements) {
        activity.push({
          type: 'announcement',
          icon: 'pi pi-megaphone',
          colorClass: 'act--announcement',
          text: `Aviso publicado: "${a.title}"`,
          subtext: `por ${a.publishedByName}`,
          timestamp: new Date(a.publishedAt).getTime(),
          route: '/rh/announcements',
        });
      }

      this.activity = activity.sort((x, y) => y.timestamp - x.timestamp).slice(0, 10);

      this.buildGrid(r.monthEvents);
      this.loading = false;
    });
  }

  // ---- Calendário visual ----

  get monthLabel(): string {
    return `${MONTH_LABELS[this.displayedMonth.getMonth()]} de ${this.displayedMonth.getFullYear()}`;
  }

  prevMonth(): void {
    this.displayedMonth = new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth() - 1, 1);
    this.loadMonth();
  }

  nextMonth(): void {
    this.displayedMonth = new Date(this.displayedMonth.getFullYear(), this.displayedMonth.getMonth() + 1, 1);
    this.loadMonth();
  }

  goToday(): void {
    this.displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.loadMonth();
  }

  private loadMonth(): void {
    this.calendarLoading = true;
    const [start, end] = this.monthRange(this.displayedMonth);
    this.calendarService.getEvents({ start, end }).pipe(catchError(() => of([]))).subscribe((events) => {
      this.buildGrid(events);
      this.calendarLoading = false;
    });
  }

  private monthRange(month: Date): [string, string] {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return [this.toIsoDate(start), this.toIsoDate(end)];
  }

  private buildGrid(events: CalendarEvent[]): void {
    const year = this.displayedMonth.getFullYear();
    const month = this.displayedMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    const gridStart = new Date(year, month, 1 - startWeekday);
    const weeks: Date[][] = [];
    let week: Date[] = [];
    const cursor = new Date(gridStart);
    for (let i = 0; i < totalCells; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    this.weeks = weeks;

    this.eventsByDay = new Map();
    for (const ev of events) {
      if (ev.status === 'REJECTED') continue;
      const cursorDate = new Date(ev.startDate + 'T00:00:00');
      const endDate = new Date(ev.endDate + 'T00:00:00');
      while (cursorDate <= endDate) {
        const key = this.dayKey(cursorDate);
        if (!this.eventsByDay.has(key)) this.eventsByDay.set(key, []);
        this.eventsByDay.get(key)!.push(ev);
        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    }
  }

  eventsFor(day: Date): CalendarEvent[] {
    return this.eventsByDay.get(this.dayKey(day)) ?? [];
  }

  isCurrentMonth(day: Date): boolean {
    return day.getMonth() === this.displayedMonth.getMonth();
  }

  isToday(day: Date): boolean {
    const today = new Date();
    return day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth() && day.getDate() === today.getDate();
  }

  openDay(day: Date): void {
    const events = this.eventsFor(day);
    if (events.length === 0) return;
    this.selectedDay = day;
    this.selectedDayEvents = events;
    this.dayDialogVisible = true;
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  // ---- Helpers ----

  statusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'pendente';
      case 'APPROVED': return 'aprovado(a)';
      case 'REJECTED': return 'recusado(a)';
      case 'PAID': return 'pago';
      default: return status;
    }
  }

  statusColorClass(status: string): string {
    switch (status) {
      case 'PENDING': return 'act--pending';
      case 'APPROVED': return 'act--approved';
      case 'REJECTED': return 'act--rejected';
      case 'PAID': return 'act--paid';
      default: return 'act--neutral';
    }
  }

  formatDate(iso: string): string {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
  }

  formatDateObj(d: Date): string {
    return d.toLocaleDateString('pt-BR');
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  relativeLabel(timestampMs: number): string {
    const days = Math.floor((Date.now() - timestampMs) / 86400000);
    if (days <= 0) return 'hoje';
    if (days === 1) return 'há 1 dia';
    return `há ${days} dias`;
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
