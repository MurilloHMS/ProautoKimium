import { TestBed } from '@angular/core/testing';

import { RentReceiptService } from './rent-receipt.service';

describe('RentReceiptServiceService', () => {
  let service: RentReceiptService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RentReceiptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
