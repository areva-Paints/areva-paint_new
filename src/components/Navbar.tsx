import React, { useState } from 'react';
import { Eye, Calculator, Menu, X, Sparkles, Phone, MapPin, MessageSquare, Camera, Download } from 'lucide-react';

interface NavbarProps {
  onOpenVisualizer: () => void;
  onOpenCalculator: () => void;
  onOpenImprovements: () => void;
  onOpenEnquiry: () => void;
  onOpenLiveAR?: () => void;
  onOpenDownload?: () => void;
  activeSection: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenVisualizer,
  onOpenCalculator,
  onOpenImprovements,
  onOpenEnquiry,
  onOpenLiveAR,
  onOpenDownload,
  activeSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Sleek, Modern, Architectural Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 transition-all duration-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-8">
          
          {/* Brand Logo: Clean Luxury Wordmark */}
          <a
            href="#top"
            className="flex items-center gap-3 shrink-0 group focus:outline-none rounded-xl"
            aria-label="Areva Paints Home"
          >
            <div className="w-10 h-10 rounded-xl bg-stone-950 text-white flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
              {/* Minimalist 3-droplet mark */}
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-3.5 rounded-full bg-amber-500 transform -rotate-12"></span>
                <span className="w-1.5 h-4.5 rounded-full bg-rose-500"></span>
                <span className="w-1.5 h-3 rounded-full bg-teal-500 transform rotate-12"></span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="font-display font-extrabold text-2xl tracking-tight text-stone-950 leading-none">
                AREVA<span className="text-amber-700 font-semibold ml-1.5 text-xl">PAINTS</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mt-1">
                Architectural Wall Coatings
              </span>
            </div>
          </a>

          {/* Center Navigation Links (Clean, single-line, hover underlines) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-stone-700">
            <a
              href="#products"
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeSection === 'products' ? 'text-amber-800 font-bold' : ''
              }`}
            >
              Formulations
            </a>
            <a
              href="#visualizer"
              onClick={(e) => {
                e.preventDefault();
                onOpenVisualizer();
                document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 text-amber-800"
            >
              <Eye className="w-4 h-4 text-amber-600" />
              <span>Visualizer Studio</span>
            </a>
            <a
              href="#gallery"
              className="hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Color Stories
            </a>
            <a
              href="#calculator"
              onClick={(e) => {
                e.preventDefault();
                onOpenCalculator();
                document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5"
            >
              <Calculator className="w-4 h-4 text-stone-400" />
              <span>Calculator</span>
            </a>
            <a
              href="#dealers"
              className="hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Dealer Depots
            </a>
          </nav>

          {/* Right Action Zone */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenLiveAR && (
              <button
                onClick={onOpenLiveAR}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100/90 rounded-full transition-all border border-amber-300 shadow-xs"
                title="Launch WebXR Real-Time Camera 3D Wall Recoloring"
              >
                <Camera className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                <span>Live AR Camera</span>
              </button>
            )}

            {onOpenDownload && (
              <button
                onClick={onOpenDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-full transition-all shadow-xs border border-amber-500/40 active:scale-95"
                title="Download complete project source code (.ZIP)"
              >
                <Download className="w-3.5 h-3.5 text-stone-950" />
                <span className="hidden sm:inline">Download Code</span>
                <span className="sm:hidden">Code</span>
              </button>
            )}

            <button
              onClick={onOpenImprovements}
              className="hidden xl:flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-950 bg-stone-100 hover:bg-stone-200/80 px-3 py-2 rounded-full transition-colors border border-stone-200"
              title="Review architecture audit and modernization suggestions"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Modern Suggestions</span>
            </button>

            <button
              onClick={onOpenEnquiry}
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border border-stone-300"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
              <span>Get Quotation</span>
            </button>

            <button
              onClick={() => {
                onOpenVisualizer();
                document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold text-white bg-stone-950 hover:bg-amber-800 rounded-full transition-all shadow-sm active:scale-95 whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              <span>Studio</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stone-700 hover:text-stone-950 rounded-xl hover:bg-stone-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-5 pt-4 pb-6 space-y-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            {onOpenDownload && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDownload();
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-base font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/40 flex items-center justify-between shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-stone-950" />
                  <span>Download Full Project Code</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-stone-950 text-white px-2 py-0.5 rounded-full">ZIP</span>
              </button>
            )}

            {onOpenLiveAR && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLiveAR();
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-base font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-amber-700 animate-pulse" />
                  <span>WebXR Live AR Camera</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-600 text-white px-2 py-0.5 rounded-full">New</span>
              </button>
            )}

            <a
              href="#products"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-base font-semibold text-stone-900 hover:bg-stone-100"
            >
              Formulations Catalog
            </a>
            <a
              href="#visualizer"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenVisualizer();
                document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="block px-3 py-2 rounded-xl text-base font-semibold text-stone-800 hover:bg-stone-100 flex items-center justify-between"
            >
              <span>Visualizer Studio</span>
              <Eye className="w-4 h-4" />
            </a>
            <a
              href="#gallery"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-base font-semibold text-stone-900 hover:bg-stone-100"
            >
              Color Stories & Lookbook
            </a>
            <a
              href="#calculator"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCalculator();
                document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="block px-3 py-2 rounded-xl text-base font-semibold text-stone-900 hover:bg-stone-100"
            >
              Paint Quantity Calculator
            </a>
            <a
              href="#dealers"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-base font-semibold text-stone-900 hover:bg-stone-100"
            >
              Dealer Depots (4 States)
            </a>
            <div className="pt-2 border-t border-stone-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenEnquiry();
                }}
                className="w-full py-3 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Project Quotation</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenImprovements();
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Modern Layout Suggestions & Audit</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Sticky Mobile Navigation Bar (<15% mobile viewport height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-lg px-1 py-1 flex items-center justify-around h-15">
        <a
          href="#products"
          className="flex flex-col items-center justify-center flex-1 py-1 text-stone-600 hover:text-stone-950 active:scale-95 transition-transform"
        >
          <span className="text-sm">🎨</span>
          <span className="text-[10px] font-semibold tracking-tight mt-0.5">Catalog</span>
        </a>

        {onOpenLiveAR && (
          <button
            onClick={onOpenLiveAR}
            className="flex flex-col items-center justify-center flex-1 py-1 text-amber-800 hover:text-amber-950 active:scale-95 transition-transform font-bold"
          >
            <Camera className="w-4 h-4 text-amber-700 animate-pulse" />
            <span className="text-[10px] tracking-tight mt-0.5 font-bold">Live AR</span>
          </button>
        )}

        <button
          onClick={() => {
            onOpenVisualizer();
            document.getElementById('visualizer')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 text-stone-700 hover:text-stone-950 active:scale-95 transition-transform font-medium"
        >
          <Eye className="w-4 h-4 text-stone-600" />
          <span className="text-[10px] tracking-tight mt-0.5">Studio</span>
        </button>

        <button
          onClick={() => {
            onOpenCalculator();
            document.getElementById('calculator')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="flex flex-col items-center justify-center flex-1 py-1 text-stone-600 hover:text-stone-950 active:scale-95 transition-transform font-medium"
        >
          <Calculator className="w-4 h-4 text-stone-500" />
          <span className="text-[10px] tracking-tight mt-0.5">Calc</span>
        </button>

        <a
          href="#dealers"
          className="flex flex-col items-center justify-center flex-1 py-1 text-stone-600 hover:text-stone-950 active:scale-95 transition-transform font-medium"
        >
          <MapPin className="w-4 h-4 text-stone-500" />
          <span className="text-[10px] tracking-tight mt-0.5">Dealers</span>
        </a>
      </nav>
    </>
  );
};
