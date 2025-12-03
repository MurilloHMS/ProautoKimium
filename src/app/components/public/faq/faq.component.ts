import { Component } from '@angular/core';
import { AccordionModule } from 'primeng/accordion';

interface Faq{
  title: string,
  body: string,
  value: any
}

@Component({
    selector: 'app-faq',
    imports: [AccordionModule],
    templateUrl: './faq.component.html',
    styleUrl: './faq.component.scss'
})
export class FaqComponent {
  faqs: Faq[] = [
  { title: 'Quais são os principais produtos oferecidos pela Proauto Kimium?', body: 'A Proauto Kimium oferece uma ampla linha de produtos químicos voltados para limpeza e higienização profissional e industrial. Entre os principais estão desengraxantes, detergentes, desinfetantes, removedores, saneantes e produtos automotivos.', value: '0' },
  { title: 'Quais são os benefícios dos produtos Proauto Kimium?', body: 'Os produtos da Proauto Kimium são desenvolvidos com alta performance, segurança e foco na sustentabilidade. Benefícios incluem maior eficiência na limpeza, menor tempo de aplicação, economia de produto e suporte técnico especializado.', value: '1' },
  { title: 'Qual o valor mínimo para compra?', body: 'O valor mínimo para compras pode variar conforme a região e tipo de cliente. Para pedidos fora do estado ou com condições específicas, consulte nosso setor comercial.', value: '2' },
  { title: 'Qual a quantidade mínima para compra?', body: 'Trabalhamos com volumes comerciais como bombonas de 5L, 20L ou tambores de 50L/200L, dependendo do produto. Quantidades sob demanda podem ser negociadas para clientes recorrentes.', value: '3' },
  { title: 'É possível fazer o pagamento a prazo?', body: 'Sim, oferecemos condições de pagamento a prazo para clientes com cadastro aprovado. As condições variam conforme análise de crédito e histórico de compras.', value: '4' },
  { title: 'Quais as formas de pagamento?', body: 'Aceitamos pagamentos via boleto, PIX, transferência e faturamento conforme aprovação de crédito.', value: '5' },
  { title: 'Os produtos químicos podem ser retirados por minha transportadora própria?', body: 'Sim, desde que a transportadora esteja em conformidade com as normas de transporte de produtos químicos. A coleta deve ser agendada previamente com nossa equipe de logística.', value: '6' },
  { title: 'Qual o horário de retirada dos produtos?', body: 'As retiradas podem ser feitas de segunda a sexta-feira, das 09h às 16h, com agendamento prévio. É importante que o veículo esteja autorizado e com documentação necessária.', value: '7' },
  { title: 'Qual o horário de atendimento?', body: 'Nosso atendimento funciona de segunda a quinta-feira, das 07:30h às 17:30h e sexta-feira, das 07:30 às 16:30, por telefone, e-mail ou WhatsApp. Atendimentos técnicos e visitas comerciais também podem ser agendados.', value: '8' },
  { title: 'A quem se destina o Atendimento Técnico Especializado?', body: 'Destinado a empresas e profissionais que necessitam de orientação sobre aplicação correta dos produtos, treinamentos operacionais, suporte em processos de higienização e adequação a normas da vigilância sanitária.', value: '9' },
  { title: 'Qual a política de privacidade da Proauto Kimium?', body: 'A Proauto Kimium respeita a LGPD. Todas as informações são usadas para fins comerciais, operacionais e de relacionamento. Não compartilhamos dados sem consentimento. Consulte nossa política completa no site.', value: '10' },
  { title: 'Como armazenar os produtos corretamente?', body: 'Armazene em local fresco, ventilado, longe da luz solar direta e fora do alcance de crianças. Mantenha frascos fechados e siga instruções de manuseio e compatibilidade química.', value: '11' },
  { title: 'Os produtos são testados e certificados?', body: 'Todos os produtos passam por rigorosos testes de qualidade e seguem normas técnicas aplicáveis, incluindo registros na ANVISA quando necessário.', value: '12' },
  { title: 'Vocês oferecem suporte para grandes projetos?', body: 'Sim, atendemos desde pequenas empresas até grandes projetos industriais, oferecendo suporte técnico especializado, treinamento de equipe e desenvolvimento de soluções sob demanda.', value: '13' },
  { title: 'Como solicitar um orçamento?', body: 'Entre em contato via e-mail, telefone ou WhatsApp informando produtos desejados, quantidades e endereço de entrega. Nossa equipe comercial retornará com proposta personalizada.' , value: '14' },
  { title: 'Os produtos são seguros para uso em ambientes alimentícios?', body: 'Alguns produtos são indicados para ambientes alimentícios, respeitando normas da ANVISA e regulamentações de segurança alimentar. Sempre verifique rótulo e ficha técnica antes da aplicação.', value: '15' }
];

}
