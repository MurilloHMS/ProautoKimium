export interface LoginResponseDTO {
  token: string;
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
