import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NfeDataCollectorComponent } from './nfe-data-collector.component';

import { providersDeTeste } from '../../../../../testing/test-setup';

describe('NfeDataCollectorComponent', () => {
  let component: NfeDataCollectorComponent;
  let fixture: ComponentFixture<NfeDataCollectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NfeDataCollectorComponent],
      providers: providersDeTeste()
    })
    .compileComponents();

    fixture = TestBed.createComponent(NfeDataCollectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
