import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import { HoleritesComponent } from './holerites.component';
import { Holerite } from '../../../domain/models/hr/holerite.model';
import { environment } from '../../../../environments/environment';
import { providersDeTeste } from '../../../../testing/test-setup';

const holerite = (id: string, tipo: string): Holerite => ({
  id, competencia: '2026-09-01', tipo, originalFilename: `${id}.pdf`, createdAt: '2026-10-01T10:00:00',
});

/** O funcionário vê o NOME do tipo, e só filtra pelos tipos que tem. */
describe('HoleritesComponent · tipos', () => {
  let fixture: ComponentFixture<HoleritesComponent>;
  let http: HttpTestingController;

  async function montar(meus: Holerite[]): Promise<HTMLElement> {
    await TestBed.configureTestingModule({ imports: [HoleritesComponent], providers: providersDeTeste() }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HoleritesComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/holerite/types`).flush([
      { code: 'SALARIO', label: 'Salário' },
      { code: 'ADIANTAMENTO', label: 'Adiantamento' },
      { code: 'PLR', label: 'PLR' },
      { code: 'FERIAS_COLETIVAS', label: 'Férias coletivas' },
    ]);
    http.expectOne(`${environment.apiUrl}/holerite/me`).flush(meus);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  const filtros = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-testid="filtro-tipo"]')).map(b => b.textContent!.trim());

  it('mostra "PLR", e não o código', async () => {
    const el = await montar([holerite('a', 'PLR'), holerite('b', 'SALARIO')]);

    expect(fixture.componentInstance.tipoLabel('PLR')).toBe('PLR');
    expect(fixture.componentInstance.tipoLabel('FERIAS_COLETIVAS')).toBe('Férias coletivas');
    expect(el.textContent).toContain('Salário');
  });

  it('o filtro só oferece os tipos que a pessoa tem, na ordem do cadastro', async () => {
    const el = await montar([holerite('a', 'PLR'), holerite('b', 'SALARIO'), holerite('c', 'PLR')]);

    expect(filtros(el)).toEqual(['Salário', 'PLR']);
  });

  it('tipo que a lista ainda não conhece aparece com o código, sem sumir', async () => {
    const el = await montar([holerite('a', 'BONUS_NOVO')]);

    expect(filtros(el)).toEqual(['BONUS_NOVO']);
  });
});
