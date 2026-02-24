import { useState } from 'react';
import { MessageSquare, Star, Send, Trash2, Reply, Shield } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, TextArea } from '../components/ui/Input';
import { useFeedback } from '../hooks/useFeedback';
import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../context/AuthContext';

export function Feedback() {
  const { feedback, loading, submitFeedback, replyToFeedback, deleteFeedback } = useFeedback();
  const { members, loading: membersLoading } = useMembers();
  const { isAdmin } = useAuth();
  const [selectedMember, setSelectedMember] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !message.trim()) return;

    const member = members.find(m => m.id === selectedMember);
    if (!member) return;

    setIsSubmitting(true);
    try {
      await submitFeedback({
        name: member.name,
        message: message.trim(),
        rating: rating > 0 ? rating : undefined,
      });
      setSelectedMember('');
      setMessage('');
      setRating(0);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      // Error handled silently
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;

    setIsReplying(true);
    try {
      await replyToFeedback(id, replyText.trim());
      setReplyingTo(null);
      setReplyText('');
    } catch {
      // Error handled silently
    } finally {
      setIsReplying(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeedback(id);
    } catch {
      // Error handled silently
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (loading || membersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Feedback" subtitle="Share your thoughts with the club" />

      <div className="p-4 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Submit Feedback Form */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Share Your Feedback
                </h3>
              </div>

              {submitted ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                    <Send className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    Thank you for your feedback!
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Your message has been submitted successfully.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Select
                    label="Your Name *"
                    value={selectedMember}
                    onChange={(e) => setSelectedMember(e.target.value)}
                    options={[
                      { value: '', label: 'Select your name' },
                      ...members.map(m => ({ value: m.id, label: m.name })),
                    ]}
                    required
                  />

                  {/* Star Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Rating (optional)
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star === rating ? 0 : star)}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              star <= (hoveredStar || rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <TextArea
                    label="Your Feedback *"
                    placeholder="Share your thoughts, suggestions, or ideas for the club..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    required
                  />

                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={!selectedMember || !message.trim()}
                    className="w-full"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Feedback
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Feedback List - Visible to all members */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              All Feedback ({feedback.length})
            </h3>

            {feedback.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">No feedback yet. Be the first to share!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {feedback.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-white">
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {getTimeAgo(item.created_at)}
                              </p>
                            </div>
                          </div>

                          {item.rating && (
                            <div className="flex gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= item.rating!
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-gray-300 dark:text-gray-600'
                                  }`}
                                />
                              ))}
                            </div>
                          )}

                          <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                            {item.message}
                          </p>

                          {/* Admin Reply Display */}
                          {item.admin_reply && (
                            <div className="mt-3 ml-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border-l-4 border-primary-500">
                              <div className="flex items-center gap-2 mb-1">
                                <Shield className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">Admin Reply</span>
                                {item.replied_at && (
                                  <span className="text-xs text-gray-400">
                                    {getTimeAgo(item.replied_at)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {item.admin_reply}
                              </p>
                            </div>
                          )}

                          {/* Admin Reply Input */}
                          {isAdmin && replyingTo === item.id && (
                            <div className="mt-3 ml-4 space-y-2">
                              <TextArea
                                placeholder="Write your reply..."
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleReply(item.id)}
                                  loading={isReplying}
                                  disabled={!replyText.trim()}
                                >
                                  <Send className="w-3 h-3 mr-1" />
                                  Reply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => { setReplyingTo(null); setReplyText(''); }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Admin Actions */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-2">
                            {replyingTo !== item.id && (
                              <button
                                onClick={() => {
                                  setReplyingTo(item.id);
                                  setReplyText(item.admin_reply || '');
                                }}
                                className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                title={item.admin_reply ? 'Edit reply' : 'Reply'}
                              >
                                <Reply className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
