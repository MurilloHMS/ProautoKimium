export interface EquipmentAssignment {
  id: string;
  employeeId: string;
  equipmentType: string;
  description: string | null;
  deliveredAt: string;
  returnedAt: string | null;
  notes: string | null;
  withEmployee: boolean;
}

export interface DeliverEquipmentPayload {
  employeeId: string;
  equipmentType: string;
  description: string;
  deliveredAt: string;
  notes: string;
}

export interface ReturnEquipmentPayload {
  returnedAt: string;
}
