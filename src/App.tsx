import { useEffect, useRef } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Matches } from './pages/Matches';
import { Calendar } from './pages/Calendar';
import { Tournaments } from './pages/Tournaments';
import { Finance } from './pages/Finance';
import { Analytics } from './pages/Analytics';
import { Requests } from './pages/Requests';
import { Settings } from './pages/Settings';
import { About } from './pages/About';
import { Feedback } from './pages/Feedback';
import { Payment } from './pages/Payment';
import { MatchPoll } from './pages/MatchPoll';
import { FeeTracking } from './pages/FeeTracking';
import { MatchDayTools } from './pages/MatchDayTools';
import { SeasonFund } from './pages/SeasonFund';
import { AIInsights } from './pages/AIInsights';
import { Leaderboard } from './pages/Leaderboard';

const isNative = Capacitor.isNativePlatform();

function DeepLinkHandler() {
  const navigate = useNavigate();
  const listenerAdded = useRef(false);

  useEffect(() => {
    if (!isNative || listenerAdded.current) return;
    listenerAdded.current = true;

    CapApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url);
        const path = url.pathname;
        if (path) navigate(path);
      } catch {
        // ignore invalid URLs
      }
    });
  }, [navigate]);

  return null;
}

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

const AppRoutes = () => (
  <>
    <DeepLinkHandler />
    <Routes>
      {/* Standalone poll page — no sidebar/layout */}
      <Route path="/poll/:matchId" element={<MatchPoll />} />

      {/* All other pages — with full layout */}
      <Route element={<LayoutWrapper />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<Members />} />
        <Route path="/matches" element={<Matches />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/fee-tracking" element={<FeeTracking />} />
        <Route path="/match-day-tools" element={<MatchDayTools />} />
        <Route path="/ground-booking" element={<SeasonFund />} />
        <Route path="/ai-insights" element={<AIInsights />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/about" element={<About />} />
      </Route>
    </Routes>
  </>
);

function App() {
  // Use MemoryRouter on native (BrowserRouter fails on file:// scheme in WebView)
  const Router = isNative ? MemoryRouter : BrowserRouter;

  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
