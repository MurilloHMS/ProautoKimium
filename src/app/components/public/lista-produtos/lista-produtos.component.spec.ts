import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaProdutosComponent } from './lista-produtos.component';
import { ProductWebSitePublicResponseDTO } from '../../../domain/models/products.model';
import { OrcamentoService } from '../../../infrastructure/services/company/products/website/orcamento/orcamento.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('ListaProdutosComponent', () => {
  let component: ListaProdutosComponent;
  let fixture: ComponentFixture<ListaProdutosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaProdutosComponent],
      providers: providersDeTeste()
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListaProdutosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const produto = (extra: Partial<ProductWebSitePublicResponseDTO> = {}): ProductWebSitePublicResponseDTO => ({
    systemCode: '2822',
    name: 'Desengraxante Alcalino KD-40',
    active: true,
    cores: ['#1f7a5a'],
    finalidade: 'Remoção de graxa e óleo pesado',
    diluicao: '1:20 a 1:40',
    descricao: 'a'.repeat(500),
    imagem: '/upload/images/2822.png',
    ...extra,
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ─── Ficha técnica ─────────────────────────────────────────────────────────
  //
  // O card corta a descrição em duas linhas, então 500 caracteres aparecem com
  // uns 90. A ficha é onde o texto inteiro vive.

  it('nasce fechada', () => {
    expect(component.fichaDe()).toBeNull();
  });

  it('abrir guarda o produto clicado', () => {
    const p = produto();

    component.abrirFicha(p);

    expect(component.fichaDe()).toBe(p);
  });

  it('fechar limpa', () => {
    component.abrirFicha(produto());

    component.fecharFicha();

    expect(component.fichaDe()).toBeNull();
  });

  /**
   * **Pedir orçamento pela ficha fecha a ficha.**
   *
   * O snackbar de confirmação aparece atrás do diálogo. Com a ficha aberta por
   * cima, a pessoa não vê que deu certo e clica de novo — e o mesmo produto
   * entra duas vezes no orçamento.
   */
  it('orçar pela ficha fecha o diálogo e adiciona o produto', () => {
    const orcamento = TestBed.inject(OrcamentoService);
    const adicionar = spyOn(orcamento, 'adicionar').and.stub();
    const p = produto();
    component.abrirFicha(p);

    component.orcarDaFicha(p);

    expect(component.fichaDe()).toBeNull();
    expect(adicionar).toHaveBeenCalled();
  });

  /**
   * A descrição não pode ser cortada aqui — o corte do card é exatamente o
   * problema que a ficha existe para resolver. Afirmado sobre o dado que chega
   * à tela, porque `-webkit-line-clamp` é CSS e não aparece no texto do DOM.
   */
  it('a ficha recebe a descrição inteira', () => {
    const p = produto({ descricao: 'x'.repeat(500) });

    component.abrirFicha(p);

    expect(component.fichaDe()!.descricao.length).toBe(500);
  });
});
