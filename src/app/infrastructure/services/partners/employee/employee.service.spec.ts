import { TestBed } from '@angular/core/testing';

import { EmployeeService } from './employee.service';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(EmployeeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
