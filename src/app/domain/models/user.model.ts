export interface RegisterDTO {
  login: string;
  password: string;
  roles: string[];
}

export interface UserResponseDTO {
  login: string;
  roles: string[];
}

export interface UserRole {
  label: string;
  value: string;
}

export interface RegisterDTO {
  login: string;
  password: string;
  roles: string[];
}

export interface User {
  id: string;
  login: string;
  roles: string[];
}
