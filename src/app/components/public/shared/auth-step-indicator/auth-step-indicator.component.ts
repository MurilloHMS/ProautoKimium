import { Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-step-indicator',
  standalone: true,
  templateUrl: './auth-step-indicator.component.html',
  styleUrl: './auth-step-indicator.component.scss',
})
export class AuthStepIndicatorComponent {
  /** Rótulos de cada etapa, em ordem. */
  steps = input<string[]>([]);

  /** Etapa atual, começando em 1. */
  currentStep = input<number>(1);
}
