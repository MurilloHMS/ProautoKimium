import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailSignatureComponent } from './email-signature.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('EmailSignatureComponent', () => {
  let component: EmailSignatureComponent;
  let fixture: ComponentFixture<EmailSignatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailSignatureComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailSignatureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
