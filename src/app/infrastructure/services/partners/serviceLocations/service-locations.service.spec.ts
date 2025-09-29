import { TestBed } from '@angular/core/testing';

import { ServiceLocationsService } from './service-locations.service';

describe('ServiceLocationsService', () => {
  let service: ServiceLocationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ServiceLocationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
