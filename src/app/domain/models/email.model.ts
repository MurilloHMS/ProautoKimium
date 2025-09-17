export interface Email{
  nome: string;
}

export interface EmailItem {
  id: string;
  name: string;
  email: {
    address: string;
  }
}
