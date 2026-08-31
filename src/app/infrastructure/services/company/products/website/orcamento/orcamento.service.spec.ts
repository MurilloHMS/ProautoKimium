import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { OrcamentoService } from './orcamento.service';

describe('OrcamentoService', () => {
  let service: OrcamentoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],});
    service = TestBed.inject(OrcamentoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
