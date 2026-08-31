import { TestBed } from '@angular/core/testing';

import { CertificateService } from './certificate.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('CertificateService', () => {
  let service: CertificateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(CertificateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
