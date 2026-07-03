export interface RegisterDTO {
  login: string;
  email: string;
  password: string;
  roles: string[];
}

export interface UserResponseDTO {
  login: string;
  roles: string[];
  codParceiro?: string | null;   // funcionário vinculado, se houver
}

export interface UserRole {
  label: string;
  value: string;
}

export interface User {
  id: string;
  login: string;
  roles: string[];
}
