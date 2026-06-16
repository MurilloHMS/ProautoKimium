import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkQrcodeComponent } from './pk-qrcode.component';

describe('PkQrcodeComponent', () => {
  let component: PkQrcodeComponent;
  let fixture: ComponentFixture<PkQrcodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PkQrcodeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkQrcodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
