import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const [learnerId, setLearnerId] = useState(null);
  const [progress, setProgress] = useState({});

  // Reactively track the logged-in learner's users.id (not auth.users.id)
  useEffect(() => {
    async function resolveId(authUserId, authEmail) {
      if (!authUserId) { setLearnerId(null); return; }
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUserId)
        .single();
      if (data) { setLearnerId(data.id); return; }

      // Fallback in case the DB auto-link trigger missed this signup: link by email instead.
      if (authEmail) {
        const { data: byEmail } = await supabase.from('users').select('id').ilike('email', authEmail).is('auth_id', null).single();
        if (byEmail) {
          await supabase.from('users').update({ auth_id: authUserId }).eq('id', byEmail.id);
          setLearnerId(byEmail.id);
          return;
        }
      }
      setLearnerId(null);
    }

    supabase.auth.getSession().then(({ data }) => {
      resolveId(data.session?.user?.id || null, data.session?.user?.email || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      resolveId(session?.user?.id || null, session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProgress = useCallback(async (courseId) => {
    if (!learnerId) return null;
    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', learnerId)
      .eq('course_id', courseId)
      .single();
    if (data) setProgress(p => ({ ...p, [courseId]: data }));
    return data;
  }, [learnerId]);

  const markLessonComplete = useCallback(async (courseId, lessonId) => {
    if (!learnerId) return;
    const existing = progress[courseId];
    const completedIds = existing?.completed_lesson_ids || [];
    if (completedIds.includes(lessonId)) return;

    const updated = [...completedIds, lessonId];
    const { data } = await supabase
      .from('progress')
      .upsert({
        user_id: learnerId,
        course_id: courseId,
        completed_lesson_ids: updated,
        last_updated: new Date(),
      }, { onConflict: 'user_id,course_id' })
      .select()
      .single();

    if (data) setProgress(p => ({ ...p, [courseId]: data }));
  }, [learnerId, progress]);

  const recordLastVisited = useCallback(async (courseId, lessonId) => {
    if (!learnerId) return;
    const { data } = await supabase
      .from('progress')
      .upsert({
        user_id: learnerId,
        course_id: courseId,
        last_lesson_id: lessonId,
        last_updated: new Date(),
      }, { onConflict: 'user_id,course_id' })
      .select()
      .single();

    if (data) setProgress(p => ({ ...p, [courseId]: data }));
  }, [learnerId]);

  const isLessonComplete = useCallback((courseId, lessonId) => {
    return (progress[courseId]?.completed_lesson_ids || []).includes(lessonId);
  }, [progress]);

  const getCourseProgress = useCallback((courseId, totalLessons) => {
    const completed = (progress[courseId]?.completed_lesson_ids || []).length;
    if (!totalLessons) return 0;
    return Math.round((completed / totalLessons) * 100);
  }, [progress]);

  return (
    <ProgressContext.Provider value={{ learnerId, progress, fetchProgress, markLessonComplete, recordLastVisited, isLessonComplete, getCourseProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  return useContext(ProgressContext);
}
