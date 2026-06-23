import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'none';

/**
 * Anima o elemento ao entrar na viewport (scroll reveal).
 * Uso: <div appReveal>  |  <div appReveal="left" [revealDelay]="120">
 * Os estilos (.reveal / .is-visible) ficam em styles.scss (globais).
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input('appReveal') variant: RevealVariant | '' = 'up';
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('reveal');
    const v = this.variant || 'up';
    node.classList.add(`reveal--${v}`);
    if (this.revealDelay) {
      node.style.transitionDelay = `${this.revealDelay}ms`;
    }

    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add('is-visible');
            this.observer?.unobserve(node);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
