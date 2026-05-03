# Design System — IurisPrudentIA

## Estilo visual

- Interface jurídica profissional: limpa, sóbria, de alta confiabilidade
- Minimalista sem ser fria — transmite autoridade e precisão
- Hierarquia visual clara: resultado → score → fontes → parecer
- Espaçamento generoso — evitar densidade que dificulte leitura de texto jurídico longo
- Responsiva: mobile-first, mas otimizada para desktop (onde advogados trabalham)

---

## UI stack

- Tailwind CSS 3.4
- shadcn/ui (base de todos os componentes)
- lucide-react para ícones
- framer-motion para animações de transição (SSE streaming, loading states)

---

## Componentes existentes

### `ConfidenceBadge`
Exibe o grau de confiança da análise (0–100):
- `alta` (75–100): badge verde — análise com evidências sólidas
- `media` (50–74): badge amarelo — análise com evidências moderadas
- `baixa` (0–49): badge vermelho — análise com evidências insuficientes

Sempre exibido ao lado do parecer gerado e dos resultados de busca.

### `EprocResultCard`
Card de resultado de busca jurisprudencial:
- Ementa (texto completo)
- Tribunal + relator + data de julgamento
- Badge de confiança (`rerankScore`)
- Fonte da busca (datajud_cnj, base_interna, lexml, stj_dados_abertos)
- Indicador "já utilizado" se o precedente já está na base de conhecimento do usuário

### `Skeleton`
Placeholder de loading para cards e blocos de texto durante streaming SSE.

---

## Editor rich text — `LegalEditor` ✅ implementado

`src/components/ui/LegalEditor.tsx` — editor WYSIWYG completo para redação do parecer.

**Biblioteca**: TipTap 3.x (ProseMirror)  
**Extensões ativas**: StarterKit, Underline, TextAlign, Placeholder, CharacterCount  
**Estilos**: `.ProseMirror` definido em `globals.css` (sem @tailwindcss/typography)

**API via ref** (`LegalEditorRef`):
- `insertContent(text)` — formata como citação jurídica (`<p><strong>header</strong></p><blockquote>…</blockquote>`) + flash de confirmação via classe CSS `.editor-insert-flash`
- `getHTML()` — retorna HTML para persistência em Firestore
- `getText()` — texto plano
- `getWordCount()` — contagem de palavras
- `isEmpty()` — verifica se editor está vazio

**Toolbar**: Bold, Italic, Underline, H1, H2, Citação (blockquote), BulletList, OrderedList, Undo, Redo, Exportar

**Exportação**: abre janela de impressão com print stylesheet jurídico (Georgia, margens ABNT)

**Rodapé**: palavras · caracteres em tempo real

**Flash de inserção**: classe `.editor-insert-flash` (CSS puro — `box-shadow indigo`, 500ms) — evita conflito com classes Tailwind dinâmicas não geradas em build

**Integração de conteúdo salvo (Firestore)**:
- `initialContent` é o HTML do `teseFinal` já salvo
- `useEffect` carrega o conteúdo no editor apenas se `editor.isEmpty` — não sobrescreve edições do usuário

**Estados implícitos**:
- `idle`: placeholder cinza visível, aguardando análise
- `inserting`: flash de anel azul ao receber texto via `insertContent`
- `editing`: digitação livre — `onChange` sincroniza `editorContent` no pai automaticamente
- `saving/saved`: gerenciado pela página pai via `ref.getHTML()`

---

## Regras de UI

- Usar shadcn/ui como base — nunca criar do zero o que já existe (`Button`, `Card`, `Dialog`, `Badge`, `Tabs`, `Sheet`, `Skeleton`).
- Componentes acessíveis — aria-labels em todos os elementos interativos.
- Estados obrigatórios em todo componente: `loading`, `empty`, `error`, `success`.
- Formulários validados com feedback inline — nunca só toast genérico.
- Ações destrutivas (excluir processo, limpar base) exigem Dialog de confirmação.

---

## Estados específicos de streaming SSE

O pipeline de análise emite chunks em tempo real. A UI deve lidar com:

| Evento SSE | Ação da UI |
|-----------|------------|
| `metadata` | Exibe metadados do processo extraído |
| `results` | Renderiza EprocResultCards com animação de entrada |
| `justification` | Inicia streaming do texto do parecer no editor (typewriter) |
| `complete` | Exibe ConfidenceBadge final, habilita botões de salvar/download |
| `error` | Toast de erro + mensagem explicativa + botão de retry |

Nunca exibir um spinner genérico durante o pipeline — cada fase deve ter feedback visual distinto.

---

## Padrão visual

- Bordas arredondadas (`rounded-lg` como padrão, `rounded-2xl` para cards principais)
- Sombras leves (`shadow-sm` para cards, sem sombra pesada)
- Tipografia: `font-serif` para texto jurídico longo, `font-sans` para interface
- Cores jurídicas: azul marinho (#1e3a5f) como primária, branco como fundo, cinza claro para separadores
- Botões com feedback visual obrigatório (`disabled` durante loading, estado `success` após ação)
- Formulários simples — uma coluna, labels descritivos, mensagem de erro inline
