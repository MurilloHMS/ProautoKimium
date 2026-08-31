import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileManagerComponent } from './profile-manager.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('ProfileManagerComponent', () => {
  let component: ProfileManagerComponent;
  let fixture: ComponentFixture<ProfileManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileManagerComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfileManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
