import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';

import { HoleriteEnvioComponent } from './holerite-envio.component';
import { PermissionStore } from '../../../../infrastructure/state/permission.store';
import { environment } from '../../../../../environments/environment';
import { providersDeTeste } from '../../../../../testing/test-setup';

const TYPES = `${environment.apiUrl}/holerite/types`;

/**
 * Os tipos de holerite vêm do cadastro, e o RH cria um novo no meio do envio
 * (pedido do RH em 2026-10-02: os holerites de PLR).
 */
describe('HoleriteEnvioComponent · tipos', () => {
  let fixture: ComponentFixture<HoleriteEnvioComponent>;
  let http: HttpTestingController;

  async function montar(podeIncluir = true): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [HoleriteEnvioComponent],
      providers: providersDeTeste([
        MessageService,
        { provide: PermissionStore, useValue: { canByCode: () => podeIncluir, can: () => podeIncluir, canOpen: () => true } },
      ]),
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HoleriteEnvioComponent);
    fixture.detectChanges();
    http.expectOne(TYPES).flush([
      { code: 'SALARIO', label: 'Salário' },
      { code: 'ADIANTAMENTO', label: 'Adiantamento' },
      { code: 'PLR', label: 'PLR' },
      { code: 'BONUS_ANUAL', label: 'Bônus anual' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  const botoes = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-testid="tipo"]')).map(b => b.textContent!.trim());
  const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  async function digitarECriar(el: HTMLElement, nome: string): Promise<void> {
    (q(el, 'novo-tipo') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = q(el, 'nome-novo-tipo') as HTMLInputElement;
    input.value = nome;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (q(el, 'criar-tipo')!.querySelector('button') as HTMLButtonElement).click();
  }

  it('os botões vêm do cadastro, inclusive o tipo criado pelo RH, com o nome curto dos de sempre', async () => {
    const el = await montar();
    expect(botoes(el)).toEqual(['Salário', 'Adiantamento', 'PLR', 'Bônus anual']);
  });

  it('"Novo tipo" cria, seleciona o criado e o põe na lista', async () => {
    const el = await montar();

    await digitarECriar(el, 'Férias coletivas');
    const req = http.expectOne(TYPES);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'Férias coletivas' });
    req.flush({ type: { code: 'FERIAS_COLETIVAS', label: 'Férias coletivas' }, created: true });
    fixture.detectChanges();

    expect(fixture.componentInstance.tipo()).toBe('FERIAS_COLETIVAS');
    expect(botoes(el)).toContain('Férias coletivas');
    expect(q(el, 'form-novo-tipo')).toBeNull();
    expect(q(el, 'aviso-tipo')).toBeNull();
  });

  it('nome que já existia: seleciona o existente e avisa, sem duplicar o botão', async () => {
    const el = await montar();

    await digitarECriar(el, 'plr');
    http.expectOne(TYPES).flush({ type: { code: 'PLR', label: 'PLR' }, created: false });
    fixture.detectChanges();

    expect(fixture.componentInstance.tipo()).toBe('PLR');
    expect(botoes(el).filter(b => b === 'PLR').length).toBe(1);
    expect(q(el, 'aviso-tipo')!.textContent).toContain('Já existia o tipo "PLR"');
  });

  it('sem permissão de incluir, não aparece o "Novo tipo"', async () => {
    const el = await montar(false);
    expect(q(el, 'novo-tipo')).toBeNull();
  });
});
