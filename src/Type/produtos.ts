export const categorias = [
    {
      nome: "Alimentos",
      produtos: [
        { id: "laticinios", nome: "Laticínios" },
        { id: "bebidas", nome: "Bebidas" },
        { id: "frigorificos", nome: "Frigoríficos" },
        { id: "processadoras", nome: "Processadoras de Alimentos" },
        { id: "mercados", nome: "Mercados" },
        { id: "panificadoras", nome: "Panificadoras" },
        { id: "confeitarias", nome: "Confeitarias" }
      ]
    },
    {
      nome: "Cozinhas Industriais e Restaurantes",
      produtos: [
        { id: "cozinhas", nome: "Cozinhas Industriais" },
        { id: "fast-food", nome: "Fast Foods" },
        { id: "bares", nome: "Bares" },
        { id: "lanchonetes", nome: "Lanchonetes e Restaurantes" }
      ]
    }, 
    {
      nome: "Automotivo",
      produtos: [
        {id: "concessionarias", nome: "Concessionárias"},
        {id: "transportadoras", nome: "Transportadoras de Carga"},
        {id: "empresas-onibus", nome: "Empresas de Ônibus"},
        {id: "lava-rapido", nome: "Lava Rapido"},
        {id: "posto-combustivel", nome: "Posto de Combustível"},
        {id: "concreteiras", nome: "Concreteiras"}
      ]
    },
    {
      nome: "Indústrias",
      produtos: [
        {id: "metalurgicas", nome: "Metalúrgicas"},
        {id: "montadoras", nome: "Montadoras"},
        {id: "usinas", nome: "Usinas"},
        {id: "retificas", nome: "Retíficas"},
        {id: "centros-manutencao", nome: "Centros de Manutenção"}
      ]
    }, 
    {
      nome: "Institucional",
      produtos: [
        {id: "clubles", nome: "Clubes"},
        {id: "shoppings", nome: "Shoppings"},
        {id: "hoteis", nome: "Hotéis"},
        {id: "clinicas", nome: "Clinicas"},
        {id: "escolas", nome: "Escolas"},
        {id: "igrejas", nome: "Igrejas"},
        {id: "hospitais", nome: "Hospitais"},
        {id: "facilities", nome: "Facilities"},
        {id: "resorts", nome: "Resorts"},
        {id: "limpadoras", nome: "Limpadoras"},
        {id: "consominios", nome: "Condomínios"},
        {id: "escritorios", nome: "Escritórios"},

      ]
    },
    {
      nome: "Lavanderias",
      produtos: [
        {id: "lavanderias-industriais", nome: "Lavanderias Industriais"},
        {id: "lavanderias-express", nome: "Lavanderias Express"}
      ]
    },
    {
      nome: "Aviação",
      produtos: [
        {id: "aviacao", nome: "Aviação"},
      ]
    }
    
  ];

  export const produtos: { [key: string]: { imagem: string; titulo: string; descricao: string; cor: string; diluicao: string }[] } = {
    laticinios: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengordurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    bebidas: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengordurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    frigorificos: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengordurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    processadoras: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengorgurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    mercados: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengorgurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    panificadoras: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengordurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ],
    confeitarias: [
      {
        imagem: "kimi-klap.png",
        titulo: "Desengordurante e Desengraxante Alcalino",
        descricao: "Kimi Klap - BB Preta",
        cor: "Laranja",
        diluicao: "1 a 10%"
      },
      {
        imagem: "kimi-klore.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      },
      {
        imagem: "klinbe.png",
        titulo: "Desincrustante Alcalino",
        descricao: "Klinbe",
        cor: "Laranja",
        diluicao: "2%"
      },
      {
        imagem: "neuter-use.png",
        titulo: "Detergente neutro de uso geral",
        descricao: "Neuter use - Natural",
        cor: "Amarelo",
        diluicao: "6 a 50%"
      },
      {
        imagem: "neuterax-yellow.png",
        titulo: "Desengordurante Levemente Alcalino",
        descricao: "Neuterax Yellow",
        cor: "amarelo",
        diluicao: "5 a 20%"
      },
      {
        imagem: "pro-bac-al.png",
        titulo: "Desinfetante Quartenário",
        descricao: "Probac Al",
        cor: "Azul",
        diluicao: "1 a 10%"
      },
      {
        imagem: "pro-ha-1000-cl.png",
        titulo: "Alcalino Clorado Cip",
        descricao: "Pro Ha 1000CL",
        cor: "Amarelo",
        diluicao: "0,5 a 2%"
      },
      {
        imagem: "pro-ha-1000-decrust.png",
        titulo: "Detergente Ácido / CIP",
        descricao: "Pro Ha 1000 Decrust - Natural",
        cor: "Incolor",
        diluicao: "1 a 5%"
      },
      {
        imagem: "pro-ha-alcb.png",
        titulo: "Sanitizante Clorado",
        descricao: "Kimi Klore",
        cor: "Incolor a amarelo",
        diluicao: "1 a 10%"
      }
    ]
  };