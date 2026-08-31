import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientLoginComponent } from './client-login.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('ClientLoginComponent', () => {
  let component: ClientLoginComponent;
  let fixture: ComponentFixture<ClientLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientLoginComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
