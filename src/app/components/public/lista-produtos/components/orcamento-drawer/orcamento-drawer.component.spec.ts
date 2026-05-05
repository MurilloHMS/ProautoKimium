import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrcamentoDrawerComponent } from './orcamento-drawer.component';

describe('OrcamentoDrawerComponent', () => {
  let component: OrcamentoDrawerComponent;
  let fixture: ComponentFixture<OrcamentoDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrcamentoDrawerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrcamentoDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
