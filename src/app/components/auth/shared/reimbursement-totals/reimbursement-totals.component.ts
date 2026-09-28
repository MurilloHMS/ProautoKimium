import { Component, computed, input, output } from '@angular/core';
import { PkKpiComponent, PkKpiTone } from '../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { ReimbursementStatus, ReimbursementSummary } from '../../../../domain/models/hr/reimbursement.model';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface TotalCard {
  label: string;
  /** Rótulo curto da faixa do celular ("A pagar"). */
  short: string;
  /** Cor do ponto na faixa: o mesmo papel do tom do cartão. */
  dot: string;
  /** O filtro que o cartão aplica na grade do RH; nulo = todos. */
  status: ReimbursementStatus | null;
  value: string;
  sub: string;
  tone: PkKpiTone;
}

function pedidos(n: number): string {
  return `${n} ${n === 1 ? 'pedido' : 'pedidos'}`;
}

/**
 * Enviado · Pendente · Aprovado, a pagar · Pago — em R$ e quantidade, do mês.
 *
 * Um componente para as duas telas de propósito: o funcionário e o RH leem os
 * mesmos quatro números, calculados pela mesma regra na API. Duas cópias
 * divergiriam no primeiro ajuste de rótulo.
 *
 * `selectable` (RH): cada cartão vira filtro da grade, sincronizado com o
 * seletor de status da toolbar (que continua, porque "Recusados" não tem cartão).
 */
@Component({
  selector: 'app-reimbursement-totals',
  standalone: true,
  imports: [PkKpiComponent],
  template: `
    @if (compact()) {
      <!-- Faixa do celular: 64px no lugar de 226. Rótulo curto e valor; a
           quantidade fica no computador, onde tem espaço. -->
      <div class="rs" role="group" aria-label="Totais do mês">
        @for (card of cards(); track card.label) {
          <button type="button" class="rs__item" [class.rs__item--on]="selectable() && card.status === selected()"
                  [disabled]="!selectable()" [attr.aria-pressed]="selectable() ? card.status === selected() : null"
                  [attr.aria-label]="card.label + ': ' + card.value + (card.sub ? ', ' + card.sub : '')"
                  (click)="select.emit(card.status)">
            <span class="rs__label"><i class="rs__dot" [style.background]="card.dot"></i>{{ card.short }}</span>
            <span class="rs__value">{{ loading() ? '—' : card.value }}</span>
          </button>
        }
      </div>
    } @else {
    <div class="rt">
      @for (card of cards(); track card.label) {
        @if (selectable()) {
          <button type="button" class="rt__card rt__card--btn"
                  [class.rt__card--on]="card.status === selected()"
                  [attr.aria-pressed]="card.status === selected()"
                  (click)="select.emit(card.status)">
            <pk-kpi [label]="card.label" [value]="card.value" [sub]="card.sub" [tone]="card.tone" [loading]="loading()" />
          </button>
        } @else {
          <div class="rt__card">
            <pk-kpi [label]="card.label" [value]="card.value" [sub]="card.sub" [tone]="card.tone" [loading]="loading()" />
          </div>
        }
      }
    </div>
    }
  `,
  styles: [`
    .rt { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .rt__card { min-width: 0; }
    .rt__card--btn { display: block; width: 100%; padding: 0; border: 0; background: transparent; text-align: left;
                     border-radius: var(--radius-surface, 12px); cursor: pointer; font: inherit; color: inherit; }
    .rt__card--btn:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    .rt__card--on { box-shadow: inset 0 0 0 2px var(--app-action); }
    @media (max-width: 768px) { .rt { grid-template-columns: 1fr 1fr; gap: 8px; } }
    /* Cartão com respiro, e não faixa de borda a borda: encostada na barra
       e na lista, ela lia como parte da toolbar. */
    .rs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); height: 64px;
          margin: 12px 12px 0; border: 1px solid var(--app-border); border-radius: var(--radius-surface, 12px);
          overflow: hidden; background: var(--app-surface); }
    .rs__item { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-width: 0;
                padding: 0 6px; border: 0; border-right: 1px solid var(--app-border); background: transparent;
                color: var(--app-text); font: inherit; text-align: left; cursor: pointer; }
    .rs__item:last-child { border-right: 0; }
    .rs__item:disabled { cursor: default; opacity: 1; }
    .rs__item:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    .rs__item--on { background: var(--app-action-soft); box-shadow: inset 0 -3px 0 var(--app-action); }
    .rs__label { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700;
                 letter-spacing: .03em; text-transform: uppercase; color: var(--app-text-muted); white-space: nowrap; }
    .rs__dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
    .rs__value { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `],
})
export class ReimbursementTotalsComponent {
  readonly summary = input<ReimbursementSummary | null>(null);
  readonly loading = input(false);
  readonly selectable = input(false);
  /** Faixa de uma linha (toolbar do celular). */
  readonly compact = input(false);
  /** O filtro aceso na grade; nulo = "Enviado" (todos). */
  readonly selected = input<ReimbursementStatus | null>(null);
  readonly select = output<ReimbursementStatus | null>();

  readonly cards = computed<TotalCard[]>(() => {
    const s = this.summary();
    const money = (v?: number) => (v === undefined ? '—' : BRL.format(v));
    return [
      { label: 'Enviado', short: 'Enviado', dot: 'var(--app-text-muted)', status: null, value: money(s?.sent.amount), sub: s ? pedidos(s.sent.count) : '', tone: 'default' },
      {
        label: 'Pendente', short: 'Pendente', dot: 'var(--app-warning)', status: 'PENDING', value: money(s?.pending.amount), tone: 'warning',
        sub: s ? pedidos(s.pending.count) + (s.contestedPending ? ` · ${s.contestedPending} contestado${s.contestedPending > 1 ? 's' : ''}` : '') : '',
      },
      { label: 'Aprovado, a pagar', short: 'A pagar', dot: 'var(--app-info)', status: 'APPROVED', value: money(s?.approved.amount), sub: s ? pedidos(s.approved.count) : '', tone: 'default' },
      { label: 'Pago', short: 'Pago', dot: 'var(--app-success)', status: 'PAID', value: money(s?.paid.amount), sub: s ? pedidos(s.paid.count) : '', tone: 'success' },
    ];
  });
}
