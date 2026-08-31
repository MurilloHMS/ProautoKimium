import { TestBed } from '@angular/core/testing';

import { ServiceLocationsService } from './service-locations.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('ServiceLocationsService', () => {
  let service: ServiceLocationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(ServiceLocationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
