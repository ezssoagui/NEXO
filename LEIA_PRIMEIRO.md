# NEXO — pacote único para Claude Code

Extraia todos os arquivos diretamente na pasta NEXO1 aberta no VS Code. Se existir código, não sobrescreva sem revisão. Confirme que CLAUDE.md aparece na raiz. Copie o conteúdo de `INICIAR_CLAUDE.txt` e envie no Claude Code. O agente deve ler PROMPT_MESTRE.md e os demais arquivos, construir por fases, testar e atualizar o estado do projeto.

## O que já está aqui
- Documento Mestre v1.0 (15 etapas/166 subtópicos), instruções permanentes, prompt, critérios de aceitação e decisões técnicas.
- Cartilha de redação Inep 2026, cartilha UFES fornecida pelo usuário (restrita), duas referências visuais de dashboard e síntese pedagógica original do Study AI.
- Script para baixar a matriz oficial do Inep, fontes oficiais de provas e microdados para o futuro importador, manifesto de arquivos e regras para evitar publicação de fontes locais.

## Limites reais
Não foi possível recuperar os PDFs binários originais do Study AI, nem baixar a matriz no ambiente de preparação. A síntese e o script permitem iniciar o desenvolvimento sem adicionar manualmente arquivos agora. Referências incompletas, autorização de conteúdo e importação do acervo são pendências de validação, não requisitos já implementados. Não reproduzir conteúdo privado nem enviá-lo a fornecedores sem autorização apropriada. O kit não contém código funcional do sistema, credenciais, banco de questões importado ou preços comerciais aprovados. O agente deverá solicitar permissão para operações pagas, integrações externas sensíveis e publicação; nunca inserir chaves no chat ou no Git.

Para retomar uma sessão, diga: Leia CLAUDE.md e docs/ESTADO_DO_PROJETO.md, confira a matriz de rastreabilidade e continue a próxima tarefa pendente do PROMPT_MESTRE.md, testando e atualizando o estado.
