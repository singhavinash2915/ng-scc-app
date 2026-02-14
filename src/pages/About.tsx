import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { useMemberActivity } from '../hooks/useMemberActivity';
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Target,
  Heart,
  TrendingUp,
} from 'lucide-react';

export function About() {
  const { members } = useMembers();
  const { matches } = useMatches();
  const { activeCount } = useMemberActivity(members, matches);

  // Calculate real stats
  const activeMembers = activeCount;
  const completedMatches = matches.filter(m => ['won', 'lost', 'draw'].includes(m.result));
  const matchesWon = completedMatches.filter(m => m.result === 'won').length;
  const matchesLost = completedMatches.filter(m => m.result === 'lost').length;
  const winRate = completedMatches.length > 0 ? Math.round((matchesWon / completedMatches.length) * 100) : 0;

  // Get unique venues
  const venues = [...new Set(matches.map(m => m.venue))];

  return (
    <div>
      <Header title="About Us" subtitle="Learn more about Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Hero Section */}
        <Card className="bg-gradient-to-r from-primary-500 to-primary-600 border-0">
          <CardContent className="p-8 text-center text-white">
            <img
              src="/scc-logo.jpg"
              alt="Sangria CC"
              className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-white/30"
            />
            <h2 className="text-3xl font-bold mb-2">Sangria Cricket Club</h2>
            <p className="text-primary-100 text-lg">
              Season 2025-26 | Pune, Maharashtra
            </p>
          </CardContent>
        </Card>

        {/* About Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Our Story */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                  <Heart className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Our Story</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Sangria Cricket Club was founded in 2025 by a group of passionate cricket
                enthusiasts in Pune. We started as friends who loved weekend cricket and
                have now grown into a competitive club playing regular matches across
                multiple grounds. Our members come from diverse backgrounds but share
                one common love - the game of cricket.
              </p>
            </CardContent>
          </Card>

          {/* Our Mission */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Our Mission</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                To promote the spirit of cricket by providing a welcoming environment for
                players to improve their skills, compete in friendly matches, and build
                lasting friendships. We believe in fair play, teamwork, and the joy of
                cricket. Every member contributes to our club fund, making us a self-sustaining
                cricket community.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeMembers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{completedMatches.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Matches Played</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{winRate}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{venues.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Venues</p>
            </CardContent>
          </Card>
        </div>

        {/* Season Stats */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Season 2025-26 Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{matchesWon}</p>
                <p className="text-sm text-green-700 dark:text-green-500">Matches Won</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                <TrendingUp className="w-6 h-6 text-red-500 mx-auto mb-2 rotate-180" />
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{matchesLost}</p>
                <p className="text-sm text-red-700 dark:text-red-500">Matches Lost</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">3-4</p>
                <p className="text-sm text-blue-700 dark:text-blue-500">Matches/Week</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">₹3,000</p>
                <p className="text-sm text-purple-700 dark:text-purple-500">Season Fee</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Venues */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Our Grounds</h3>
            <div className="flex flex-wrap gap-2">
              {venues.map((venue) => (
                <span
                  key={venue}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {venue}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Contact Us</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="tel:+918888546860"
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Phone className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">+91 8888546860</span>
              </a>
              <a
                href="mailto:sangriacricket@gmail.com"
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300 text-sm">sangriacricket@gmail.com</span>
              </a>
              <a
                href="https://instagram.com/sangriacricket_official"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <Instagram className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                </div>
                <span className="text-gray-700 dark:text-gray-300">@sangriacricket_official</span>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Values */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Our Values</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2">Fair Play</h4>
                <p className="text-sm text-green-600 dark:text-green-500">
                  We believe in playing the game with integrity and respect for opponents.
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Teamwork</h4>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  Success comes from working together and supporting each other on and off the field.
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">Commitment</h4>
                <p className="text-sm text-purple-600 dark:text-purple-500">
                  Every member contributes their share, ensuring the club runs smoothly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
