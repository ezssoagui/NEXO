import { route, uuid } from '@/server/http/handler';
import { asService } from '@/server/db';
import { currentRecommendations } from '@/server/services/recommendations';
import { resumableSession } from '@/server/services/sessions';
import { gamificationSummary, performanceOverview } from '@/server/services/account';

export const GET = route({ auth: 'student' }, async ({ user }) => asService(async (tx) => {
  const [recommendations, resume, gamification, performance] = [
    await currentRecommendations(tx, user!.id), await resumableSession(tx, user!.id),
    await gamificationSummary(tx, user!.id), await performanceOverview(tx, user!.id, 'all'),
  ];
  return {
    recommendations: recommendations.slice(0, 12), resume,
    summary: { accuracy: performance.accuracy, answered: performance.answered, coverage: performance.coverage, curricularMastery: performance.curricularMastery,
      xp: gamification.xp, level: gamification.level, className: gamification.className, streak: gamification.streak },
  };
}));
