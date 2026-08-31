import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecretsComponent } from './secrets.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('SecretsComponent', () => {
  let component: SecretsComponent;
  let fixture: ComponentFixture<SecretsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecretsComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecretsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
