import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RentReceiptGeneratorComponent } from './rent-receipt-generator.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('RentReceiptGeneratorComponent', () => {
  let component: RentReceiptGeneratorComponent;
  let fixture: ComponentFixture<RentReceiptGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RentReceiptGeneratorComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(RentReceiptGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
