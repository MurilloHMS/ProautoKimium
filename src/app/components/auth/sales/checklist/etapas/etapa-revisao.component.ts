import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { ETAPAS, totalDoPedido } from '../../../../../domain/utils/checklist/checklist-regras';
import { ChecklistSessao } from '../checklist-sessao';

const TIPOS: Record<string, string> = { CAPO: 'capô', ESTEIRA: 'esteira', FRONTAL: 'frontal', OUTRA: 'outra' };

/**
 * Etapa 8 — conferir. Uma linha por etapa: o que foi preenchido, ou o que
 * falta, em vermelho, dizendo o quê. Tocar leva à etapa.
 */
@Component({
  selector: 'ck-etapa-revisao',
  standalone: true,
  templateUrl: './etapa-revisao.component.html',
  styleUrl: './etapa-revisao.component.scss',
})
export class EtapaRevisaoComponent {

  protected readonly s = inject(ChecklistSessao);
  readonly irPara = output<number>();

  private readonly moeda = new CurrencyPipe('pt-BR');

  protected readonly linhas = computed(() => {
    const c = this.s.conteudo();
    const problemas = this.s.problemas();
    return ETAPAS.slice(0, 7).map(e => {
      const daEtapa = problemas.filter(p => p.etapa === e.numero).map(p => p.mensagem.replace(/^Etapa \d+ — /, ''));
      return { etapa: e.numero, titulo: e.curto, faltas: daEtapa, resumo: this.resumo(e.numero), opcional: e.numero === 7 && !c.order?.enabled };
    });
  });

  private resumo(etapa: number): string {
    const c = this.s.conteudo();
    switch (etapa) {
      case 1: return c.customer?.name ? (c.customer.newCustomer ? `${c.customer.name} (cliente novo)` : c.customer.name) : 'Sem cliente';
      case 2: {
        const mudancas = ['zipCode', 'street', 'number', 'complement', 'district', 'city', 'state']
          .filter(k => this.s.divergencia(k, (c.mainAddress as unknown as Record<string, string | null> | null)?.[k])).length;
        const cidade = c.mainAddress?.city ? `${c.mainAddress.city}/${c.mainAddress.state ?? ''}` : '';
        return mudancas ? `${cidade} · ${mudancas} ${mudancas === 1 ? 'mudança' : 'mudanças'} para a Controladoria conferir` : cidade;
      }
      case 3: return c.customer?.signatory ? `Assina: ${c.customer.signatory}` : '';
      case 4: {
        const i = c.installation;
        if (!i?.needsMachine) return i?.needsMachine === false ? 'Sem máquina' : '';
        return i.machines.map(m => `${m.quantity} ${m.type === 'OUTRA' ? (m.otherType ?? 'outra') : (TIPOS[m.type ?? ''] ?? '?')}`).join(', ');
      }
      case 5: {
        const n = (c.comodato?.items.length ?? 0) + (c.comodato?.extraItems.length ?? 0);
        return n ? `${n} ${n === 1 ? 'item' : 'itens'}` : 'Nada em comodato';
      }
      case 6: {
        const n = c.visual?.items.length ?? 0;
        return n ? `${n} ${n === 1 ? 'item' : 'itens'}` : 'Nenhum item';
      }
      case 7: return c.order?.enabled
        ? `${c.order.kind === 'BONIFICADO' ? 'Bonificado' : 'Venda'} · ${this.moeda.transform(totalDoPedido(c.order.items), 'BRL', 'symbol', '1.2-2')}`
        : 'Sem pedido';
      default: return '';
    }
  }
}
