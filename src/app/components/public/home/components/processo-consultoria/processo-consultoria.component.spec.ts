import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessoConsultoriaComponent } from './processo-consultoria.component';

describe('ProcessoConsultoriaComponent', () => {
  let component: ProcessoConsultoriaComponent;
  let fixture: ComponentFixture<ProcessoConsultoriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessoConsultoriaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProcessoConsultoriaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
