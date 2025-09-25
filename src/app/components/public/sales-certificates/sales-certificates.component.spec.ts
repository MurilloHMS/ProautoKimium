import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SalesCertificatesComponent } from './sales-certificates.component';

describe('SalesCertificatesComponent', () => {
  let component: SalesCertificatesComponent;
  let fixture: ComponentFixture<SalesCertificatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalesCertificatesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SalesCertificatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
