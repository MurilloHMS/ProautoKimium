import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { PKTitleComponent } from './pk-title.component';

describe('PKTitleComponent', () => {
  let component: PKTitleComponent;
  let fixture: ComponentFixture<PKTitleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
      imports: [PKTitleComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PKTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
