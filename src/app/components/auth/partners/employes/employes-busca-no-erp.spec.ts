import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { EmployesComponent } from './employes.component';
import { EmployeeService } from '../../../../infrastructure/services/partners/employee/employee.service';
import { ErpPartner } from '../../../../domain/models/erp-partner.model';
import { providersDeTeste } from '../../../../../testing/test-setup';

/**
 * **Buscar o funcionário no Sankhya pelo código de parceiro.**
 *
 * Cadastrar quem já existe no ERP era redigitar nome, CPF e e-mail. Um dígito
 * errado no CPF não aparece em lugar nenhum — só no primeiro acesso, que é por
 * CPF e simplesmente não encontra a pessoa.
 *
 * Os testes leem o **DOM**: um componente não importado deixa o build verde e a
 * tela vazia, e é o modo de falhar mais comum desta base.
 */
describe('EmployesComponent · buscar no ERP', () => {

  const parceiro = (extra: Partial<ErpPartner> = {}): ErpPartner => ({
    codParceiro: '3418',
    name: 'JOSE CARLOS ALVES',
    document: '82111440830',
    email: 'jose@empresa.com.br',
    activeInErp: true,
    conflict: null,
    conflictWith: null,
    ...extra,
  });

  let servico: jasmine.SpyObj<EmployeeService>;

  async function montar(): Promise<ComponentFixture<EmployesComponent>> {
    // O `EmployeeStore` consome o mesmo serviço: sem os outros métodos no
    // dublê, o `ngOnInit` estoura antes de qualquer teste chegar ao ERP.
    servico = jasmine.createSpyObj<EmployeeService>('EmployeeService',
      ['lookupInErp', 'getEmployes', 'getEmployeeEmail', 'addEmploye', 'updateEmploye']);
    servico.getEmployes.and.returnValue(of([]));
    servico.getEmployeeEmail.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: [
        ...providersDeTeste(),
        { provide: EmployeeService, useValue: servico },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EmployesComponent);
    fixture.componentInstance.showDialog();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const texto = (fixture: ComponentFixture<EmployesComponent>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  afterEach(() => TestBed.resetTestingModule());

  // ── O caminho normal ───────────────────────────────────────────────────────

  it('o botão de buscar está na tela do cadastro novo', async () => {
    const fixture = await montar();

    const botoes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('pk-button'),
    ).map(b => b.textContent ?? '');

    expect(botoes.some(t => t.includes('Buscar no ERP')))
      .withContext('sem o botão no DOM, o build fica verde e a tela não busca nada')
      .toBeTrue();
  });

  it('preenche nome, documento e e-mail', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro()));

    tela.form.patchValue({ partnerCode: '3418' });
    tela.buscarNoErp();
    await fixture.whenStable();

    expect(servico.lookupInErp).toHaveBeenCalledWith(3418);
    expect(tela.form.get('name')?.value).toBe('JOSE CARLOS ALVES');
    expect(tela.form.get('document')?.value).toBe('82111440830');
    expect(tela.form.get('email')?.value).toBe('jose@empresa.com.br');
  });

  /**
   * E-mail nulo é legítimo — muitos funcionários não têm no ERP, e é por isso
   * que o primeiro acesso é por CPF. Apagar o que a pessoa já digitou seria
   * trocar um dado bom por nada.
   */
  it('e-mail vazio no ERP não apaga o que já foi digitado', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro({ email: null })));

    tela.form.patchValue({ partnerCode: '3418', email: 'digitado@x.com' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.form.get('email')?.value).toBe('digitado@x.com');
    expect(texto(fixture)).toContain('não tem e-mail');
  });

  // ── Os conflitos ───────────────────────────────────────────────────────────

  /**
   * Desde a V101 o `cod_parceiro` é único: o insert bateria no índice e voltaria
   * erro depois de a pessoa ter preenchido empresa, setor, cargo, nível,
   * contrato e data de admissão.
   */
  it('código que já é de um funcionário trava o salvar e diz de quem é', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro({
      conflict: 'ALREADY_AN_EMPLOYEE',
      conflictWith: 'JOSE CARLOS ALVES',
    })));

    tela.form.patchValue({ partnerCode: '3418' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.erpTravado()).toBeTrue();
    expect(texto(fixture)).toContain('JOSE CARLOS ALVES');
    expect(tela.form.get('name')?.value)
      .withContext('preencher sugeriria que dá para salvar')
      .toBeFalsy();
  });

  it('código que já é de um cliente avisa, mas preenche e não trava', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro({
      conflict: 'ALREADY_A_CUSTOMER',
      conflictWith: 'EXAL VESUVIUS',
    })));

    tela.form.patchValue({ partnerCode: '8805' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.erpTravado()).toBeFalse();
    expect(tela.form.get('name')?.value).toBe('JOSE CARLOS ALVES');
    expect(texto(fixture)).toContain('EXAL VESUVIUS');
  });

  /**
   * **O aviso não sobrevive à troca do código.** Sem isto, quem busca um código
   * travado e digita outro fica com o salvar desabilitado sem nada na tela
   * explicando por quê.
   */
  it('trocar o código descarta o resultado anterior', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro({
      conflict: 'ALREADY_AN_EMPLOYEE',
      conflictWith: 'JOSE CARLOS ALVES',
    })));

    tela.form.patchValue({ partnerCode: '3418' });
    tela.buscarNoErp();
    await fixture.whenStable();
    expect(tela.erpTravado()).toBeTrue();

    tela.form.patchValue({ partnerCode: '9999' });
    await fixture.whenStable();

    expect(tela.erpTravado()).toBeFalse();
  });

  it('parceiro inativo no ERP aparece como aviso', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(of(parceiro({ activeInErp: false })));

    tela.form.patchValue({ partnerCode: '3418' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('inativo');
  });

  // ── O que dá errado ────────────────────────────────────────────────────────

  it('código inexistente no ERP mostra o código que não achou', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;
    servico.lookupInErp.and.returnValue(throwError(() => ({ status: 404 })));

    tela.form.patchValue({ partnerCode: '4242' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('4242');
    expect(tela.erpBuscando())
      .withContext('o botão ficaria girando para sempre')
      .toBeFalse();
  });

  it('buscar sem código não chama a API', async () => {
    const fixture = await montar();
    const tela = fixture.componentInstance;

    tela.form.patchValue({ partnerCode: '' });
    tela.buscarNoErp();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(servico.lookupInErp).not.toHaveBeenCalled();
    expect(texto(fixture)).toContain('Informe o código');
  });
});
