import { TestBed } from '@angular/core/testing';

import { ContactService } from './contact.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('ContactService', () => {
  let service: ContactService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(ContactService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
