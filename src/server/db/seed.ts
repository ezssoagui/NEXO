import { env } from '@/config/env';
import { hashPassword } from '@/server/auth/crypto';
import { loadReferenceData } from './reference-loader';
import type { Database, Tx } from './types';

/**
 * SEED DE DESENVOLVIMENTO — dados SINTÉTICOS, explicitamente identificados (is_synthetic=true,
 * rights_status='synthetic', prefixo "[SINTÉTICO]"). Proibido em produção (env()).
 * Serve para exercitar motor, sessões e interfaces sem acervo oficial importado.
 * NÃO é conteúdo pedagógico validado e não deve ser publicado.
 */
const TAG = '[SINTÉTICO]';

export async function seedDevelopment(db: Database): Promise<void> {
  if (env().NEXO_ENV === 'production') throw new Error('Seed sintético proibido em produção');
  const done = await db.query(`select 1 from content_sources where code = 'SYNTHETIC_DEV'`);
  if (done.length) return;
  await db.transaction(async (tx) => {
    await loadReferenceData(tx, { activateCurriculum: true });
    const [src] = await tx.query<{ id: string }>(
      `insert into content_sources (code, title, kind, rights_status, notes) values ('SYNTHETIC_DEV', 'Dados sintéticos de desenvolvimento', 'synthetic_test', 'synthetic',
       'Gerados por código para testes. Não são questões oficiais nem conteúdo validado.') returning id`);
    const sourceId = src!.id;
    await seedLegalDrafts(tx);
    await seedSyntheticContent(tx, sourceId);
    await seedEssayContent(tx, sourceId);
    await seedDevUsers(tx);
  });
}

async function seedLegalDrafts(tx: Tx) {
  const docs: [string, string, string][] = [
    ['terms', 'Termos de Uso (RASCUNHO)', 'RASCUNHO para desenvolvimento — pendente de revisão jurídica (13.10). O NEXO é uma plataforma de preparação para o ENEM. Notas de redação são estimativas e não oficiais. Não há promessa de aprovação.'],
    ['privacy', 'Política de Privacidade (RASCUNHO)', 'RASCUNHO para desenvolvimento — pendente de revisão jurídica. Coletamos nome, e-mail, ano do ENEM e data de nascimento (proteção de menores). Dados pedagógicos são usados para personalizar o estudo. Fornecedores de IA recebem apenas dados pedagógicos sem identificadores pessoais.'],
  ];
  for (const [kind, title, body] of docs) {
    await tx.query(
      `insert into legal_documents (kind, version, title, body_md, status, requires_acceptance, published_at) values ($1, 'dev-0', $2, $3, 'published', true, now())`,
      [kind, title, body]);
  }
}

interface Gen { statement: string; alternatives: string[]; correct: number; solution: string; difficulty: 'easy' | 'medium' | 'hard' }

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function rotate(correct: string, distractors: string[], seed: number): { alternatives: string[]; correct: number } {
  const all = [correct, ...distractors.slice(0, 4)];
  const pos = seed % 5;
  const arr = all.slice(1);
  arr.splice(pos, 0, correct);
  return { alternatives: arr, correct: pos };
}

function generators(name: string): ((i: number) => Gen) | null {
  const n = name.toLowerCase();
  if (n.includes('porcentagem')) {
    return (i) => {
      const p = 80 + i * 20, d = [10, 15, 20, 25, 30][i % 5]!;
      const difficulty = i < 5 ? 'easy' : i < 9 ? 'medium' : 'hard';
      const ans = difficulty === 'hard' ? p * (1 - d / 100) * (1 - d / 100) : p * (1 - d / 100);
      const r = rotate(brl(ans), [brl(p * d / 100), brl(p * (1 + d / 100)), brl(p - d), brl(p * (1 - (2 * d) / 100) + 1)], i);
      return {
        statement: `${TAG} Um produto custa ${brl(p)}${difficulty === 'hard' ? ` e recebe dois descontos sucessivos de ${d}%` : ` e recebe desconto de ${d}%`}. Qual é o preço final?`,
        ...r, difficulty,
        solution: `${TAG} Desconto de ${d}% equivale a multiplicar por ${(1 - d / 100).toFixed(2)}${difficulty === 'hard' ? ' duas vezes' : ''}: ${brl(ans)}. Alternativa ${'ABCDE'[r.correct]}.`,
      };
    };
  }
  if (n.includes('razões e proporções')) {
    return (i) => {
      const a = 4 + (i % 4) * 2, b = 12 + (i % 3) * 6, c = a * 2;
      const ans = (a * b) / c;
      const r = rotate(`${ans} dias`, [`${b * 2} dias`, `${a * b * c} dias`, `${b + a} dias`, `${ans + 3} dias`], i);
      return {
        statement: `${TAG} ${a} operários concluem uma obra em ${b} dias. Mantido o ritmo, em quantos dias ${c} operários concluiriam a mesma obra?`,
        ...r, difficulty: i < 5 ? 'easy' : i < 9 ? 'medium' : 'hard',
        solution: `${TAG} Grandezas inversamente proporcionais: ${a}·${b} = ${c}·x ⇒ x = ${ans}. Alternativa ${'ABCDE'[r.correct]}.`,
      };
    };
  }
  if (n.includes('probabilidade')) {
    return (i) => {
      const red = 2 + i, blue = 3 + (i % 4);
      const r = rotate(`${red}/${red + blue}`, [`${blue}/${red + blue}`, `${red}/${blue}`, `1/${red + blue}`, `${red + 1}/${red + blue}`], i);
      return {
        statement: `${TAG} Uma urna contém ${red} bolas vermelhas e ${blue} azuis. Retirando uma bola ao acaso, qual é a probabilidade de ela ser vermelha?`,
        ...r, difficulty: i < 5 ? 'easy' : i < 9 ? 'medium' : 'hard',
        solution: `${TAG} Casos favoráveis ${red}; casos possíveis ${red + blue}. P = ${red}/${red + blue}. Alternativa ${'ABCDE'[r.correct]}.`,
      };
    };
  }
  if (n.includes('lei de ohm')) {
    return (i) => {
      const R = [10, 20, 40, 50, 100][i % 5]!, U = R * (1 + (i % 3));
      const I = U / R;
      const r = rotate(`${I} A`, [`${U * R} A`, `${R / U} A`, `${I * 2} A`, `${I + 0.5} A`], i);
      return {
        statement: `${TAG} Um resistor ôhmico de ${R} Ω é submetido a uma tensão de ${U} V. Qual é a intensidade da corrente elétrica?`,
        ...r, difficulty: i < 5 ? 'easy' : i < 9 ? 'medium' : 'hard',
        solution: `${TAG} Lei de Ohm: U = R·i ⇒ i = ${U}/${R} = ${I} A. Alternativa ${'ABCDE'[r.correct]}.`,
      };
    };
  }
  return null;
}

function genericGen(subtopic: string): (i: number) => Gen {
  return (i) => {
    const r = rotate('Alternativa correta (teste)', ['Distrator 1 (teste)', 'Distrator 2 (teste)', 'Distrator 3 (teste)', 'Distrator 4 (teste)'], i);
    return {
      statement: `${TAG} Questão de teste nº ${i + 1} sobre "${subtopic}". Conteúdo fictício para validar fluxos; assinale a alternativa marcada como correta.`,
      ...r, difficulty: i < 5 ? 'easy' : i < 9 ? 'medium' : 'hard',
      solution: `${TAG} Item fictício: a alternativa correta é a ${'ABCDE'[r.correct]}.`,
    };
  };
}

const TARGETS = ['Porcentagem e juros', 'Razões e proporções', 'Noções de probabilidade', 'Lei de Ohm', 'Ecossistemas', 'Cultura Material e imaterial', 'Fatoração'];

async function seedSyntheticContent(tx: Tx, sourceId: string) {
  const lp = await tx.query<{ id: string; name: string; skill_id: string; area_code: string }>(
    `select st.id, st.name, k.id as skill_id, s.area_code from subtopics st join skills k on k.subtopic_id = st.id join topics t on t.id = st.topic_id
       join subjects s on s.id = t.subject_id where s.code = 'LC.LP' order by st.code limit 1`);
  const rows = await tx.query<{ id: string; name: string; skill_id: string; area_code: string }>(
    `select distinct on (st.name) st.id, st.name, k.id as skill_id, s.area_code from subtopics st join skills k on k.subtopic_id = st.id
       join topics t on t.id = st.topic_id join subjects s on s.id = t.subject_id where st.name = any($1::text[]) order by st.name, st.code`, [TARGETS]);
  for (const st of [...rows, ...lp]) {
    const gen = generators(st.name) ?? genericGen(st.name);
    for (let i = 0; i < 12; i++) {
      const g = gen(i);
      const [q] = await tx.query<{ id: string }>(
        `insert into questions (area_code, statement_md, correct_alternative, difficulty, difficulty_source, primary_subtopic_id, primary_skill_id,
           classification_status, classification_source, is_synthetic, rights_status, publication_status, source_id, published_at, year, application)
         values ($1,$2,$3,$4,'pedagogical_provisional',$5,$6,'validated','synthetic_seed',true,'synthetic','published',$7, now(), null, null) returning id`,
        [st.area_code, g.statement, 'ABCDE'[g.correct], g.difficulty, st.id, st.skill_id, sourceId]);
      for (const [k, alt] of g.alternatives.entries()) {
        await tx.query('insert into alternatives (question_id, letter, body_md) values ($1,$2,$3)', [q!.id, 'ABCDE'[k], alt]);
      }
      const cpe = st.area_code === 'LC' || st.area_code === 'CH'
        ? JSON.stringify({ comando: `${TAG} O comando pede identificar a alternativa marcada como correta.`, prova: `${TAG} A evidência é o rótulo "(teste)" da alternativa correta.`,
            eliminacao: Object.fromEntries('ABCDE'.split('').filter((_, k) => k !== g.correct).map((l) => [l, `${TAG} Distrator sem respaldo no enunciado.`])) })
        : null;
      await tx.query(`insert into question_solutions (question_id, body_md, cpe_reference, author_kind, validation_status, validated_at) values ($1,$2,$3,'synthetic','validated', now())`,
        [q!.id, g.solution, cpe]);
    }
    const [micro] = await tx.query<{ id: string }>(
      `insert into lessons (subtopic_id, kind, title, is_free, estimated_minutes, status, is_synthetic, rights_status, source_id, published_at)
       values ($1,'microlesson',$2,true,5,'published',true,'synthetic',$3, now()) returning id`, [st.id, `${TAG} Microaula: ${st.name}`, sourceId]);
    const [full] = await tx.query<{ id: string }>(
      `insert into lessons (subtopic_id, kind, title, is_free, estimated_minutes, status, is_synthetic, rights_status, source_id, published_at)
       values ($1,'lesson',$2,false,20,'published',true,'synthetic',$3, now()) returning id`, [st.id, `${TAG} Aula completa: ${st.name}`, sourceId]);
    const [summary] = await tx.query<{ id: string }>(
      `insert into lessons (subtopic_id, kind, title, is_free, estimated_minutes, status, is_synthetic, rights_status, source_id, published_at)
       values ($1,'summary',$2,true,3,'published',true,'synthetic',$3, now()) returning id`, [st.id, `${TAG} Resumo: ${st.name}`, sourceId]);
    const blocks: [string, string, string, boolean][] = [
      [micro!.id, 'text', `${TAG} Texto introdutório de teste sobre ${st.name}.`, false],
      [micro!.id, 'key_point', `${TAG} Ponto-chave de teste sobre ${st.name}.`, true],
      [full!.id, 'text', `${TAG} Desenvolvimento teórico de teste sobre ${st.name}.`, false],
      [full!.id, 'example', `${TAG} Exemplo resolvido de teste sobre ${st.name}.`, false],
      [full!.id, 'summary_point', `${TAG} Síntese de teste sobre ${st.name}.`, true],
      [summary!.id, 'summary_point', `${TAG} Resumo para revisão de ${st.name}.`, true],
    ];
    for (const [i, b] of blocks.entries()) {
      await tx.query('insert into lesson_blocks (lesson_id, position, block_type, body_md, is_final_review) values ($1,$2,$3,$4,$5)', [b[0], i + 1, b[1], b[2], b[3]]);
    }
    await tx.query(
      `insert into concept_activities (skill_id, kind, prompt_md, reference_answer_md, status, is_synthetic, source_id) values
         ($1,'definition',$2,$3,'published',true,$5), ($1,'application',$4,$3,'published',true,$5)`,
      [st.skill_id, `${TAG} Explique com suas palavras o conceito central de "${st.name}".`, `${TAG} Resposta de referência fictícia para testes.`,
        `${TAG} Dê um exemplo de aplicação de "${st.name}" em uma situação cotidiana.`, sourceId]);
    const [deck] = await tx.query<{ id: string }>(
      `insert into decks (subtopic_id, title, kind, status, is_synthetic, source_id) values ($1,$2,'curricular','published',true,$3) returning id`, [st.id, `${TAG} Baralho: ${st.name}`.slice(0, 120), sourceId]);
    for (let i = 1; i <= 6; i++) {
      await tx.query(`insert into flashcards (deck_id, skill_id, front_md, back_md, origin, status, is_synthetic) values ($1,$2,$3,$4,'curricular','published',true)`,
        [deck!.id, st.skill_id, `${TAG} Pergunta ${i} sobre ${st.name}`, `${TAG} Resposta ${i} (teste)`]);
    }
  }
}

async function seedEssayContent(tx: Tx, sourceId: string) {
  for (const [title, axis] of [[`${TAG} Tema de teste: desafios do uso consciente da tecnologia`, 'tecnologia'], [`${TAG} Tema de teste: caminhos para a mobilidade urbana sustentável`, 'meio ambiente']]) {
    const [t] = await tx.query<{ id: string }>(
      `insert into essay_themes (title, kind, axis, instructions_md, status, verification_status, rights_status, is_synthetic, source_id)
       values ($1,'nexo_original',$2,$3,'published','validated','synthetic',true,$4) returning id`,
      [title, axis, `${TAG} Redija texto dissertativo-argumentativo em modalidade escrita formal sobre o tema, com proposta de intervenção que respeite os direitos humanos.`, sourceId]);
    await tx.query(`insert into motivator_texts (theme_id, position, body_md, source_citation, rights_status) values ($1, 1, $2, 'Texto sintético de teste', 'synthetic')`,
      [t!.id, `${TAG} Texto motivador fictício para desenvolvimento.`]);
  }
  for (let c = 1; c <= 5; c++) {
    await tx.query(`insert into essay_theory (competency, title, body_md, status, is_synthetic, source_id) values ($1,$2,$3,'published',true,$4)`,
      [c, `${TAG} Teoria da Competência ${c}`, `${TAG} Conteúdo fictício de teoria. Consulte os níveis oficiais da cartilha do Inep para a Competência ${c}.`, sourceId]);
    await tx.query(`insert into essay_exercises (competency, kind, prompt_md, reference_md, status, is_synthetic, source_id) values ($1,$2,$3,$4,'published',true,$5)`,
      [c, ['other', 'thesis', 'argumentation', 'cohesion', 'intervention'][c - 1], `${TAG} Exercício de teste da Competência ${c}: escreva um parágrafo curto.`, `${TAG} Referência fictícia.`, sourceId]);
  }
  for (let i = 1; i <= 3; i++) {
    await tx.query(`insert into repertoires (title, concept_md, source_citation, context_md, applications_md, axes, status, is_synthetic, source_id)
      values ($1,$2,'Fonte fictícia de teste',$3,$4,$5,'published',true,$6)`,
      [`${TAG} Repertório de teste ${i}`, `${TAG} Conceito fictício ${i}.`, `${TAG} Contexto fictício.`, `${TAG} Aplicações fictícias.`, ['tecnologia', 'meio ambiente'], sourceId]);
  }
}

async function seedDevUsers(tx: Tx) {
  const users: [string, string, boolean][] = [
    ['admin@nexo.local', process.env.NEXO_DEV_ADMIN_PASSWORD ?? 'nexo-admin-dev-123', true],
    ['estudante@nexo.local', 'nexo-estudante-123', false],
  ];
  for (const [email, password, admin] of users) {
    const [u] = await tx.query<{ id: string }>(`insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [email]);
    await tx.query('insert into auth.local_credentials (user_id, password_hash) values ($1,$2)', [u!.id, hashPassword(password)]);
    await tx.query(`insert into profiles (id, display_name, enem_target_year, birth_date, foreign_language, onboarding_completed_at) values ($1,$2,$3,'2000-01-01','en', now())`,
      [u!.id, admin ? 'Admin (dev)' : 'Estudante (dev)', new Date().getFullYear() + 1]);
    await tx.query('insert into preferences (user_id) values ($1)', [u!.id]);
    await tx.query(`insert into user_roles (user_id, role) values ($1,'student')`, [u!.id]);
    if (admin) await tx.query(`insert into user_roles (user_id, role) values ($1,'admin')`, [u!.id]);
  }
}
