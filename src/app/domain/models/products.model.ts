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

export interface InventoryMovement{
  movementDate: Date;
  quantity: number;
  system_code: string;
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
