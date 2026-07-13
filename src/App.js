import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ProgressProvider } from './context/ProgressContext';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import AnalyticsLayout from './pages/admin/AnalyticsLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProgramManager from './pages/admin/ProgramManager';
import CourseList from './pages/admin/CourseList';
import CourseBuilder from './pages/admin/CourseBuilder';
import QuizBuilder from './pages/admin/QuizBuilder';
import UserManager from './pages/admin/UserManager';
import ClientsList from './pages/admin/ClientsList';
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
import SearchResults from './pages/learner/SearchResults';
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
            <Route index element={<Navigate to="analytics/dashboard" replace />} />
            <Route path="analytics" element={<AnalyticsLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="progress" element={<ProgressReport />} />
              <Route path="completion" element={<CompletionReport />} />
              <Route path="quiz" element={<QuizAnalytics />} />
            </Route>
            <Route path="programs" element={<ProgramManager />} />
            <Route path="courses" element={<CourseList />} />
            <Route path="courses/:courseId" element={<CourseBuilder />} />
            <Route path="quizzes/:quizId" element={<QuizBuilder />} />
            <Route path="users" element={<UserManager />} />
            <Route path="clients" element={<ClientsList />} />
          </Route>

          {/* Learner routes */}
          <Route path="/" element={<LearnerLayout />}>
            <Route index element={<MyPrograms />} />
            <Route path="dashboard" element={<LearnerDashboard />} />
            <Route path="search" element={<SearchResults />} />
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
