import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { EmployesComponent } from './employes.component';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { AuthService } from '../../../../infrastructure/services/auth.service';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { Employee } from '../../../../domain/models/employee.model';
import { NO_COMPUTADOR, larguraDaJanela, providersDeTeste, restaurarLargura } from '../../../../../testing/test-setup';

/**
 * Acesso ao site (2026-10-08): o RH vê quem já entrou no site, filtra os
 * pendentes e baixa o relatório deles.
 *
 * O defeito que esta mudança fecha é silencioso: a tela tirava a situação da
 * lista de contas da Administração, que responde 403 para quem é só do RH, e
 * todo mundo aparecia sem usuário. A situação agora vem com o funcionário.
 */
describe('EmployesComponent · acesso ao site', () => {
  const pessoa = (p: Partial<Employee>) => ({
    id: p.partnerCode, document: '', email: 'x@t.com', ativo: true, managerCode: '', birthday: null as never, ...p,
  }) as Employee;

  const EQUIPE: Employee[] = [
    pessoa({ partnerCode: '1043', name: 'Ricardo Lima', siteAccess: 'ACTIVE', siteLogin: 'ricardo' }),
    // Conta bloqueada pela Administração com o funcionário ainda ativo: o caso raro.
    pessoa({ partnerCode: '1050', name: 'Carlos Dias', siteAccess: 'BLOCKED', siteLogin: 'carlos' }),
    // Inativar bloqueia a conta: desligado com conta não é "bloqueado" na lista, é desligado.
    pessoa({ partnerCode: '0902', name: 'Marta Saiu', siteAccess: 'BLOCKED', siteLogin: 'marta', ativo: false }),
    pessoa({ partnerCode: '1047', name: 'Bruna Teixeira', siteAccess: 'PENDING', firstAccessRequestedAt: '2026-10-03T09:12:00' }),
    pessoa({ partnerCode: '1052', name: 'Diego Martins', siteAccess: 'PENDING' }),
    // Desligado sem conta: ninguém precisa cobrar o cadastro dele.
    pessoa({ partnerCode: '0901', name: 'João Antigo', siteAccess: 'PENDING', ativo: false }),
  ];

  let service: jasmine.SpyObj<EmployeeService>;
  let auth: jasmine.SpyObj<AuthService>;

  /** Quem está olhando. Por padrão, o RH: vê funcionários, não vê a Administração. */
  const RH = (tela: string) => tela !== 'settings/admin';

  async function montar(can: (tela: string, acao?: string) => boolean = RH) {
    larguraDaJanela(NO_COMPUTADOR);
    const params = new BehaviorSubject(convertToParamMap({}));
    service = jasmine.createSpyObj<EmployeeService>('EmployeeService', ['downloadPendingSiteAccessReport', 'lookupInErp']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['getUsers', 'linkEmployee', 'unlinkEmployee']);
    // O RH sem a Administração: a lista de contas é recusada.
    auth.getUsers.and.returnValue(can('settings/admin', 'CONSULTAR')
      ? of([{ id: 'u1', login: 'ricardo', email: 'r@t.com', roles: [], codParceiro: '1043', active: true,
              developer: false, client: false, templates: [] }])
      : throwError(() => ({ status: 403 })));

    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: [
        ...providersDeTeste(),
        { provide: EmployeeStore, useValue: { items: signal(EQUIPE), load: () => {}, refresh: () => {}, loading: signal(false),
                                              options: signal([]), activeOptions: signal([]), nameOf: () => '' } },
        { provide: EmployeeService, useValue: service },
        { provide: AuthService, useValue: auth },
        // O RH: vê funcionários, não vê a Administração.
        { provide: PermissionStore, useValue: { can, canOpen: () => true } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { queryParamMap: params.value } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmployesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { tela: fixture.componentInstance, fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** "selo · detalhe" de cada linha da tabela. */
  const celulas = (el: HTMLElement) => Array.from(el.querySelectorAll('.acesso-celula')).map(c =>
    `${c.querySelector('.acesso-selo')!.textContent!.trim()} · ${c.querySelector('.acesso-detalhe')!.textContent!.trim()}`);

  afterEach(() => {
    TestBed.resetTestingModule();
    restaurarLargura();
  });

  /**
   * **O defeito.** Com a lista de contas recusada, a tela antiga contava os
   * cinco como sem usuário. A situação que vem com o funcionário é a que vale.
   */
  it('a situação vem do funcionário, mesmo sem acesso à lista de contas', async () => {
    const { tela } = await montar();

    expect(tela.accessCounts()).toEqual({ todos: 6, ACTIVE: 1, PENDING: 2 });
  });

  /** Sem a Administração, a lista de contas nem é pedida: o pedido só voltaria 403. */
  it('quem não vê a Administração não pede a lista de contas', async () => {
    await montar();

    expect(auth.getUsers).not.toHaveBeenCalled();
  });

  /**
   * Decisão dele: só a Administração vincula e desvincula; o RH só vê. O
   * caso que separa as duas coisas é quem CONSULTA a Administração mas não
   * CONFIGURA: vê as contas, e mesmo assim não ganha os botões.
   */
  it('quem só consulta a Administração vê as contas, mas não vincula nem desvincula', async () => {
    const { fixture, el } = await montar((tela, acao) => tela !== 'settings/admin' || acao === 'CONSULTAR');
    fixture.detectChanges();

    expect(auth.getUsers).toHaveBeenCalled();
    expect(el.querySelectorAll('.acesso-acao').length).toBe(0);
  });

  it('quem configura a Administração vê desvincular em quem tem conta e vincular nos outros', async () => {
    const { fixture, el } = await montar(() => true);
    fixture.detectChanges();

    const acoes = Array.from(el.querySelectorAll('.acesso-acao')).map(b => b.textContent!.trim());
    expect(acoes).toContain('desvincular');
    expect(acoes).toContain('vincular');
  });

  it('o filtro Pendentes mostra só os ativos que ainda não entraram', async () => {
    const { tela } = await montar();

    tela.accessFilter.set('PENDING');

    expect(tela.visibleEmployes().map(e => e.name)).toEqual(['Bruna Teixeira', 'Diego Martins']);
  });

  it('a linha diz o detalhe: quem pediu o código e não concluiu, e quem nunca entrou', async () => {
    const { tela, fixture, el } = await montar();
    tela.accessFilter.set('PENDING');
    fixture.detectChanges();

    expect(celulas(el)).toEqual(['Pendente · pediu o código em 03/10, não concluiu', 'Pendente · nunca entrou']);
  });

  /** O bloqueio é o "Ativo": não há filtro de bloqueados, e o desligado aparece com um traço. */
  it('desligado fica fora dos filtros e aparece com traço, mesmo com conta', async () => {
    const { tela, fixture, el } = await montar();

    expect(tela.accessOptions().map(o => o.label)).toEqual(['Todos', 'Com acesso', 'Pendentes']);
    expect(tela.accessOf(EQUIPE.find(e => e.name === 'Marta Saiu')!)).toBe('INACTIVE');

    fixture.detectChanges();
    const marta = Array.from(el.querySelectorAll('tr')).find(tr => tr.textContent!.includes('Marta Saiu'))!;
    expect(marta.querySelector('.acesso-selo')).toBeNull();
  });

  it('a conta bloqueada de quem está ativo ainda mostra o selo, com o login', async () => {
    const { fixture, el } = await montar();
    fixture.detectChanges();

    const carlos = Array.from(el.querySelectorAll('tr')).find(tr => tr.textContent!.includes('Carlos Dias'))!;
    expect(carlos.querySelector('.acesso-selo')!.textContent!.trim()).toBe('Bloqueado');
    expect(carlos.querySelector('.acesso-detalhe')!.textContent!.trim()).toBe('carlos');
  });

  it('o relatório baixa no formato escolhido', async () => {
    const { tela } = await montar();
    const arquivo = new HttpResponse({
      body: new Blob(['x']),
      headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="pendentes.xlsx"' }),
    });
    service.downloadPendingSiteAccessReport.and.returnValue(of(arquivo));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
    spyOn(HTMLAnchorElement.prototype, 'click');

    tela.reportItems[1].command!({});

    expect(service.downloadPendingSiteAccessReport).toHaveBeenCalledWith('pdf');
    expect(tela.downloading()).toBeFalse();
  });
});
