'use client';

import { useParams } from 'next/navigation';
import { LessonReader } from '@/components/study';

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="mx-auto max-w-3xl"><LessonReader lessonId={id} /></div>;
}
