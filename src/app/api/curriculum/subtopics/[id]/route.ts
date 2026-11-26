import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { subtopicDetail } from '@/server/services/account';
import { listDecks, listLessons } from '@/server/services/content';

export const GET = route({ auth: 'student' }, async ({ user, params }) => asService(async (tx) => {
  const id = uuid.parse(params.id);
  const detail = await subtopicDetail(tx, user!.id, id);
  const concepts = await tx.query(`select ca.id, ca.kind from concept_activities ca join skills k on k.id = ca.skill_id where k.subtopic_id = $1 and ca.status = 'published'`, [id]);
  const [q] = await tx.query<{ n: number }>(`select count(*)::int as n from questions where primary_subtopic_id = $1 and publication_status = 'published'`, [id]);
  return { ...detail, lessons: await listLessons(tx, user!.id, id), decks: await listDecks(tx, user!.id, id), concepts, questionCount: q!.n };
}));
