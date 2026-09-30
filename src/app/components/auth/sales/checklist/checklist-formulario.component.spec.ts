import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { catalogoDeTeste, checklistValido } from '../../../../../testing/checklist-fixtures';
import { NO_CELULAR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { indexar } from '../../../../domain/utils/checklist/checklist-catalogo';
import { checklistVazio } from '../../../../domain/utils/checklist/checklist-regras';
import { ChecklistDb, Rascunho } from '../../../../infrastructure/offline/checklist-db';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { CHECKLIST_DB, ChecklistOfflineStore } from '../../../../infrastructure/state/checklist-offline.store';
import { ChecklistFormularioComponent } from './checklist-formulario.component';

/**
 * O formulário no celular. Quem usa tem de 22 a 65 anos, e parte tem muita
 * dificuldade com tecnologia: os testes medem o tamanho de verdade, além do
 * comportamento.
 */
describe('ChecklistFormularioComponent', () => {
  let fixture: ComponentFixture<ChecklistFormularioComponent>;
  let el: HTMLElement;
  let store: ChecklistOfflineStore;
  let db: ChecklistDb;
  let nome: string;

  function rascunho(etapa = 1, conteudo = checklistVazio()): Rascunho {
    return { chave: ChecklistDb.chave('diego', 'r1'), login: 'diego', id: 'r1', conteudo, etapa, revision: 1,
      iniciadoEm: '2026-09-30T08:00:00.000Z', salvoEm: '2026-09-30T08:00:00.000Z', semInternet: false };
  }

  async function montar(r: Rascunho): Promise<void> {
    larguraDaJanela(NO_CELULAR);
    nome = 'teste-form-' + Math.random().toString(36).slice(2);
    db = new ChecklistDb(nome);
    TestBed.configureTestingModule({
      imports: [ChecklistFormularioComponent],
      providers: providersDeTeste([
        { provide: CHECKLIST_DB, useValue: db },
        { provide: AuthService, useValue: { getUsername: () => 'diego' } },
      ]),
    });
    store = TestBed.inject(ChecklistOfflineStore);
    store.indice.set(indexar(catalogoDeTeste()));
    fixture = TestBed.createComponent(ChecklistFormularioComponent);
    fixture.componentRef.setInput('rascunho', r);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
  }

  afterEach(async () => {
    restaurarLargura();
    // Destruir salva o rascunho (de propósito): o banco só fecha depois disso.
    fixture?.destroy();
    await new Promise(r => setTimeout(r, 50));
    store?.ngOnDestroy();
    await db?.fechar();
    if (nome) indexedDB.deleteDatabase(nome);
  });

  function digitar(input: HTMLInputElement, texto: string): void {
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges(false);
  }

  function botao(texto: string): HTMLButtonElement {
    const b = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(x => x.textContent!.trim().startsWith(texto));
    if (!b) throw new Error('sem o botão ' + texto);
    return b;
  }

  it('etapa 1: busca o cliente, um toque escolhe, e "Continuar" leva ao endereço já preenchido', async () => {
    await montar(rascunho());
    expect(el.querySelector('h2')!.textContent).toContain('Qual é o cliente?');
    expect(el.textContent).toContain('Etapa 1 de 8');

    digitar(el.querySelector<HTMLInputElement>('input[type=search]')!, 'mercado central');
    botao('MERCADO CENTRAL').click();
    fixture.detectChanges(false);
    expect(el.textContent).toContain('Cliente escolhido');

    botao('Continuar').click();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
    expect(el.textContent).toContain('Etapa 2 de 8');
    expect(el.querySelector<HTMLInputElement>('#ck-street-principal')!.value).toBe('Avenida FRANCISCO GLICERIO');
  });

  it('mudar o bairro que veio do Sankhya fica amarelo e diz o que estava lá', async () => {
    const c = checklistValido();
    c.mainAddress!.district = 'VILA INDUSTRIAL';
    await montar(rascunho(2, c));

    const bairro = el.querySelector<HTMLInputElement>('#ck-district-principal')!;
    expect(bairro.classList).not.toContain('is-diverge');
    digitar(bairro, 'Centro');
    expect(bairro.classList).toContain('is-diverge');
    expect(el.textContent).toContain('No Sankhya está "VILA INDUSTRIAL"');
  });

  it('salva no aparelho sozinho, sem botão de salvar', async () => {
    await montar(rascunho());
    botao('É um cliente novo').click();
    fixture.detectChanges(false);
    digitar(el.querySelector<HTMLInputElement>('#ck-nome')!, 'Padaria Bom Pão');

    await new Promise(r => setTimeout(r, 700));
    const salvo = await db.lerRascunho('diego', 'r1');
    expect(salvo?.conteudo.customer?.name).toBe('Padaria Bom Pão');
    expect(salvo?.conteudo.customer?.newCustomer).toBeTrue();
  });

  it('na conferência, com pendência: "Enviar" apagado, e tocar na linha vermelha leva à etapa', async () => {
    const c = checklistValido();
    c.customer!.signatoryCpf = '12345678900';
    await montar(rascunho(8, c));

    const enviar = botao('Enviar checklist');
    expect(enviar.disabled).toBeTrue();
    expect(el.textContent).toContain('Falta: o CPF de quem assina é inválido.');

    botao('!').click();
    fixture.detectChanges(false);
    await fixture.whenStable();
    fixture.detectChanges(false);
    expect(el.textContent).toContain('Etapa 3 de 8');
    // A etapa já foi "vista": o erro aparece junto do campo.
    expect(el.querySelector('#ck-signatoryCpf')!.classList).toContain('is-erro');
  });

  it('sem pendência: "Enviar" entrega para a fila e avisa quem abriu', async () => {
    await montar(rascunho(8, checklistValido()));
    const envio = spyOn(store, 'enviar').and.resolveTo({ tipo: 'aguardando' });
    let resultado: boolean | undefined;
    fixture.componentInstance.enviado.subscribe(v => (resultado = v));

    botao('Enviar checklist').click();
    // Antes de enviar, o formulário grava o rascunho no IndexedDB: espera a chamada, e não um tempo fixo.
    for (let i = 0; i < 100 && resultado === undefined; i++) await new Promise(r => setTimeout(r, 10));

    expect(envio).toHaveBeenCalled();
    expect(resultado).withContext('guardado para enviar depois').toBeFalse();
  });

  /**
   * **O que ele viu (2026-09-30):** o servidor recusou ("CPF de quem assina é
   * inválido"), mas a tela dizia "enviado" e o checklist voltava para a lista
   * de rascunhos. Agora a pessoa fica aqui, na etapa do problema, com a frase.
   */
  it('recusa do servidor: continua no formulário, na etapa do problema, com a frase — e não "enviado"', async () => {
    await montar(rascunho(8, checklistValido()));
    const http = TestBed.inject(HttpTestingController);
    let emitiu = false;
    fixture.componentInstance.enviado.subscribe(() => (emitiu = true));

    botao('Enviar checklist').click();
    let req;
    for (let i = 0; i < 50 && !req; i++) {
      await new Promise(r => setTimeout(r, 10));
      req = http.match(r => r.method === 'PUT')[0];
    }
    req!.flush({ message: 'Etapa 3 — o CPF de quem assina é inválido.' }, { status: 400, statusText: 'Bad Request' });
    await new Promise(r => setTimeout(r, 80));
    fixture.detectChanges(false);

    expect(emitiu).withContext('não foi enviado').toBeFalse();
    expect(el.textContent).toContain('Etapa 3 de 8');
    expect(el.textContent).toContain('Não foi enviado.');
    expect(el.textContent).toContain('o CPF de quem assina é inválido');
    expect(store.recusados()).withContext('volta a ser rascunho, não fica na fila').toEqual([]);
    expect(store.rascunhos().map(r => r.id)).toEqual(['r1']);
  });

  /** Medidas para quem tem pouca intimidade com o celular: nada abaixo de 44px de toque ou 16px de letra. */
  for (const etapa of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`etapa ${etapa}: campos e botões com 44px ou mais, e letra de 16px ou mais nos campos`, async () => {
      const c = checklistValido();
      await montar(rascunho(etapa, c));

      const campos = Array.from(el.querySelectorAll<HTMLElement>('input:not([type=hidden]), textarea'));
      for (const f of campos) {
        expect(parseFloat(getComputedStyle(f).fontSize)).withContext(`letra de ${f.id || f.getAttribute('aria-label')}`).toBeGreaterThanOrEqual(16);
      }
      const alvos = Array.from(el.querySelectorAll<HTMLElement>('input:not([type=hidden]), button'))
        .filter(b => b.getBoundingClientRect().width > 0);
      for (const b of alvos) {
        const r = b.getBoundingClientRect();
        expect(Math.round(r.height)).withContext(`altura de "${(b.textContent || b.getAttribute('aria-label') || b.id).trim()}"`).toBeGreaterThanOrEqual(44);
      }
      expect(document.documentElement.scrollWidth).withContext('sem rolar de lado').toBeLessThanOrEqual(window.innerWidth + 1);
    });
  }
});
