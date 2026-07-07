import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

function getYouTubeEmbedUrl(url) {
  try {
    const u = new URL(url);
    let videoId = u.searchParams.get('v');
    if (!videoId && u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?rel=0`;
  } catch {
    return null;
  }
}

export default function LessonView() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);

  const [course, setCourse] = useState(null);
  const [allLessons, setAllLessons] = useState([]); // flat ordered list for prev/next
  const [courseSections, setCourseSections] = useState([]); // sections with their lessons for sidebar
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [retakeCount, setRetakeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { learnerId, progress, fetchProgress, markLessonComplete, isLessonComplete } = useProgress();

  const loadLesson = useCallback(async (id) => {
    setLoading(true);
    setAnswers({});
    setSubmitted(false);
    setScore(null);

    const { data: l } = await supabase.from('lessons').select('*').eq('id', id).single();
    if (!l) { setLoading(false); return; }
    setLesson(l);

    // Load section + course for breadcrumbs and prev/next
    const { data: sec } = await supabase.from('sections').select('*').eq('id', l.section_id).single();

    if (sec) {
      const { data: c } = await supabase.from('courses').select('*').eq('id', sec.course_id).single();
      setCourse(c);
      await fetchProgress(sec.course_id);

      // Build flat ordered lesson list for this course
      const { data: secs } = await supabase.from('sections').select('*, lessons(*)').eq('course_id', sec.course_id).order('order');
      const sortedSecs = (secs || []).map(s => ({ ...s, lessons: (s.lessons || []).sort((a, b) => a.order - b.order) }));
      setCourseSections(sortedSecs);
      const flat = sortedSecs.flatMap(s => s.lessons);
      setAllLessons(flat);
    }

    if (l.quiz_id) {
      const { data: q } = await supabase.from('quizzes').select('*').eq('id', l.quiz_id).single();
      const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', l.quiz_id).order('order');
      setQuiz(q);
      setQuestions(qs || []);

      // Load prior quiz result if learner already took it
      const { data: prior } = await supabase
        .from('quiz_results')
        .select('*')
        .eq('user_id', learnerId)
        .eq('quiz_id', l.quiz_id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      if (prior) {
        setScore(prior.score);
        setSubmitted(true);
      }
      // Count total attempts for retake limit
      const { count } = await supabase
        .from('quiz_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', learnerId)
        .eq('quiz_id', l.quiz_id);
      setRetakeCount(count || 0);
    } else {
      setQuiz(null);
      setQuestions([]);
    }

    setLoading(false);
  }, [fetchProgress, learnerId]);

  useEffect(() => { loadLesson(lessonId); }, [lessonId, loadLesson]);

  async function handleMarkComplete() {
    if (!course || !lesson) return;
    setMarking(true);
    await markLessonComplete(course.id, lesson.id);
    setMarking(false);

    // Check if this was the last lesson
    const completedAfter = allLessons.filter(l =>
      l.id === lesson.id || (progress[course.id]?.completed_lesson_ids || []).includes(l.id)
    ).length;
    if (completedAfter >= allLessons.length) {
      navigate(`/courses/${course.id}/complete`);
    }
  }

  async function submitQuiz() {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_option_index) correct++;
    });
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= (quiz?.pass_threshold || 80);
    setScore(pct);
    setSubmitted(true);

    // Save result to database
    await supabase.from('quiz_results').insert({
      user_id: learnerId,
      quiz_id: quiz.id,
      score: pct,
      passed,
    });
    setRetakeCount(c => c + 1);

    // Auto-mark lesson complete if quiz passed
    if (passed && course && lesson) {
      await markLessonComplete(course.id, lesson.id);
    }
  }

  if (loading) return <LoadingSkeleton />;
  if (!lesson) return <p style={{ padding: 32 }}>Lesson not found.</p>;

  const currentIndex = allLessons.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
  const done = course ? isLessonComplete(course.id, lesson.id) : false;
  const passed = score !== null && quiz && score >= quiz.pass_threshold;
  const retakesExhausted = quiz?.max_retakes != null && retakeCount >= quiz.max_retakes && !passed;

  return (
    <div style={styles.shell} className="page-fade">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && <div style={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}

      {/* Dark sidebar */}
      <aside className={sidebarOpen ? '' : 'lesson-sidebar-default'} style={{ ...styles.sidebar, ...(sidebarOpen ? styles.sidebarMobileOpen : {}) }}>
        <div style={styles.sidebarHeader}>
          {course && <div style={styles.sidebarCourse}>{course.product || 'Course'}</div>}
          {course && <div style={styles.sidebarTitle}>{course.title}</div>}
          <div style={styles.sidebarProgTrack}>
            <div style={{ ...styles.sidebarProgFill, width: `${Math.round((allLessons.filter(l => course && isLessonComplete(course.id, l.id)).length / Math.max(allLessons.length, 1)) * 100)}%` }} />
          </div>
        </div>
        <div style={styles.sidebarScroll}>
          {courseSections.map(sec => (
            <div key={sec.id}>
              <div style={styles.sectionLabel}>{sec.title}</div>
              {sec.lessons.map(l => {
                const isDone = course && isLessonComplete(course.id, l.id);
                const isActive = l.id === lesson.id;
                return (
                  <div
                    key={l.id}
                    style={{ ...styles.lessonItem, ...(isActive ? styles.lessonItemActive : {}), ...(isDone && !isActive ? styles.lessonItemDone : {}) }}
                    onClick={() => navigate(`/lessons/${l.id}`)}
                  >
                    <div style={{ ...styles.lessonIcon, ...(isActive ? styles.lessonIconActive : {}), ...(isDone && !isActive ? styles.lessonIconDone : {}) }}>
                      {isDone && !isActive
                        ? <i className="fa-solid fa-check" style={{ fontSize: 8, color: '#9AB485' }} />
                        : isActive
                          ? <i className="fa-solid fa-play" style={{ fontSize: 8, color: '#fff', marginLeft: 1 }} />
                          : <i className="fa-solid fa-circle" style={{ fontSize: 5, color: '#7A7A7A' }} />
                      }
                    </div>
                    <span style={{ ...styles.lessonName, ...(isActive ? styles.lessonNameActive : {}), ...(isDone && !isActive ? styles.lessonNameDone : {}) }}>
                      {l.title}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div style={styles.main}>
        {/* Topbar with breadcrumb + prev/next */}
        <div style={styles.topbar}>
          <button style={styles.menuBtn} onClick={() => setSidebarOpen(o => !o)} title="Toggle course outline">
            <i className="fa-solid fa-bars" />
          </button>
          <div style={styles.breadcrumbs}>
            <Link to="/" style={styles.crumb}>My Programs</Link>
            <span style={styles.sep}>›</span>
            {course && <Link to={`/courses/${course.id}`} style={styles.crumb}>{course.title}</Link>}
            <span style={styles.sep}>›</span>
            <span style={styles.crumbCurrent}>{lesson.title}</span>
          </div>
          <div style={styles.topbarNav}>
            <span style={styles.lessonCount}>{currentIndex + 1} / {allLessons.length}</span>
            {prevLesson && (
              <button style={styles.navBtn} onClick={() => navigate(`/lessons/${prevLesson.id}`)}>
                <i className="fa-solid fa-chevron-left" />
              </button>
            )}
            {nextLesson && (
              <button style={{ ...styles.navBtn, ...styles.navBtnPrimary }} onClick={() => navigate(`/lessons/${nextLesson.id}`)}>
                Next <i className="fa-solid fa-chevron-right" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={styles.scroll}>
          <h1 style={styles.title}>{lesson.title}</h1>

          {/* Video */}
          {lesson.video_url && (
            <div style={styles.videoWrap}>
              {lesson.video_type === 'youtube' ? (
                <iframe
                  src={getYouTubeEmbedUrl(lesson.video_url)}
                  title={lesson.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
              ) : (
                <ReactPlayer
                  url={lesson.video_url}
                  controls
                  width="100%"
                  height="100%"
                  style={{ position: 'absolute', top: 0, left: 0 }}
                />
              )}
            </div>
          )}

          {/* PDF attachment */}
          {lesson.attachment_url && (
            <div style={styles.attachmentRow}>
              <i className="fa-solid fa-file-pdf" style={{ color: 'var(--red)', fontSize: 18 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{lesson.attachment_name || 'Attachment'}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>PDF Resource</div>
              </div>
              <a href={lesson.attachment_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 13 }}>
                <i className="fa-solid fa-download" /> Download
              </a>
            </div>
          )}

          {/* Written content */}
          {lesson.written_content && (
            <div style={styles.content}>
              <h2 style={styles.sectionHeading}>Lesson Notes</h2>
              <div className="rich-content" style={styles.prose} dangerouslySetInnerHTML={{ __html: lesson.written_content }} />
            </div>
          )}

          {/* Quiz */}
          {quiz && questions.length > 0 && (
            <div style={styles.quiz}>
              <h2 style={styles.sectionHeading}>Quiz: {quiz.title}</h2>
              <p style={styles.quizMeta}>Pass threshold: {quiz.pass_threshold}%</p>
              {submitted ? (
                <>
                  <div style={{ ...styles.resultBanner, background: passed ? '#F4F6F1' : '#FEF3F2', color: passed ? '#404A34' : '#B41E14' }}>
                    <i className={`fa-solid fa-${passed ? 'circle-check' : 'circle-xmark'}`} />
                    <strong>{passed ? 'Passed.' : 'Not quite.'}</strong> You scored {score}%.
                    {!passed && !retakesExhausted && (
                      <button className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => { setSubmitted(false); setAnswers({}); setScore(null); }}>
                        Try Again {quiz.max_retakes != null ? `(${quiz.max_retakes - retakeCount} left)` : ''}
                      </button>
                    )}
                    {retakesExhausted && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'inherit' }}>No retakes remaining.</span>}
                  </div>
                  {quiz.show_correct_answers && (
                    <div style={{ marginTop: 16 }}>
                      {questions.map((q, qi) => (
                        <div key={q.id} style={styles.question}>
                          <p style={styles.questionText}><strong>Q{qi + 1}.</strong> {q.question_text}</p>
                          <div style={styles.options}>
                            {q.options.map((opt, oi) => {
                              const isCorrect = oi === q.correct_option_index;
                              const wasSelected = answers[q.id] === oi;
                              return (
                                <div key={oi} style={{ ...styles.option, background: isCorrect ? '#F4F6F1' : wasSelected && !isCorrect ? '#FEF3F2' : undefined, border: isCorrect ? '1px solid #9AB485' : wasSelected ? '1px solid #FDA29B' : '1px solid var(--gray-200)', cursor: 'default' }}>
                                  <i className={`fa-solid fa-${isCorrect ? 'check' : wasSelected ? 'xmark' : 'minus'}`} style={{ fontSize: 11, color: isCorrect ? '#6A7A56' : wasSelected ? '#D92D20' : 'var(--gray-300)', marginRight: 8 }} />
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {quiz.max_retakes != null && retakeCount > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>{quiz.max_retakes - retakeCount} attempt{quiz.max_retakes - retakeCount !== 1 ? 's' : ''} remaining.</p>
                  )}
                  {questions.map((q, qi) => (
                    <div key={q.id} style={styles.question}>
                      <p style={styles.questionText}><strong>Q{qi + 1}.</strong> {q.question_text}</p>
                      <div style={styles.options}>
                        {q.options.map((opt, oi) => (
                          <label key={oi} style={{ ...styles.option, ...(answers[q.id] === oi ? styles.optionSelected : {}) }}>
                            <input type="radio" name={`q_${q.id}`} checked={answers[q.id] === oi} onChange={() => setAnswers(a => ({ ...a, [q.id]: oi }))} style={{ marginRight: 8 }} />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={submitQuiz} disabled={Object.keys(answers).length < questions.length}>
                    Submit Quiz
                  </button>
                </>
              )}
            </div>
          )}

          {/* Mark complete */}
          <div style={styles.footer}>
            {!done ? (
              <button className="btn btn-primary" onClick={handleMarkComplete} disabled={marking}>
                <i className="fa-solid fa-circle-check" />
                {marking ? 'Saving…' : 'Mark as Complete'}
              </button>
            ) : (
              <div style={styles.completedBadge}>
                <i className="fa-solid fa-circle-check" />
                Lesson Complete
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ height: 16, width: 300, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 20 }} />
      <div style={{ height: 32, width: 400, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 24 }} />
      <div style={{ width: '100%', paddingTop: '56.25%', background: 'var(--gray-100)', borderRadius: 8 }} />
    </div>
  );
}

const styles = {
  // Two-column shell
  shell: { display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', position: 'relative' },

  // Dark sidebar (Design A)
  sidebar: { width: 240, minWidth: 240, background: 'var(--pitch)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  sidebarMobileOpen: { position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 20, width: 280 },
  mobileOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 19 },
  menuBtn: { background: 'none', border: 'none', color: 'var(--gray-500)', cursor: 'pointer', fontSize: 16, padding: '0 8px 0 0', display: 'flex', alignItems: 'center', flexShrink: 0 },
  sidebarHeader: { background: '#0A0A0A', padding: '16px 16px 12px', borderBottom: '1px solid var(--pitch-800)', flexShrink: 0 },
  sidebarCourse: { fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 4 },
  sidebarTitle: { fontSize: 13, fontWeight: 600, color: 'var(--white)', lineHeight: 1.3, marginBottom: 8 },
  sidebarProgTrack: { height: 3, background: 'var(--pitch-800)', borderRadius: 999, overflow: 'hidden' },
  sidebarProgFill: { height: 3, background: 'var(--red)', borderRadius: 999, transition: 'width 0.4s ease' },
  sidebarScroll: { flex: 1, overflowY: 'auto', paddingBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--pitch-600)', padding: '12px 16px 4px' },
  lessonItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 16px', cursor: 'pointer', borderLeft: '2px solid transparent' },
  lessonItemActive: { background: 'rgba(244,97,0,0.1)', borderLeftColor: 'var(--red)' },
  lessonItemDone: {},
  lessonIcon: { width: 18, height: 18, borderRadius: '50%', background: 'var(--pitch-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  lessonIconActive: { background: 'var(--red)' },
  lessonIconDone: { background: '#404A34' },
  lessonName: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 },
  lessonNameActive: { color: 'var(--white)', fontWeight: 500 },
  lessonNameDone: { color: 'rgba(255,255,255,0.25)' },

  // Main panel
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--gray-100)' },
  topbar: { background: 'var(--white)', borderBottom: '1px solid var(--gray-200)', padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  breadcrumbs: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' },
  crumb: { color: 'var(--gray-500)', fontWeight: 500, textDecoration: 'none' },
  sep: { color: 'var(--gray-300)' },
  crumbCurrent: { color: 'var(--gray-700)', fontWeight: 500 },
  topbarNav: { display: 'flex', alignItems: 'center', gap: 6 },
  lessonCount: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-500)', marginRight: 4 },
  navBtn: { height: 30, padding: '0 10px', background: 'var(--white)', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 12, color: 'var(--gray-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  navBtnPrimary: { background: 'var(--red)', border: 'none', color: 'var(--white)' },
  scroll: { flex: 1, overflowY: 'auto', padding: '28px 32px' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 20, color: 'var(--gray-900)' },
  videoWrap: { position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 28 },
  attachmentRow: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 },
  content: { marginBottom: 28 },
  sectionHeading: { fontSize: 15, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--gray-200)', color: 'var(--gray-800)' },
  prose: { fontSize: 15, lineHeight: 1.7, color: 'var(--gray-700)' },
  quiz: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 24, marginBottom: 28 },
  quizMeta: { fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 },
  question: { marginBottom: 24 },
  questionText: { fontSize: 15, marginBottom: 12, color: 'var(--gray-800)' },
  options: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: { display: 'flex', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  optionSelected: { border: '1px solid var(--red)', background: 'var(--red-light)' },
  resultBanner: { padding: '14px 18px', borderRadius: 8, fontSize: 14, display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 },
  footer: { paddingTop: 20, borderTop: '1px solid var(--gray-200)', marginTop: 8 },
  completedBadge: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#F4F6F1', color: '#404A34', borderRadius: 8, fontSize: 14, fontWeight: 600 },
};
