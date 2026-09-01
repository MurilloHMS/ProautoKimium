import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SnackbarComponent } from '../../shared/snackbar/snackbar.component';
import { environment } from '../../../../environments/environment';
import {OrcamentoService} from "../../../infrastructure/services/company/products/website/orcamento/orcamento.service";
import {OrcamentoDrawerComponent} from "./components/orcamento-drawer/orcamento-drawer.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ProductWebSitePublicResponseDTO} from "../../../domain/models/products.model";
import { urlDeMidia } from '../../../infrastructure/config/media-url';
import { apenasDigitos, formatarDocumento } from '../../../infrastructure/validators/documento-br';

export interface ProdutoPorDepartamento {
  nome: string;
  produtos: ProductWebSitePublicResponseDTO[];
}

@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, RouterModule, SnackbarComponent, OrcamentoDrawerComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './lista-produtos.component.html',
  styleUrl: './lista-produtos.component.scss',
})
export class ListaProdutosComponent implements OnInit {
  currentYear: number = new Date().getFullYear() - 1989;

  produtos = signal<ProductWebSitePublicResponseDTO[]>([]);
  loading  = signal(true);
  erro     = signal(false);

  // Busca
  busca = signal('');

  produtosFiltrados = computed<ProductWebSitePublicResponseDTO[]>(() => {
    const termo = this.busca().trim().toLowerCase();
    const lista = this.produtos();
    if (!termo) return lista;
    return lista.filter(p =>
      [p.name, p.finalidade, p.descricao, p.systemCode]
        .some(campo => (campo ?? '').toLowerCase().includes(termo))
    );
  });

  snackbarMessage = '';
  showSnackbar    = false;

  // ─── Ficha técnica ────────────────────────────────────────────────────────
  //
  // O card corta a descrição em duas linhas (`-webkit-line-clamp: 2`), então uma
  // descrição de 500 caracteres aparece com uns 90. O corte é proposital — sem
  // ele um produto falante empurraria os outros cards para fora do alinhamento.
  // O texto inteiro passa a viver aqui.

  /** Nulo com o diálogo fechado, que é quase sempre. */
  readonly fichaDe = signal<ProductWebSitePublicResponseDTO | null>(null);

  abrirFicha(produto: ProductWebSitePublicResponseDTO): void {
    this.fichaDe.set(produto);
  }

  fecharFicha(): void {
    this.fichaDe.set(null);
  }

  /**
   * Pede o orçamento e fecha a ficha.
   *
   * Deixar o diálogo aberto depois de adicionar esconderia o snackbar de
   * confirmação atrás dele — a pessoa clicaria de novo achando que não pegou.
   */
  orcarDaFicha(produto: ProductWebSitePublicResponseDTO): void {
    this.fecharFicha();
    this.adicionarAoOrcamento(produto);
  }

  // Agrupamento — quando a API trouxer departamento, troque o campo aqui
  departamentos = computed<ProdutoPorDepartamento[]>(() => {
    const lista = this.produtos();
    if (!lista.length) return [];

    // ── FUTURO: agrupar por produto.departamento ──────────────────────────
    // const mapa = new Map<string, ProductWebSitePublicResponseDTO[]>();
    // for (const p of lista) {
    //   const dep = p.departamento ?? 'Geral';
    //   if (!mapa.has(dep)) mapa.set(dep, []);
    //   mapa.get(dep)!.push(p);
    // }
    // return [...mapa.entries()].map(([nome, produtos]) => ({ nome, produtos }));
    // ─────────────────────────────────────────────────────────────────────

    // ── HOJE: tudo numa seção única ───────────────────────────────────────
    return [{ nome: 'Todos os Produtos', produtos: lista }];
  });

  // Sidebar: lista plana de { id, nome } por departamento
  menuCategorias = computed(() =>
    this.departamentos().map(dep => ({
      nome: dep.nome,
      produtos: dep.produtos.map(p => ({
        id: p.systemCode,
        nome: p.name,
      })),
    }))
  );

  constructor(
    private http: HttpClient,
    public orcamento: OrcamentoService,
  ) {}

  ngOnInit(): void {
    // Ao entrar na página de produtos, sempre começar no topo.
    window.scrollTo({ top: 0, left: 0 });

    this.http
      .get<ProductWebSitePublicResponseDTO[]>(`${environment.apiUrl}/product/website/active`)
      .subscribe({
        next: (data) => {
          this.produtos.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.erro.set(true);
          this.loading.set(false);
        },
      });
  }

  resolverImagem(produto: ProductWebSitePublicResponseDTO): string {
    return urlDeMidia(produto.imagem);
  }

  slugDepartamento(nome: string): string {
    return nome.toLowerCase().replace(/\s+/g, '-');
  }

  adicionarAoOrcamento(produto: ProductWebSitePublicResponseDTO): void {
    this.orcamento.adicionar(produto);
    this.orcamento.abrirDrawer();
  }

  onBusca(event: Event): void {
    this.busca.set((event.target as HTMLInputElement).value);
  }

  onTelefoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);

    let masked = digits;
    if (digits.length > 2) {
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    input.value = masked;
    this.orcamento.form.get('telefone')?.setValue(digits, { emitEvent: false });
  }

  /**
   * Máscara de CPF/CNPJ, no mesmo desenho da do telefone.
   *
   * O visível é formatado e o guardado são só os dígitos: o formulário nunca vê
   * ponto nem barra, então o validador não precisa limpar nada e a mensagem
   * decide o formato na hora de escrever.
   *
   * `setValue` com `emitEvent: false` para a máscara não disparar a validação a
   * cada tecla — quem digita um CPF veria "documento inválido" nos dez
   * primeiros dígitos, e o erro certo só aparece quando o campo perde o foco.
   */
  onDocumentoInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = apenasDigitos(input.value);

    input.value = formatarDocumento(digits);
    this.orcamento.form.get('documento')?.setValue(digits, { emitEvent: false });
  }
}
