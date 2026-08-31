import { TestBed } from '@angular/core/testing';

import { EmailService } from './email.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(EmailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
