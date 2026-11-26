"""Gera docs/MATRIZ_DE_RASTREABILIDADE.md a partir dos títulos do Documento Mestre + mapeamento abaixo.
Status: TESTADO (implementado e coberto por teste automatizado), IMPLEMENTADO (sem teste dedicado),
PARCIAL, PENDENTE (dependência externa/decisão), FUTURO (fora do MVP), REJEITADO (não implementar),
DOCUMENTAL (princípio/decisão refletida no produto, sem artefato executável próprio).
Uso: py scripts/docs/build_matrix.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
U, I, P = 'tests/unit', 'tests/db/services.test.ts', 'tests/db/pgtap.test.ts'
E = 'tests/e2e/flows.spec.ts'

M = {
 '1.1': ('Produto inteiro', '—', 'DOCUMENTAL', ''), '1.2': ('Escopo exclusivo ENEM em todo o código', '—', 'DOCUMENTAL', ''),
 '1.3': ('ESTADO_DO_PROJETO.md', '—', 'DOCUMENTAL', 'Piloto e validação pendentes'), '1.4': ('modules/adaptive-engine', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''),
 '1.5': ('composition.ts (intensidade por relevância/dificuldade)', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''), '1.6': ('mastery/compute.ts curricularIndicators', f'{U}/mastery.test.ts', 'TESTADO', ''),
 '1.7': ('sessões livres, sem bloqueios', f'{E}', 'TESTADO', ''), '1.8': ('services/essays.ts', f'{I}', 'TESTADO', 'IA real pendente'), '1.9': ('Sem promessas na interface; IA só onde definida', '—', 'DOCUMENTAL', ''),
 '2.1': ('priority.ts (exploração sem histórico)', f'{U}/adaptive-engine.test.ts; {I}', 'TESTADO', ''), '2.2': ('exams.createDiagnostic (180, sem cronômetro, retomável)', f'{I}', 'TESTADO', 'Redação diagnóstica = redação livre; vínculo dedicado a refinar'),
 '2.3': ('composition.ts planSession', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''), '2.4': ('questions/rules revealPolicy; listas e simulados', f'{U}/modules.test.ts; {I}; {E}', 'TESTADO', ''),
 '2.5': ('content.submitConceptResponse; prompt concept_eval', f'{I}', 'TESTADO', 'Modelo real a aprovar'), '2.6': ('rules.cpeEligible; questions CPE', f'{U}/modules.test.ts; {I}', 'TESTADO', 'Referências CPE das questões a produzir'),
 '2.7': ('questions.classifyError', f'{U}/modules.test.ts; {I}', 'TESTADO', ''), '2.8': ('priority.ts foco recovery (5/10)', f'{U}/adaptive-engine.test.ts; {I}', 'TESTADO', ''),
 '2.9': ('mastery/compute.ts', f'{U}/mastery.test.ts', 'TESTADO', 'Calibração no piloto'), '2.10': ('reviews/schedule.ts + flashcards/fsrs.ts', f'{U}/modules.test.ts', 'TESTADO', ''),
 '2.11': ('finalStretchBoost; materiais final_review', '—', 'IMPLEMENTADO', 'Datas oficiais do ENEM a cadastrar'), '2.12': ('twins.findEquivalent', f'{U}/modules.test.ts', 'PARCIAL', 'Teste de integração da fila de gêmeas a adicionar'),
 '2.13': ('services/ai.ts (escopo restrito)', f'{I}', 'TESTADO', ''), '2.14': ('learning.processQuestionAnswer', f'{I}', 'TESTADO', ''), '2.15': ('engine_parameter_sets versionado', f'{U}/mastery.test.ts', 'IMPLEMENTADO', 'Fontes privadas não processadas (autorização)'),
 '3.1': ('migração curriculum + curriculum-loader', f'{I}', 'TESTADO', ''), '3.2': ('supabase/seed/curriculum_matriz_v0.json', '—', 'PENDENTE', 'Validação pedagógica dos sócios'),
 '3.3': ('official_competencies/official_skills (120 H)', f'{I}', 'TESTADO', 'Vínculos habilidade interna↔oficial a validar'), '3.4': ('supabase/seed/relevance_v1.json; relevance-loader.ts; scripts/curriculum/build_relevance_v1.py', 'tests/db/relevance.test.ts; scripts/curriculum/test_relevance_v1.py', 'TESTADO', 'Proposta ADR-018: validar regra, limiares e 68 divergências com os sócios'),
 '3.5': ('priority.ts fator dificuldade', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''), '3.6': ('skill_connections + fator conexões', '—', 'IMPLEMENTADO', 'Conexões a cadastrar'),
 '3.7': ('rules.terciles / pipeline.difficulty', f'{U}/modules.test.ts; scripts/import-enem/test_pipeline.py', 'TESTADO', 'Limiares por tercil: proposta ADR-009'), '3.8': ('migração questions + scripts/import-enem', 'scripts/import-enem/test_pipeline.py', 'PARCIAL', 'Download e importação integral do acervo pendentes'),
 '3.9': ('question_tags, classification_status, admin review', f'{I}', 'PARCIAL', 'Lote de classificação assistida a executar'), '3.10': ('scripts/curriculum/build_matriz_v0.py; relevance_v1_data.py (mapeamento Checklist/dossiê)', 'scripts/curriculum/test_relevance_v1.py', 'PARCIAL', 'Subtópicos/habilidades internas a refinar e validar'),
 '3.11': ('curriculum_versions, change_log, trigger anti-exclusão', '—', 'IMPLEMENTADO', ''),
 '4.1': ('onboarding (dados mínimos, idade)', f'{E}', 'TESTADO', ''), '4.2': ('recomendações iniciais de exploração', f'{I}; {E}', 'TESTADO', ''),
 '4.3': ('recommendations.ts + /inicio filtros', f'{I}; {E}', 'TESTADO', ''), '4.4': ('sessions.ts (snapshot, pausa)', f'{I}; {E}', 'TESTADO', ''),
 '4.5': ('composition.questionQuantity', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''), '4.6': ('sessão livre por conteúdo; currículo navegável', f'{E}', 'TESTADO', ''),
 '4.7': ('peso temporal relativo à última evidência', f'{U}/mastery.test.ts', 'TESTADO', ''), '4.8': ('/desempenho + account.performanceOverview', f'{I}', 'TESTADO', ''),
 '4.9': ('/inicio', f'{E}', 'TESTADO', ''), '4.10': ('proximityMultiplier, finalStretchBoost', f'{U}/adaptive-engine.test.ts', 'IMPLEMENTADO', 'Datas e janelas a calibrar'),
 '4.11': ('exams.ts + /simulados', f'{I}; {E}', 'TESTADO', 'Provas oficiais dependem do acervo'),
 '5.1': ('lessons/lesson_blocks + LessonReader', f'{I}', 'PARCIAL', 'Produção do acervo escrito validado'), '5.2': ('questions.searchBank', f'{E}', 'TESTADO', 'Acervo oficial a importar'),
 '5.3': ('questions.createList adaptativa/manual', f'{I}', 'TESTADO', ''), '5.4': ('submitConceptResponse', f'{I}', 'TESTADO', ''),
 '5.5': ('services/twins.ts', f'{U}/modules.test.ts', 'IMPLEMENTADO', 'Geração real depende de IA aprovada'), '5.6': ('content.reviewFlashcard (FSRS)', f'{I}; {E}', 'TESTADO', 'Baralhos curriculares a produzir'),
 '5.7': ('learning.updateErrorNotebook', f'{I}', 'TESTADO', ''), '5.8': ('trigger guard_session_activities', f'{I}', 'TESTADO', ''), '5.9': ('exams.ts', f'{I}; {E}', 'TESTADO', ''),
 '5.10': ('review_evidence (estudo livre satisfaz revisão)', f'{U}/modules.test.ts', 'TESTADO', ''), '5.11': ('content.assembleMaterial', '—', 'IMPLEMENTADO', ''),
 '5.12': ('—', 'Verificado: sem editor de notas', 'REJEITADO', 'Não implementar'), '5.13': ('—', 'Verificado: sem favoritos; repertórios e marcação de simulado são exceções', 'REJEITADO', 'Não implementar'),
 '5.14': ('content.globalSearch + modal Ctrl+K', '—', 'IMPLEMENTADO', ''), '5.15': ('perfil único de evidências', f'{I}', 'TESTADO', ''),
 '6.1': ('essays.submitEssay + validação 0–200/40', f'{U}/modules.test.ts; {I}; {E}', 'TESTADO', 'Modelo superior a aprovar'), '6.2': ('citações verificadas; essayFollowUp', f'{U}/modules.test.ts; {I}', 'TESTADO', ''),
 '6.3': ('rag_documents (rag); modules/essays/benchmark.ts; essay-benchmark.ts; essay_benchmark_runs; extract_cartilha.py', 'tests/unit/essay-benchmark.test.ts; tests/db/essay-benchmark.test.ts', 'PARCIAL', 'Conjunto local: 8 redações UFES (uma faixa); faltam intermediárias/baixas e autorização para envio à API'), '6.4': ('essay_themes/motivator_texts', '—', 'PARCIAL', 'Temas oficiais/inéditos a validar'),
 '6.5': ('essay_theory, essay_exercises, submitDiscursive', '—', 'PARCIAL', 'Conteúdo a produzir'), '6.6': ('submitPartialRewrite; reescrita integral', '—', 'IMPLEMENTADO', 'Adicionar E2E de reescrita'),
 '6.7': ('repertoires + seleção (RLS)', '—', 'IMPLEMENTADO', 'Banco de repertórios a produzir'), '6.8': ('editor com autosave (RLS)', f'{E}', 'TESTADO', ''),
 '6.9': ('essayIndicators', f'{U}/modules.test.ts', 'TESTADO', ''), '6.10': ('franquias essays/rewrites/discursive', f'{I}', 'TESTADO', ''),
 '7.1': ('services/ai.ts finalidades', '—', 'IMPLEMENTADO', ''), '7.2': ('ai_models (aprovação manual)', '—', 'PENDENTE', 'Confirmar IDs, preços e qualidade'),
 '7.3': ('ragContext por filtros; pgvector', '—', 'PARCIAL', 'Embeddings não gerados (custo/autorização)'), '7.4': ('prompt concept_eval + schema', f'{I}', 'TESTADO', ''),
 '7.5': ('validateFullEvaluation; trava essayBenchmarkGate (ADR-019)', f'{U}/modules.test.ts; {I}; tests/db/essay-benchmark.test.ts', 'TESTADO', 'Benchmark real aprovado pendente (bloqueia produção)'), '7.6': ('twins checks + validação independente', f'{U}/modules.test.ts', 'IMPLEMENTADO', ''),
 '7.7': ('sem gabarito/IA antes do envio', f'{E}', 'TESTADO', ''), '7.8': ('runAi retry/validação; franquia liberada', f'{I}', 'TESTADO', ''),
 '7.9': ('quotas + custo por chamada', f'{I}', 'TESTADO', ''), '7.10': ('/admin/ia, prompts versionados, orçamento', '—', 'IMPLEMENTADO', ''),
 '8.1': ('skill_evidence dimensões', f'{U}/mastery.test.ts', 'TESTADO', ''), '8.2': ('combineDimensions', f'{U}/mastery.test.ts', 'TESTADO', ''), '8.3': ('resolução 50/35/15', f'{U}/mastery.test.ts', 'TESTADO', ''),
 '8.4': ('minEvidence por relevância e disponibilidade', f'{U}/mastery.test.ts', 'TESTADO', 'Experimental'), '8.5': ('temporalWeight', f'{U}/mastery.test.ts', 'TESTADO', 'Experimental'),
 '8.6': ('estados e rebaixamento', f'{U}/mastery.test.ts', 'TESTADO', ''), '8.7': ('curricularIndicators', f'{U}/mastery.test.ts; {I}', 'TESTADO', ''),
 '8.8': ('scoreExam (sem TRI)', f'{U}/modules.test.ts; {E}', 'TESTADO', ''), '8.9': ('/desempenho abas e filtros', f'{I}', 'IMPLEMENTADO', ''), '8.10': ('dimensões recolhidas; rule_version', '—', 'IMPLEMENTADO', ''),
 '9.1': ('gamificação individual', '—', 'IMPLEMENTADO', ''), '9.2': ('xp_rules + awardXp', f'{I}', 'TESTADO', ''), '9.3': ('levelFor', f'{U}/modules.test.ts', 'TESTADO', ''),
 '9.4': ('achievements + checkAchievements', '—', 'IMPLEMENTADO', ''), '9.5': ('currentStreak', f'{U}/modules.test.ts', 'TESTADO', ''), '9.6': ('ranking opt-in, menores', f'{I}', 'TESTADO', 'Validação jurídica'),
 '9.7': ('XP idempotente; validação no servidor', f'{I}; {P}', 'TESTADO', ''), '9.8': ('motor não lê XP', '—', 'DOCUMENTAL', ''), '9.9': ('/perfil; nada durante sessões', '—', 'IMPLEMENTADO', ''),
 '10.1': ('components/liquid.tsx + mapa hierárquico', '—', 'IMPLEMENTADO', 'Teste com estudantes'), '10.2': ('/inicio 70/30', f'{E}', 'IMPLEMENTADO', ''),
 '10.3': ('globals.css tokens (paleta preliminar)', '—', 'PARCIAL', 'Logo/tipografia definitivas'), '10.4': ('tema claro/escuro/automático persistido', f'{E}', 'TESTADO', ''),
 '10.5': ('/estudar/sessao modo foco', f'{E}', 'TESTADO', ''), '10.6': ('question-view (vertical/lado a lado, eliminação, zoom)', f'{E}', 'TESTADO', ''),
 '10.7': ('Estudar/Questões abas', '—', 'IMPLEMENTADO', ''), '10.8': ('web responsiva, menu inferior', '—', 'IMPLEMENTADO', 'Validar em protótipo com estudantes'),
 '10.9': ('semântica, foco, contraste, teclado', f'{E}', 'PARCIAL', 'Auditoria de acessibilidade completa'), '10.10': ('minimalismo funcional', '—', 'DOCUMENTAL', ''),
 '11.1': ('—', '—', 'DOCUMENTAL', ''), '11.2': ('—', '—', 'DOCUMENTAL', 'Revisar concorrentes antes do lançamento'), '11.3': ('freemium sem anúncios', '—', 'IMPLEMENTADO', ''),
 '11.4': ('plan_limits Gratuito', f'{I}', 'TESTADO', 'Subconjunto de aulas gratuitas: proposta'), '11.5': ('plan_limits Plus/Pro', f'{I}', 'TESTADO', ''),
 '11.6': ('ai_usage.cost_usd; orçamento', f'{I}', 'PARCIAL', 'Preços reais de API'), '11.7': ('—', '—', 'PENDENTE', 'Contas Supabase/Cloudflare, deploy'),
 '11.8': ('integrations/asaas.ts + webhook', f'{I}', 'PARCIAL', 'Sandbox Asaas sem credenciais; tarifas a conferir'), '11.9': ('/admin/financeiro', '—', 'IMPLEMENTADO', ''),
 '11.10': ('preços nulos; checkout bloqueado até aprovação', f'{I}', 'TESTADO', 'Preços a definir pelos sócios'), '11.11': ('—', '—', 'DOCUMENTAL', ''), '11.12': ('—', '—', 'DOCUMENTAL', ''),
 '11.13': ('—', '—', 'DOCUMENTAL', ''), '11.14': ('histórico preservado no downgrade/cancelamento', f'{U}/modules.test.ts', 'IMPLEMENTADO', ''), '11.15': ('marketing_metrics (admin)', '—', 'IMPLEMENTADO', ''),
 '12.1': ('—', '—', 'FUTURO', 'Fora do MVP'), '12.2': ('user_roles student/admin', f'{P}', 'TESTADO', ''), '12.3': ('/admin', f'{E}', 'TESTADO', ''),
 '12.4': ('admin.listUsers/grantAccess/setSuspension', '—', 'IMPLEMENTADO', ''), '12.5': ('admin content review/publish/import', '—', 'IMPLEMENTADO', ''),
 '12.6': ('admin.financeReport', '—', 'IMPLEMENTADO', ''), '12.7': ('alerts, monitoring, backup checks', '—', 'IMPLEMENTADO', 'Ferramentas dos fornecedores a conectar'),
 '13.1': ('profiles mínimo; CPF não armazenado', '—', 'IMPLEMENTADO', ''), '13.2': ('guardian_consents; ranking menores', f'{I}', 'PARCIAL', 'Envio de e-mail ao responsável e validação jurídica'),
 '13.3': ('auth local/Supabase, MFA admin, rate limit', f'{P}; {E}', 'PARCIAL', 'Supabase Auth não testado contra projeto real'), '13.4': ('scrubPII; contexto sem identificadores', f'{U}/modules.test.ts', 'TESTADO', ''),
 '13.5': ('scripts/backup/*.sh; checkBackupFreshness', '—', 'PARCIAL', 'Executar em infraestrutura real'), '13.6': ('export/correção/exclusão', f'{I}; {E}', 'TESTADO', ''),
 '13.7': ('deriveSubscriptionStatus, cancelamento, arrependimento', f'{U}/modules.test.ts; {I}', 'TESTADO', 'Prorrata/contrato a validar'), '13.8': ('rate limits, webhooks autenticados, XP no servidor', f'{I}; {P}', 'TESTADO', ''),
 '13.9': ('rights_status e restrição de publicação', f'{I}', 'IMPLEMENTADO', 'Verificar direitos de cada fonte'), '13.10': ('legal_documents versionados + aceites', '—', 'PENDENTE', 'Redação e revisão jurídica'),
 '14.1': ('—', '—', 'PARCIAL', 'Software implementado; acervo e validações pendentes'), '14.2': ('pipeline + admin', '—', 'PENDENTE', 'Acervo integral'), '14.3': ('backend primeiro', '—', 'DOCUMENTAL', ''),
 '14.4': ('—', '—', 'PENDENTE', 'Piloto não realizado'), '14.5': ('access_grants/cupons para piloto', '—', 'PENDENTE', ''), '14.6': ('—', '—', 'PENDENTE', ''),
 '14.7': ('FeedbackButton + /admin/feedback', '—', 'IMPLEMENTADO', ''), '14.8': ('—', '—', 'PENDENTE', 'Critérios go/no-go não atendidos'), '14.9': ('—', '—', 'DOCUMENTAL', ''),
 '15.1': ('Next 16/TS/Tailwind/Zod/Postgres/ts-fsrs/Vitest/pgTAP/Playwright', 'npm run check', 'PARCIAL', 'R2 e Workers pendentes'), '15.2': ('src/modules, src/server, src/integrations', '—', 'IMPLEMENTADO', ''),
 '15.3': ('supabase/migrations + RLS', f'{P}; tests/db/migrations.test.ts', 'TESTADO', ''), '15.4': ('scripts/import-enem', 'scripts/import-enem/test_pipeline.py', 'TESTADO', 'Execução com dados reais pendente'),
 '15.5': ('adaptive-engine', f'{U}/adaptive-engine.test.ts', 'TESTADO', ''), '15.6': ('mastery', f'{U}/mastery.test.ts', 'TESTADO', ''), '15.7': ('fsrs.ts, reviews', f'{U}/modules.test.ts', 'TESTADO', ''),
 '15.8': ('openai.ts, ai.ts, prompts.ts', f'{I}', 'PARCIAL', 'Sem chamadas reais (autorização/credenciais)'), '15.9': ('reserve_quota/finalize_quota; webhook', f'{I}', 'TESTADO', ''),
 '15.10': ('git local (develop), CI', '.github/workflows/ci.yml', 'PARCIAL', 'Repositório remoto e proteção de branches'), '15.11': ('—', '—', 'DOCUMENTAL', ''),
 '15.12': ('Vitest, pgTAP, Playwright, unittest', 'npm run check; npm run test:e2e', 'PARCIAL', 'Carga, restauração e sandbox Asaas pendentes'), '15.13': ('—', '—', 'PENDENTE', 'Prova de conceito Workers/OpenNext'),
 '15.14': ('docs/specs/*', '—', 'IMPLEMENTADO', ''), '15.15': ('docs/specs/ROADMAP.md', '—', 'DOCUMENTAL', ''),
}


def main():
    text = (ROOT / 'docs' / 'NEXO_DOCUMENTO_MESTRE.md').read_text('utf-8')
    heads = re.findall(r'^## (\d+\.\d+) — (.+)$', text, re.M)
    rows = ['| Subtópico | Título | Módulo / artefato | Evidência de teste | Status | Pendências |', '|---|---|---|---|---|---|']
    missing = []
    counts: dict[str, int] = {}
    for num, title in heads:
        if num not in M:
            missing.append(num)
            continue
        mod, test, status, dep = M[num]
        counts[status] = counts.get(status, 0) + 1
        rows.append(f'| {num} | {title.strip()} | {mod} | {test} | {status} | {dep} |')
    summary = ' · '.join(f'{k}: {v}' for k, v in sorted(counts.items()))
    out = ['# Matriz de rastreabilidade — Documento Mestre v1.0', '',
           f'Gerada por `scripts/docs/build_matrix.py`. {len(heads)} subtópicos lidos do mestre. Resumo: {summary}.', '',
           'Status: **TESTADO** (código + teste automatizado), **IMPLEMENTADO** (sem teste dedicado), **PARCIAL**, **PENDENTE** (dependência externa/decisão), **FUTURO**, **REJEITADO** (não implementar), **DOCUMENTAL**. Tela pronta não é prova de backend pronto; integração simulada não é integração real.', '',
           *rows, '']
    if missing:
        out.append(f'Subtópicos sem mapeamento: {", ".join(missing)}')
    (ROOT / 'docs' / 'MATRIZ_DE_RASTREABILIDADE.md').write_text('\n'.join(out), 'utf-8')
    print(len(heads), 'subtópicos;', summary, '; sem mapeamento:', missing)


if __name__ == '__main__':
    main()
