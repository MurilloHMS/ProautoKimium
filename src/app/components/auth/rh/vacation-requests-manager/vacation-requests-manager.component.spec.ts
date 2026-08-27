import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { VacationRequestsManagerComponent } from './vacation-requests-manager.component';
import { VacationRequestService } from '../../../../infrastructure/services/hr/vacation-request.service';
import { EmployeeStore } from '../../../../infrastructure/state/employee.store';
import { VacationRequest } from '../../../../domain/models/hr/vacation-request.model';

/**
 * A coluna de ações das férias.
 *
 * Ela abriu vazia em produção: nem os botões de aprovar e recusar, nem o traço
 * que deveria aparecer no lugar deles. Uma coluna vazia não dá erro em canto
 * nenhum — a tela carrega, a tabela mostra os dados, e só a ação some.
 */
describe('VacationRequestsManagerComponent · coluna de ações', () => {
  let fixture: ComponentFixture<VacationRequestsManagerComponent>;
  let service: jasmine.SpyObj<VacationRequestService>;

  const pedido = (status: VacationRequest['status']): VacationRequest => ({
    id: 'v-1',
    employeeId: 'e-1',
    startDate: '2026-09-01',
    endDate: '2026-09-10',
    daysRequested: 10,
    status,
    requestedAt: '2026-08-01T10:00:00Z',
    replacementEmployeeId: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<VacationRequestService>('VacationRequestService', [
      'getAll', 'getAlerts', 'approve', 'reject', 'registerByRh',
    ]);
    service.getAlerts.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [VacationRequestsManagerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        { provide: VacationRequestService, useValue: service },
        { provide: EmployeeStore, useValue: { items: () => [], load: () => of([]), ensureLoaded: () => of([]), nameOf: () => 'Funcionário' } },
      ],
    }).compileComponents();
  });

  const montarCom = (...pedidos: VacationRequest[]) => {
    service.getAll.and.returnValue(of(pedidos));
    fixture = TestBed.createComponent(VacationRequestsManagerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const componente = () => fixture.componentInstance;

  /**
   * **O teste que reproduz o defeito.**
   *
   * Uma solicitação pendente tem que oferecer aprovar e recusar. Sem os dois
   * botões, a tela vira só leitura e o RH não consegue trabalhar por ela.
   */
  it('solicitação pendente mostra aprovar e recusar', () => {
    const tela = montarCom(pedido('PENDING'));

    expect(tela.querySelector('.action-btn--approve'))
      .withContext('o botão de aprovar')
      .not.toBeNull();
    expect(tela.querySelector('.action-btn--reject'))
      .withContext('o botão de recusar')
      .not.toBeNull();
  });

  /** E o ícone precisa estar lá dentro: botão vazio não se distingue de bug. */
  it('os botões têm ícone', () => {
    const tela = montarCom(pedido('PENDING'));

    expect(tela.querySelector('.action-btn--approve .pi')).not.toBeNull();
  });

  /** Já decidida não oferece ação — mas mostra o traço, e não o vazio. */
  it('solicitação já aprovada mostra o traço no lugar dos botões', () => {
    const tela = montarCom(pedido('APPROVED'));

    expect(tela.querySelector('.action-btn')).toBeNull();
    expect(tela.textContent).toContain('—');
  });

  // ─── O saldo no lançamento do RH ──────────────────────────────────────────

  /**
   * **Marcar a caixa e deixar o campo vazio faria o oposto do que ela promete.**
   *
   * `null` é o sinal de "não informado", e a API desconta os dias em vez de
   * gravar o valor. Sem a exigência, o RH marca "definir saldo", esquece de
   * digitar, e o saldo cai — sem erro nenhum na tela.
   */
  it('marcar "definir saldo" torna o campo obrigatório', () => {
    montarCom();
    componente().onSetBalanceChange(true);

    const campo = componente().registerForm.get('vacationBalanceDays')!;
    expect(campo.hasError('required')).toBeTrue();
  });

  /**
   * **Zero é um saldo, e não vazio.**
   *
   * É o RH lançando as últimas férias e dizendo que a pessoa fica zerada. Se o
   * campo recusasse zero, esse caso não teria como ser expresso.
   */
  it('zero é um valor válido de saldo', () => {
    montarCom();
    componente().onSetBalanceChange(true);

    const campo = componente().registerForm.get('vacationBalanceDays')!;
    campo.setValue(0);

    expect(campo.valid).toBeTrue();
  });

  /** Desmarcar limpa o campo: sobra escondida vira saldo gravado sem querer. */
  it('desmarcar limpa o valor', () => {
    montarCom();
    componente().onSetBalanceChange(true);
    componente().registerForm.get('vacationBalanceDays')!.setValue(7);

    componente().onSetBalanceChange(false);

    expect(componente().registerForm.get('vacationBalanceDays')!.value).toBeNull();
  });
});
