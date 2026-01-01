import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Target,
  Heart,
} from 'lucide-react';

export function About() {
  return (
    <div>
      <Header title="About Us" subtitle="Learn more about Sangria Cricket Club" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Hero Section */}
        <Card className="bg-gradient-to-r from-primary-500 to-primary-600 border-0">
          <CardContent className="p-8 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-bold">S</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">Sangria Cricket Club</h2>
            <p className="text-primary-100 text-lg">
              Playing with passion since 2023
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
                Sangria Cricket Club was founded by a group of passionate cricket enthusiasts
                who wanted to create a community where players of all skill levels could come
                together to enjoy the beautiful game. What started as weekend matches among
                friends has grown into a thriving club with regular fixtures and a strong
                sense of camaraderie.
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
                cricket.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">30+</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">3-4</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Matches/Week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">70%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Win Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900 dark:text-white">5+</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Venues</p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Get in Touch</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Mail className="w-5 h-5" />
                </div>
                <span>sangria.cc@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Phone className="w-5 h-5" />
                </div>
                <span>+91 98765 43210</span>
              </div>
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
                  Success comes from working together and supporting each other.
                </p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <h4 className="font-semibold text-purple-700 dark:text-purple-400 mb-2">Growth</h4>
                <p className="text-sm text-purple-600 dark:text-purple-500">
                  We encourage continuous improvement and learning for all members.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
