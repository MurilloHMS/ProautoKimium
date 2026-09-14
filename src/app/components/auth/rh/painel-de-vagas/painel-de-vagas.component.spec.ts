import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PainelDeVagasComponent } from './painel-de-vagas.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('PainelDeVagasComponent', () => {
  let component: PainelDeVagasComponent;
  let fixture: ComponentFixture<PainelDeVagasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PainelDeVagasComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(PainelDeVagasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('abre em Vagas, com as abas de status', () => {
    expect(fixture.nativeElement.querySelector('.tabs-nav')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-talent-bank-panel')).toBeNull();
  });

  it('a seção Banco de talentos monta a aba, e as abas de status saem', async () => {
    // Componente fora do `imports`: o build passa, o @if renderiza, e a seção
    // abre vazia sem erro nenhum no console.
    (fixture.nativeElement.querySelector('[data-testid="secao-banco"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const aba = fixture.nativeElement.querySelector('app-talent-bank-panel') as HTMLElement | null;
    expect(aba).not.toBeNull();
    expect(aba!.querySelector('pk-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tabs-nav')).toBeNull();
  });
});
