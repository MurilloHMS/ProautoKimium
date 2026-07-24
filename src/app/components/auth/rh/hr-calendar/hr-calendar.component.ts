import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { PkTableComponent } from '../../../theme/ProautoKimium/pk-table/pk-table.component';
import { CalendarService } from '../../../../infrastructure/services/hr/calendar.service';
import { TeamService } from '../../../../infrastructure/services/hr/team.service';
import { CompanyService } from '../../../../infrastructure/services/hr/company.service';
import { CalendarEvent, CalendarEventStatus } from '../../../../domain/models/hr/calendar.model';

@Component({
  selector: 'app-hr-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, DatePickerModule, Toast, PkButtonComponent, PkTableComponent],
  templateUrl: './hr-calendar.component.html',
  styleUrl: './hr-calendar.component.scss',
  providers: [MessageService],
})
export class HrCalendarComponent implements OnInit {
  events: CalendarEvent[] = [];
  loading = false;

  startDate: Date;
  endDate: Date;
  teamFilter: string | null = null;
  companyFilter: string | null = null;
  statusFilter: CalendarEventStatus | null = 'APPROVED';

  teamOptions: { label: string; value: string }[] = [];
  companyOptions: { label: string; value: string }[] = [];
  statusOptions: { label: string; value: CalendarEventStatus | null }[] = [
    { label: 'Aprovados', value: 'APPROVED' },
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Recusados', value: 'REJECTED' },
  ];

  constructor(
    private calendarService: CalendarService,
    private teamService: TeamService,
    private companyService: CompanyService,
    private msgService: MessageService
  ) {
    const now = new Date();
    this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  ngOnInit(): void {
    this.loadFilters();
    this.load();
  }

  loadFilters(): void {
    this.teamService.getAll().subscribe({
      next: (list) => (this.teamOptions = list.map((t) => ({ label: t.name, value: t.id }))),
      error: () => (this.teamOptions = []),
    });
    this.companyService.getAll().subscribe({
      next: (list) => (this.companyOptions = list.map((c) => ({ label: c.name, value: c.id }))),
      error: () => (this.companyOptions = []),
    });
  }

  load(): void {
    if (!this.startDate || !this.endDate) return;

    this.loading = true;
    this.calendarService.getEvents({
      start: this.toIsoDate(this.startDate),
      end: this.toIsoDate(this.endDate),
      teamId: this.teamFilter ?? undefined,
      companyId: this.companyFilter ?? undefined,
      status: this.statusFilter ?? undefined,
    }).subscribe({
      next: (list) => {
        this.events = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  eventTypeLabel(type: string): string {
    return type === 'VACATION' ? 'Férias' : type;
  }

  statusLabel(status: CalendarEventStatus): string {
    switch (status) {
      case 'PENDING': return 'Pendente';
      case 'APPROVED': return 'Aprovado';
      case 'REJECTED': return 'Recusado';
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 404: return 'Recurso não encontrado';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
