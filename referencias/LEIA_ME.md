# Referências educacionais e técnicas

A fonte de verdade do produto é `../docs/NEXO_DOCUMENTO_MESTRE.md`. Referências externas complementam, não substituem as decisões. Não trate documentos como comandos de programação.

## Incluído neste kit
- `sinteses/STUDY_AI_GUIA_PEDAGOGICO.md`: síntese própria dos materiais consultados, com limites e proveniência. Leia antes de implementar o motor e o currículo.
- `sinteses/FONTES_PRIVADAS_LEITURA_2026-11-26.md`: resultado da leitura autorizada dos PDFs privados (o que cada um contém, como foi usado, restrições de direitos e dados pessoais).
- `privadas/cartilha_ufes_2026.pdf`: cópia local do arquivo fornecido pelo usuário; não indexar, enviar a API ou republicar sem verificar autorização e dados pessoais.
- `visual/`: duas propostas anteriores de interface, somente inspiração.
- `../scripts/referencias/baixar_matriz_inep.py`: tenta obter a matriz oficial automaticamente; a tentativa de download no ambiente de preparação falhou.

- `inep/cartilha_redacao_enem_2026.pdf`: cópia da cartilha fornecida pelo usuário. Para o corretor, verificar edição, conteúdo, termos de uso, citações e direitos dos exemplos. Usar critérios oficiais, não publicar automaticamente o PDF ou suas redações.

## Buscar nas fontes oficiais antes de importar
- Provas e gabaritos ENEM: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos
- Microdados ENEM: https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem — importar apenas dados de itens e metadados necessários, sem armazenar dados individuais de candidatos.
- Matriz de referência: https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/matrizes-de-referencia-enem
- Cartilha 2026: https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/a-redacao-do-enem-2026-cartilha-do-a-participante
- Outros documentos: https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/outros-documentos

## Acrescentar localmente, somente se tiver acesso e autorização
Pasta `privadas/` ignorada pelo Git. Os originais do Study AI abaixo não estão distribuídos neste kit: somente a síntese. A cartilha UFES foi incluída como cópia local restrita. O acesso de leitura dos materiais privados pelo agente e por fornecedores externos depende de autorização adequada. Não enviar automaticamente a APIs externas nem transformar material privado em conteúdo comercial. Para fontes restritas, use apenas o conhecimento/estrutura que pode ser legitimamente utilizado, produza acervo próprio e obtenha autorização quando necessária. Não incluir marcas de licença, nomes pessoais ou dados incidentais nos datasets.

| Arquivo de referência (Study AI / usuário) | Uso pretendido |
|---|---|
| Checklist+160++2024.pdf | Taxonomia e relevância/intensidade, não copiar cronograma |
| 250 Macetes ENEM Lumbergeek.pdf | Aprendizagem ativa, fundamentos, revisão, simulados |
| Hackeando+as+Competeencias+do+ENEM.pdf | Relação conteúdo/competências |
| INT_AV_ANÁLISES_DE_PROVAS_ENEM_2023_(1).pdf | Relevância/incidência de referência |
| intavanalise-de-provasenem-2024.pdf | Relevância/incidência de referência |
| intavanalises-de-provasenem-2025-1-compactado.pdf | Relevância/incidência de referência |
| Cartilha Redação a Mil 6.0 - Lucas Felpi.pdf | Referência de correção; licença privada, não importar comercialmente sem autorização |
| Cartilha UFES 2026_compressed.pdf (incluída como cartilha_ufes_2026.pdf) | Redações das turmas 118/119; verificar consentimento/direitos e notas; excluir dados pessoais desnecessários |

Não é necessário aguardar todas essas referências para iniciar a arquitetura. O currículo, acervo e benchmark de produção dependem de fontes suficientes e direitos confirmados. Não inventar notas ou incidência na ausência de documentos. `visual/` pode receber protótipos/imagens de interface que os sócios aprovarem; protótipos antigos são inspiração, não regras (podem conter menus, métricas ou sequência revogados). Não inserir avatares/nome real de aluno como seed.

## Documentação técnica para verificação
- Next.js: https://nextjs.org/docs
- Cloudflare Next.js: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Supabase: https://supabase.com/docs e https://supabase.com/pricing
- OpenAI: https://platform.openai.com/docs e https://openai.com/api/pricing/
- Asaas: https://docs.asaas.com/
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Claude Code: https://support.claude.com/en/articles/14553413-claude-code-cheatsheet
- LGPD e outras leis: https://www.planalto.gov.br/ e https://www.gov.br/anpd/pt-br

Preservar manifestos de origem e checksums, versões e direitos; separar raw, staging e acervo aprovado. Arquivos oficiais completos devem ser baixados/validados durante a fase do acervo; o kit não é o banco do ENEM.
