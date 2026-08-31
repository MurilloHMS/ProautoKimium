import { TestBed } from '@angular/core/testing';

import { EmailSignatureService } from './email-signature.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('EmailSignatureService', () => {
  let service: EmailSignatureService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(EmailSignatureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
