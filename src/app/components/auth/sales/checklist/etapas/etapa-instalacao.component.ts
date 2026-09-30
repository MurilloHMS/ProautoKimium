import { Component, inject } from '@angular/core';
import { ChecklistContent, ChecklistMachine, MachineType } from '../../../../../domain/models/sales/checklist.model';
import { dataValida } from '../../../../../domain/utils/checklist/checklist-regras';
import { ChecklistSessao } from '../checklist-sessao';
import { OpcoesComponent } from '../ui/opcoes.component';
import { QuantidadeComponent } from '../ui/quantidade.component';
import { SimNaoComponent } from '../ui/sim-nao.component';

/**
 * Etapa 4 — instalação e máquinas. Tipo: Capô, Esteira, Frontal ou Outra (a
 * lista da planilha, confirmada por ele); "Vai com mesa?" é só Sim ou Não — o
 * tipo da mesa saiu a pedido dele (2026-09-30). A data da implantação é
 * opcional e vem primeiro: é o que a Controladoria procura antes de tudo.
 */
@Component({
  selector: 'ck-etapa-instalacao',
  standalone: true,
  imports: [SimNaoComponent, OpcoesComponent, QuantidadeComponent],
  templateUrl: './etapa-instalacao.component.html',
  styleUrl: './etapa.scss',
})
export class EtapaInstalacaoComponent {

  protected readonly s = inject(ChecklistSessao);

  protected readonly tipos: { valor: MachineType; rotulo: string }[] = [
    { valor: 'CAPO', rotulo: 'Capô' },
    { valor: 'ESTEIRA', rotulo: 'Esteira' },
    { valor: 'FRONTAL', rotulo: 'Frontal' },
    { valor: 'OUTRA', rotulo: 'Outra' },
  ];

  protected get i() {
    return this.s.conteudo().installation ?? instalacaoVazia();
  }

  protected responder(campo: 'withMaintenance' | 'needsMachine', valor: boolean | null): void {
    this.s.atualizar(c => {
      c.installation ??= instalacaoVazia();
      c.installation[campo] = valor;
      // "Sim" já abre a primeira máquina: o próximo passo óbvio vem pronto.
      if (campo === 'needsMachine' && valor && !c.installation.machines.length) {
        c.installation.machines.push(novaMaquina());
      }
    });
  }

  protected maquina<K extends keyof ChecklistMachine>(n: number, campo: K, valor: ChecklistMachine[K]): void {
    this.s.atualizar(c => {
      const m = c.installation?.machines[n];
      if (!m) return;
      m[campo] = valor;
      if (campo === 'type' && valor !== 'OUTRA') m.otherType = null;
    });
  }

  protected outraMaquina(): void {
    this.s.atualizar(c => c.installation?.machines.push(novaMaquina()));
  }

  protected tirar(n: number): void {
    this.s.atualizar(c => c.installation?.machines.splice(n, 1));
  }

  /** O campo de data devolve "aaaa-mm-dd", ou vazio quando a pessoa limpa. */
  protected implantacao(texto: string | null): void {
    this.s.atualizar(c => {
      c.installation ??= instalacaoVazia();
      c.installation.implantationDate = texto || null;
    });
  }

  /** "segunda-feira, 5 de outubro de 2026": confirma por extenso o que o calendário marcou. */
  protected porExtenso(iso: string | null | undefined): string | null {
    if (!iso || !dataValida(iso)) return null;
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected notas(texto: string): void {
    this.s.atualizar(c => { if (c.installation) c.installation.notes = texto || null; });
  }
}

function instalacaoVazia(): NonNullable<ChecklistContent['installation']> {
  return { withMaintenance: null, needsMachine: null, machines: [], notes: null, implantationDate: null };
}

function novaMaquina(): ChecklistMachine {
  return { type: null, otherType: null, quantity: 1, withTable: null };
}
