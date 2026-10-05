import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OrgStructureCompaniesComponent } from '../org-structure-companies/org-structure-companies.component';
import { OrgStructureDepartmentsComponent } from '../org-structure-departments/org-structure-departments.component';
import { OrgStructureTeamsComponent } from '../org-structure-teams/org-structure-teams.component';
import { OrgStructureHierarchiesComponent } from '../org-structure-hierarchies/org-structure-hierarchies.component';
import { CareerStructureComponent } from '../career-structure/career-structure.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';

type OrgStructureSection = 'companies' | 'departments' | 'teams' | 'hierarchies' | 'positions';

/** A tela de cada parte na grade. As quatro da estrutura são uma tela só. */
const STRUCTURE_SCREEN = 'rh/organizational-structure';
const CAREER_SCREEN = 'rh/career-structure';

@Component({
  selector: 'app-org-structure',
  standalone: true,
  imports: [
    CommonModule,
    OrgStructureCompaniesComponent,
    OrgStructureDepartmentsComponent,
    OrgStructureTeamsComponent,
    OrgStructureHierarchiesComponent,
    CareerStructureComponent,
  ],
  templateUrl: './org-structure.component.html',
  styleUrl: './org-structure.component.scss',
})
export class OrgStructureComponent implements OnInit {
  private readonly permissions = inject(PermissionStore);
  private readonly route = inject(ActivatedRoute, { optional: true });

  activeSection = signal<OrgStructureSection>('companies');

  /**
   * Organização (2026-10-05): Cargos & Níveis entrou como quinta parte. Cada
   * parte continua com a tela dela na grade — quem só cuidava de cargos vê só
   * cargos, e quem só via a estrutura não ganhou os salários.
   */
  private readonly all: { key: OrgStructureSection; label: string; icon: string; screen: string }[] = [
    { key: 'companies', label: 'Empresas', icon: 'pi pi-building', screen: STRUCTURE_SCREEN },
    { key: 'departments', label: 'Departamentos', icon: 'pi pi-sitemap', screen: STRUCTURE_SCREEN },
    { key: 'teams', label: 'Setores', icon: 'pi pi-users', screen: STRUCTURE_SCREEN },
    { key: 'hierarchies', label: 'Hierarquias', icon: 'pi pi-sort-amount-down', screen: STRUCTURE_SCREEN },
    { key: 'positions', label: 'Cargos e níveis', icon: 'pi pi-briefcase', screen: CAREER_SCREEN },
  ];

  readonly sections = computed(() => this.all.filter(s => this.permissions.canOpen(s.screen)));

  /** `?parte=cargos` é o destino do endereço antigo de Cargos & Níveis. */
  ngOnInit(): void {
    const parte = this.route?.snapshot.queryParamMap.get('parte');
    const pedida = parte === 'cargos' ? this.sections().find(s => s.key === 'positions') : undefined;
    const alvo = pedida ?? this.sections()[0];
    if (alvo) this.activeSection.set(alvo.key);
  }

  select(section: OrgStructureSection): void {
    this.activeSection.set(section);
  }
}
