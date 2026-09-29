import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { EmployeeDocumentsManagerComponent } from './employee-documents-manager.component';
import { environment } from '../../../../../environments/environment';
import { EmployeeDocument } from '../../../../domain/models/hr/employee-document.model';
import {
  NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura,
} from '../../../../../testing/test-setup';

const API = `${environment.apiUrl}/hr/employee-documents`;
const TYPES_API = `${environment.apiUrl}/hr/employee-document-types`;

function doc(partial: Partial<EmployeeDocument>): EmployeeDocument {
  return {
    id: crypto.randomUUID(), employeeId: 'e1', employeeName: 'Ana Souza', typeId: 't-aso', typeName: 'ASO',
    title: 'ASO periódico', originalFilename: 'aso.pdf', contentType: 'application/pdf', sizeBytes: 1000,
    dueDate: null, status: 'NO_DUE_DATE', daysUntilDue: null, replacedById: null,
    uploadedAt: '2026-09-01T10:00:00', uploadedBy: 'rh.maria',
    ...partial,
  };
}

const EXPIRED = doc({ id: 'expired', title: 'NR-35', typeId: 't-nr', typeName: 'NR', employeeId: 'e2',
  employeeName: 'Diego Martins', dueDate: '2026-09-20', status: 'EXPIRED', daysUntilDue: -9 });
const EXPIRING = doc({ id: 'expiring', dueDate: '2026-10-12', status: 'EXPIRING', daysUntilDue: 13 });
const VALID = doc({ id: 'valid', title: 'Contrato', typeId: 't-ct', typeName: 'Contrato de trabalho',
  employeeId: 'e3', employeeName: 'João Prado', dueDate: '2027-01-05', status: 'VALID', daysUntilDue: 98 });
const NO_DATE = doc({ id: 'nodate', title: 'RG e CPF', typeId: 't-pes', typeName: 'Documento pessoal' });
const REPLACED = doc({ id: 'old', title: 'ASO 2024', dueDate: '2025-10-12', status: 'REPLACED',
  daysUntilDue: -352, replacedById: 'expiring' });

/**
 * A tela do RH: o que cada filtro mostra, e em que ordem.
 *
 * `detectChanges(false)`: a tela usa signals, e o teste sem zone.js não pode
 * acusar a mudança que a resposta HTTP faz.
 */
describe('EmployeeDocumentsManagerComponent', () => {
  let fixture: ComponentFixture<EmployeeDocumentsManagerComponent>;
  let component: EmployeeDocumentsManagerComponent;
  let http: HttpTestingController;
  let query: BehaviorSubject<ParamMap>;

  function montar(largura: number, params: Record<string, string> = {}): void {
    larguraDaJanela(largura);
    query = new BehaviorSubject(convertToParamMap(params));
    TestBed.configureTestingModule({
      imports: [EmployeeDocumentsManagerComponent],
      providers: providersDeTeste([{ provide: ActivatedRoute, useValue: { queryParamMap: query } }]),
    });
    fixture = TestBed.createComponent(EmployeeDocumentsManagerComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(false);

    for (const req of http.match(() => true)) {
      if (req.request.url === API) req.flush([EXPIRED, EXPIRING, VALID, NO_DATE, REPLACED]);
      else if (req.request.url === TYPES_API) req.flush([]);
      else req.flush([]);
    }
    fixture.detectChanges(false);
  }

  afterEach(() => restaurarLargura());

  describe('no computador', () => {
    beforeEach(() => montar(NO_COMPUTADOR));

    /** Um ASO velho que já tem um novo no lugar é história, não trabalho. */
    it('sem filtro, os substituídos ficam fora da lista', () => {
      expect(component.rows().map(d => d.id)).not.toContain('old');
      expect(component.rows().length).toBe(4);
    });

    it('ligar o chip de substituídos mostra só eles', () => {
      component.toggleStatus('REPLACED');
      expect(component.rows().map(d => d.id)).toEqual(['old']);
    });

    /** A contagem é do quadro inteiro: ela não encolhe porque outro chip foi ligado. */
    it('a contagem dos chips ignora os filtros ligados', () => {
      component.toggleStatus('EXPIRED');
      expect(component.rows().length).toBe(1);
      expect(component.counts().get('EXPIRING')).toBe(1);
      expect(component.counts().get('REPLACED')).toBe(1);
    });

    it('os chips somam: vencidos e vence em breve juntos', () => {
      component.toggleStatus('EXPIRED');
      component.toggleStatus('EXPIRING');
      expect(component.rows().map(d => d.id)).toEqual(['expired', 'expiring']);
    });

    /**
     * **A ordem é o prazo.** O vencido (data no passado) sobe sozinho; o sem
     * data vai para o fim, porque não tem pressa nenhuma.
     */
    it('ordena pelo vencimento mais próximo, e sem data no fim', () => {
      expect(component.rows().map(d => d.id)).toEqual(['expired', 'expiring', 'valid', 'nodate']);
    });

    it('a busca ignora acento e caixa', () => {
      component.search.set('joao');
      expect(component.rows().map(d => d.id)).toEqual(['valid']);
    });

    it('filtrar por funcionário e por tipo', () => {
      component.employeeFilter.set('e1');
      expect(component.rows().map(d => d.id)).toEqual(['expiring', 'nodate']);

      component.typeFilter.set('t-pes');
      expect(component.rows().map(d => d.id)).toEqual(['nodate']);
    });

    it('limpar volta a lista inteira (menos os substituídos)', () => {
      component.toggleStatus('EXPIRED');
      component.search.set('x');
      component.clearFilters();
      expect(component.rows().length).toBe(4);
      expect(component.hasFilters()).toBeFalse();
    });

    /** "Substituir" abre o mesmo formulário já com quem, o quê e o documento que sai. */
    it('substituir abre o vínculo com funcionário, tipo e o documento anterior', () => {
      component.openReplace(EXPIRING);
      expect(component.linkOpen()).toBeTrue();
      expect(component.linkPreset()).toEqual({ employeeId: 'e1', typeId: 't-aso', replacesId: 'expiring' });
    });

    /** Excluir o substituto faz o anterior voltar a avisar — a pergunta precisa dizer. */
    it('excluir o substituto avisa que o anterior volta a valer', () => {
      component.deleteTarget.set(EXPIRING);
      expect(component.deleteRevivesPrevious()).toBeTrue();

      component.deleteTarget.set(VALID);
      expect(component.deleteRevivesPrevious()).toBeFalse();
    });

    it('editar manda a data sem fuso, e recarrega', () => {
      component.openEdit(EXPIRING);
      component.editDue.set(new Date(2027, 0, 5));
      component.saveEdit();

      const req = http.expectOne(`${API}/expiring`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ title: 'ASO periódico', typeId: 't-aso', dueDate: '2027-01-05' });
      req.flush(EXPIRING);
      expect(component.editTarget()).toBeNull();
      expect(http.match(API).length).withContext('recarrega a lista').toBe(1);
    });

    /**
     * **O que ele viu:** a célula do funcionário saía de outro tamanho. A classe
     * de texto estava no próprio `<td>`, e o `display: block` dela tirava a
     * célula da tabela — ela deixava de acompanhar a altura da linha.
     */
    it('a célula do funcionário tem a altura das outras da linha', async () => {
      await fixture.whenStable();
      fixture.detectChanges(false);
      const linha = (fixture.nativeElement as HTMLElement).querySelector('.pk-table tbody tr') as HTMLElement;
      const celulas = Array.from(linha.querySelectorAll(':scope > td')) as HTMLElement[];

      expect(getComputedStyle(celulas[0]).display).toBe('table-cell');
      const alturas = new Set(celulas.map(td => Math.round(td.getBoundingClientRect().height)));
      expect(alturas.size).withContext(`alturas: ${[...alturas].join(', ')}`).toBe(1);
    });

    it('a distância até o vencimento aparece na linha', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('vencido há 9 d');
      expect(texto).toContain('vence em 13 dias');
    });
  });

  /** O aviso de vencimento chega com `?status=EXPIRING`: a tela abre já no recorte. */
  describe('filtro vindo do link do aviso', () => {
    it('aplica o status da URL', () => {
      montar(NO_COMPUTADOR, { status: 'EXPIRING' });
      expect(component.rows().map(d => d.id)).toEqual(['expiring']);
    });

    it('ignora status inventado', () => {
      montar(NO_COMPUTADOR, { status: 'QUALQUER' });
      expect(component.statusFilter().size).toBe(0);
    });

    it('um segundo link com a tela aberta troca o filtro', () => {
      montar(NO_COMPUTADOR, { status: 'EXPIRING' });
      query.next(convertToParamMap({ status: 'EXPIRED' }));
      expect(component.rows().map(d => d.id)).toEqual(['expired']);
    });
  });

  describe('no celular', () => {
    beforeEach(() => montar(NO_CELULAR));

    it('mostra cartões, com a busca e o filtro na barra', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.doc-cartao').length).toBe(4);
      expect(el.querySelector('[aria-label="Mais filtros"]')).not.toBeNull();
      expect(el.querySelector('.barra__filtro')).withContext('os selects ficam na folha').toBeNull();
    });

    /** 16px no campo, senão o iPhone dá zoom ao focar a busca. */
    it('a busca tem 16px', () => {
      const campo = (fixture.nativeElement as HTMLElement).querySelector('.busca__campo') as HTMLElement;
      expect(getComputedStyle(campo).fontSize).toBe('16px');
    });
  });
});
