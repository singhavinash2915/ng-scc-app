import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { Matches } from './pages/Matches';
import { Finance } from './pages/Finance';
import { Analytics } from './pages/Analytics';
import { Requests } from './pages/Requests';
import { Settings } from './pages/Settings';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename="/ng-scc-app">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
