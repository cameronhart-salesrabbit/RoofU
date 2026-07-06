import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';

export default function QuizBuilder() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [maxRetakes, setMaxRetakes] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchQuiz(); }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchQuiz() {
    setLoading(true);
    const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('order');
    setQuiz(q);
    setTitle(q?.title || '');
    setThreshold(q?.pass_threshold || 80);
    setMaxRetakes(q?.max_retakes ?? '');
    setShowAnswers(q?.show_correct_answers || false);
    setQuestions(qs || []);
    setLoading(false);
  }

  async function saveQuizMeta(e) {
    e.preventDefault();
    setSaving(true);
    await supabase.from('quizzes').update({
      title,
      pass_threshold: threshold,
      max_retakes: maxRetakes !== '' ? Number(maxRetakes) : null,
      show_correct_answers: showAnswers,
    }).eq('id', quizId);
    setSaving(false);
  }

  function addQuestion() {
    setQuestions(qs => [...qs, { id: `new_${Date.now()}`, question_text: '', options: ['', '', '', ''], correct_option_index: 0, order: qs.length, isNew: true }]);
  }

  async function saveQuestion(q) {
    if (q.isNew) {
      const { data } = await supabase.from('quiz_questions').insert({
        quiz_id: quizId,
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
        order: q.order,
      }).select().single();
      setQuestions(qs => qs.map(x => (x.id === q.id ? { ...data } : x)));
    } else {
      await supabase.from('quiz_questions').update({
        question_text: q.question_text,
        options: q.options,
        correct_option_index: q.correct_option_index,
      }).eq('id', q.id);
    }
  }

  async function deleteQuestion(id) {
    if (id.toString().startsWith('new_')) {
      setQuestions(qs => qs.filter(q => q.id !== id));
      return;
    }
    await supabase.from('quiz_questions').delete().eq('id', id);
    setQuestions(qs => qs.filter(q => q.id !== id));
  }

  function updateQ(id, field, value) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateOption(qId, idx, value) {
    setQuestions(qs => qs.map(q => {
      if (q.id !== qId) return q;
      const opts = [...q.options];
      opts[idx] = value;
      return { ...q, options: opts };
    }));
  }

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading quiz…</p>;
  if (!quiz) return <p>Quiz not found.</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <h1>Quiz Builder</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <form onSubmit={saveQuizMeta} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label>Quiz Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Module 1 Check" />
          </div>
          <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
            <label>Pass Threshold (%)</label>
            <input type="number" min={0} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
          </div>
          <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
            <label>Max Retakes</label>
            <input type="number" min={0} value={maxRetakes} onChange={e => setMaxRetakes(e.target.value)} placeholder="Unlimited" />
          </div>
          <div className="form-group" style={{ marginBottom: 0, alignSelf: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showAnswers} onChange={e => setShowAnswers(e.target.checked)} />
              Show correct answers after submission
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </form>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Questions ({questions.length})</h2>
        <button className="btn btn-primary" onClick={addQuestion}>+ Add Question</button>
      </div>

      {questions.length === 0 && (
        <div className="card empty-state"><p>No questions yet. Add your first question above.</p></div>
      )}

      {questions.map((q, qi) => (
        <div key={q.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-500)' }}>Q{qi + 1}</span>
            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteQuestion(q.id)}>Remove</button>
          </div>
          <div className="form-group">
            <label>Question</label>
            <textarea rows={2} value={q.question_text} onChange={e => updateQ(q.id, 'question_text', e.target.value)} placeholder="Enter your question here…" style={{ resize: 'vertical' }} onBlur={() => saveQuestion(q)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {q.options.map((opt, oi) => (
              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name={`correct_${q.id}`}
                  checked={q.correct_option_index === oi}
                  onChange={() => { updateQ(q.id, 'correct_option_index', oi); }}
                  title="Mark as correct answer"
                />
                <input
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--gray-300)', borderRadius: 6, fontSize: 13 }}
                  value={opt}
                  onChange={e => updateOption(q.id, oi, e.target.value)}
                  placeholder={`Option ${oi + 1}`}
                  onBlur={() => saveQuestion(q)}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>Select the radio button next to the correct answer.</p>
        </div>
      ))}
    </div>
  );
}
