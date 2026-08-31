import { TestBed } from '@angular/core/testing';

import { VehicleService } from './vehicle.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('VehicleService', () => {
  let service: VehicleService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(VehicleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
