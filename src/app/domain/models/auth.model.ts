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
