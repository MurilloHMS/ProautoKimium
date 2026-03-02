import { TestBed } from '@angular/core/testing';

import { EmailSignatureService } from './email-signature.service';

describe('EmailSignatureService', () => {
  let service: EmailSignatureService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmailSignatureService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
