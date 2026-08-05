import { Component, computed, input } from '@angular/core';

interface PasswordRule {
  label: string;
  valid: boolean;
}

@Component({
  selector: 'app-password-rules',
  standalone: true,
  templateUrl: './password-rules.component.html',
  styleUrl: './password-rules.component.scss',
})
export class PasswordRulesComponent {
  password = input<string>('');

  rules = computed<PasswordRule[]>(() => {
    const value = this.password() ?? '';
    return [
      { label: 'No mínimo 8 caracteres', valid: value.length >= 8 },
      { label: 'Uma letra minúscula', valid: /[a-z]/.test(value) },
      { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(value) },
      { label: 'Um número', valid: /\d/.test(value) },
      { label: 'Um caractere especial (@$!%*?&#)', valid: /[@$!%*?&#]/.test(value) },
    ];
  });
}
