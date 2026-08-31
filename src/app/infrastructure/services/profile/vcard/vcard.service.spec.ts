import { TestBed } from '@angular/core/testing';

import { VcardService } from './vcard.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('VcardService', () => {
  let service: VcardService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(VcardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
