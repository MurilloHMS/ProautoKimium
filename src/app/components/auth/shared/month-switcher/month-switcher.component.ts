import { Component, computed, input, output } from '@angular/core';

/** `2026-09` → `2026-10` (e `2026-12` → `2027-01`). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** O mês de hoje em `yyyy-MM`, pelas partes locais — `toISOString` viraria o mês às 21h do último dia. */
export function currentMonth(today = new Date()): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * ‹ Setembro 2026 › — anda um mês por vez.
 *
 * O valor é texto `yyyy-MM`, o mesmo que a API recebe no `?month=`: não há
 * `Date` no meio para errar fuso. `fill` ocupa a largura toda (celular).
 */
@Component({
  selector: 'app-month-switcher',
  standalone: true,
  template: `
    <div class="ms" [class.ms--fill]="fill()" role="group" aria-label="Mês">
      <button type="button" class="ms__btn" (click)="change.emit(prev())" [attr.aria-label]="'Mês anterior: ' + label(prev())">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
      </button>
      <span class="ms__label" aria-live="polite">{{ label(month()) }}</span>
      <button type="button" class="ms__btn" (click)="change.emit(next())" [attr.aria-label]="'Próximo mês: ' + label(next())">
        <i class="pi pi-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  `,
  styles: [`
    .ms { display: inline-flex; align-items: center; border: 1px solid var(--app-border); border-radius: var(--radius-pill, 999px);
          background: var(--app-surface); overflow: hidden; }
    .ms--fill { display: flex; width: 100%; justify-content: space-between; }
    .ms__btn { width: 32px; height: 30px; border: 0; background: transparent; color: var(--app-text); cursor: pointer; }
    .ms__btn:hover { background: var(--app-action-soft); }
    .ms__btn:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    .ms__label { padding: 0 10px; min-width: 128px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
    @media (max-width: 768px) { .ms__btn { width: 48px; height: 44px; } }
  `],
})
export class MonthSwitcherComponent {
  /** `yyyy-MM` */
  readonly month = input.required<string>();
  readonly fill = input(false);
  readonly change = output<string>();

  readonly prev = computed(() => shiftMonth(this.month(), -1));
  readonly next = computed(() => shiftMonth(this.month(), 1));

  label(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }
}
