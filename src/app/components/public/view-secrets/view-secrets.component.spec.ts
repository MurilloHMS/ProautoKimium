import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewSecretsComponent } from './view-secrets.component';

import { providersDeTeste } from '../../../../testing/test-setup';

describe('ViewSecretsComponent', () => {
  let component: ViewSecretsComponent;
  let fixture: ComponentFixture<ViewSecretsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewSecretsComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewSecretsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
