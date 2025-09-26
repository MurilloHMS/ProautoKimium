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
      descricao: "Na Proauto Kimium, Leandro Ribeiro atua com dedicação e foco em oferecer as melhores soluções para nossos clientes. Com ampla experiência no setor, ele contribui para o crescimento da empresa e para a satisfação de quem confia em nossos produtos e serviços. Comprometido com a excelência, busca sempre entender as necessidades de cada cliente, garantindo atendimento de qualidade, suporte completo e soluções eficazes. Seu trabalho reflete os valores da Proauto Kimium: confiança, inovação e resultados.",
      imagem: "Leandro.Ribeiro.jpg",
      whatsapp: "555496422002"
    }
  ]
}
