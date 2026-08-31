import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployesComponent } from './employes.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('EmployesComponent', () => {
  let component: EmployesComponent;
  let fixture: ComponentFixture<EmployesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployesComponent],
      providers: providersDeTeste()
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EmployesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
