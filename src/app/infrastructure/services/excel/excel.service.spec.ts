import { TestBed } from '@angular/core/testing';

import { ExcelService } from './excel.service';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('ExcelService', () => {
  let service: ExcelService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: providersDeTeste(),
    });
    service = TestBed.inject(ExcelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
