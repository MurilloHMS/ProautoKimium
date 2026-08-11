export interface InventoryProduct{
  systemCode: string;
  name: string;
  active: boolean;
  minimumStock: number;
}

export interface InventoryProductResponse{
  id: string;
  systemCode: string;
  name: string;
  active: boolean;
  minimumStock: number;
}

/**
 * Movimentação de estoque.
 *
 * `quantity` é o estoque **absoluto resultante**, não a diferença: o desktop lê o
 * último movimento como estoque atual e grava `atual ± quantidade`. Os dois
 * clientes escrevem na mesma base, então a regra tem que ser idêntica aqui.
 *
 * O campo era `system_code` e a API espera `systemCode` — assim o código chegava
 * nulo e a API respondia 404 "código do sistema está nulo ou vazio".
 */
export interface InventoryMovement{
  movementDate: string;
  quantity: number;
  systemCode: string;
}

export interface ProductWebSiteCreateDTO{
  systemCode: string;
  name: string;
  active: boolean;
  cores: string[];
  finalidade: string;
  diluicao: string;
  concentracao: string;
  localUso: string;
  descricao: string;
  descricaoGuia?: string;
  equipmentId?: string | null;
}

export interface ProductWebSiteUpdateDTO{
  name: string;
  active: boolean;
  cores: string[];
  finalidade: string;
  diluicao: string;
  concentracao: string;
  localUso: string;
  descricao: string;
  descricaoGuia?: string;
  equipmentId?: string | null;
}

export interface ProductWebSiteResponseDTO{
  id: string;
  systemCode: string;
  name: string;
  active: boolean;
  cores: string[];
  finalidade: string;
  diluicao: string;
  concentracao: string;
  localUso: string;
  descricao: string;
  descricaoGuia?: string;
  imagem: string;
  equipmentId?: string | null;
}

export interface ProductWebSitePublicResponseDTO{
  systemCode: string;
  name: string;
  active: boolean;
  cores: string[];
  finalidade: string;
  diluicao: string;
  descricao: string;
  imagem: string;
}
