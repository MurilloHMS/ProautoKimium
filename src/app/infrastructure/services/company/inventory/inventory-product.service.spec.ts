import { TestBed } from '@angular/core/testing';

import { InventoryProductService } from './inventory-product.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('InventoryProductService', () => {
  let service: InventoryProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(InventoryProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
