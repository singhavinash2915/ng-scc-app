import { useState, useMemo } from 'react';
import { CreditCard, IndianRupee, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select, Input } from '../components/ui/Input';
import { useMembers } from '../hooks/useMembers';
import { useMatches } from '../hooks/useMatches';
import { usePayment } from '../hooks/usePayment';
import { useMemberActivity } from '../hooks/useMemberActivity';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

export function Payment() {
  const { members, loading: membersLoading, fetchMembers } = useMembers();
  const { matches } = useMatches();
  const { isActive } = useMemberActivity(members, matches);
  const { initiatePayment, loading: paymentLoading, error: paymentError } = usePayment();

  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed' | 'cancelled'>('idle');

  const activeMembers = useMemo(() => {
    return members.filter(m => isActive(m.id));
  }, [members, isActive]);

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId) || null;
  }, [members, selectedMemberId]);

  const handlePayment = async () => {
    if (!selectedMemberId || !amount || parseFloat(amount) <= 0) return;
    if (!selectedMember) return;

    setPaymentStatus('idle');

    const result = await initiatePayment(
      selectedMemberId,
      selectedMember.name,
      selectedMember.email,
      selectedMember.phone,
      parseFloat(amount)
    );

    if (result.success) {
      setPaymentStatus('success');
      setAmount('');
      setSelectedMemberId('');
      // Re-fetch members to get updated balance
      fetchMembers();
    } else if (result.message === 'Payment cancelled') {
      setPaymentStatus('cancelled');
    } else {
      setPaymentStatus('failed');
    }
  };

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Pay Online" subtitle="Deposit funds to your SCC account" />

      <div className="p-4 lg:p-8">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Payment Form */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard className="w-5 h-5 text-primary-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Make a Payment</h3>
              </div>

              <div className="space-y-4">
                <Select
                  label="Select Your Name *"
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                    setPaymentStatus('idle');
                  }}
                  options={[
                    { value: '', label: 'Choose your name' },
                    ...activeMembers.map(m => ({
                      value: m.id,
                      label: `${m.name} (Balance: ₹${m.balance.toFixed(0)})`,
                    })),
                  ]}
                />

                {selectedMember && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Balance</span>
                    <span className={`font-bold text-lg ${
                      selectedMember.balance < 500
                        ? 'text-red-500'
                        : selectedMember.balance < 1000
                          ? 'text-amber-500'
                          : 'text-green-500'
                    }`}>
                      ₹{selectedMember.balance.toFixed(0)}
                    </span>
                  </div>
                )}

                <Input
                  label="Amount (₹) *"
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPaymentStatus('idle');
                  }}
                  min="1"
                />

                {/* Quick Amount Buttons */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quick Select
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((quickAmount) => (
                      <button
                        key={quickAmount}
                        type="button"
                        onClick={() => {
                          setAmount(quickAmount.toString());
                          setPaymentStatus('idle');
                        }}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          amount === quickAmount.toString()
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        ₹{quickAmount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handlePayment}
                  loading={paymentLoading}
                  disabled={!selectedMemberId || !amount || parseFloat(amount) <= 0}
                  className="w-full"
                >
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Pay ₹{amount ? parseFloat(amount).toLocaleString() : '0'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Status */}
          {paymentStatus === 'success' && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Payment Successful!
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Your balance has been updated.
                </p>
              </CardContent>
            </Card>
          )}

          {paymentStatus === 'failed' && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Payment Failed
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {paymentError || 'Something went wrong. Please try again.'}
                </p>
              </CardContent>
            </Card>
          )}

          {paymentStatus === 'cancelled' && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Payment Cancelled
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  You can try again whenever you're ready.
                </p>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          <Card>
            <CardContent className="p-6">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">How it works</h4>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Select your name and enter the amount' },
                  { step: '2', text: 'Click "Pay" to open the payment gateway' },
                  { step: '3', text: 'Complete payment via UPI, Card, or Net Banking' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{step}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Your balance will be updated automatically after successful payment.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
