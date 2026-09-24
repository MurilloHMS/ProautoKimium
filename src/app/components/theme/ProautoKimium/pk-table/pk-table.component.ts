import {
  Component, ContentChild, TemplateRef, ViewChild,
  computed, forwardRef, input, signal
} from '@angular/core';
import {CommonModule} from "@angular/common";
import {Table, TableModule, TableService} from "primeng/table";
import {InputTextModule} from "primeng/inputtext";
import {PkInputComponent} from "../pk-input/pk-input.component";
import {PkEmptyComponent} from "../pk-empty/pk-empty.component";
import {ehCelular} from "../../../../infrastructure/state/eh-celular";

@Component({
  selector: 'pk-table',
  imports: [
    CommonModule,
    TableModule,
    InputTextModule,
    PkInputComponent,
    PkEmptyComponent
  ],
  templateUrl: './pk-table.component.html',
  styleUrl: './pk-table.component.scss',
  providers: [
    TableService,
    {
      provide: Table,
      useFactory: (component: PkTableComponent<any>) => component.dt,
      deps: [forwardRef(() => PkTableComponent)]
    }
  ]
})
export class PkTableComponent<T> {
  data          = input<T[]>([]);
  loading       = input<boolean>(false);
  totalLabel    = input<string>('registros');
  rows          = input<number>(10);
  rowsOptions   = input<number[]>([5, 10, 20]);
  filterFields  = input<string[]>([]);
  searchPlaceholder = input<string>('Buscar…');
  emptyIcon     = input<string>('pi pi-inbox');
  emptyTitle    = input<string>('Nenhum registro encontrado');
  emptySubtitle = input<string>('');
  pageReportTitle = input<string>('Registros encontrados');

  /**
   * Barra de contagem e busca acima da grade. Telas com toolbar própria
   * desligam: a busca passa a morar na toolbar e a contagem já aparece na
   * paginação ("Mostrando 1 a 14 de 87").
   */
  showCaption = input<boolean>(true);

  /** Quantos cartões aparecem antes do "Mostrar mais". */
  private static readonly LOTE = 20;

  @ViewChild('dt', { static: true }) dt!: Table;

  @ContentChild('headerTpl') headerTpl!: TemplateRef<any>;
  @ContentChild('bodyTpl') bodyTpl!: TemplateRef<any>;

  /**
   * O cartão que substitui a linha no celular.
   *
   * <p>Opcional: tela sem ele continua com a tabela rolando de lado, como
   * antes. A anatomia do cartão — título, subtítulo, marca no canto e rodapé —
   * está nas classes `pk-cartao*` do tema, e é o que faz cartões de telas
   * diferentes parecerem o mesmo componente.
   */
  @ContentChild('cardTpl') cardTpl?: TemplateRef<any>;

  readonly ehCelular = ehCelular();

  /** Termo digitado, para filtrar os cartões — a tabela filtra pelo PrimeNG. */
  private readonly termo = signal('');

  private readonly limite = signal(PkTableComponent.LOTE);

  /**
   * Cartões em vez de tabela.
   *
   * <p>Só no celular, e só quando a tela ofereceu um `#cardTpl`. Sem ele não há
   * como adivinhar quais das oito colunas cabem num cartão — e empilhar todas
   * viraria a mesma tabela, de pé.
   */
  readonly mostrarCartoes = computed(() => this.ehCelular() && !!this.cardTpl);

  /** As linhas que passam pela busca, antes do corte do lote. */
  readonly linhasFiltradas = computed<T[]>(() => {
    const termo = chaveDeBusca(this.termo());
    const campos = this.filterFields();

    if (!termo || campos.length === 0) return this.data();

    return this.data().filter(linha =>
      campos.some(campo => chaveDeBusca(valorDoCampo(linha, campo)).includes(termo)));
  });

  readonly linhasVisiveis = computed<T[]>(() =>
    this.linhasFiltradas().slice(0, this.limite()));

  readonly temMais = computed(() => this.linhasFiltradas().length > this.limite());

  readonly restantes = computed(() => this.linhasFiltradas().length - this.limite());

  mostrarMais(): void {
    this.limite.update(n => n + PkTableComponent.LOTE);
  }

  /**
   * Filtro global — usado pela busca da toolbar da tela e pela barra própria.
   *
   * <p>Alimenta os dois modos: o PrimeNG no desktop e o sinal dos cartões no
   * celular. Quem chama é a tela, que não sabe — nem precisa saber — em qual
   * dos dois está.
   */
  filterGlobal(value: string): void {
    this.termo.set(value ?? '');
    this.limite.set(PkTableComponent.LOTE);
    this.dt?.filterGlobal(value, 'contains');
  }
}

/** Minúsculas e sem acento: "Vinícius" tem que ser achado por "vinicius". */
function chaveDeBusca(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * O valor de um campo, aceitando caminho com ponto.
 *
 * <p>`filterFields` já vinha com caminhos como `team.name` para o PrimeNG, que
 * os resolve. Os cartões precisam resolver do mesmo jeito, senão a mesma busca
 * acha coisas diferentes no celular e no desktop.
 */
function valorDoCampo(linha: unknown, campo: string): string {
  const valor = campo.split('.').reduce<any>(
    (atual, parte) => (atual == null ? atual : atual[parte]), linha);

  return valor == null ? '' : String(valor);
}
