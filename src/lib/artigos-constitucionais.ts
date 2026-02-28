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
