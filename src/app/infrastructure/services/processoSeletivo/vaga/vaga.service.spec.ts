import { TestBed } from '@angular/core/testing';

import { VagaService } from './vaga.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('VagaService', () => {
  let service: VagaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(VagaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
