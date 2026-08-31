import { TestBed } from '@angular/core/testing';

import { CustomerService } from './customer.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(CustomerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
