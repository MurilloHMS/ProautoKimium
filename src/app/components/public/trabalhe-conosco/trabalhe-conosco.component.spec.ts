import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrabalheConoscoComponent } from './trabalhe-conosco.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('TrabalheConoscoComponent', () => {
  let component: TrabalheConoscoComponent;
  let fixture: ComponentFixture<TrabalheConoscoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrabalheConoscoComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrabalheConoscoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
