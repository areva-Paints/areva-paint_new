import React from 'react';
import { X, CheckCircle2, Smartphone, Sparkles, Paintbrush, Layers, Shield, FileText, Camera, Box, QrCode, MapPin } from 'lucide-react';

interface ImprovementRoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImprovementRoadmapModal: React.FC<ImprovementRoadmapModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200 bg-stone-50">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">
              <Sparkles className="w-4 h-4" />
              <span>Areva Paints · Architecture & Modern Layout Audit</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-stone-950">
              Modern Layout Upgrades & Strategic Suggestions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-950 rounded-xl hover:bg-stone-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Content */}
        <div className="p-6 sm:p-8 space-y-8 max-h-[75vh] overflow-y-auto text-xs sm:text-sm text-stone-700">
          
          {/* Executive Overview */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-stone-800 space-y-2">
            <h3 className="font-display font-bold text-base text-amber-950 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-700" />
              <span>Modern Luxury Architectural Design Evolution</span>
            </h3>
            <p className="leading-relaxed">
              We eliminated the dated top utility bar and clashing rainbow elements, replacing them with a <strong>clean, editorial luxury architectural layout</strong> inspired by modern high-end coating brands (Backdrop, Farrow & Ball, Asian Paints Royale). Below are key suggestions for elevating the customer and trade contractor journey.
            </p>
          </div>

          {/* Strategic Modern Suggestions Grid */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-base text-stone-950">
              Top 6 Recommendations for Modernizing Areva Paints
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Camera className="w-4 h-4 text-amber-700" />
                  <span>1. WebXR Live Camera AR Wall Projection</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Implement browser-based WebXR plane detection. Users point their smartphone camera at their living room walls and see real-time 3D wall recoloring live in their camera viewfinder with automatic door/furniture occlusion.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Box className="w-4 h-4 text-amber-700" />
                  <span>2. Peel-and-Stick Swatch Sample Packs</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Offer low-cost physical 8×10" peel-and-stick coated sample swatches with real paint emulsion. Homeowners test them on different walls under morning and evening daylight before ordering full 20L drums.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <QrCode className="w-4 h-4 text-amber-700" />
                  <span>3. Contractor & Painter Loyalty App</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Print unique serialized QR codes under the lids of Areva paint cans. Registered painters scan them with their phone camera to instantly earn cash rewards and loyalty tier benefits directly to their UPI/bank.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <MapPin className="w-4 h-4 text-amber-700" />
                  <span>4. Real-Time Depot Stock Locator</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Integrate GPS geolocation with dealer inventories across Bengaluru, Mysuru, Pune, Mumbai, Chennai, and Hyderabad. Contractors view live stock counts for immediate same-day site pickup.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>5. Architect BIM / CAD Texture Library</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Provide downloadable Autodesk Revit, SketchUp, and 3ds Max material texture packs for Areva Zester finishes and interior sheens, making it effortless for interior architects to specify Areva in client 3D renders.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200 bg-stone-50/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900 text-sm">
                  <Smartphone className="w-4 h-4 text-amber-700" />
                  <span>6. WhatsApp Quick Re-Order Bot</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Allow repeat painting contractors to send a quick voice note or text on WhatsApp (e.g. "Send 4 cans of Sheen Pro Terracotta to Whitefield site") with automated invoice generation and dispatch.
                </p>
              </div>

            </div>
          </div>

          {/* Summary of What Was Redesigned */}
          <div className="p-5 rounded-2xl border border-stone-200 bg-white space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">
              Implemented Layout Upgrades in this Build:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Removed dark top utility bar & rainbow line</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Modern editorial split hero with live room tint</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Clean architectural swatch ribbon marquee</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Photorealistic room canvas visualizer + upload</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mobile thumb-friendly bottom navigation bar</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Precision paint coverage & can breakdown math</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold rounded-xl bg-stone-950 text-white hover:bg-amber-800 transition-colors shadow-sm"
          >
            Close & Continue Exploring
          </button>
        </div>

      </div>
    </div>
  );
};
