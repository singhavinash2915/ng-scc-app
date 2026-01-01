import { useState } from 'react';
import {
  UserPlus,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useRequests } from '../hooks/useRequests';
import { useAuth } from '../context/AuthContext';

export function Requests() {
  const { requests, loading, submitRequest, approveRequest, rejectRequest } = useRequests();
  const { isAdmin } = useAuth();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    experience: '',
    message: '',
  });

  const filteredRequests = requests.filter(r => filter === 'all' || r.status === filter);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await submitRequest({
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        experience: formData.experience || undefined,
        message: formData.message || undefined,
      });
      setShowRequestModal(false);
      setFormData({ name: '', phone: '', email: '', experience: '', message: '' });
    } catch (error) {
      console.error('Failed to submit request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!isAdmin) return;
    try {
      await approveRequest(id);
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleReject = async (id: string) => {
    if (!isAdmin) return;
    try {
      await rejectRequest(id);
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="success">
            <CheckCircle className="w-3 h-3 mr-1" /> Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="danger">
            <XCircle className="w-3 h-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Member Requests" subtitle="Join requests from new players" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Info Card for Non-Members */}
        <Card className="bg-gradient-to-r from-primary-500 to-primary-600 border-0">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 text-white">
                <h3 className="text-xl font-bold mb-2">Want to Join Sangria Cricket Club?</h3>
                <p className="text-primary-100">
                  Submit a request to join our club. Our admin team will review your application
                  and get back to you soon.
                </p>
              </div>
              <Button
                onClick={() => setShowRequestModal(true)}
                className="bg-white text-primary-600 hover:bg-primary-50"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Request to Join
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pending' && requests.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.map(request => (
            <Card key={request.id}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserPlus className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {request.name}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {request.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{request.phone}</span>
                        </div>
                      )}
                      {request.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span>{request.email}</span>
                        </div>
                      )}
                    </div>

                    {request.experience && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Experience:
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {request.experience}
                        </p>
                      </div>
                    )}

                    {request.message && (
                      <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                        <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">{request.message}</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-3">
                      Submitted on{' '}
                      {new Date(request.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {isAdmin && request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleReject(request.id)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <div className="text-center py-12">
            <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No requests found</p>
          </div>
        )}
      </div>

      {/* Submit Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request to Join"
        size="lg"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              placeholder="e.g., 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="e.g., you@email.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <Input
            label="Cricket Experience"
            placeholder="e.g., 5 years, played for college team"
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
          />
          <TextArea
            label="Message (Optional)"
            placeholder="Tell us why you want to join..."
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            rows={3}
          />
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRequestModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
