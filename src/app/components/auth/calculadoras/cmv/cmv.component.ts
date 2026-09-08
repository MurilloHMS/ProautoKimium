import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PkInputComponent } from '../../../theme/ProautoKimium/pk-input/pk-input.component';
import { PkSegmentedComponent, type PkSegmentedOption }
  from '../../../theme/ProautoKimium/pk-segmented/pk-segmented.component';
import { calculadora } from '../calculadoras.catalog';
import { lerDecimal, reais, percentual, CASAS_DINHEIRO, CASAS_CMV } from '../formato';
import { calcularCmv, type CampoCalculado, type ResultadoCmv } from '../../../../domain/utils/cmv';
import { formatarDecimal } from '../../../../domain/utils/decimal-br';
import { calcularLinha, totaisDaLista } from '../../../../domain/utils/cmv-lista';
import { SankhyaService } from '../../../../infrastructure/services/sankhya/sankhya.service';
import { temCustoCalculado, type LinhaCmv, type ProdutoCmv }
  from '../../../../domain/models/sankhya/produto-cmv.model';

/**
 * CMV — custo da mercadoria vendida.
 *
 * Três campos e um deles é o resultado: custo, venda e percentual são faces da
 * mesma relação, então três modos separados seriam a mesma conta escrita três
 * vezes.
 */
@Component({
  selector: 'app-calculadora-cmv',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, PkInputComponent, PkSegmentedComponent],
  templateUrl: './cmv.component.html',
  styleUrl: './cmv.component.scss',
})
export class CmvComponent {

  /** Título e descrição saem do catálogo, os mesmos que o hub mostra no cartão. */
  readonly calc = calculadora('cmv');

  /**
   * As duas contas moram na mesma tela, mas uma de cada vez.
   *
   * Sao perguntas diferentes: "que venda me da o CMV que eu quero" e "qual o
   * CMV destes produtos que eu ja tenho". Empilhadas, a segunda empurrava a
   * primeira para fora da tela e as duas competiam pela atencao.
   *
   * `pk-segmented` e nao abas do PrimeNG: isto e estado de tela, e o tema ja
   * tem o componente para isso.
   */
  readonly modo = signal<'simples' | 'produtos'>('simples');

  readonly modos: PkSegmentedOption[] = [
    { label: 'Cálculo simples', value: 'simples' },
    { label: 'Por produto',     value: 'produtos' },
  ];

  readonly custo = signal('');
  readonly venda = signal('');
  readonly cmv = signal('');

  /**
   * Qual campo a tela preenche. Começa no CMV porque é o que a maioria quer
   * saber, e muda sozinho quando alguém digita justamente nele.
   */
  readonly campoCalculado = signal<CampoCalculado>('cmv');

  readonly resultado = computed<ResultadoCmv | null>(() =>
    calcularCmv(
      {
        custo: lerDecimal(this.custo()),
        venda: lerDecimal(this.venda()),
        cmvPercentual: lerDecimal(this.cmv()),
      },
      this.campoCalculado(),
    ),
  );

  /**
   * Digitar no campo que hoje é o calculado passa o cálculo para outro — é o
   * que dispensa um seletor de modo.
   *
   * O destino é o CMV, salvo quando é nele que se está digitando: aí o
   * calculado vira o preço de venda, que é a outra pergunta que alguém faz de
   * pé na frente do cliente.
   */
  aoDigitar(campo: CampoCalculado, valor: string): void {
    this[campo].set(valor);
    if (this.campoCalculado() === campo) {
      this.campoCalculado.set(campo === 'cmv' ? 'venda' : 'cmv');
    }
  }

  /** O que aparece na caixa: o texto digitado, ou o resultado já formatado. */
  valorDe(campo: CampoCalculado): string {
    if (campo !== this.campoCalculado()) return this[campo]();

    const r = this.resultado();
    if (!r) return '';
    return campo === 'cmv'
      ? formatarDecimal(r.cmvPercentual, CASAS_CMV)
      : formatarDecimal(r[campo], CASAS_DINHEIRO);
  }

  limpar(): void {
    this.custo.set('');
    this.venda.set('');
    this.cmv.set('');
    this.campoCalculado.set('cmv');
  }

  readonly casasDinheiro = CASAS_DINHEIRO;
  readonly casasCmv = CASAS_CMV;

  // ── Lista de produtos, com o custo vindo do ERP ───────────────────────────
  //
  // O bloco de cima responde "que venda me dá o CMV que eu quero"; este
  // responde "qual o CMV destes produtos que eu ja tenho". Perguntas
  // diferentes, e a de cima nao some porque o custo do ERP nao a resolve.

  private readonly sankhya = inject(SankhyaService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Tabela no desktop, cartoes no celular.
   *
   * `@if` e nao `display: none`: a tabela tem um campo por linha, e esconder
   * por CSS deixaria os campos vivos no DOM — foco, tab e leitor de tela
   * passariam por eles.
   *
   * 768px e o `$bp-md` do SCSS, repetido aqui porque media query nao atravessa
   * para o TypeScript. Se um mudar, o outro muda junto, senao a tabela e os
   * cartoes aparecem ao mesmo tempo.
   */
  readonly ehCelular = signal(false);

  constructor() {
    const celular = window.matchMedia('(max-width: 768px)');
    const aplicar = () => this.ehCelular.set(celular.matches);

    celular.addEventListener('change', aplicar);
    this.destroyRef.onDestroy(() => celular.removeEventListener('change', aplicar));
    aplicar();
  }

  readonly produtos = signal<ProdutoCmv[]>([]);
  readonly carregando = signal(false);
  readonly erroAoCarregar = signal<string | null>(null);

  /** O que foi digitado na busca do seletor. */
  readonly busca = signal('');
  readonly seletorAberto = signal(false);

  readonly linhas = signal<LinhaCmv[]>([]);

  /**
   * Os produtos que casam com a busca, no maximo 30.
   *
   * O limite existe porque sao 4.632: desenhar todos trava a tela, e ninguem
   * le uma lista de mil linhas — quem nao achou refina a busca.
   */
  readonly sugestoes = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    if (!termo) return [];

    const jaNaLista = new Set(this.linhas().map(l => l.produto.codigo));

    return this.produtos()
      .filter(p => !jaNaLista.has(p.codigo))
      .filter(p => p.nome.toLowerCase().includes(termo) || String(p.codigo).includes(termo))
      .slice(0, 30);
  });

  readonly totais = computed(() => totaisDaLista(this.linhas()));

  /** Quantos produtos da base ainda nao tem custo — aparece como aviso. */
  readonly semCustoCalculado = computed(() =>
    this.produtos().filter(p => !temCustoCalculado(p)).length);

  carregarProdutos(): void {
    if (this.carregando()) return;

    this.carregando.set(true);
    this.erroAoCarregar.set(null);

    this.sankhya.produtosComCmv().subscribe({
      next: produtos => {
        this.produtos.set(produtos);
        this.carregando.set(false);
      },
      error: erro => {
        this.carregando.set(false);
        // A mensagem do servidor primeiro: ela diz se foi permissao, se o ERP
        // recusou, ou se a consulta esta errada. Trocar por texto generico
        // apagaria justamente o que resolve.
        this.erroAoCarregar.set(
          erro?.error?.message ?? 'Nao foi possivel buscar os produtos no Sankhya.');
      },
    });
  }

  temCusto(produto: ProdutoCmv): boolean {
    return temCustoCalculado(produto);
  }

  /** Produto sem custo calculado nao entra: a linha nao teria como calcular. */
  adicionar(produto: ProdutoCmv): void {
    if (!temCustoCalculado(produto)) return;

    this.linhas.update(atual => [...atual, { produto, venda: '' }]);
    this.busca.set('');
    this.seletorAberto.set(false);
  }

  remover(codigo: number): void {
    this.linhas.update(atual => atual.filter(l => l.produto.codigo !== codigo));
  }

  aoDigitarVenda(codigo: number, valor: string): void {
    this.linhas.update(atual => atual.map(l =>
      l.produto.codigo === codigo ? { ...l, venda: valor } : l));
  }

  resultadoDa(linha: LinhaCmv) {
    return calcularLinha(linha);
  }

  limparLista(): void {
    this.linhas.set([]);
    this.busca.set('');
  }

  readonly reais = reais;
  readonly percentual = percentual;
}
