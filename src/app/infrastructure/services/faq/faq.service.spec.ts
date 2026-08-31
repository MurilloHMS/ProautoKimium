import { TestBed } from '@angular/core/testing';

import { FaqService } from './faq.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('FaqService', () => {
  let service: FaqService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(FaqService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
