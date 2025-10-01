import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NfeDataCollectorComponent } from './nfe-data-collector.component';

describe('NfeDataCollectorComponent', () => {
  let component: NfeDataCollectorComponent;
  let fixture: ComponentFixture<NfeDataCollectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NfeDataCollectorComponent]
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
