import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PkFileUploadComponent } from './pk-file-upload.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('PkFileUploadComponent', () => {
  let component: PkFileUploadComponent;
  let fixture: ComponentFixture<PkFileUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PkFileUploadComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(PkFileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
