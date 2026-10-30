import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  Award, 
  Coins, 
  ArrowUpRight, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  Smartphone, 
  Gift, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  Zap,
  Building,
  CreditCard,
  Camera
} from 'lucide-react';

interface PainterLoyaltyPortalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEnquiry?: () => void;
}

interface ScanTransaction {
  id: string;
  product: string;
  canSize: string;
  points: number;
  cashback: number;
  date: string;
  qrCode: string;
  status: 'Credited' | 'Transferred';
}

const SAMPLE_CAN_LIDS = [
  {
    id: 'can-1',
    product: 'Areva Royale Lustre Luxury Emulsion',
    canSize: '20 Liters',
    points: 500,
    cashback: 250,
    qrCode: 'ARV-LUS-20L-984210',
    color: 'from-amber-600 to-amber-800',
  },
  {
    id: 'can-2',
    product: 'Areva Weather Guard Extreme Exterior',
    canSize: '20 Liters',
    points: 600,
    cashback: 300,
    qrCode: 'ARV-WGX-20L-551982',
    color: 'from-teal-600 to-teal-800',
  },
  {
    id: 'can-3',
    product: 'Areva Super Sheen Interior Emulsion',
    canSize: '10 Liters',
    points: 250,
    cashback: 125,
    qrCode: 'ARV-SSN-10L-332014',
    color: 'from-indigo-600 to-indigo-800',
  },
  {
    id: 'can-4',
    product: 'Areva Acrylic Wall Primer & Sealer',
    canSize: '20 Liters',
    points: 200,
    cashback: 100,
    qrCode: 'ARV-PRM-20L-110842',
    color: 'from-stone-600 to-stone-800',
  },
];

export const PainterLoyaltyPortal: React.FC<PainterLoyaltyPortalProps> = ({
  isOpen,
  onClose,
  onOpenEnquiry,
}) => {
  // Tab: 'dashboard' | 'scanner' | 'withdraw' | 'tiers'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'withdraw' | 'tiers'>('dashboard');

  // Wallet State
  const [pointsBalance, setPointsBalance] = useState<number>(3450);
  const [totalLifetimeEarned, setTotalLifetimeEarned] = useState<number>(28750);
  const [scannedCount, setScannedCount] = useState<number>(48);

  // Scanner Simulator State
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessToast, setScanSuccessToast] = useState<{
    product: string;
    points: number;
    cashback: number;
    qr: string;
  } | null>(null);

  // Withdrawal State
  const [upiId, setUpiId] = useState('ramesh.contractor@okhdfcbank');
  const [withdrawAmount, setWithdrawAmount] = useState<number>(1000);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState<{
    utr: string;
    amount: number;
    timestamp: string;
  } | null>(null);

  // Scan History Ledger
  const [history, setHistory] = useState<ScanTransaction[]>([
    {
      id: 'tx-1',
      product: 'Areva Royale Lustre Luxury Emulsion',
      canSize: '20 L',
      points: 500,
      cashback: 250,
      date: 'Today, 11:20 AM',
      qrCode: 'ARV-LUS-20L-774102',
      status: 'Credited',
    },
    {
      id: 'tx-2',
      product: 'Areva Weather Guard Extreme Exterior',
      canSize: '20 L',
      points: 600,
      cashback: 300,
      date: 'Yesterday, 04:15 PM',
      qrCode: 'ARV-WGX-20L-449102',
      status: 'Credited',
    },
    {
      id: 'tx-3',
      product: 'Areva Super Sheen Interior Emulsion',
      canSize: '10 L',
      points: 250,
      cashback: 125,
      date: '28 Oct 2026',
      qrCode: 'ARV-SSN-10L-109283',
      status: 'Credited',
    },
  ]);

  if (!isOpen) return null;

  // Simulate scanning a can lid QR
  const handleScanCanLid = (can: typeof SAMPLE_CAN_LIDS[0]) => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setPointsBalance((prev) => prev + can.points);
      setTotalLifetimeEarned((prev) => prev + can.cashback);
      setScannedCount((prev) => prev + 1);

      const newTx: ScanTransaction = {
        id: `tx-${Date.now()}`,
        product: can.product,
        canSize: can.canSize,
        points: can.points,
        cashback: can.cashback,
        date: 'Just now',
        qrCode: can.qrCode,
        status: 'Credited',
      };
      setHistory((prev) => [newTx, ...prev]);

      setScanSuccessToast({
        product: can.product,
        points: can.points,
        cashback: can.cashback,
        qr: can.qrCode,
      });

      // Clear toast after 4s
      setTimeout(() => {
        setScanSuccessToast(null);
      }, 4000);
    }, 900);
  };

  const handleWithdrawUPI = (e: React.FormEvent) => {
    e.preventDefault();
    const maxRupees = Math.floor(pointsBalance / 2);
    if (withdrawAmount > maxRupees || withdrawAmount <= 0) {
      alert(`Withdrawal amount must be between ₹100 and ₹${maxRupees}`);
      return;
    }
    const pointsDeducted = withdrawAmount * 2;
    setPointsBalance((prev) => prev - pointsDeducted);
    const mockUtr = `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    setWithdrawalSuccess({
      utr: mockUtr,
      amount: withdrawAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-stone-800 px-2 py-0.5 rounded-full border border-stone-700">
                  Point 3 · Modernization Roadmap
                </span>
                <span className="text-xs text-stone-300 font-medium">Areva Ustaad Rewards & QR Cash Engine</span>
              </div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
                Contractor & Master Painter Loyalty Club
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-stone-100 border-b border-stone-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200'
            }`}
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>Painter Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'scanner'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Can Lid QR</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </button>

          <button
            onClick={() => setActiveTab('withdraw')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'withdraw'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Instant UPI Cash Transfer</span>
          </button>

          <button
            onClick={() => setActiveTab('tiers')}
            className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tiers'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-950 hover:bg-stone-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Contractor Tiers & Perks</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* Active Toast Notification */}
          {scanSuccessToast && (
            <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm">
                    Can Lid QR Scanned Successfully!
                  </div>
                  <div className="text-xs text-emerald-100">
                    +{scanSuccessToast.points} Points (₹{scanSuccessToast.cashback} Cashback) added for {scanSuccessToast.product}
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs bg-emerald-700/60 px-2.5 py-1 rounded-md font-bold">
                {scanSuccessToast.qr}
              </span>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Profile & Wallet Hero Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-950 text-white shadow-xl border border-stone-800 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
                
                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-black text-xl flex items-center justify-center shadow-md">
                      RK
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-lg text-white">
                          Ramesh Kumar
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-stone-950">
                          Gold Master Contractor
                        </span>
                      </div>
                      <p className="text-xs text-stone-400">
                        Contractor ID: <span className="font-mono text-stone-200">#ARV-KA-9418</span> · Verified Karnataka Region
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveTab('scanner')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Scan Paint Can</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('withdraw')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      <Coins className="w-4 h-4" />
                      <span>Withdraw Cash</span>
                    </button>
                  </div>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-stone-800 text-xs">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-stone-400 text-[11px] block font-medium">Available Points Balance</span>
                    <div className="text-2xl font-black text-amber-400 font-display mt-0.5">
                      {pointsBalance.toLocaleString()} Pts
                    </div>
                    <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                      = ₹{Math.floor(pointsBalance / 2).toLocaleString()} Cash Value
                    </span>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-stone-400 text-[11px] block font-medium">Lifetime Cashback Earned</span>
                    <div className="text-2xl font-black text-white font-display mt-0.5">
                      ₹{totalLifetimeEarned.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-stone-400 mt-1 block">
                      Directly paid out to UPI
                    </span>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-stone-400 text-[11px] block font-medium">Can Lids Scanned</span>
                    <div className="text-2xl font-black text-white font-display mt-0.5">
                      {scannedCount} Units
                    </div>
                    <span className="text-[11px] text-amber-400 mt-1 block">
                      Tier Progress: 82% to Royale Master
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Scan Simulator Teaser (5 cols) */}
                <div className="lg:col-span-5 p-5 rounded-3xl border border-stone-200 bg-stone-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>Ready to Scan Cans</span>
                    </h3>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">
                      Instant Credit
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Every Areva 20L and 10L bucket comes with a tamper-proof serialized QR under the lid. Open the scanner and point your phone camera to claim instant credit!
                  </p>

                  <div className="space-y-2">
                    {SAMPLE_CAN_LIDS.slice(0, 2).map((can) => (
                      <div
                        key={can.id}
                        className="p-3 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-stone-900">{can.product}</div>
                          <div className="text-[11px] text-stone-500">{can.canSize} · {can.qrCode}</div>
                        </div>
                        <button
                          onClick={() => handleScanCanLid(can)}
                          className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-colors"
                        >
                          +₹{can.cashback}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Open Live Can Scanner</span>
                  </button>
                </div>

                {/* Ledger Table (7 cols) */}
                <div className="lg:col-span-7 p-5 rounded-3xl border border-stone-200 bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-stone-500" />
                      <span>Recent Scan Ledger</span>
                    </h3>
                    <span className="text-xs text-stone-500 font-mono">
                      Showing latest scans
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 text-xs">
                    {history.map((tx) => (
                      <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-stone-900">{tx.product}</div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                            <span>{tx.canSize}</span>
                            <span>•</span>
                            <span className="font-mono text-stone-400">{tx.qrCode}</span>
                            <span>•</span>
                            <span>{tx.date}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-emerald-600 text-sm">
                            +{tx.points} Pts
                          </div>
                          <div className="text-[11px] text-stone-400">
                            (₹{tx.cashback} UPI)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Live Can Lid QR Scanner
                </span>
                <h3 className="font-display text-2xl font-bold text-stone-950">
                  Scan Your Areva Paint Can Lid
                </h3>
                <p className="text-xs text-stone-600">
                  Point the camera reticle at the holographic QR code printed inside the lid of any 4L, 10L, or 20L Areva container.
                </p>
              </div>

              {/* Viewfinder Mockup */}
              <div className="relative aspect-video max-w-md mx-auto rounded-3xl bg-stone-950 overflow-hidden shadow-2xl border-4 border-stone-800 flex items-center justify-center p-6">
                
                {/* Crosshairs & Scanning laser line */}
                <div className="relative w-48 h-48 border-2 border-dashed border-amber-400/80 rounded-2xl flex items-center justify-center">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                  <QrCode className="w-16 h-16 text-stone-700 animate-pulse opacity-40" />
                </div>

                <div className="absolute bottom-4 inset-x-0 text-center text-xs text-amber-300 font-mono font-medium">
                  {isScanning ? 'Validating unique security hash...' : 'Align QR code within reticle'}
                </div>
              </div>

              {/* Interactive Demo Can Lids to Test */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">
                    Or Tap a Sample Can Lid Below to Test Scanner:
                  </span>
                  <span className="text-[11px] text-stone-500 font-mono">
                    Instant Simulation
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_CAN_LIDS.map((can) => (
                    <button
                      key={can.id}
                      onClick={() => handleScanCanLid(can)}
                      disabled={isScanning}
                      className="p-4 rounded-2xl border border-stone-200 bg-white hover:border-amber-500 hover:shadow-md transition-all text-left flex items-start justify-between gap-3 group active:scale-[0.98]"
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                          {can.canSize}
                        </span>
                        <div className="font-bold text-stone-900 text-xs mt-1.5 group-hover:text-amber-800 transition-colors">
                          {can.product}
                        </div>
                        <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                          {can.qrCode}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-600 block">
                          +{can.points} Pts
                        </span>
                        <span className="text-[10px] text-stone-500 font-semibold">
                          ₹{can.cashback} Cash
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900"
                >
                  ← Return to Dashboard
                </button>
              </div>

            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="max-w-xl mx-auto space-y-6">
              
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Instant UPI Payout
                </span>
                <h3 className="font-display text-2xl font-bold text-stone-950">
                  Transfer Earnings to Your Bank / UPI
                </h3>
                <p className="text-xs text-stone-600">
                  1 Point = ₹0.50 Cash. Direct 24×7 IMPS / UPI payout to Google Pay, PhonePe, Paytm, or BHIM.
                </p>
              </div>

              {/* Wallet Tally Card */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-stone-500 font-medium block">Current Redeemable Balance</span>
                  <div className="text-2xl font-black text-stone-900 font-display mt-0.5">
                    ₹{Math.floor(pointsBalance / 2).toLocaleString()}
                  </div>
                  <span className="text-[11px] text-stone-400">({pointsBalance.toLocaleString()} points)</span>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    Instant Bank Transfer
                  </span>
                </div>
              </div>

              {/* Success Alert */}
              {withdrawalSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>₹{withdrawalSuccess.amount} Transferred Successfully!</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Credited to UPI ID <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{upiId}</code> at {withdrawalSuccess.timestamp}.
                    Bank Reference UTR: <span className="font-mono font-bold">{withdrawalSuccess.utr}</span>.
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleWithdrawUPI} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Your UPI ID (VPA) *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. mobile@upi or name@okaxis"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1 block">
                    Supported: Google Pay, PhonePe, Paytm, AmazonPay, BHIM
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Amount to Withdraw (in Rupees) *
                  </label>
                  <div className="relative">
                    <span className="text-stone-500 font-bold absolute left-3 top-2.5 text-sm">₹</span>
                    <input
                      type="number"
                      required
                      min={100}
                      max={Math.floor(pointsBalance / 2)}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 text-sm font-bold rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mt-1.5">
                    <span>Deducts {withdrawAmount * 2} points</span>
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(Math.floor(pointsBalance / 2))}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Withdraw Full Balance
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pointsBalance < 200}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Transfer ₹{withdrawAmount} to UPI Now</span>
                </button>
              </form>

            </div>
          )}

          {activeTab === 'tiers' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Contractor Recognition
                </span>
                <h3 className="font-display text-2xl font-bold text-stone-950">
                  Areva Ustaad Club Tiers & Exclusive Perks
                </h3>
                <p className="text-xs text-stone-600">
                  As you scan more cans across your residential and commercial painting projects, unlock higher cashback multipliers and insurance benefits.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-700">Bronze Painter</span>
                    <span className="text-[10px] font-mono text-stone-500">0 - 1,000 Pts</span>
                  </div>
                  <ul className="space-y-1.5 text-stone-600">
                    <li className="flex items-center gap-1.5">✓ Standard cashback on all 10L & 20L cans</li>
                    <li className="flex items-center gap-1.5">✓ Direct UPI instant withdrawal</li>
                    <li className="flex items-center gap-1.5">✓ Areva painter T-shirt & cap kit</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">Silver Contractor</span>
                    <span className="text-[10px] font-mono text-stone-500">1,000 - 3,000 Pts</span>
                  </div>
                  <ul className="space-y-1.5 text-stone-600">
                    <li className="flex items-center gap-1.5">✓ 1.10× Points Booster on luxury line</li>
                    <li className="flex items-center gap-1.5">✓ Priority order dispatch at dealer depots</li>
                    <li className="flex items-center gap-1.5">✓ Professional masking tape roll crate</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl border-2 border-amber-500 bg-amber-50/60 space-y-3 relative">
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold">
                    YOUR CURRENT TIER
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 text-sm">Gold Master Contractor</span>
                    <span className="text-[10px] font-mono text-amber-900">3,000 - 8,000 Pts</span>
                  </div>
                  <ul className="space-y-1.5 text-amber-950 font-medium">
                    <li className="flex items-center gap-1.5">✓ 1.25× Points multiplier on all formulations</li>
                    <li className="flex items-center gap-1.5">✓ ₹3 Lakh accidental insurance coverage</li>
                    <li className="flex items-center gap-1.5">✓ Free Wagner electric roller tool kit</li>
                    <li className="flex items-center gap-1.5">✓ Dedicated WhatsApp support manager</li>
                  </ul>
                </div>

                <div className="p-5 rounded-2xl border border-stone-900 bg-stone-950 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-sm">Royale Master Club</span>
                    <span className="text-[10px] font-mono text-stone-400">8,000+ Pts</span>
                  </div>
                  <ul className="space-y-1.5 text-stone-300">
                    <li className="flex items-center gap-1.5">✓ 1.50× Maximum points multiplier</li>
                    <li className="flex items-center gap-1.5">✓ ₹5 Lakh comprehensive family medical cover</li>
                    <li className="flex items-center gap-1.5">✓ Free Graco Airless Spray Gun</li>
                    <li className="flex items-center gap-1.5">✓ All-expenses-paid Annual Goa Dealer Summit</li>
                  </ul>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
