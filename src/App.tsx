import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Outlet, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';

// Critical pages — loaded immediately (small, no heavy deps)
import { MatchPoll } from './pages/MatchPoll';

// Book-match: lazy-loaded but the route only registers in DEV (local testing only)
const BookMatch = lazy(() => import('./pages/BookMatch').then(m => ({ default: m.BookMatch })));

// All pages lazy loaded (Dashboard loads fast — recharts/photos deferred further)
const Dashboard    = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Members      = lazy(() => import('./pages/Members').then(m => ({ default: m.Members })));
const Matches      = lazy(() => import('./pages/Matches').then(m => ({ default: m.Matches })));
const Calendar     = lazy(() => import('./pages/Calendar').then(m => ({ default: m.Calendar })));
const Tournaments  = lazy(() => import('./pages/Tournaments').then(m => ({ default: m.Tournaments })));
const Finance      = lazy(() => import('./pages/Finance').then(m => ({ default: m.Finance })));
const Analytics    = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const Requests     = lazy(() => import('./pages/Requests').then(m => ({ default: m.Requests })));
const Settings     = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const About        = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const Feedback     = lazy(() => import('./pages/Feedback').then(m => ({ default: m.Feedback })));
const Payment      = lazy(() => import('./pages/Payment').then(m => ({ default: m.Payment })));
const FeeTracking  = lazy(() => import('./pages/FeeTracking').then(m => ({ default: m.FeeTracking })));
const MatchDayTools= lazy(() => import('./pages/MatchDayTools').then(m => ({ default: m.MatchDayTools })));
const SeasonFund   = lazy(() => import('./pages/SeasonFund').then(m => ({ default: m.SeasonFund })));
const AIInsights   = lazy(() => import('./pages/AIInsights').then(m => ({ default: m.AIInsights })));
const Leaderboard  = lazy(() => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })));
const Records      = lazy(() => import('./pages/Records').then(m => ({ default: m.Records })));
const Auction      = lazy(() => import('./pages/Auction').then(m => ({ default: m.Auction })));
const Predictions  = lazy(() => import('./pages/Predictions').then(m => ({ default: m.Predictions })));
const MemberProfile = lazy(() => import('./pages/MemberProfile').then(m => ({ default: m.MemberProfile })));
const AnnualReport = lazy(() => import('./pages/AnnualReport').then(m => ({ default: m.AnnualReport })));
const Compare   = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const Bookings  = lazy(() => import('./pages/Bookings').then(m => ({ default: m.Bookings })));
const WhatsNew  = lazy(() => import('./pages/WhatsNew').then(m => ({ default: m.WhatsNew })));

const isNative = Capacitor.isNativePlatform();

// Minimal spinner shown while lazy page chunks load
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
      {/* Standalone pages — no sidebar/layout */}
      <Route path="/poll/:matchId" element={<MatchPoll />} />
      <Route path="/book-match" element={<Suspense fallback={<PageLoader />}><BookMatch /></Suspense>} />

      {/* All other pages — with full layout */}
      <Route element={<LayoutWrapper />}>
        <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/members"       element={<Suspense fallback={<PageLoader />}><Members /></Suspense>} />
        <Route path="/matches"       element={<Suspense fallback={<PageLoader />}><Matches /></Suspense>} />
        <Route path="/calendar"      element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />
        <Route path="/tournaments"   element={<Suspense fallback={<PageLoader />}><Tournaments /></Suspense>} />
        <Route path="/finance"       element={<Suspense fallback={<PageLoader />}><Finance /></Suspense>} />
        <Route path="/fee-tracking"  element={<Suspense fallback={<PageLoader />}><FeeTracking /></Suspense>} />
        <Route path="/match-day-tools" element={<Suspense fallback={<PageLoader />}><MatchDayTools /></Suspense>} />
        <Route path="/ground-booking" element={<Suspense fallback={<PageLoader />}><SeasonFund /></Suspense>} />
        <Route path="/ai-insights"   element={<Suspense fallback={<PageLoader />}><AIInsights /></Suspense>} />
        <Route path="/leaderboard"   element={<Suspense fallback={<PageLoader />}><Leaderboard /></Suspense>} />
        <Route path="/records"       element={<Suspense fallback={<PageLoader />}><Records /></Suspense>} />
        <Route path="/auction"       element={<Suspense fallback={<PageLoader />}><Auction /></Suspense>} />
        <Route path="/predictions"   element={<Suspense fallback={<PageLoader />}><Predictions /></Suspense>} />
        <Route path="/profile/:id"   element={<Suspense fallback={<PageLoader />}><MemberProfile /></Suspense>} />
        <Route path="/annual-report" element={<Suspense fallback={<PageLoader />}><AnnualReport /></Suspense>} />
        <Route path="/compare"       element={<Suspense fallback={<PageLoader />}><Compare /></Suspense>} />
        <Route path="/payment"       element={<Suspense fallback={<PageLoader />}><Payment /></Suspense>} />
        <Route path="/analytics"     element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
        <Route path="/bookings" element={<Suspense fallback={<PageLoader />}><Bookings /></Suspense>} />
        <Route path="/requests"      element={<Suspense fallback={<PageLoader />}><Requests /></Suspense>} />
        <Route path="/settings"      element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
        <Route path="/feedback"      element={<Suspense fallback={<PageLoader />}><Feedback /></Suspense>} />
        <Route path="/about"         element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
        <Route path="/whats-new"     element={<Suspense fallback={<PageLoader />}><WhatsNew /></Suspense>} />
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
