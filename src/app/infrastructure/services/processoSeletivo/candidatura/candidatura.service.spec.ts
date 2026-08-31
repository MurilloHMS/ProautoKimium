import { TestBed } from '@angular/core/testing';

import { CandidaturaService } from './candidatura.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('CandidaturaService', () => {
  let service: CandidaturaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(CandidaturaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
