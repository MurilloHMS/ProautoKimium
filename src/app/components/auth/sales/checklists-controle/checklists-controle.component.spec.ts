import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../../environments/environment';
import { checklistValido } from '../../../../../testing/checklist-fixtures';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';
import { ChecklistDetail, ChecklistStatus, ChecklistSummary } from '../../../../domain/models/sales/checklist.model';
import { ChecklistsControleComponent } from './checklists-controle.component';

const API = `${environment.apiUrl}/checklists`;

function resumo(id: string, status: ChecklistStatus, nome = 'Cliente ' + id): ChecklistSummary {
  return { id, number: Number(id.replace(/\D/g, '')) || 1, sellerLogin: 'diego', sellerName: 'Diego', customerCode: 1, customerName: nome,
    customerDocument: '11222333000181', newCustomer: false, status, version: 1, hasOrder: false, orderTotal: null, filledOffline: false,
    firstSubmittedAt: '2026-09-30T10:00:00', lastSubmittedAt: '2026-09-30T10:00:00', reviewNotes: null, reviewedAt: null,
    changeReason: status === 'CHANGE_REQUESTED' ? 'Mais 2 diluidores' : null, changeRequestedAt: null };
}

function detalhe(s: ChecklistSummary, content = checklistValido()): ChecklistDetail {
  return { summary: s, content, events: [], changes: [],
    erpDifferences: [{ field: 'Bairro', erp: 'VILA INDUSTRIAL', checklist: 'Centro' }] };
}

/** A Controladoria: o que pede ação primeiro, e nenhuma decisão sem o motivo que o vendedor vai ler. */
describe('ChecklistsControleComponent', () => {
  let fixture: ComponentFixture<ChecklistsControleComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    larguraDaJanela(NO_COMPUTADOR);
    TestBed.configureTestingModule({ imports: [ChecklistsControleComponent], providers: providersDeTeste() });
    fixture = TestBed.createComponent(ChecklistsControleComponent);
    el = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(false);
    http.expectOne(API).flush([resumo('c1', 'SUBMITTED', 'Mercado'), resumo('c2', 'SUBMITTED'), resumo('c3', 'CHANGE_REQUESTED'), resumo('c4', 'APPROVED')]);
    await fixture.whenStable();
    fixture.detectChanges(false);
  });

  afterEach(() => restaurarLargura());

  function chip(rotulo: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.chip')).find(c => c.textContent!.includes(rotulo))!;
  }

  function botao(texto: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.trim().startsWith(texto))!;
  }

  async function abrir(s: ChecklistSummary, content = checklistValido()): Promise<void> {
    (fixture.componentInstance as unknown as { abrir(s: ChecklistSummary): Promise<void> }).abrir(s);
    http.expectOne(`${API}/${s.id}`).flush(detalhe(s, content));
    await fixture.whenStable();
    fixture.detectChanges(false);
  }

  it('data da implantação em destaque no topo; sem data, "A definir"', async () => {
    await abrir(resumo('c1', 'SUBMITTED', 'Mercado'));
    const caixa = () => el.querySelector('.implantacao')!;
    expect(caixa().textContent).toContain('segunda-feira, 05/10/2026');
    expect(caixa().classList).not.toContain('implantacao--vazia');

    const sem = checklistValido();
    sem.installation!.implantationDate = null;
    await abrir(resumo('c2', 'SUBMITTED'), sem);
    expect(caixa().textContent).toContain('A definir');
    expect(caixa().classList).toContain('implantacao--vazia');
  });

  it('abre em "Aguardando análise", e os chips contam cada situação', () => {
    expect(chip('Aguardando análise').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Aguardando análise').textContent).toContain('2');
    expect(chip('Pedidos de alteração').textContent).toContain('1');
    expect(chip('Todos').textContent).toContain('4');
  });

  it('devolver exige o motivo: "Confirmar" só acende com texto, e o motivo vai para a API', async () => {
    await abrir(resumo('c1', 'SUBMITTED', 'Mercado'));
    expect(el.textContent).toContain('Diferente do Sankhya');
    expect(el.textContent).toContain('VILA INDUSTRIAL');

    botao('Devolver com motivo').click();
    fixture.detectChanges(false);
    expect(botao('Confirmar').disabled).toBeTrue();

    const texto = el.querySelector<HTMLTextAreaElement>('#ctl-notas')!;
    texto.value = 'Faltou a IE';
    texto.dispatchEvent(new Event('input'));
    fixture.detectChanges(false);
    expect(botao('Confirmar').disabled).toBeFalse();

    botao('Confirmar').click();
    const req = http.expectOne(`${API}/c1/return`);
    expect(req.request.body).toEqual({ notes: 'Faltou a IE' });
    req.flush(detalhe({ ...resumo('c1', 'RETURNED', 'Mercado'), reviewNotes: 'Faltou a IE' }));
    await fixture.whenStable();
    fixture.detectChanges(false);
    expect(chip('Devolvidos').textContent).withContext('a linha mudou de situação').toContain('1');
  });

  it('pedido de alteração: liberar, com a observação opcional', async () => {
    await abrir(resumo('c3', 'CHANGE_REQUESTED'));
    expect(el.textContent).toContain('Mais 2 diluidores');
    botao('Liberar alteração').click();
    fixture.detectChanges(false);
    expect(botao('Confirmar').disabled).withContext('liberar não exige motivo').toBeFalse();
    botao('Confirmar').click();
    http.expectOne(`${API}/c3/grant-change`).flush(detalhe(resumo('c3', 'REOPENED')));
  });
});
