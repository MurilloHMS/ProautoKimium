import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { WebsiteComponent } from './website.component';
import { environment } from '../../../../../../environments/environment';
import { ProductWebSiteResponseDTO } from '../../../../../domain/models/products.model';
import {
  NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../../testing/test-setup';

const PRODUCTS = `${environment.apiUrl}/product/website`;
const EQUIPMENT = `${environment.apiUrl}/product/website/equipment`;

function produto(partial: Partial<ProductWebSiteResponseDTO>): ProductWebSiteResponseDTO {
  return {
    id: crypto.randomUUID(), systemCode: 'KM-1', name: 'Produto', active: true, cores: [],
    finalidade: 'Limpeza', diluicao: '1:50', concentracao: '2%', localUso: 'Oficina',
    descricao: 'Descrição do site.', descricaoGuia: '', imagem: '', equipmentId: null,
    ...partial,
  };
}

const COM_GUIA = produto({ id: 'com', name: 'Detergente Alcalino', descricaoGuia: 'Aplicar e enxaguar.',
  descricao: 'Remove óleo e graxa. Baixa espuma.', equipmentId: 'eq1' });
const SEM_GUIA = produto({ id: 'sem', name: 'Desengraxante Neutro', descricaoGuia: '   ' });
const OCULTO = produto({ id: 'oculto', name: 'Sanitizante Clorado', active: false, descricaoGuia: undefined });

/**
 * Produtos do site: as descrições à vista (pedido dele, 2026-09-29). Antes, para
 * saber se um produto tinha a descrição do guia, era preciso abrir o formulário.
 */
describe('WebsiteComponent', () => {
  let component: WebsiteComponent;
  let fixture: ComponentFixture<WebsiteComponent>;
  let http: HttpTestingController;

  async function montar(largura: number): Promise<void> {
    larguraDaJanela(largura);
    TestBed.configureTestingModule({ imports: [WebsiteComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(WebsiteComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(false);

    for (const req of http.match(() => true)) {
      if (req.request.url === PRODUCTS) req.flush([COM_GUIA, SEM_GUIA, OCULTO]);
      else if (req.request.url === EQUIPMENT) req.flush([{ id: 'eq1', nome: 'Lavadora LK-300', imagem: null }]);
      else req.flush([]);
    }
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
  }

  const el = () => fixture.nativeElement as HTMLElement;

  afterEach(() => restaurarLargura());

  describe('no computador', () => {
    beforeEach(() => montar(NO_COMPUTADOR));

    /** Só espaço conta como vazio — o mesmo critério do PDF do guia. */
    it('a linha diz se tem descrição do guia, sem abrir nada', () => {
      const linhas = Array.from(el().querySelectorAll('tr.prod-linha')) as HTMLElement[];
      const doProduto = (nome: string) => linhas.find(l => l.textContent?.includes(nome))!;

      expect(doProduto('Detergente Alcalino').querySelectorAll('.marca--ok').length).toBe(2);
      expect(doProduto('Desengraxante Neutro').querySelector('.marca--falta')).not.toBeNull();
      expect(doProduto('Sanitizante Clorado').querySelector('.marca--falta')).not.toBeNull();
    });

    it('"Sem descrição do guia" lista as lacunas e conta o quadro inteiro', () => {
      expect(component.semGuiaCount()).toBe(2);

      component.semGuia.set(true);
      expect(component.produtosFiltrados().map(p => p.id)).toEqual(['sem', 'oculto']);

      component.setFiltro('publicados');
      expect(component.produtosFiltrados().map(p => p.id)).toEqual(['sem']);
      expect(component.semGuiaCount()).withContext('a contagem não encolhe com outro filtro').toBe(2);
    });

    /** A busca agora entra nas descrições: "espuma" acha o produto pelo texto. */
    it('a busca acha texto dentro da descrição, sem acento', () => {
      component.termoBusca = 'oleo';
      component.aplicarFiltro();
      expect(component.produtosFiltrados().map(p => p.id)).toEqual(['com']);

      component.termoBusca = 'enxaguar';
      component.aplicarFiltro();
      expect(component.produtosFiltrados().map(p => p.id)).withContext('descrição do guia').toEqual(['com']);
    });

    it('abrir a linha mostra as duas descrições e os campos do guia', async () => {
      component.toggleRow(COM_GUIA);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const detalhe = el().querySelector('.detalhe') as HTMLElement;
      expect(detalhe.textContent).toContain('Remove óleo e graxa');
      expect(detalhe.textContent).toContain('Aplicar e enxaguar.');
      expect(detalhe.textContent).toContain('Lavadora LK-300');
      expect(detalhe.textContent).toContain('1:50');
    });

    /** Sem a do guia, o accordion diz o que acontece no PDF — ele usa a do site. */
    it('sem descrição do guia, avisa que o guia imprime a do site', async () => {
      component.toggleRow(SEM_GUIA);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      expect(el().querySelector('.detalhe__bloco--vazio')?.textContent).toContain('o guia imprime a descrição do site');
    });

    it('só uma linha aberta por vez, e o segundo toque fecha', () => {
      component.toggleRow(COM_GUIA);
      component.toggleRow(SEM_GUIA);
      expect(component.isExpanded(COM_GUIA)).toBeFalse();
      expect(component.isExpanded(SEM_GUIA)).toBeTrue();

      component.toggleRow(SEM_GUIA);
      expect(component.expandedId()).toBeNull();
    });

    it('os chips de situação se excluem, e o segundo toque volta para todos', () => {
      component.alternarFiltro('ocultos');
      expect(component.produtosFiltrados().map(p => p.id)).toEqual(['oculto']);

      component.alternarFiltro('ocultos');
      expect(component.filtro()).toBe('todos');
    });

    /**
     * O formulário em duas colunas (2026-09-29): a largura larga do
     * app-form-screen, e a descrição do guia virou caixa de texto com o limite
     * do banco — era um campo de uma linha em que não dava para reler o texto.
     */
    it('o formulário usa a largura larga, com a descrição do guia em caixa de texto', () => {
      component.openEditDialog(COM_GUIA);
      fixture.detectChanges(false);

      expect(el().querySelector('.pf__col--lado')).withContext('a coluna do que se escolhe').not.toBeNull();
      const guia = el().querySelector('#descricaoGuia') as HTMLTextAreaElement;
      expect(guia.tagName).toBe('TEXTAREA');
      expect(guia.maxLength).toBe(300);
      expect(el().querySelector('label[for="imagemEdit"]')?.textContent).toContain('Enviar arquivo');
    });

    /** No galpão o equipamento se reconhece pela cara: a foto vai junto do nome. */
    it('o equipamento escolhido aparece com a foto', async () => {
      component.openEditDialog(COM_GUIA);
      fixture.detectChanges(false);
      await fixture.whenStable();
      fixture.detectChanges(false);

      const escolhido = el().querySelector('p-select .eq-opcao') as HTMLElement;
      expect(escolhido?.textContent).toContain('Lavadora LK-300');
      expect(escolhido?.querySelector('img.eq-opcao__foto')).not.toBeNull();
    });

    /** O banco guarda até 1000: o campo trava antes, e o excesso não vira erro da API. */
    it('a descrição do site tem o limite do banco', () => {
      component.openCreateDialog();
      fixture.detectChanges(false);

      const campo = el().querySelector('#c-descricao') as HTMLTextAreaElement;
      expect(campo.maxLength).toBe(1000);
    });
  });

  describe('no celular', () => {
    beforeEach(() => montar(NO_CELULAR));

    it('vira cartão, com as marcas à vista', () => {
      expect(el().querySelectorAll('.prod-cartao').length).toBe(3);
      expect(el().querySelector('.prod-cartao .marca--falta')).not.toBeNull();
      expect(el().querySelector('tr.prod-linha')).withContext('sem tabela rolando de lado').toBeNull();
    });
  });
});
