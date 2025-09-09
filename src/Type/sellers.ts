export interface Seller {
  nome: string;
  descricao: string;
  imagem: string;
  whatsapp: string
}

export const sellers: { [key: string]: Seller[] } = {
  gerente: [
    {
      nome: "Leandro Ribeiro",
      descricao: "Mais do que distribuir produtos químicos, <b>entregamos consultoria, economia e performance.",
      imagem: "Leandro.Ribeiro.jpg",
      whatsapp: "5511975797732"
    }
  ]
}
