import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ProgressProvider } from './context/ProgressContext';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProgramManager from './pages/admin/ProgramManager';
import CourseBuilder from './pages/admin/CourseBuilder';
import QuizBuilder from './pages/admin/QuizBuilder';
import UserManager from './pages/admin/UserManager';
import ProgressReport from './pages/admin/ProgressReport';
import CompletionReport from './pages/admin/CompletionReport';
import QuizAnalytics from './pages/admin/QuizAnalytics';

// Learner pages
import LearnerLayout from './pages/learner/LearnerLayout';
import MyPrograms from './pages/learner/MyPrograms';
import ProgramView from './pages/learner/ProgramView';
import CourseView from './pages/learner/CourseView';
import LessonView from './pages/learner/LessonView';
import CourseComplete from './pages/learner/CourseComplete';
import LearnerDashboard from './pages/learner/LearnerDashboard';
import ResetPassword from './pages/learner/ResetPassword';

import './index.css';

function App() {
  return (
    <AdminAuthProvider>
      <ProgressProvider>
      <BrowserRouter>
        <Routes>
          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="programs" element={<ProgramManager />} />
            <Route path="courses" element={<CourseBuilder />} />
            <Route path="courses/:courseId" element={<CourseBuilder />} />
            <Route path="quizzes/:quizId" element={<QuizBuilder />} />
            <Route path="users" element={<UserManager />} />
            <Route path="progress" element={<ProgressReport />} />
            <Route path="completion" element={<CompletionReport />} />
            <Route path="quiz-analytics" element={<QuizAnalytics />} />
          </Route>

          {/* Learner routes */}
          <Route path="/" element={<LearnerLayout />}>
            <Route index element={<MyPrograms />} />
            <Route path="dashboard" element={<LearnerDashboard />} />
            <Route path="programs/:programId" element={<ProgramView />} />
            <Route path="courses/:courseId" element={<CourseView />} />
            <Route path="lessons/:lessonId" element={<LessonView />} />
            <Route path="courses/:courseId/complete" element={<CourseComplete />} />
          </Route>

          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ProgressProvider>
    </AdminAuthProvider>
  );
}

export default App;
