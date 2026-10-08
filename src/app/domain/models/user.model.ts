export interface RegisterDTO {
  login: string;
  email: string;
  password: string;
  roles: string[];
}

/** Uma conta, do jeito que a tela de administração a lista. */
export interface UserResponseDTO {
  id: string;
  login: string;
  email: string;
  roles: string[];
  /** Código do funcionário vinculado, ou null sem vínculo. */
  codParceiro?: string | null;
  employeeName?: string | null;
  active: boolean;
  /** Tem tudo por definição; a grade dela não se edita. */
  developer: boolean;
  /** Conta do portal do cliente: o acesso vem do cadastro do cliente, não da grade. */
  client: boolean;
  /** Os modelos de permissão já aplicados, em ordem alfabética. */
  templates: string[];
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
