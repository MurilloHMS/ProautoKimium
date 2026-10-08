import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestBuilderComponent } from './request-builder.component';
import { DocumentRequestService } from '../../../../../infrastructure/services/hr/document-request.service';
import { NO_CELULAR, NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../../testing/test-setup';

/**
 * O construtor replanejado em 2026-10-08: três colunas que rolam sozinhas, só
 * o campo selecionado aberto, e o erro de um campo só depois de visitado.
 */
describe('RequestBuilderComponent', () => {
  let fixture: ComponentFixture<RequestBuilderComponent>;
  let comp: RequestBuilderComponent;
  let service: jasmine.SpyObj<DocumentRequestService>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function montar(largura: number): Promise<void> {
    larguraDaJanela(largura);
    service = jasmine.createSpyObj<DocumentRequestService>('DocumentRequestService', ['create', 'update', 'send', 'uploadTemplate']);
    await TestBed.configureTestingModule({
      imports: [RequestBuilderComponent],
      providers: providersDeTeste([{ provide: DocumentRequestService, useValue: service }]),
    }).compileComponents();
    fixture = TestBed.createComponent(RequestBuilderComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => restaurarLargura());

  describe('no computador', () => {
    beforeEach(() => montar(NO_COMPUTADOR));

    it('o construtor pode encolher: sem isso o rodapé com Salvar e Enviar era cortado', () => {
      // Com display:block e sem min-height:0, o host crescia até o conteúdo
      // (1.913px com oito campos) e a área que devia rolar nunca rolava.
      const host = getComputedStyle(el());
      expect(host.display).toBe('flex');
      expect(host.minHeight).toBe('0px');
      expect(el().querySelector('.form-screen__body--full')).withContext('o corpo é só a moldura; as colunas rolam').not.toBeNull();
    });

    it('as três colunas aparecem, e cada uma rola sozinha', () => {
      const cols = Array.from(el().querySelectorAll<HTMLElement>('.rb-col'));
      expect(cols.length).toBe(3);
      cols.forEach(c => expect(getComputedStyle(c).overflowY).toBe('auto'));
    });

    it('acrescentar um campo já o abre, e só um fica aberto por vez', () => {
      comp.add('FILE');
      comp.add('CHOICE');
      fixture.detectChanges();

      expect(el().querySelectorAll('.rb-campo').length).toBe(2);
      expect(el().querySelectorAll('.rb-campo__mais').length).toBe(1);
      expect(comp.selectedKey()).toBe(comp.fields()[1].key);
    });

    it('o campo novo não nasce com erro; o erro aparece depois que a pessoa sai dele', () => {
      comp.add('CHOICE');
      fixture.detectChanges();
      // Nenhum erro, de nenhum tipo: nem "sem nome" nem "sem opção".
      expect(comp.fieldProblem(comp.fields()[0])).toBeNull();
      expect(el().querySelector('.rb-campo .rb__aviso')).toBeNull();
      expect(el().querySelector('.rb-campo__alerta')).toBeNull();

      const escolha = comp.fields()[0];
      comp.add('FILE');
      fixture.detectChanges();
      expect(comp.fieldProblem(escolha)).toBe('Dê um nome à pergunta.');
      expect(el().querySelector('.rb-campo__alerta')).withContext('o campo fechado mostra o alerta na linha').not.toBeNull();
    });

    it('Enviar com algo faltando mostra o que falta e não chama a API', () => {
      comp.add('CHOICE');
      comp.send();
      fixture.detectChanges();

      expect(service.create).not.toHaveBeenCalled();
      expect(service.send).not.toHaveBeenCalled();
      expect(el().querySelector('.rb-rodape [role=alert]')!.textContent).toContain('Dê um título');
      expect(comp.fieldProblem(comp.fields()[0])).withContext('depois da tentativa, até o campo aberto mostra o erro').not.toBeNull();
    });

    it('a ajuda do campo chega à prévia', () => {
      comp.add('SHORT_TEXT');
      comp.patch(0, { label: 'CPF', help: 'Só os números' });
      fixture.detectChanges();
      expect(el().querySelector('.rb-col--previa')!.textContent).toContain('Só os números');
    });
  });

  describe('no celular', () => {
    beforeEach(() => montar(NO_CELULAR));

    it('as colunas viram abas, e começa pelos campos', () => {
      expect(el().querySelectorAll('.rb-abas [role=tab]').length).toBe(3);
      expect(comp.mobileTab()).toBe('fields');
    });

    it('Enviar sem título leva para a aba Sobre, onde o título está', () => {
      comp.add('FILE');
      comp.patch(0, { label: 'RG' });
      comp.send();
      expect(comp.mobileTab()).toBe('about');
    });
  });
});
