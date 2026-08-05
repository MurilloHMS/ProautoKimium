import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { PkButtonComponent } from '../../../theme/ProautoKimium/pk-button/pk-button.component';
import { TeamOverviewService } from '../../../../infrastructure/services/hr/team-overview.service';
import { CompanyStore, TeamStore } from '../../../../infrastructure/state/org-structure.store';
import { AvailabilityStatus, TeamOverviewEntry } from '../../../../domain/models/hr/team-overview.model';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

@Component({
  selector: 'app-team-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, Toast, PkButtonComponent, PageHeaderComponent],
  templateUrl: './team-overview.component.html',
  styleUrl: './team-overview.component.scss',
  providers: [MessageService],
})
export class TeamOverviewComponent implements OnInit {
  entries: TeamOverviewEntry[] = [];
  loading = false;

  teamFilter: string | null = null;
  companyFilter: string | null = null;

  private readonly teamStore = inject(TeamStore);
  private readonly companyStore = inject(CompanyStore);

  // Filtros saem dos stores compartilhados: um setor novo cadastrado em outra
  // aba aparece aqui sem recarregar a tela.
  readonly teamOptions = computed(() =>
    this.teamStore.items().map(team => ({ label: team.name, value: team.id })));
  readonly companyOptions = computed(() =>
    this.companyStore.items().map(company => ({ label: company.name, value: company.id })));

  constructor(
    private teamOverviewService: TeamOverviewService,
    private msgService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.load();
  }

  loadFilters(): void {
    this.teamStore.load();
    this.companyStore.load();
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
