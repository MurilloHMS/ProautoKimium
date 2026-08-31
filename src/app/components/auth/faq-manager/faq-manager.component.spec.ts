import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqManagerComponent } from './faq-manager.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('FaqManagerComponent', () => {
  let component: FaqManagerComponent;
  let fixture: ComponentFixture<FaqManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqManagerComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(FaqManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
