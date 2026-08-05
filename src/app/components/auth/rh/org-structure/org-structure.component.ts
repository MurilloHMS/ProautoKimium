import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgStructureCompaniesComponent } from '../org-structure-companies/org-structure-companies.component';
import { OrgStructureDepartmentsComponent } from '../org-structure-departments/org-structure-departments.component';
import { OrgStructureTeamsComponent } from '../org-structure-teams/org-structure-teams.component';
import { OrgStructureHierarchiesComponent } from '../org-structure-hierarchies/org-structure-hierarchies.component';

type OrgStructureSection = 'companies' | 'departments' | 'teams' | 'hierarchies';

@Component({
  selector: 'app-org-structure',
  standalone: true,
  imports: [
    CommonModule,
    OrgStructureCompaniesComponent,
    OrgStructureDepartmentsComponent,
    OrgStructureTeamsComponent,
    OrgStructureHierarchiesComponent,
  ],
  templateUrl: './org-structure.component.html',
  styleUrl: './org-structure.component.scss',
})
export class OrgStructureComponent {
  activeSection = signal<OrgStructureSection>('companies');

  sections: { key: OrgStructureSection; label: string; icon: string }[] = [
    { key: 'companies', label: 'Empresas', icon: 'pi pi-building' },
    { key: 'departments', label: 'Departamentos', icon: 'pi pi-sitemap' },
    { key: 'teams', label: 'Setores', icon: 'pi pi-users' },
    { key: 'hierarchies', label: 'Hierarquias', icon: 'pi pi-sort-amount-down' },
  ];

  select(section: OrgStructureSection): void {
    this.activeSection.set(section);
  }
}
