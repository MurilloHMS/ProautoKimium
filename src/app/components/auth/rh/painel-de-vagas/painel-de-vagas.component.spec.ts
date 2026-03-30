import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PainelDeVagasComponent } from './painel-de-vagas.component';

describe('PainelDeVagasComponent', () => {
  let component: PainelDeVagasComponent;
  let fixture: ComponentFixture<PainelDeVagasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PainelDeVagasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PainelDeVagasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
