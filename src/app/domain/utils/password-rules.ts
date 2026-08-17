import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * A mesma exigência do login do sistema interno: 8 caracteres, com minúscula,
 * maiúscula, número e símbolo da lista.
 *
 * Vive aqui para que o primeiro acesso e a redefinição de senha do portal
 * cobrem exatamente a mesma coisa. Duas telas com regras parecidas mas não
 * iguais é como se cria a senha que uma aceita e a outra recusa.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

export interface PasswordRule {
  readonly label: string;
  readonly met: (value: string) => boolean;
}

/** Mostradas enquanto se digita: recusar depois de enviar, sem dizer o quê, é o que se quer evitar. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { label: 'Pelo menos 8 caracteres', met: v => v.length >= 8 },
  { label: 'Uma letra maiúscula e uma minúscula', met: v => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'Um número', met: v => /\d/.test(v) },
  { label: 'Um símbolo (@ $ ! % * ? & #)', met: v => /[@$!%*?&#]/.test(v) },
];

export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) return null;
    return PASSWORD_PATTERN.test(value) ? null : { passwordStrength: true };
  };
}

/**
 * Confere a confirmação no grupo, e não no campo, porque depende dos dois.
 * O erro é publicado no campo de confirmação para a mensagem aparecer embaixo
 * dele, que é onde a pessoa está olhando.
 */
export function passwordsMatchValidator(passwordKey = 'password', confirmKey = 'confirm'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey);
    const confirm = group.get(confirmKey);

    if (!password || !confirm || !confirm.value) return null;

    if (password.value !== confirm.value) {
      confirm.setErrors({ ...(confirm.errors ?? {}), passwordsMismatch: true });
      return { passwordsMismatch: true };
    }

    // Só limpa o erro que é deste validador: o campo pode estar inválido por
    // outro motivo, e apagar tudo aqui esconderia o outro.
    if (confirm.hasError('passwordsMismatch')) {
      const { passwordsMismatch, ...rest } = confirm.errors ?? {};
      confirm.setErrors(Object.keys(rest).length ? rest : null);
    }

    return null;
  };
}
