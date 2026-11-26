# Design system
> Desdobramento técnico do Documento Mestre v1.0 (fonte de verdade). Em caso de conflito, prevalece o mestre. Referências no formato etapa.subtópico.

- **Tokens (10.3/10.4):** `src/app/globals.css` — azul #2563EB (primária), #0F172A (contraste), #0D9488 (evolução), #D97706 (conquistas); temas claro/escuro/automático via `data-theme`, persistidos em cookie e preferências.
- **Componentes:** `src/components/ui.tsx` (Button, Card, Badge, Input, Textarea, Select, Tabs, Modal `<dialog>`, Progress, Stat, Empty/Error/Loading), `question-view.tsx`, `liquid.tsx`, `study.tsx`, `app-shell.tsx`, `markdown.tsx` (sem HTML do conteúdo).
- **Navegação (10.1/10.8):** seis seções; barra lateral no desktop, menu inferior no celular; busca Ctrl+K; modo foco em sessão, simulado e redação.
- **Acessibilidade (10.9):** link "pular para o conteúdo", foco visível, rótulos, `role=radiogroup` nas alternativas, teclas A–E, números junto às cores, `prefers-reduced-motion`. Pendente: auditoria completa e testes com estudantes.
- **Minimalismo (10.10):** detalhes por expansão; sem gráficos repetidos no dashboard; nada de gamificação durante estudo.
- **Pendente:** logo, tipografia e slogan definitivos.
