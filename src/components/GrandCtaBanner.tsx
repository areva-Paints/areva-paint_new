import React from 'react';
import { Eye, Upload, MessageSquare, Sparkles, ArrowRight, Download } from 'lucide-react';

interface GrandCtaBannerProps {
  onOpenVisualizer: () => void;
  onOpenEnquiry: () => void;
  onOpenDownload?: () => void;
}

export const GrandCtaBanner: React.FC<GrandCtaBannerProps> = ({
  onOpenVisualizer,
  onOpenEnquiry,
  onOpenDownload,
}) => {
  return (
    <section className="py-16 lg:py-24 bg-stone-100/60 border-t border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Sleek Modern Architectural CTA Banner */}
        <div className="relative rounded-3xl lg:rounded-[40px] p-8 sm:p-14 lg:p-20 text-white shadow-2xl overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 border border-stone-800">
          
          {/* Subtle Ambient Glow */}
          <div className="absolute right-12 top-10 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute left-1/4 -bottom-20 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

          {/* Decorative Swatch Pillars (Desktop only) */}
          <div className="absolute right-12 bottom-12 hidden lg:flex items-end gap-3 pointer-events-none opacity-80">
            <div className="w-12 h-36 rounded-full bg-[#c8623f] border border-white/20 shadow-xl" />
            <div className="w-12 h-48 rounded-full bg-[#e3cfa8] border border-white/20 shadow-xl" />
            <div className="w-12 h-40 rounded-full bg-[#587b68] border border-white/20 shadow-xl" />
            <div className="w-12 h-28 rounded-full bg-[#26305a] border border-white/20 shadow-xl" />
          </div>

          <div className="relative z-10 max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-widest border border-white/20 text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Architectural Color Studio</span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
              Ready to visualize your walls with lasting precision?
            </h2>

            <p className="text-base sm:text-lg text-stone-300 leading-relaxed font-medium">
              Experience shades on our photorealistic architectural presets, upload your own home photo, or connect with our regional technical consultants for trade specifications.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={onOpenVisualizer}
                className="px-7 py-4 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span>Launch Visualizer Studio</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </button>

              <button
                onClick={onOpenEnquiry}
                className="px-6 py-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Project Quotation</span>
              </button>

              {onOpenDownload && (
                <button
                  onClick={onOpenDownload}
                  className="px-6 py-4 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Full Project (.ZIP)</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
