import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import {
  Company,
  CreateCompanyRequest,
  CreateDepartmentRequest,
  CreateHierarchyRequest,
  CreateTeamRequest,
  Department,
  Hierarchy,
  Team,
} from '../../domain/models/hr/org-structure.model';
import { CompanyService } from '../services/hr/company.service';
import { DepartmentService } from '../services/hr/department.service';
import { HierarchyService } from '../services/hr/hierarchy.service';
import { TeamService } from '../services/hr/team.service';
import { ReferenceStore } from './reference-store';

/**
 * Estrutura organizacional: alimenta praticamente todo select de formulário
 * do RH, então é o que mais se beneficia de existir uma cópia só.
 */

@Injectable({ providedIn: 'root' })
export class CompanyStore extends ReferenceStore<Company> {
  private readonly service = inject(CompanyService);

  protected fetch(): Observable<Company[]> { return this.service.getAll(); }
  protected idOf(item: Company): string { return item.id; }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.withUpsert(this.service.create(request));
  }
}

@Injectable({ providedIn: 'root' })
export class DepartmentStore extends ReferenceStore<Department> {
  private readonly service = inject(DepartmentService);

  protected fetch(): Observable<Department[]> { return this.service.getAll(); }
  protected idOf(item: Department): string { return item.id; }

  create(request: CreateDepartmentRequest): Observable<Department> {
    return this.withUpsert(this.service.create(request));
  }

  update(id: string, request: CreateDepartmentRequest): Observable<Department> {
    return this.withUpsert(this.service.update(id, request));
  }

  /** So tira da lista local depois que a API confirmou. */
  delete(id: string): Observable<void> {
    return this.service.remove(id).pipe(tap(() => this.remove(id)));
  }
}

@Injectable({ providedIn: 'root' })
export class TeamStore extends ReferenceStore<Team> {
  private readonly service = inject(TeamService);

  protected fetch(): Observable<Team[]> { return this.service.getAll(); }
  protected idOf(item: Team): string { return item.id; }

  create(request: CreateTeamRequest): Observable<Team> {
    return this.withUpsert(this.service.create(request));
  }

  update(id: string, request: CreateTeamRequest): Observable<Team> {
    return this.withUpsert(this.service.update(id, request));
  }

  /** So tira da lista local depois que a API confirmou. */
  delete(id: string): Observable<void> {
    return this.service.remove(id).pipe(tap(() => this.remove(id)));
  }
}

@Injectable({ providedIn: 'root' })
export class HierarchyStore extends ReferenceStore<Hierarchy> {
  private readonly service = inject(HierarchyService);

  protected fetch(): Observable<Hierarchy[]> { return this.service.getAll(); }
  protected idOf(item: Hierarchy): string { return item.id; }

  create(request: CreateHierarchyRequest): Observable<Hierarchy> {
    return this.withUpsert(this.service.create(request));
  }

  update(id: string, request: CreateHierarchyRequest): Observable<Hierarchy> {
    return this.withUpsert(this.service.update(id, request));
  }

  /** So tira da lista local depois que a API confirmou. */
  delete(id: string): Observable<void> {
    return this.service.remove(id).pipe(tap(() => this.remove(id)));
  }
}
