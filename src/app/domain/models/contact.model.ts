export interface Contact{
  name: string;
  email: string;
  contactType: string;
  other?: string;
  message: string;
  businessName: string;
  contactStatus: string;
  contactDate: string;
}

export interface TipoContato {
  label: string;
  value: string;
}
