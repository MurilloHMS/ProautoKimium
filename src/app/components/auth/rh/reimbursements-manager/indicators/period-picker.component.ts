import { Component, input, output } from '@angular/core';
import { Granularity } from './reimbursement-indicators';

/**
 * Mês/Trimestre/Ano e o ‹ › — o período da tela de reembolsos, um só para as
 * abas Pedidos e Indicadores (2026-09-29). No computador mora na linha das
 * abas; no celular, `compact` (só o ‹ ›) na barra de Pedidos e inteiro no topo
 * dos Indicadores.
 */
@Component({
  selector: 'app-period-picker',
  standalone: true,
  host: { '[class.pp--compact]': 'compact()' },
  template: `
    @if (!compact()) {
      <div class="pp-gran" role="group" aria-label="Período">
        @for (g of options; track g.value) {
          <button type="button" [class.is-on]="granularity() === g.value" [attr.aria-pressed]="granularity() === g.value"
                  (click)="granularityChange.emit(g.value)">{{ g.label }}</button>
        }
      </div>
    }
    <div class="pp-nav">
      <button type="button" aria-label="Período anterior" (click)="move.emit(-1)"><i class="pi pi-chevron-left" aria-hidden="true"></i></button>
      <b>{{ label() }}</b>
      <button type="button" aria-label="Próximo período" [disabled]="!canGoForward()" (click)="move.emit(1)"><i class="pi pi-chevron-right" aria-hidden="true"></i></button>
    </div>
  `,
  // As medidas do `app-month-switcher` da aba Pedidos, uma a uma: o ‹ › é o
  // mesmo controle nas duas abas, no mesmo lugar e do mesmo tamanho — só o
  // Mês/Trimestre/Ano aparece ao lado (ele viu dois tamanhos em 2026-09-29).
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--gap-control, 8px); flex: none; }

    .pp-gran {
      display: inline-flex;
      border: 1px solid var(--app-border);
      border-radius: var(--radius-pill, 999px);
      background: var(--app-surface);
      overflow: hidden;

      button {
        height: 30px;
        padding: 0 12px;
        border: 0;
        background: transparent;
        color: var(--app-text-muted);
        font: inherit;
        font-size: var(--text-ui-sm);
        font-weight: 600;
        cursor: pointer;

        &.is-on { background: var(--app-action-soft); color: var(--app-action); }
        &:focus-visible { outline: none; box-shadow: inset var(--app-focus-ring); }
      }
    }

    .pp-nav {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--app-border);
      border-radius: var(--radius-pill, 999px);
      background: var(--app-surface);
      overflow: hidden;

      b { padding: 0 10px; min-width: 128px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }

      button {
        width: 32px;
        height: 30px;
        border: 0;
        background: transparent;
        color: var(--app-text);
        cursor: pointer;

        &:hover:not(:disabled) { background: var(--app-action-soft); }
        &:disabled { opacity: .35; cursor: default; }
        &:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
      }
    }

    /* Celular, inteiro (topo dos Indicadores): a largura toda, o ‹ › ocupando o que sobra. */
    @media (max-width: 768px) {
      :host { display: flex; width: 100%; }
      .pp-gran button { height: 40px; padding: 0 8px; } /* 8px: com 10 o "Setembro 2026" era cortado a 390px */
      .pp-nav { flex: 1 1 auto; min-width: 0; justify-content: space-between; }
      .pp-nav b { min-width: 0; padding: 0 4px; white-space: nowrap; }
      .pp-nav button { width: 36px; height: 40px; } /* a largura do compacto; a altura de toque fica */
    }

    /* Compacto (barra do celular): só o ‹ ›, como o month-switcher compacto. */
    :host(.pp--compact) { flex: 1 1 auto; min-width: 0; width: auto; }
    :host(.pp--compact) .pp-nav { flex: 1 1 auto; min-width: 0; justify-content: space-between; }
    :host(.pp--compact) .pp-nav button { width: 36px; height: 40px; }
    :host(.pp--compact) .pp-nav b { min-width: 0; padding: 0 4px; font-size: 12.5px; white-space: nowrap; }
  `,
})
export class PeriodPickerComponent {
  readonly granularity = input.required<Granularity>();
  readonly label = input.required<string>();
  readonly canGoForward = input(false);
  /** Só o ‹ ›, sem Mês/Trimestre/Ano: a barra do celular. */
  readonly compact = input(false);

  readonly granularityChange = output<Granularity>();
  readonly move = output<number>();

  readonly options: { value: Granularity; label: string }[] = [
    { value: 'month', label: 'Mês' },
    { value: 'quarter', label: 'Trimestre' },
    { value: 'year', label: 'Ano' },
  ];
}
