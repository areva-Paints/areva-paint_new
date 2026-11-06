import React from 'react';
import { ShieldCheck, Phone, Mail, MapPin, Sparkles, Download } from 'lucide-react';

interface FooterProps {
  onOpenImprovements: () => void;
  onOpenVisualizer: () => void;
  onOpenCalculator: () => void;
  onOpenDownload?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenImprovements,
  onOpenVisualizer,
  onOpenCalculator,
  onOpenDownload,
}) => {
  return (
    <footer className="bg-stone-950 text-stone-400 text-xs border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-12">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Col 1 & 2: Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-white">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-3 rounded-full bg-amber-500"></span>
                  <span className="w-1.5 h-4 rounded-full bg-rose-500"></span>
                  <span className="w-1.5 h-2.5 rounded-full bg-teal-500"></span>
                </div>
              </div>
              <span className="font-display font-extrabold text-2xl text-white tracking-tight">
                AREVA<span className="text-amber-500 ml-1.5">PAINTS</span>
              </span>
            </div>

            <p className="text-stone-400 leading-relaxed max-w-sm">
              Formulating architectural emulsions, exterior all-weather protective coatings, elastomeric roof waterproofing, and polymer tile adhesives since 2003. Certified low-VOC formulations engineered for lasting beauty and climate defense.
            </p>

            <div className="flex items-center gap-3 text-stone-300 pt-1 font-semibold text-[11px]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> ISO 9001:2015
              </span>
              <span>·</span>
              <span>IGBC Green Certified</span>
              <span>·</span>
              <span>Low-VOC</span>
            </div>
          </div>

          {/* Col 3: Coating Systems */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">
              Coating Systems
            </h4>
            <ul className="space-y-2.5 text-stone-400 font-medium">
              <li><a href="#products" className="hover:text-white transition-colors">Areva Sheen Pro Interior</a></li>
              <li><a href="#products" className="hover:text-white transition-colors">Lumina Luster Exterior</a></li>
              <li><a href="#products" className="hover:text-white transition-colors">AquaSafe Roof Waterproofing</a></li>
              <li><a href="#products" className="hover:text-white transition-colors">RedTape Polymer Adhesive</a></li>
              <li><a href="#products" className="hover:text-white transition-colors">Zester Artisanal Textures</a></li>
            </ul>
          </div>

          {/* Col 4: Digital Tools */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">
              Interactive Tools
            </h4>
            <ul className="space-y-2.5 text-stone-400 font-medium">
              <li>
                <button onClick={onOpenVisualizer} className="hover:text-white transition-colors text-left font-semibold text-amber-400">
                  Room Color Studio & Visualizer
                </button>
              </li>
              <li>
                <button onClick={onOpenCalculator} className="hover:text-white transition-colors text-left">
                  Paint Coverage Calculator
                </button>
              </li>
              <li><a href="#gallery" className="hover:text-white transition-colors">Project gallery</a></li>
              <li>
                <a href="#dealers" className="hover:text-white transition-colors">
                  Authorized Depot Stockists
                </a>
              </li>
              <li>
                <button onClick={onOpenImprovements} className="text-amber-400 hover:text-white font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Modern Suggestions & Audit
                </button>
              </li>
              {onOpenDownload && (
                <li>
                  <button onClick={onOpenDownload} className="text-emerald-400 hover:text-white font-bold flex items-center gap-1.5 pt-1">
                    <Download className="w-3.5 h-3.5" /> Download Full Project (.ZIP)
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 5: Central Depot & Technical Desk */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-white text-xs uppercase tracking-wider">
              Central Depot & Support
            </h4>
            <div className="space-y-2.5 text-stone-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Karnataka Central Manufacturing Facility, Bengaluru Industrial Area</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <a href="tel:+919876543210" className="hover:text-white font-mono font-bold">+91 98765 43210</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <a href="mailto:contact@arevapaints.com" className="hover:text-white">support@arevapaints.com</a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Legal Strip */}
        <div className="pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-500">
          <div>
            © 2026 Areva Paints Limited. All rights reserved. Manufactured in Karnataka since 2003.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-stone-300 cursor-pointer">Technical Data Sheets (TDS)</span>
            <span>·</span>
            <span className="hover:text-stone-300 cursor-pointer">Safety Data Sheets (SDS)</span>
            <span>·</span>
            <span className="hover:text-stone-300 cursor-pointer">Warranty Certificate</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
