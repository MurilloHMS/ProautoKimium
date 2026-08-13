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
  login: string;
  email: string;
  active: boolean;
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
