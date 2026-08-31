import { TestBed } from '@angular/core/testing';

import { SecretsService } from './secrets.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('SecretsService', () => {
  let service: SecretsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(SecretsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
