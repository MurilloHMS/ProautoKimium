import { TestBed } from '@angular/core/testing';

import { FuelSuppyService } from './fuel-suppy.service';

import { providersDeTeste } from '../../../../../../testing/test-setup';

describe('FuelSuppyService', () => {
  let service: FuelSuppyService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(FuelSuppyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
