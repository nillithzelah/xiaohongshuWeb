import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ReviewManagement from './pages/ReviewManagement';
import NoteReviewList from './pages/NoteReviewList';
import CommentReviewList from './pages/CommentReviewList';
import CustomerReviewList from './pages/CustomerReviewList';
import AiAutoApprovedList from './pages/AiAutoApprovedList';
import StaffList from './pages/StaffList';
import ClientList from './pages/ClientList';
import HrDashboard from './pages/HrDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import MentorDashboard from './pages/MentorDashboard';
import DeviceList from './pages/DeviceList';
import DeviceReview from './pages/DeviceReview';
import TaskPointsManagement from './pages/TaskPointsManagement';
import CookieManagement from './pages/CookieManagement';
import AnnouncementManagement from './pages/AnnouncementManagement';
import PartTimeWithdrawals from './pages/PartTimeWithdrawals';
import FinancialManagement from './pages/FinancialManagement';
import DiscoveredNotes from './pages/DiscoveredNotes';
import ShortLinkPool from './pages/ShortLinkPool';
import CommentLeads from './pages/CommentLeads';
import CommentBlacklist from './pages/CommentBlacklist';
import MonitoringPage from './pages/MonitoringPage';
import HarvestQueueManagement from './pages/HarvestQueueManagement';
import SearchKeywords from './pages/SearchKeywords';
import AiPromptManagement from './pages/AiPromptManagement';
import PermissionManagement from './pages/PermissionManagement';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router basename="/xiaohongshu">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="reviews" element={<ReviewManagement />}>
                <Route index element={<Navigate to="note" replace />} />
                <Route path="note" element={<NoteReviewList />} />
                <Route path="comment" element={<CommentReviewList />} />
                <Route path="customer" element={<CustomerReviewList />} />
              </Route>
              <Route path="ai-auto-approved" element={<AiAutoApprovedList />} />
              <Route path="monitoring" element={<MonitoringPage />} />
              <Route path="harvest-queue" element={<HarvestQueueManagement />} />
              <Route path="discovery-notes" element={<DiscoveredNotes />} />
              <Route path="short-link-pool" element={<ShortLinkPool />} />
              <Route path="comment-leads" element={<CommentLeads />} />
              <Route path="comment-blacklist" element={<CommentBlacklist />} />
              <Route path="search-keywords" element={<SearchKeywords />} />
              <Route path="ai-prompts" element={<AiPromptManagement />} />
              <Route path="permissions" element={<PermissionManagement />} />
              <Route path="staff" element={<StaffList />} />
              <Route path="clients" element={<ClientList />} />
              <Route path="devices" element={<DeviceList />} />
              <Route path="device-review" element={<DeviceReview />} />
              <Route path="task-points" element={<TaskPointsManagement />} />
              <Route path="cookie" element={<CookieManagement />} />
              <Route path="announcements" element={<AnnouncementManagement />} />
              <Route path="financial" element={<FinancialManagement />} />
              <Route path="financial/summary" element={<FinancialManagement />} />
              <Route path="financial/withdrawals" element={<FinancialManagement />} />
              <Route path="part-time-withdrawals" element={<PartTimeWithdrawals />} />
              {/* 老板可以访问所有页面 */}
              <Route path="hr" element={<HrDashboard />} />
              <Route path="manager" element={<ManagerDashboard />} />
              <Route path="mentor" element={<MentorDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
