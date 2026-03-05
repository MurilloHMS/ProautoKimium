export interface Recipient {
  id: string | number;
  name: string;
  email: string;
  type: 'employee' | 'customer';
}
