import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';

import { TalentBankPanelComponent } from './talent-bank-panel.component';
import { TalentBankSummaryDTO } from '../../../../domain/models/talent-bank.model';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { environment } from '../../../../../environments/environment';

import { providersDeTeste } from '../../../../../testing/test-setup';

const URL_LISTA = `${environment.apiUrl}/talent-bank`;

function linha(extra: Partial<TalentBankSummaryDTO>): TalentBankSummaryDTO {
  return {
    id: 'id-1',
    nome: 'Rafael Lima Costa',
    email: 'rafael@email.com',
    telefone: '19981234567',
    urlLinkedin: null,
    areaInteresse: null,
    temCurriculo: true,
    espontaneo: false,
    quantidadeDeCandidaturas: 1,
    criadoEm: '2026-08-28T10:00:00',
    atualizadoEm: null,
    consentimentoEm: null,
    expiraEm: null,
    ...extra,
  };
}

/** Como a base está no dia em que subir: todo mundo de candidatura antiga, ninguém autorizou. */
const COMO_ESTA_HOJE = [
  linha({ id: 'a', nome: 'Rafael Lima Costa' }),
  linha({ id: 'b', nome: 'Juliana Ferreira', quantidadeDeCandidaturas: 2 }),
];

describe('TalentBankPanelComponent', () => {
  let fixture: ComponentFixture<TalentBankPanelComponent>;
  let component: TalentBankPanelComponent;
  let http: HttpTestingController;

  function carregarPermissoes(mapa: Record<string, string[]>): void {
    TestBed.inject(PermissionStore).ensureLoaded().subscribe();
    http.expectOne(`${environment.apiUrl}/me/permissions`).flush(mapa);
  }

  async function montar(permissoes: Record<string, string[]>, dados: TalentBankSummaryDTO[]): Promise<TestRequest> {
    carregarPermissoes(permissoes);
    fixture = TestBed.createComponent(TalentBankPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne(`${environment.apiUrl}/vaga/areas`).flush(['Qualidade']);
    const req = http.expectOne((r) => r.method === 'GET' && r.url === URL_LISTA);
    req.flush(dados);
    await fixture.whenStable();
    return req;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TalentBankPanelComponent],
      providers: providersDeTeste([MessageService]),
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const TUDO = { 'rh/painel-de-vagas': ['CONSULTAR', 'BAIXAR', 'EXCLUIR'] };

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('abre mostrando todo mundo, sem filtrar por autorização', async () => {
    // Um padrão em "Autorizado" abriria a aba vazia no dia em que subir, e as
    // 21 pessoas de antes de 11/09 sumiriam sem ninguém perceber.
    const req = await montar(TUDO, COMO_ESTA_HOJE);

    expect(req.request.params.get('consentimento')).toBe('TODOS');
    expect(req.request.params.get('situacao')).toBe('TODOS');
    expect(req.request.params.get('origem')).toBe('TODOS');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="linha"]').length).toBe(2);
  });

  it('quem nunca autorizou aparece marcado como "Sem registro"', async () => {
    await montar(TUDO, COMO_ESTA_HOJE);

    const chips = [...fixture.nativeElement.querySelectorAll('[data-testid="situacao"]')] as HTMLElement[];
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Sem registro', 'Sem registro']);
    expect(chips[0].classList).toContain('status-chip--neutral');
  });

  it('quem tem só a permissão de candidaturas também vê o download', async () => {
    // A API aceita as duas authorities. Esconder por uma só deixaria o botão
    // sumido para quem o servidor autoriza.
    await montar({ 'rh/painel-de-vagas': ['CONSULTAR'], 'rh/candidaturas': ['BAIXAR'] }, COMO_ESTA_HOJE);

    expect(component.podeBaixar()).toBeTrue();
  });

  it('sem nenhuma das duas permissões de download, não oferece baixar', async () => {
    await montar({ 'rh/painel-de-vagas': ['CONSULTAR'] }, COMO_ESTA_HOJE);

    expect(component.podeBaixar()).toBeFalse();
  });

  it('a exclusão de quem tem candidatura diz que a candidatura fica', async () => {
    await montar(TUDO, COMO_ESTA_HOJE);

    component.pedirExclusao(component.linhas()[1]);
    await fixture.whenStable();

    const dialogo = document.querySelector('[data-testid="exclusao"]')?.textContent ?? '';
    expect(dialogo).toContain('2 candidaturas registradas');
    expect(dialogo).toContain('As candidaturas continuam no histórico');
  });

  it('a exclusão de quem se cadastrou sem vaga diz que sai tudo', async () => {
    await montar(TUDO, [linha({ id: 'c', nome: 'Carlos Mendes', espontaneo: true, quantidadeDeCandidaturas: 0 })]);

    component.pedirExclusao(component.linhas()[0]);
    await fixture.whenStable();

    const dialogo = document.querySelector('[data-testid="exclusao"]')?.textContent ?? '';
    expect(dialogo).toContain('apagados por inteiro');
    expect(dialogo).not.toContain('continua');
  });

  it('confirmar exclui pelo id e tira a linha da lista', async () => {
    await montar(TUDO, COMO_ESTA_HOJE);

    component.pedirExclusao(component.linhas()[0]);
    component.confirmarExclusao();

    http.expectOne((r) => r.method === 'DELETE' && r.url === `${URL_LISTA}/a`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(component.linhas().map((l) => l.id)).toEqual(['b']);
    expect(component.excluindo()).toBeNull();
    expect(texto()).not.toContain('Rafael Lima Costa');
  });

  it('trocar um filtro busca de novo na API com o valor escolhido', async () => {
    await montar(TUDO, COMO_ESTA_HOJE);

    component.aoFiltrar('origem', 'ESPONTANEO');

    const req = http.expectOne((r) => r.method === 'GET' && r.url === URL_LISTA);
    expect(req.request.params.get('origem')).toBe('ESPONTANEO');
    req.flush([]);
  });
});
