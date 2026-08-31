import { TestBed } from '@angular/core/testing';

import { NewsletterService } from './newsletter.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('NewsletterService', () => {
  let service: NewsletterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(NewsletterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
