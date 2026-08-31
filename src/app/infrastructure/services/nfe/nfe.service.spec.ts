import { TestBed } from '@angular/core/testing';

import { NfeService } from './nfe.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('NfeService', () => {
  let service: NfeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(NfeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
