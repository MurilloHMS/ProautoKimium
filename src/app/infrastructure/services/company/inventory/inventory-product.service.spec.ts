import { TestBed } from '@angular/core/testing';

import { InventoryProductService } from './inventory-product.service';

describe('InventoryProductService', () => {
  let service: InventoryProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InventoryProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
