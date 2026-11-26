import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';

/** Árvore curricular completa (acesso livre a todo o currículo — 4.6). */
export const GET = route({ auth: 'student' }, async () => asService(async (tx) => ({
  areas: await tx.query('select code, name, exam_day from areas order by sort'),
  subjects: await tx.query('select id, area_code, code, name from subjects order by area_code, sort'),
  topics: await tx.query(`select t.id, t.subject_id, t.name from topics t join curriculum_versions cv on cv.id = t.curriculum_version_id and cv.status = 'active' where t.verification_status <> 'retired' order by t.sort`),
  subtopics: await tx.query(`select st.id, st.topic_id, st.name, st.relevance from subtopics st join curriculum_versions cv on cv.id = st.curriculum_version_id and cv.status = 'active' where st.verification_status <> 'retired' order by st.sort`),
})));
