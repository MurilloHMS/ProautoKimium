export interface Customer {
  codParceiro: string;
  documento: string;
  nome: string;
  email: string;
  ativo: boolean;
  recebeEmail: boolean;
  codMatriz: string;
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
