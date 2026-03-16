import { TestBed } from '@angular/core/testing';

import { FuelSuppyService } from './fuel-suppy.service';

describe('FuelSuppyService', () => {
  let service: FuelSuppyService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FuelSuppyService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
