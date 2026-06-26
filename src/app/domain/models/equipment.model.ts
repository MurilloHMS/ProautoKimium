export interface EquipmentResponseDTO {
  id: string;
  nome: string;
  imagem: string | null;
}

export interface EquipmentCreateDTO {
  nome: string;
}

export interface EquipmentUpdateDTO {
  nome: string;
}
