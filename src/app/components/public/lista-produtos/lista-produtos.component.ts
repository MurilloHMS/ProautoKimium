import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SnackbarComponent } from '../../../shared/snackbar/snackbar.component';
import { environment } from '../../../../environments/environment';
import {OrcamentoService} from "../../../infrastructure/services/company/products/website/orcamento/orcamento.service";
import {OrcamentoDrawerComponent} from "./components/orcamento-drawer/orcamento-drawer.component";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";

export interface ProductWebSitePublicResponseDTO {
  systemCode: string;
  name: string;
  active: boolean;
  cores: string[];
  finalidade: string;
  diluicao: string;
  descricao: string;
  imagem?: string; // path ou URL — opcional até a API definir
  // departamento?: string; // descomente quando a API suportar
}

// Agrupamento por departamento (ou "geral" enquanto não houver)
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

  produtos = signal<ProductWebSitePublicResponseDTO[]>([]);
  loading  = signal(true);
  erro     = signal(false);

  snackbarMessage = '';
  showSnackbar    = false;

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
    if (!produto.imagem) return 'images/products/placeholder.png';
    if (produto.imagem.startsWith('http')) return produto.imagem;
    return `${environment.apiUrl.replace('/api', '')}/${produto.imagem}`;
  }

  slugDepartamento(nome: string): string {
    return nome.toLowerCase().replace(/\s+/g, '-');
  }

  adicionarAoOrcamento(produto: ProductWebSitePublicResponseDTO): void {
    this.orcamento.adicionar(produto);
    this.orcamento.abrirDrawer();
  }
}
