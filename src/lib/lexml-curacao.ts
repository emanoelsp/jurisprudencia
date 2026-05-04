/**
 * Camada 3 — Curadoria de leis frequentes no contencioso brasileiro.
 * 10 leis com URN LexML, datas de vigência e texto de embedding.
 */

export interface LeiCurada {
  nome: string
  urn: string
  dataVigencia: string
  dataRevogacao: string
  texto: string
}

export const LEIS_CURADAS: LeiCurada[] = [
  {
    nome: 'Código Penal — Decreto-Lei 2.848/1940',
    urn: 'urn:lex:br:federal:decreto.lei:1940-12-07;2848',
    dataVigencia: '1940-12-07',
    dataRevogacao: '9999-12-31',
    texto: `Decreto-Lei nº 2.848/1940 — Código Penal Brasileiro. Vigente com alterações.
Art. 1º Não há crime sem lei anterior que o defina. Não há pena sem prévia cominação legal (princípio da legalidade).
Art. 2º Ninguém pode ser punido por fato que lei posterior deixa de considerar crime (retroatividade benéfica).
Art. 5º Aplica-se a lei brasileira ao crime cometido no território nacional (territorialidade).
Art. 14. Crime consumado: quando nele se reúnem todos os elementos de sua definição legal. Tentado: quando iniciada a execução não se consuma por circunstâncias alheias à vontade do agente.
Art. 18. Crime doloso: agente quis o resultado ou assumiu o risco. Crime culposo: agente inobservou o dever de cuidado objetivo (negligência, imprudência, imperícia).
Art. 29. Concurso de agentes: quem concorre para o crime incide nas penas a ele cominadas, na medida de sua culpabilidade.
Art. 59. Fixação da pena-base pelo juiz considerando culpabilidade, antecedentes, conduta social, personalidade, motivos, circunstâncias e consequências do crime.
Art. 65. Atenuantes obrigatórias: ser menor de 21 anos na data do fato; ser maior de 70 anos na data da sentença; desconhecimento da lei; cometimento sob coação resistível; confissão espontânea; reparação do dano.
Art. 121. Homicídio doloso simples: pena de reclusão de 6 a 20 anos. Qualificado por veneno, fogo, asfixia, tortura, traição, emboscada, dissimulação, motivo torpe ou fútil, feminicídio: reclusão de 12 a 30 anos.
Art. 155. Furto: subtrair coisa alheia móvel para si ou para outrem. Pena: reclusão de 1 a 4 anos e multa. Qualificado: rompimento de obstáculo, escalada, chave falsa, abuso de confiança.
Art. 157. Roubo: subtração mediante grave ameaça ou violência à pessoa. Pena: reclusão de 4 a 10 anos. Latrocínio (morte): reclusão de 20 a 30 anos.
Art. 171. Estelionato: obter vantagem ilícita mediante fraude, induzindo ou mantendo alguém em erro. Pena: reclusão de 1 a 5 anos.
Art. 213. Estupro: constranger alguém mediante violência ou grave ameaça a ter conjunção carnal ou a praticar ato libidinoso. Pena: reclusão de 6 a 10 anos.
Art. 288. Associação criminosa: associar-se 3 ou mais pessoas para o fim específico de cometer crimes. Pena: reclusão de 1 a 3 anos.
Art. 312. Peculato: apropriar-se de dinheiro, valor ou bem móvel, público ou particular, por funcionário público em razão do cargo. Pena: reclusão de 2 a 12 anos.`,
  },
  {
    nome: 'Constituição Federal de 1988',
    urn: 'urn:lex:br:federal:constituicao:1988-10-05;1988',
    dataVigencia: '1988-10-05',
    dataRevogacao: '9999-12-31',
    texto: `Constituição da República Federativa do Brasil de 1988. Norma fundamental do ordenamento jurídico brasileiro.
Art. 1º Fundamentos da República: soberania; cidadania; dignidade da pessoa humana; valores sociais do trabalho e da livre iniciativa; pluralismo político.
Art. 3º Objetivos fundamentais: construir sociedade livre, justa e solidária; erradicar a pobreza e a marginalização; reduzir desigualdades sociais e regionais; promover o bem de todos.
Art. 5º Direitos e garantias fundamentais: igualdade perante a lei; inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade; proibição de tortura e tratamento desumano; liberdade de manifestação do pensamento; inviolabilidade da intimidade, vida privada, honra e imagem; inviolabilidade do domicílio; sigilo das comunicações; livre exercício de qualquer trabalho; direito de propriedade; proibição de confisco; direito de herança; habeas corpus; mandado de segurança; ação popular; presunção de inocência; ampla defesa e contraditório; proibição de provas ilícitas; devido processo legal; razoável duração do processo.
Art. 6º Direitos sociais: educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência social, proteção à maternidade e à infância, assistência aos desamparados.
Art. 37. Princípios da administração pública: legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE).
Art. 93. Independência do Judiciário. Motivação obrigatória das decisões judiciais sob pena de nulidade.
Art. 102. STF: guarda da Constituição, controle de constitucionalidade.
Art. 105. STJ: uniformização da interpretação da lei federal.
Art. 129. Funções do Ministério Público: titular da ação penal pública; promover inquérito civil; zelar pelo patrimônio público; defesa da ordem jurídica e dos interesses sociais.`,
  },
  {
    nome: 'Código de Defesa do Consumidor — Lei 8.078/1990',
    urn: 'urn:lex:br:federal:lei:1990-09-11;8078',
    dataVigencia: '1991-03-11',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 8.078/1990 — Código de Defesa do Consumidor (CDC). Vigência a partir de 11/03/1991.
Art. 2º Consumidor: pessoa física ou jurídica que adquire ou utiliza produto ou serviço como destinatário final. Equipara-se: coletividade exposta às práticas abusivas.
Art. 3º Fornecedor: pessoa física ou jurídica que desenvolve atividades de produção, montagem, criação, construção, transformação, importação, exportação, distribuição ou comercialização de produtos ou prestação de serviços.
Art. 6º Direitos básicos do consumidor: proteção da vida e saúde; educação e divulgação sobre consumo; informação adequada e clara; proteção contra publicidade enganosa e abusiva; proteção contratual; reparação de danos; acesso a órgãos judiciários e administrativos; facilitação da defesa dos direitos em juízo.
Art. 12. Responsabilidade objetiva do fabricante, produtor, construtor e importador pelos danos causados por defeitos nos produtos (responsabilidade pelo fato do produto).
Art. 14. Responsabilidade objetiva do fornecedor de serviços por defeitos relativos à prestação dos serviços (fato do serviço). Excludentes: culpa exclusiva do consumidor ou de terceiro.
Art. 17. Bystander (terceiros): equiparam-se aos consumidores as vítimas do evento danoso.
Art. 18. Vício do produto: fornecedores respondem solidariamente pelos vícios de qualidade ou quantidade que tornem os produtos impróprios ou inadequados ao consumo.
Art. 30. Oferta e publicidade: obriga o fornecedor que a fizer veicular. Princípio da vinculação da oferta.
Art. 42. Cobrança de dívidas: vedado expor o consumidor a ridículo, nem submetê-lo a constrangimento, ameaça, coação ou violência.
Art. 49. Direito de arrependimento: 7 dias para desistir de contratações feitas fora do estabelecimento comercial (inclusive internet).
Art. 51. Cláusulas abusivas: nulas de pleno direito as que impossibilitem, exonerem ou atenuem responsabilidade do fornecedor; as que subtraiam a opção de reembolso; as que estabeleçam obrigações iníquas ao consumidor.`,
  },
  {
    nome: 'Consolidação das Leis do Trabalho — Decreto-Lei 5.452/1943',
    urn: 'urn:lex:br:federal:decreto.lei:1943-05-01;5452',
    dataVigencia: '1943-11-10',
    dataRevogacao: '9999-12-31',
    texto: `Decreto-Lei nº 5.452/1943 — Consolidação das Leis do Trabalho (CLT). Vigente com alterações pela Reforma Trabalhista (Lei 13.467/2017).
Art. 2º Empregador: empresa individual ou coletiva que, assumindo os riscos da atividade econômica, admite, assalaria e dirige a prestação pessoal de serviço. Responsabilidade solidária entre empresas do mesmo grupo econômico.
Art. 3º Empregado: pessoa física que presta serviços de natureza não eventual a empregador, sob dependência e mediante salário. Sem distinção quanto à natureza do trabalho.
Art. 9º Nulos os atos praticados com o objetivo de desvirtuar, impedir ou fraudar a aplicação da CLT.
Art. 58. Duração do trabalho: 8 horas diárias e 44 horas semanais. Não computado no horário normal o tempo de deslocamento (Súmula 429 TST).
Art. 59. Horas extras: máximo 2 horas/dia mediante acordo escrito, convenção ou acordo coletivo. Adicional mínimo de 50% (CF art. 7º, XVI).
Art. 443. Contrato de trabalho: pode ser por prazo determinado ou indeterminado. Contrato por prazo determinado não pode exceder 2 anos.
Art. 477. Rescisão: comunicação à SRTE; anotação na CTPS; pagamento das verbas rescisórias em até 10 dias após o término do contrato.
Art. 487. Aviso prévio: mínimo de 30 dias. Por tempo de serviço: 3 dias por ano trabalhado, até o máximo de 60 dias (total: 90 dias).
Art. 482. Justa causa: ato de improbidade; incontinência de conduta; negociação habitual por conta própria; condenação criminal; desídia; embriaguez habitual; violação de segredo; indisciplina; abandono de emprego.
Art. 492. Estabilidade decenal: empregado com mais de 10 anos de serviço só pode ser dispensado por justa causa ou força maior, mediante inquérito judicial.`,
  },
  {
    nome: 'Código Civil — Lei 10.406/2002',
    urn: 'urn:lex:br:federal:lei:2002-01-10;10406',
    dataVigencia: '2003-01-11',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 10.406/2002 — Código Civil Brasileiro. Vigência a partir de 11/01/2003.
Art. 1º Toda pessoa é capaz de direitos e deveres na ordem civil (personalidade jurídica).
Art. 2º Personalidade civil começa com o nascimento com vida. Lei protege o nascituro desde a concepção.
Art. 104. Validade do negócio jurídico: agente capaz; objeto lícito, possível, determinado ou determinável; forma prescrita ou não defesa em lei.
Art. 138. Anulabilidade por vício de consentimento: erro, dolo, coação, estado de perigo, lesão e fraude contra credores.
Art. 186. Ato ilícito: quem por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem fica obrigado a repará-lo, ainda que exclusivamente moral.
Art. 187. Abuso de direito: ato ilícito quando titular de direito excede manifestamente os limites impostos por sua finalidade econômica ou social, pela boa-fé ou pelos bons costumes.
Art. 206. Prescrição em 3 anos: reparação civil; prestação alimentar; honorários profissionais; pretensão do vencedor sobre o vencido na lide. Prescrição em 10 anos: prescrição ordinária.
Art. 421. Liberdade contratual limitada pela função social do contrato. Princípio da boa-fé objetiva (art. 422).
Art. 927. Obrigação de reparar dano decorrente de ato ilícito. Responsabilidade objetiva nas atividades de risco (parágrafo único).
Art. 944. Indenização mede-se pela extensão do dano. Redução equitativa quando culpa levíssima e dano excessivo.
Art. 1.228. Direito de propriedade: usar, gozar e dispor; reaver da posse de quem injustamente detenha ou possua.`,
  },
  {
    nome: 'Código de Processo Civil — Lei 13.105/2015',
    urn: 'urn:lex:br:federal:lei:2015-03-16;13105',
    dataVigencia: '2016-03-18',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 13.105/2015 — Código de Processo Civil (CPC/2015). Vigência a partir de 18/03/2016.
Art. 1º Processo civil ordenado conforme valores e normas fundamentais da CF/88.
Art. 5º Boa-fé processual: todos que participam do processo devem comportar-se conforme a boa-fé.
Art. 10. Princípio da não surpresa: vedado ao juiz decidir com base em fundamento sobre o qual as partes não tiveram oportunidade de se manifestar.
Art. 139. Poderes do juiz: zelar pela duração razoável; prevenir ou reprimir atos contrários à dignidade da justiça; determinar medidas indutivas, coercitivas, mandamentais ou sub-rogatórias.
Art. 190. Negócios jurídicos processuais: partes capazes podem estipular mudanças no procedimento, excluir litisconsórcio, convencionar calendário processual.
Art. 489. Elementos essenciais da sentença: relatório, fundamentos (art. 93 IX CF — motivação das decisões) e dispositivo. Nula a sentença que deixar de examinar fundamento capaz de alterar a conclusão.
Art. 927. Súmulas e precedentes vinculantes: STF em controle concentrado; enunciados de súmula vinculante; acórdãos em IRDR; acórdãos em recursos repetitivos; enunciados de súmula do STF e STJ.
Art. 966. Ação rescisória: cabível quando decisão de mérito transitada em julgado for proferida por juiz absolutamente incompetente, resultar de corrupção do juiz, ofender coisa julgada ou violar manifestamente norma jurídica.`,
  },
  {
    nome: 'Código de Processo Penal — Decreto-Lei 3.689/1941',
    urn: 'urn:lex:br:federal:decreto.lei:1941-10-03;3689',
    dataVigencia: '1942-01-01',
    dataRevogacao: '9999-12-31',
    texto: `Decreto-Lei nº 3.689/1941 — Código de Processo Penal (CPP). Vigente com alterações.
Art. 1º Processo penal regido pelo CPP em todo o território nacional; aplicando-se subsidiariamente os princípios gerais de direito.
Art. 4º Polícia judiciária: exercida pelas autoridades policiais; finalidade de apuração das infrações penais e de sua autoria; DEPEN subordinado ao MP no que tange à destinação das investigações.
Art. 5º Inquérito policial: de ofício; mediante requisição da autoridade judiciária ou do MP; ou a requerimento da vítima.
Art. 157. Prova ilícita: inadmissível, devendo ser desentranhada do processo. Teoria dos frutos da árvore envenenada (prova derivada também inadmissível). Exceção: prova derivada obtida de fonte independente.
Art. 302. Flagrante delito: está cometendo a infração; acabou de cometê-la; é perseguido logo após; é encontrado logo depois com instrumentos do crime.
Art. 310. Audiência de custódia: ao receber auto de prisão em flagrante, juiz deve, em 24 horas: relaxar prisão ilegal; converter em preventiva; ou conceder liberdade provisória.
Art. 312. Prisão preventiva: decretada quando necessária para garantia da ordem pública, da instrução criminal, para assegurar a aplicação da lei penal. Requer prova da existência do crime e indício suficiente de autoria.
Art. 380. Tribunal do Júri: competente para crimes dolosos contra a vida (homicídio doloso, feminicídio qualificado, infanticídio, aborto).`,
  },
  {
    nome: 'Lei de Improbidade Administrativa — Lei 8.429/1992 (com redação da Lei 14.230/2021)',
    urn: 'urn:lex:br:federal:lei:1992-06-02;8429',
    dataVigencia: '1992-06-02',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 8.429/1992 — Lei de Improbidade Administrativa. Alterada substancialmente pela Lei 14.230/2021.
Art. 1º Sistema de responsabilização por atos de improbidade: tutela a probidade na organização do Estado e no exercício de suas funções. Exige dolo específico do agente; não há mais responsabilidade por culpa.
Art. 9º Enriquecimento ilícito: recebimento de qualquer vantagem patrimonial indevida em razão do exercício de cargo, mandato, função, emprego ou atividade pública. Inclui percepção de comissão, percentagem, gratificação ou presente de quem tenha interesse em ato do agente.
Art. 10. Lesão ao erário: ação ou omissão dolosa que acarrete perda, desvio, apropriação, malbaratamento ou dilapidação dos bens públicos ou que cause dano ao erário. Exige elemento subjetivo doloso.
Art. 11. Atentado contra os princípios da administração pública: ação ou omissão dolosa que viole deveres de honestidade, de imparcialidade e de legalidade.
Art. 12. Sanções: perda dos bens ou valores acrescidos ilicitamente ao patrimônio; ressarcimento integral do dano; perda da função pública; suspensão dos direitos políticos; pagamento de multa civil; proibição de contratar com o Poder Público.
Art. 17. Ação de improbidade: promovida exclusivamente pelo MP (após EC 111/2021). Prescrição: 8 anos a partir da ocorrência do ato.`,
  },
  {
    nome: 'Lei Maria da Penha — Lei 11.340/2006',
    urn: 'urn:lex:br:federal:lei:2006-08-07;11340',
    dataVigencia: '2006-09-22',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 11.340/2006 — Lei Maria da Penha — Violência Doméstica e Familiar contra a Mulher.
Art. 1º Cria mecanismos para coibir e prevenir a violência doméstica e familiar contra a mulher; dispõe sobre criação dos JVDFMs (Juizados de Violência Doméstica e Familiar contra a Mulher).
Art. 5º Violência doméstica e familiar: qualquer ação ou omissão baseada no gênero que cause morte, lesão, sofrimento físico, sexual ou psicológico e dano moral ou patrimonial; em âmbito de unidade doméstica, familiar ou em relação íntima de afeto.
Art. 7º Formas de violência: física; psicológica; sexual; patrimonial (subtração de bens, valores, direitos, recursos econômicos); moral (calúnia, difamação, injúria).
Art. 16. Renúncia à representação: só admitida perante o juiz em audiência especialmente designada, antes do recebimento da denúncia, ouvido o MP.
Art. 22. Medidas protetivas de urgência ao agressor: suspensão da posse ou restrição do porte de armas; afastamento do lar; proibição de aproximação e contato; restrição ou suspensão de visitas aos filhos; prestação de alimentos provisionais.
Art. 41. Inaplicabilidade da Lei 9.099/1995 (JECrim) aos crimes praticados com violência doméstica e familiar contra a mulher, independentemente da pena.
Súmula 600 STJ: Para configuração da violência doméstica e familiar, não é necessário que a vítima e o agressor coabitem ou sejam parentes.`,
  },
  {
    nome: 'Estatuto da Criança e do Adolescente — Lei 8.069/1990',
    urn: 'urn:lex:br:federal:lei:1990-07-13;8069',
    dataVigencia: '1990-10-14',
    dataRevogacao: '9999-12-31',
    texto: `Lei nº 8.069/1990 — Estatuto da Criança e do Adolescente (ECA).
Art. 1º Proteção integral à criança (até 12 anos incompletos) e ao adolescente (12 a 18 anos).
Art. 3º Direitos fundamentais: inerentes à pessoa humana, com prioridade absoluta, em condições de liberdade e dignidade, para o pleno desenvolvimento físico, mental, moral, espiritual e social.
Art. 4º Responsabilidade solidária: família, comunidade, sociedade em geral e poder público asseguram direitos com absoluta prioridade. Primazia de receber socorro; primazia de receber proteção e socorro em quaisquer circunstâncias.
Art. 13. Comunicação obrigatória ao Conselho Tutelar nos casos de suspeita ou confirmação de castigo físico, tratamento cruel ou degradante ou maus-tratos.
Art. 98. Medidas de proteção aplicáveis quando direitos forem ameaçados ou violados por ação ou omissão da sociedade ou do Estado; por falta, omissão ou abuso dos pais ou responsável; ou em razão da conduta da própria criança ou adolescente.
Art. 112. Medidas socioeducativas (adolescente infrator): advertência; obrigação de reparar o dano; prestação de serviços à comunidade; liberdade assistida; semiliberdade; internação.
Art. 136. Atribuições do Conselho Tutelar: atender crianças e adolescentes e aplicar medidas de proteção; atender e aconselhar os pais ou responsável; promover execução de suas decisões.
Art. 241-A. Crime: oferecer, trocar, disponibilizar, transmitir, distribuir, publicar ou divulgar, por qualquer meio, fotografia, vídeo ou registro de cena de sexo explícito ou pornográfica envolvendo criança ou adolescente.`,
  },
]
