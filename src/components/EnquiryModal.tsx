import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, MessageSquare, Phone, Building2, Send } from 'lucide-react';
import { EnquiryFormData } from '../types';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
  initialProduct?: string;
  initialShade?: string;
  initialMessage?: string;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({
  isOpen,
  onClose,
  initialTopic = 'Request a quotation',
  initialProduct = '',
  initialShade = '',
  initialMessage = '',
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<EnquiryFormData>({
    topic: initialTopic,
    fullName: '',
    phone: '',
    city: 'Bengaluru',
    productName: initialProduct,
    shadeName: initialShade,
    message: initialMessage,
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [assignedDepot, setAssignedDepot] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      topic: initialTopic,
      productName: initialProduct || prev.productName,
      shadeName: initialShade || prev.shadeName,
      message: initialMessage || prev.message,
    }));
  }, [initialTopic, initialProduct, initialShade, initialMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const data = await res.json();
        setTicketId(data.ticketId || `ARV-REQ-${Date.now().toString().slice(-5)}`);
        if (data.assignedDepot && data.assignedDepot.name) {
          setAssignedDepot(`${data.assignedDepot.name} (${data.assignedDepot.city})`);
        }
      } else {
        setTicketId(`ARV-REQ-${Date.now().toString().slice(-5)}`);
      }
    } catch (err) {
      // Offline fallback
      setTicketId(`ARV-REQ-${Date.now().toString().slice(-5)}`);
    } finally {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  const whatsappText = encodeURIComponent(
    `Areva Paints Enquiry (${formData.topic})\nName: ${formData.fullName}\nPhone: ${formData.phone}\nCity: ${formData.city}${
      formData.productName ? `\nProduct: ${formData.productName}` : ''
    }${formData.shadeName ? `\nShade: ${formData.shadeName}` : ''}${
      formData.message ? `\nDetails: ${formData.message}` : ''
    }`
  );
  const whatsappUrl = `https://wa.me/919876543210?text=${whatsappText}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-700" />
            <h2 className="font-display text-lg font-bold text-stone-950">
              Technical & Quotation Enquiry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-950 rounded-xl hover:bg-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-stone-950">Enquiry Transmitted</h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
              Your inquiry has been registered under reference <strong className="font-mono text-stone-900">{ticketId}</strong>. Our regional technical sales desk for {formData.city} will contact you shortly with trade rates and specifications.
            </p>

            {assignedDepot && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 flex items-center justify-center gap-2 max-w-md mx-auto">
                <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Assigned Depot: <strong>{assignedDepot}</strong></span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Open Instant WhatsApp Chat</span>
              </a>

              <button
                onClick={() => {
                  setIsSubmitted(false);
                  onClose();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="font-semibold text-stone-700 block mb-1">Inquiry Purpose</label>
              <select
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              >
                <option>Request a quotation</option>
                <option>Dealer or distributor enquiry</option>
                <option>Architect / Builder project specification</option>
                <option>Free site moisture & technical survey</option>
                <option>Physical shade card & sample request</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sundaram"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Mobile (WhatsApp)</label>
                <input
                  type="tel"
                  required
                  placeholder="98450 12345"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">City / Location</label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Coating System</label>
                <input
                  type="text"
                  placeholder="e.g. Sheen Pro"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Visualizer Shade</label>
                <input
                  type="text"
                  placeholder="e.g. Terracotta (AR108)"
                  value={formData.shadeName}
                  onChange={(e) => setFormData({ ...formData, shadeName: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-700 block mb-1">Project Details or Area (sq ft)</label>
              <textarea
                rows={3}
                placeholder="Mention estimated square footage, surface condition, or questions..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3 border-t border-stone-100">
              <span className="text-[11px] text-stone-500 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-amber-700" />
                <span>Direct Support: +91 98765 43210</span>
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-400 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Technical Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
