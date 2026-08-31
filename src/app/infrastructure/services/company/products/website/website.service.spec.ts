import { TestBed } from '@angular/core/testing';

import { WebsiteService } from './website.service';

import { providersDeTeste } from '../../../../../../testing/test-setup';

describe('WebsiteService', () => {
  let service: WebsiteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(WebsiteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
