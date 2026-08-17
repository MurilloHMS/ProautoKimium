export interface Customer {
  codParceiro: string;
  documento: string;
  nome: string;
  email: string;
  ativo: boolean;
  recebeEmail: boolean;
  codMatriz: string;
  /** Matriz do grupo: no portal, enxerga as unidades que apontam para ela. */
  isMatriz: boolean;
}

/** Uma pessoa com acesso ao portal por este cliente. */
export interface ClientUser {
  /** Nulo enquanto o convite não foi aceito: o usuário só nasce no primeiro acesso. */
  login: string | null;
  email: string;
  active: boolean;
  /** Convite enviado e ainda não usado. Some sozinho quando vence. */
  pending: boolean;
}

export interface CustomerResponse {
  id: string;
  codParceiro: string;
  documento: string;
  name: string;
  email: {
    address: string;
  }
  ativo: boolean;
  recebeEmail: boolean;
  codMatriz: string;
}
