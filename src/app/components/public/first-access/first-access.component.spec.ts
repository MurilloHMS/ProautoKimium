import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FirstAccessComponent } from './first-access.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('FirstAccessComponent', () => {
  let component: FirstAccessComponent;
  let fixture: ComponentFixture<FirstAccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstAccessComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(FirstAccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
