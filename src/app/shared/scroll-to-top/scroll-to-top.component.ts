import { Component, HostListener, Inject, DOCUMENT } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-scroll-to-top',
    imports: [CommonModule],
    templateUrl: './scroll-to-top.component.html',
    styleUrl: './scroll-to-top.component.scss'
})
export class ScrollToTopComponent {
  windowScrolled = false;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  @HostListener("window:scroll", [])
  onWindowScroll() {
    const scrollTop = this.document.documentElement.scrollTop || this.document.body.scrollTop;
    this.windowScrolled = scrollTop > 100;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
