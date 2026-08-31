import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

import { providersDeTeste } from '../../../testing/test-setup';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
