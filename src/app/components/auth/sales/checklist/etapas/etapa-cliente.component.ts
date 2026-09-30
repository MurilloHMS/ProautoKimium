import { Component, computed, inject, signal } from '@angular/core';
import { buscarClientes } from '../../../../../domain/utils/checklist/checklist-catalogo';
import { formatarDocumento } from '../../../../../infrastructure/validators/documento-br';
import { ChecklistSessao } from '../checklist-sessao';

/**
 * Etapa 1 — qual é o cliente. A busca roda no celular (os clientes ficam no
 * aparelho), então funciona sem internet. Cliente que não aparece vira
 * "cliente novo", com os dados digitados.
 */
@Component({
  selector: 'ck-etapa-cliente',
  standalone: true,
  templateUrl: './etapa-cliente.component.html',
  styleUrl: './etapa.scss',
})
export class EtapaClienteComponent {

  protected readonly s = inject(ChecklistSessao);

  protected readonly busca = signal('');
  protected readonly novo = computed(() => this.s.conteudo().customer?.newCustomer === true);
  protected readonly escolhido = computed(() => this.s.conteudo().customer);

  protected readonly resultados = computed(() => {
    const indice = this.s.indice();
    return indice ? buscarClientes(indice, this.busca()) : [];
  });

  protected readonly doc = formatarDocumento;

  protected buscar(texto: string): void {
    this.busca.set(texto);
  }

  protected trocar(): void {
    this.s.atualizar(c => { c.customer = null; });
    this.busca.set('');
  }

  protected nomeDoNovo(nome: string): void {
    this.s.atualizar(c => { if (c.customer) c.customer.name = nome; });
  }

  protected razaoDoNovo(razao: string): void {
    this.s.atualizar(c => { if (c.customer) c.customer.legalName = razao || null; });
  }
}
