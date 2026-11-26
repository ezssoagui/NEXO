'use client';

import { useParams } from 'next/navigation';
import { ConceptActivity } from '@/components/study';

export default function ConceptPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="mx-auto max-w-3xl"><ConceptActivity activityId={id} /></div>;
}
