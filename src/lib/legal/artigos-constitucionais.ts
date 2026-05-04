// Artigos constitucionais mais citados – CF/88
// Fonte: Constituição Federal de 1988

export interface ArtigoConstitucional {
  id: string
  titulo: string
  texto: string
  tema: string
}

export const ARTIGOS_CONSTITUCIONAIS: ArtigoConstitucional[] = [
  { id: 'art5', titulo: 'Art. 5º - Direitos e Garantias Fundamentais', tema: 'Direitos fundamentais', texto: 'Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes: [...] (incisos I a LXXVIII)' },
  { id: 'art5-XXXV', titulo: 'Art. 5º, XXXV - Inafastabilidade da jurisdição', tema: 'Acesso à Justiça', texto: 'A lei não excluirá da apreciação do Poder Judiciário lesão ou ameaça a direito.' },
  { id: 'art5-XXXVII', titulo: 'Art. 5º, XXXVII - Princípio da legalidade', tema: 'Direitos fundamentais', texto: 'Não haverá juízo ou tribunal de exceção.' },
  { id: 'art5-XXXIX', titulo: 'Art. 5º, XXXIX - Legalidade penal', tema: 'Direito Penal', texto: 'Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.' },
  { id: 'art5-LIII', titulo: 'Art. 5º, LIII - Presunção de inocência', tema: 'Direito Penal', texto: 'Ninguém será processado nem sentenciado senão pela autoridade competente.' },
  { id: 'art5-LV', titulo: 'Art. 5º, LV - Contraditório e ampla defesa', tema: 'Processo', texto: 'Aos litigantes, em processo judicial ou administrativo, e aos acusados em geral são assegurados o contraditório e ampla defesa, com os meios e recursos a ela inerentes.' },
  { id: 'art5-LXXVIII', titulo: 'Art. 5º, LXXVIII - Duração razoável do processo', tema: 'Processo', texto: 'A todos, no âmbito judicial e administrativo, são assegurados a razoável duração do processo e os meios que garantam a celeridade de sua tramitação.' },
  { id: 'art6', titulo: 'Art. 6º - Direitos sociais', tema: 'Direitos sociais', texto: 'São direitos sociais a educação, a saúde, a alimentação, o trabalho, a moradia, o transporte, o lazer, a segurança, a previdência social, a proteção à maternidade e à infância, a assistência aos desamparados, na forma desta Constituição.' },
  { id: 'art7', titulo: 'Art. 7º - Direitos dos trabalhadores', tema: 'Direito do Trabalho', texto: 'São direitos dos trabalhadores urbanos e rurais, além de outros que visem à melhoria de sua condição social: [...] (incisos I a XXXIV)' },
  { id: 'art37', titulo: 'Art. 37 - Princípios da Administração Pública', tema: 'Direito Administrativo', texto: 'A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência.' },
  { id: 'art93', titulo: 'Art. 93 - Garantias da magistratura', tema: 'Judiciário', texto: 'Lei complementar, de iniciativa do Supremo Tribunal Federal, disporá sobre o Estatuto da Magistratura, observados os princípios da inamovibilidade e da vitaliciedade.' },
  { id: 'art102', titulo: 'Art. 102 - Competência do STF', tema: 'Judiciário', texto: 'Compete ao Supremo Tribunal Federal, precipuamente, a guarda da Constituição, cabendo-lhe: I - processar e julgar, originariamente: a) a ação direta de inconstitucionalidade de lei ou ato normativo federal ou estadual [...]' },
  { id: 'art105', titulo: 'Art. 105 - Competência do STJ', tema: 'Judiciário', texto: 'Compete ao Superior Tribunal de Justiça: I - processar e julgar, originariamente: [...] II - julgar, em recurso ordinário: [...] III - julgar, em recurso especial, as causas decididas, em única ou última instância [...]' },
  { id: 'art129', titulo: 'Art. 129 - Funções institucionais do MP', tema: 'Ministério Público', texto: 'São funções institucionais do Ministério Público: I - promover, privativamente, a ação penal pública [...] II - zelar pelo efetivo respeito dos Poderes Públicos e dos serviços de relevância pública aos direitos assegurados nesta Constituição [...]' },
  { id: 'art133', titulo: 'Art. 133 - Advocacia', tema: 'OAB', texto: 'O advogado é indispensável à administração da justiça, sendo inviolável por seus atos e manifestações no exercício da profissão, nos limites da lei.' },
  { id: 'art170', titulo: 'Art. 170 - Ordem econômica', tema: 'Direito Econômico', texto: 'A ordem econômica, fundada na valorização do trabalho humano e na livre iniciativa, tem por fim assegurar a todos existência digna, conforme os ditames da justiça social, observados os princípios: I - soberania nacional; II - propriedade privada; III - função social da propriedade; IV - livre concorrência; V - defesa do consumidor; VI - defesa do meio ambiente; VII - redução das desigualdades regionais e sociais; VIII - busca do pleno emprego; IX - tratamento favorecido para as empresas de pequeno porte.' },
  { id: 'art196', titulo: 'Art. 196 - Direito à saúde', tema: 'Saúde', texto: 'A saúde é direito de todos e dever do Estado, garantido mediante políticas sociais e econômicas que visem à redução do risco de doença e de outros agravos e ao acesso universal e igualitário às ações e serviços para sua promoção, proteção e recuperação.' },
  { id: 'art205', titulo: 'Art. 205 - Direito à educação', tema: 'Educação', texto: 'A educação, direito de todos e dever do Estado e da família, será promovida e incentivada com a colaboração da sociedade, visando ao pleno desenvolvimento da pessoa, seu preparo para o exercício da cidadania e sua qualificação para o trabalho.' },
  { id: 'art225', titulo: 'Art. 225 - Meio ambiente', tema: 'Meio Ambiente', texto: 'Todos têm direito ao meio ambiente ecologicamente equilibrado, bem de uso comum do povo e essencial à sadia qualidade de vida, impondo-se ao Poder Público e à coletividade o dever de defendê-lo e preservá-lo para as presentes e futuras gerações.' },
  { id: 'art226', titulo: 'Art. 226 - Família', tema: 'Família', texto: 'A família, base da sociedade, tem especial proteção do Estado.' },
  { id: 'art1', titulo: 'Art. 1º - Fundamentos da República', tema: 'Princípios fundamentais', texto: 'A República Federativa do Brasil, formada pela união indissolúvel dos Estados e Municípios e do Distrito Federal, constitui-se em Estado Democrático de Direito e tem como fundamentos: I - a soberania; II - a cidadania; III - a dignidade da pessoa humana; IV - os valores sociais do trabalho e da livre iniciativa; V - o pluralismo político.' },
  { id: 'art2', titulo: 'Art. 2º - Separação dos Poderes', tema: 'Princípios fundamentais', texto: 'São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.' },
  { id: 'art3', titulo: 'Art. 3º - Objetivos fundamentais', tema: 'Princípios fundamentais', texto: 'Constituem objetivos fundamentais da República Federativa do Brasil: I - construir uma sociedade livre, justa e solidária; II - garantir o desenvolvimento nacional; III - erradicar a pobreza e a marginalização e reduzir as desigualdades sociais e regionais; IV - promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação.' },
  { id: 'art5-II', titulo: 'Art. 5º, II - Princípio da legalidade', tema: 'Direitos fundamentais', texto: 'Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei.' },
  { id: 'art5-X', titulo: 'Art. 5º, X - Intimidade e vida privada', tema: 'Direitos fundamentais', texto: 'São invioláveis a intimidade, a vida privada, a honra e a imagem das pessoas, assegurado o direito a indenização pelo dano material ou moral decorrente de sua violação.' },
  { id: 'art5-XXXVI', titulo: 'Art. 5º, XXXVI - Direito adquirido', tema: 'Direitos fundamentais', texto: 'A lei não prejudicará o direito adquirido, o ato jurídico perfeito e a coisa julgada.' },
  { id: 'art5-LIV', titulo: 'Art. 5º, LIV - Devido processo legal', tema: 'Processo', texto: 'Ninguém será privado da liberdade ou de seus bens sem o devido processo legal.' },
  { id: 'art5-LVII', titulo: 'Art. 5º, LVII - Presunção de inocência', tema: 'Direito Penal', texto: 'Ninguém será considerado culpado até o trânsito em julgado de sentença penal condenatória.' },
  { id: 'art14', titulo: 'Art. 14 - Soberania popular', tema: 'Direitos políticos', texto: 'A soberania popular será exercida pelo sufrágio universal e pelo voto direto e secreto, com valor igual para todos, e, nos termos da lei, mediante: I - plebiscito; II - referendo; III - iniciativa popular.' },
  { id: 'art22', titulo: 'Art. 22 - Competência privativa da União', tema: 'Organização do Estado', texto: 'Compete privativamente à União legislar sobre: I - direito civil, comercial, penal, processual, eleitoral, agrário, marítimo, aeronáutico, espacial e do trabalho [...]' },
  { id: 'art109', titulo: 'Art. 109 - Competência da Justiça Federal', tema: 'Judiciário', texto: 'Aos juízes federais compete processar e julgar: I - as causas em que a União, entidade autárquica ou empresa pública federal forem interessadas na condição de autoras, rés, assistentes ou oponentes [...]' },
  { id: 'art114', titulo: 'Art. 114 - Competência da Justiça do Trabalho', tema: 'Judiciário', texto: 'Compete à Justiça do Trabalho processar e julgar: I - as ações oriundas da relação de trabalho [...]' },
  { id: 'art127', titulo: 'Art. 127 - Ministério Público', tema: 'Ministério Público', texto: 'O Ministério Público é instituição permanente, essencial à função jurisdicional do Estado, incumbindo-lhe a defesa da ordem jurídica, do regime democrático e dos interesses sociais e individuais indisponíveis.' },
  { id: 'art144', titulo: 'Art. 144 - Segurança pública', tema: 'Segurança', texto: 'A segurança pública, dever do Estado, direito e responsabilidade de todos, é exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio [...]' },
  { id: 'art150', titulo: 'Art. 150 - Limitações ao poder de tributar', tema: 'Direito Tributário', texto: 'Sem prejuízo de outras garantias asseguradas ao contribuinte, é vedado à União, aos Estados, ao Distrito Federal e aos Municípios: I - exigir ou aumentar tributo sem lei que o estabeleça; II - instituir tratamento desigual entre contribuintes [...]' },
]

export function searchArtigosConstitucionais(query: string): ArtigoConstitucional[] {
  const q = query.trim().toLowerCase()
  if (!q) return ARTIGOS_CONSTITUCIONAIS
  return ARTIGOS_CONSTITUCIONAIS.filter(
    a =>
      a.titulo.toLowerCase().includes(q) ||
      a.texto.toLowerCase().includes(q) ||
      a.tema.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
  )
}
