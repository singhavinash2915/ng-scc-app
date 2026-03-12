import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
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

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
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
              <Route path="/payment" element={<Payment />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/feedback" element={<Feedback />} />
              <Route path="/about" element={<About />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
