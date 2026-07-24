import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { TeamOverviewService } from '../../../../infrastructure/services/hr/team-overview.service';
import { TeamService } from '../../../../infrastructure/services/hr/team.service';
import { CompanyService } from '../../../../infrastructure/services/hr/company.service';
import { AvailabilityStatus, TeamOverviewEntry } from '../../../../domain/models/hr/team-overview.model';

@Component({
  selector: 'app-team-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, Toast, PkButtonComponent],
  templateUrl: './team-overview.component.html',
  styleUrl: './team-overview.component.scss',
  providers: [MessageService],
})
export class TeamOverviewComponent implements OnInit {
  entries: TeamOverviewEntry[] = [];
  loading = false;

  teamFilter: string | null = null;
  companyFilter: string | null = null;

  teamOptions: { label: string; value: string }[] = [];
  companyOptions: { label: string; value: string }[] = [];

  constructor(
    private teamOverviewService: TeamOverviewService,
    private teamService: TeamService,
    private companyService: CompanyService,
    private msgService: MessageService
  ) {}

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
    this.loading = true;
    this.teamOverviewService.getOverview(this.teamFilter ?? undefined, this.companyFilter ?? undefined).subscribe({
      next: (list) => {
        this.entries = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.msgService.add({ severity: 'warning', summary: 'Erro', detail: this.getErrorMessage(err) });
      },
    });
  }

  get availableCount(): number {
    return this.entries.filter((e) => e.availabilityStatus === 'AVAILABLE').length;
  }

  get onVacationCount(): number {
    return this.entries.filter((e) => e.availabilityStatus === 'ON_VACATION').length;
  }

  get scheduledCount(): number {
    return this.entries.filter((e) => e.availabilityStatus === 'VACATION_SCHEDULED').length;
  }

  statusLabel(status: AvailabilityStatus): string {
    switch (status) {
      case 'AVAILABLE': return 'Disponível';
      case 'ON_VACATION': return 'Em férias';
      case 'VACATION_SCHEDULED': return 'Férias agendadas';
    }
  }

  initials(name: string): string {
    return name?.charAt(0)?.toUpperCase() ?? '?';
  }

  private getErrorMessage(err: any): string {
    switch (err.status) {
      case 400: return 'Requisição inválida';
      case 401: return 'Não autorizado. Faça login novamente';
      case 403: return 'Você não tem permissão para esta ação';
      case 500: return 'Erro interno do servidor';
      case 0:   return 'Sem conexão com o servidor';
      default:  return `Erro inesperado (${err.status})`;
    }
  }
}
