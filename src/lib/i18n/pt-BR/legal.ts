type Section = { title: string; paragraphs: string[] };
type Document = { title: string; updated: string; intro: string; sections: Section[] };

export const privacy: Document = {
  title: "Política de privacidade",
  updated: "23 de setembro de 2026",
  intro:
    "Esta política explica quais dados o Relicário trata, por que trata e o que você pode fazer com eles. Ela segue a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
  sections: [
    {
      title: "Quem é responsável",
      paragraphs: [
        "O Relicário é o controlador dos dados das contas e o operador do conteúdo que você cria. Dúvidas e pedidos sobre privacidade podem ser enviados para o endereço de contato indicado no fim desta página.",
      ],
    },
    {
      title: "O que coletamos",
      paragraphs: [
        "Conta: e-mail, senha (guardada apenas como hash pelo provedor de autenticação) e, se você informar, seu nome. Se entrar com Google, recebemos seu e-mail e nome da conta Google.",
        "Conteúdo: textos, fotos, vídeos, datas e nomes que você coloca nas memórias, além das contribuições e respostas enviadas por outras pessoas para as suas memórias.",
        "Pagamento: valor, status, forma de pagamento e o identificador da transação no Mercado Pago. Dados de cartão são tratados exclusivamente pelo Mercado Pago e nunca passam pelos nossos servidores.",
        "Uso técnico: registros de segurança com endereço IP transformado em código irreversível, e eventos de uso agregados que não contêm nomes, textos, fotos nem links das memórias.",
      ],
    },
    {
      title: "Para que usamos",
      paragraphs: [
        "Para executar o contrato com você: guardar seus rascunhos, publicar e entregar as memórias, processar pagamentos e enviar avisos sobre a sua conta.",
        "Para proteger o serviço, com base em legítimo interesse: limitar abusos, detectar acessos indevidos e manter registros de segurança.",
        "Para cumprir obrigações legais, como a guarda de registros fiscais de pagamento.",
        "Não vendemos dados, não usamos seu conteúdo para publicidade e não usamos seu conteúdo para treinar sistemas de nenhum tipo.",
      ],
    },
    {
      title: "Quem pode ver uma memória",
      paragraphs: [
        "Rascunhos são visíveis apenas para quem os criou. Uma memória publicada pode ser aberta por qualquer pessoa que tenha o link. O link é aleatório e longo, não é listado em lugar nenhum e as páginas das memórias pedem aos buscadores que não as indexem. Ainda assim, quem recebe o link pode repassá-lo.",
        "Colaboradores enxergam apenas o formulário de envio. Respostas do destinatário ficam visíveis só para quem criou a memória.",
      ],
    },
    {
      title: "Com quem compartilhamos",
      paragraphs: [
        "Usamos fornecedores que processam dados em nosso nome: Supabase (banco de dados, autenticação e armazenamento de arquivos), Vercel (hospedagem da aplicação), Mercado Pago (pagamentos) e um serviço de e-mail transacional para avisos da conta. Esses fornecedores podem armazenar dados fora do Brasil, com salvaguardas contratuais.",
      ],
    },
    {
      title: "Por quanto tempo guardamos",
      paragraphs: [
        "Rascunhos e memórias ficam guardados enquanto você não os excluir. Memórias publicadas não têm data de expiração.",
        "Ao excluir uma memória, ela deixa de abrir imediatamente e os arquivos são removidos do armazenamento. Cópias de segurança operacionais do banco de dados podem manter esses dados por um período adicional, de até 30 dias, até serem substituídas no ciclo normal de retenção.",
        "Registros de pagamento são mantidos pelo prazo exigido pela legislação fiscal, sem o conteúdo da memória.",
      ],
    },
    {
      title: "Seus direitos",
      paragraphs: [
        "Você pode confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão, a portabilidade e informações sobre compartilhamento. No painel, em Conta, você baixa uma cópia dos seus dados e pode excluir a conta a qualquer momento. Para outros pedidos, use o contato abaixo.",
      ],
    },
    {
      title: "Segurança",
      paragraphs: [
        "Toda comunicação é criptografada. Arquivos ficam em armazenamento privado e só são entregues por links temporários. O acesso aos dados é restrito por regras aplicadas no próprio banco. Mais detalhes na página de segurança.",
      ],
    },
    {
      title: "Crianças",
      paragraphs: [
        "O Relicário não é destinado a menores de 18 anos como titulares de conta. Memórias podem ser feitas para crianças, mas a conta deve ser de um adulto responsável.",
      ],
    },
    {
      title: "Mudanças nesta política",
      paragraphs: ["Quando esta política mudar de forma relevante, avisaremos por e-mail ou no painel antes de a mudança valer."],
    },
  ],
};

export const terms: Document = {
  title: "Termos de uso",
  updated: "23 de setembro de 2026",
  intro: "Ao criar uma conta ou publicar uma memória no Relicário, você concorda com estes termos.",
  sections: [
    {
      title: "O serviço",
      paragraphs: [
        "O Relicário permite criar experiências digitais com textos, fotos e vídeos curtos, publicá-las mediante pagamento único e compartilhá-las por link. Criar e editar rascunhos é gratuito.",
      ],
    },
    {
      title: "Publicação e imutabilidade",
      paragraphs: [
        "Antes do pagamento você revisa todo o conteúdo e confirma que ele não poderá ser alterado. Depois de publicada, a memória fica selada: nem você nem a nossa equipe conseguem editar textos, fotos, vídeos, ordem, modelo ou configurações. Você pode excluí-la a qualquer momento.",
      ],
    },
    {
      title: "Disponibilidade",
      paragraphs: [
        "Memórias publicadas não têm data de expiração e ficam disponíveis enquanto não forem excluídas e enquanto o serviço estiver em operação. Trabalhamos para manter o serviço estável, mas não garantimos disponibilidade ininterrupta. Se um dia o Relicário for encerrado, avisaremos com antecedência mínima de 90 dias e ofereceremos a exportação do conteúdo.",
      ],
    },
    {
      title: "Pagamento",
      paragraphs: [
        "O valor é cobrado uma vez por memória publicada, via Pix ou cartão, processado pelo Mercado Pago. A publicação acontece somente depois da confirmação do pagamento.",
        "Por se tratar de conteúdo digital personalizado e entregue imediatamente, o direito de arrependimento se aplica enquanto a memória não tiver sido aberta pelo link publicado. Pedidos de reembolso podem ser feitos pelo contato abaixo em até 7 dias da compra.",
      ],
    },
    {
      title: "Seu conteúdo",
      paragraphs: [
        "O conteúdo é seu. Você nos concede apenas a licença necessária para armazenar, processar e exibir a memória para quem tiver o link.",
        "Você declara ter o direito de usar as fotos, vídeos e textos enviados e o consentimento das pessoas que aparecem neles quando necessário.",
      ],
    },
    {
      title: "O que não é permitido",
      paragraphs: [
        "Conteúdo ilegal, que envolva exploração de menores, que incite violência ou ódio, que exponha terceiros sem consentimento, que viole direitos autorais ou que seja usado para enganar pessoas. Memórias que violem estas regras podem ser removidas e a conta, encerrada.",
        "Também não é permitido tentar acessar dados de outras pessoas, contornar limites técnicos ou sobrecarregar o serviço.",
      ],
    },
    {
      title: "Responsabilidade",
      paragraphs: [
        "O Relicário não se responsabiliza pelo repasse do link por quem o recebeu nem pelo conteúdo enviado por colaboradores e aprovado por você.",
      ],
    },
    {
      title: "Lei aplicável",
      paragraphs: ["Estes termos seguem a legislação brasileira, incluindo o Código de Defesa do Consumidor."],
    },
  ],
};

export const securityPage: Document = {
  title: "Segurança",
  updated: "23 de setembro de 2026",
  intro: "Como protegemos as memórias, as contas e os pagamentos. Nenhum sistema é infalível; este é o conjunto de medidas que adotamos e mantemos.",
  sections: [
    {
      title: "Memórias seladas",
      paragraphs: [
        "Ao publicar, o conteúdo inteiro é serializado de forma canônica e recebe uma impressão digital SHA-256. As regras que impedem alterações ficam no próprio banco de dados e valem para qualquer acesso, inclusive o da nossa equipe. A cada abertura, a impressão digital é conferida.",
      ],
    },
    {
      title: "Acesso aos dados",
      paragraphs: [
        "Cada consulta é filtrada pelo usuário autenticado por políticas de segurança no nível das linhas do banco. Links públicos e de colaboração são aleatórios, longos e os de colaboração são guardados apenas como hash.",
      ],
    },
    {
      title: "Arquivos",
      paragraphs: [
        "Fotos são decodificadas e reprocessadas no servidor, o que remove metadados como localização e qualquer conteúdo escondido no arquivo. Vídeos têm o formato e a duração verificados pela estrutura interna do arquivo. Nada é identificado pela extensão.",
      ],
    },
    {
      title: "Contas",
      paragraphs: [
        "Senhas são guardadas pelo provedor de autenticação com hash forte. Há limite de tentativas de login e de recuperação de senha, e as mensagens de erro não revelam se um e-mail está cadastrado.",
      ],
    },
    {
      title: "Pagamentos",
      paragraphs: [
        "O preço é definido no servidor. Uma memória só é publicada depois que a notificação do Mercado Pago é validada por assinatura e o pagamento é confirmado diretamente na API do Mercado Pago, com conferência de valor e referência.",
      ],
    },
    {
      title: "Relatar uma vulnerabilidade",
      paragraphs: [
        "Se você encontrar uma falha, escreva para o contato abaixo com os passos para reproduzir. Não acesse dados de outras pessoas nem faça testes que degradem o serviço. Respondemos em até 5 dias úteis.",
      ],
    },
  ],
};
