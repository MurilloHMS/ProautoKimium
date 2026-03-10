import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HoleritExtractorComponent } from './holerit-extractor.component';

describe('HoleritExtractorComponent', () => {
  let component: HoleritExtractorComponent;
  let fixture: ComponentFixture<HoleritExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HoleritExtractorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HoleritExtractorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
