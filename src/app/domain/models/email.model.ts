export interface Email{
  address: string;
}

export interface EmailItem {
  id: string;
  name: string;
  email: {
    address: string;
  }
}
