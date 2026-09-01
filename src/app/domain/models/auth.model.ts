export interface LoginResponseDTO {
  /** O JWT de duas horas que acompanha cada requisição. */
  token: string;

  /**
   * O de sete dias, que só serve para trocar por um `token` novo.
   *
   * Opcional porque a API pode estar numa versão anterior a ele: front novo
   * contra API velha receberia `undefined`, e sem o `?` o TypeScript deixaria
   * passar um `undefined` gravado como a string "undefined" no armazenamento.
   */
  refreshToken?: string;
}

export interface ForgotPasswordDTO {
  login: string;
}

export interface ResetPasswordDTO {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDTO {
  login: string;
  newPassword: string;
}

export interface NewAccessDTO {
  cpf: string;
  email: string;
}

export interface NewAccessPasswordDTO {
  password: string;
  email: string;
}
