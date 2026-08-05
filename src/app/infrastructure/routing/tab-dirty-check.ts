/**
 * Tela que sabe dizer se tem alteração não salva.
 *
 * Quem implementa passa a ser avisado antes de a aba ser fechada. Quem não
 * implementa é tratado como limpo — nenhuma tela é obrigada a aderir.
 *
 * ```ts
 * export class MinhaTela implements TabDirtyCheck {
 *   isTabDirty(): boolean {
 *     return this.mode() === 'form' && this.form.dirty;
 *   }
 * }
 * ```
 */
export interface TabDirtyCheck {
  isTabDirty(): boolean;
}

export function isTabDirtyCheck(value: unknown): value is TabDirtyCheck {
  return !!value && typeof (value as TabDirtyCheck).isTabDirty === 'function';
}
