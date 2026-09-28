import { Component, computed, input, output } from '@angular/core';
import { PkKpiComponent, PkKpiTone } from '../../../theme/ProautoKimium/pk-kpi/pk-kpi.component';
import { ReimbursementStatus, ReimbursementSummary } from '../../../../domain/models/hr/reimbursement.model';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface TotalCard {
  label: string;
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
  `,
  styles: [`
    .rt { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .rt__card { min-width: 0; }
    .rt__card--btn { display: block; width: 100%; padding: 0; border: 0; background: transparent; text-align: left;
                     border-radius: var(--radius-surface, 12px); cursor: pointer; font: inherit; color: inherit; }
    .rt__card--btn:focus-visible { outline: none; box-shadow: var(--app-focus-ring); }
    .rt__card--on { box-shadow: inset 0 0 0 2px var(--app-action); }
    @media (max-width: 768px) { .rt { grid-template-columns: 1fr 1fr; gap: 8px; } }
  `],
})
export class ReimbursementTotalsComponent {
  readonly summary = input<ReimbursementSummary | null>(null);
  readonly loading = input(false);
  readonly selectable = input(false);
  /** O filtro aceso na grade; nulo = "Enviado" (todos). */
  readonly selected = input<ReimbursementStatus | null>(null);
  readonly select = output<ReimbursementStatus | null>();

  readonly cards = computed<TotalCard[]>(() => {
    const s = this.summary();
    const money = (v?: number) => (v === undefined ? '—' : BRL.format(v));
    return [
      { label: 'Enviado', status: null, value: money(s?.sent.amount), sub: s ? pedidos(s.sent.count) : '', tone: 'default' },
      {
        label: 'Pendente', status: 'PENDING', value: money(s?.pending.amount), tone: 'warning',
        sub: s ? pedidos(s.pending.count) + (s.contestedPending ? ` · ${s.contestedPending} contestado${s.contestedPending > 1 ? 's' : ''}` : '') : '',
      },
      { label: 'Aprovado, a pagar', status: 'APPROVED', value: money(s?.approved.amount), sub: s ? pedidos(s.approved.count) : '', tone: 'default' },
      { label: 'Pago', status: 'PAID', value: money(s?.paid.amount), sub: s ? pedidos(s.paid.count) : '', tone: 'success' },
    ];
  });
}
