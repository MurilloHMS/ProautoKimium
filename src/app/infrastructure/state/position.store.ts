import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  CreatePositionLevelRequest,
  CreatePositionRequest,
  Position,
  PositionLevel,
} from '../../domain/models/hr/career.model';
import { PositionLevelService } from '../services/hr/position-level.service';
import { PositionService } from '../services/hr/position.service';
import { ReferenceStore } from './reference-store';

@Injectable({ providedIn: 'root' })
export class PositionStore extends ReferenceStore<Position> {
  private readonly service = inject(PositionService);

  protected fetch(): Observable<Position[]> { return this.service.getAll(); }
  protected idOf(item: Position): string { return item.id; }

  create(request: CreatePositionRequest): Observable<Position> {
    return this.withUpsert(this.service.create(request));
  }
}

/**
 * Níveis são por cargo (`getByPosition`), então não cabem na base, que guarda
 * uma lista única. Aqui o cache é um mapa de cargo → níveis, com o mesmo
 * efeito: criar um nível aparece na hora em qualquer tela que esteja olhando
 * aquele cargo.
 */
@Injectable({ providedIn: 'root' })
export class PositionLevelStore {

  private readonly service = inject(PositionLevelService);

  private readonly byPosition = signal<Record<string, PositionLevel[]>>({});
  private readonly loading = signal<Set<string>>(new Set());

  /** Níveis já carregados de um cargo. Vazio enquanto a busca não terminou. */
  levelsOf(positionId: string): PositionLevel[] {
    return this.byPosition()[positionId] ?? [];
  }

  isLoading(positionId: string): boolean {
    return this.loading().has(positionId);
  }

  load(positionId: string, force = false): void {
    if (!positionId) return;
    if (!force && positionId in this.byPosition()) return;
    if (this.loading().has(positionId)) return;

    this.loading.update(set => new Set(set).add(positionId));

    this.service.getByPosition(positionId).subscribe({
      next: levels => {
        this.byPosition.update(map => ({ ...map, [positionId]: levels }));
        this.stopLoading(positionId);
      },
      error: () => this.stopLoading(positionId),
    });
  }

  create(request: CreatePositionLevelRequest): Observable<PositionLevel> {
    return this.service.create(request).pipe(tap(level => this.upsert(level)));
  }

  upsert(level: PositionLevel): void {
    this.byPosition.update(map => {
      const current = map[level.positionId] ?? [];
      const index = current.findIndex(item => item.id === level.id);

      const next = index === -1 ? [...current, level] : current.map(item => item.id === level.id ? level : item);
      return { ...map, [level.positionId]: next };
    });
  }

  /** Usado depois do dissídio, que recalcula os salários de todos os níveis. */
  invalidateAll(): void {
    this.byPosition.set({});
  }

  private stopLoading(positionId: string): void {
    this.loading.update(set => {
      const next = new Set(set);
      next.delete(positionId);
      return next;
    });
  }
}
