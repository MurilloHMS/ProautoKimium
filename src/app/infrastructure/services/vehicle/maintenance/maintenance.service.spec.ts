import { TestBed } from '@angular/core/testing';

import { MaintenanceService } from './maintenance.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(MaintenanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
