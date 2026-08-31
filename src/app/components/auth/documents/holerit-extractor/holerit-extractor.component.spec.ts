import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { HoleritExtractorComponent } from './holerit-extractor.component';

describe('HoleritExtractorComponent', () => {
  let component: HoleritExtractorComponent;
  let fixture: ComponentFixture<HoleritExtractorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
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
