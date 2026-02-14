import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/matches" element={<Matches />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
