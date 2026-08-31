import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CandidaturasComponent } from './candidaturas.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('CandidaturasComponent', () => {
  let component: CandidaturasComponent;
  let fixture: ComponentFixture<CandidaturasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandidaturasComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(CandidaturasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
