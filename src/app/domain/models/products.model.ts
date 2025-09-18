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
