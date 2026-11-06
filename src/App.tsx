import { ProjectGallery } from './components/ProjectGallery';
import React, { useState, useEffect } from 'react';
import { Product } from './types';
import { COLOR_SHADES } from './data/paintsData';
import { HeroSlider } from './components/HeroSlider';
import { ColorTicker } from './components/ColorTicker';
import { ProductCatalog } from './components/ProductCatalog';
import { ColorVisualizer } from './components/ColorVisualizer';
import { ProductDetailModal } from './components/ProductDetailModal';
import { PaintCalculator } from './components/PaintCalculator';
import { DealersAndServices } from './components/DealersAndServices';
import { GrandCtaBanner } from './components/GrandCtaBanner';
import { EnquiryModal } from './components/EnquiryModal';
import { ImprovementRoadmapModal } from './components/ImprovementRoadmapModal';
import { LiveCameraARVisualizer } from './components/LiveCameraARVisualizer';
import { SwatchSampleOrderModal } from './components/SwatchSampleOrderModal';
import { PainterLoyaltyPortal } from './components/PainterLoyaltyPortal';
import { ProjectDownloadModal } from './components/ProjectDownloadModal';
import { AttachedPageViewer } from './components/AttachedPageViewer';
import { ColorSplashArcade } from './components/ColorSplashArcade';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MessageSquare, ArrowUp } from 'lucide-react';

export default function App() {
  // View mode switcher: 'attached' (shows the user's attached HTML file), 'react' (modern React platform), 'split' (side-by-side)
  const [viewMode, setViewMode] = useState<'attached' | 'react' | 'split'>('attached');

  // Global Color State (synced across Visualizer, Catalog, and Calculator)
  const [selectedColorHex, setSelectedColorHex] = useState<string>(COLOR_SHADES[7].hex); // Terracotta Hearth
  const [selectedColorName, setSelectedColorName] = useState<string>(COLOR_SHADES[7].name);

  // Modal States
  const [isLiveArOpen, setIsLiveArOpen] = useState(false);
  const [isSwatchOpen, setIsSwatchOpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [enquiryInitialData, setEnquiryInitialData] = useState<{
    topic?: string;
    product?: string;
    shade?: string;
    message?: string;
  }>({});
  const [isImprovementsOpen, setIsImprovementsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Scroll listener for back to top
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSelectColor = (hex: string, name: string) => {
    setSelectedColorHex(hex);
    setSelectedColorName(name);
  };

  const handleOpenEnquiry = (options?: {
    topic?: string;
    product?: string;
    shade?: string;
    message?: string;
  }) => {
    setEnquiryInitialData(options || {});
    setIsEnquiryOpen(true);
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-[#1b1340]">
      {/* Main Content Area */}
      {viewMode === 'attached' ? (
        <div className="flex-1 w-full h-screen">
          <AttachedPageViewer onBackToReact={() => setViewMode('react')} />
        </div>
      ) : viewMode === 'split' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-300">
          {/* Left Column: Modern React Suite */}
          <div className="h-[calc(100vh-140px)] overflow-y-auto">
            <div className="bg-stone-900 text-stone-200 text-xs px-4 py-2 font-bold sticky top-0 z-20 flex items-center justify-between">
              <span>✨ Modern React Architectural Platform</span>
              <span className="text-amber-400 font-mono text-[10px]">React 19 + TypeScript</span>
            </div>
            <HeroSlider
              onOpenVisualizer={() => scrollToSection('visualizer')}
              onExploreProducts={() => scrollToSection('products')}
              onOpenLiveAR={() => setIsLiveArOpen(true)}
              onSelectCategory={(_catId) => scrollToSection('products')}
            />
            <ColorTicker
              onSelectColor={handleSelectColor}
              onOpenVisualizer={() => scrollToSection('visualizer')}
            />
            <ProductCatalog
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
              onViewProductDetails={(prod) => setDetailProduct(prod)}
              onOpenVisualizerWithProduct={(_prod) => scrollToSection('visualizer')}
              onRequestQuoteForProduct={(prod) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  product: prod.name,
                  message: `Please share technical specifications, packaging sizes, and trade pricing for ${prod.name}.`,
                });
              }}
            />
            <ColorVisualizer
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
              onSelectColor={handleSelectColor}
              onOpenLiveAR={() => setIsLiveArOpen(true)}
              onRequestQuote={(shadeName, shadeCode) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  shade: `${shadeName} (${shadeCode})`,
                  message: `I visualized the shade ${shadeName} on my room walls.`,
                });
              }}
            />
            <PaintCalculator
              onRequestQuoteWithEstimate={({ productName, paintableArea, litersNeeded, canBreakdown, unit }) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  product: productName,
                  message: `Paint Calculator: ${productName} for ${paintableArea} sq ft (${litersNeeded} ${unit || 'L'}).`,
                });
              }}
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
            />
            <ProjectGallery />
            <DealersAndServices />
          </div>

          {/* Right Column: Attached HTML Page View */}
          <div className="h-[calc(100vh-140px)] flex flex-col">
            <div className="bg-stone-900 text-stone-200 text-xs px-4 py-2 font-bold sticky top-0 z-20 flex items-center justify-between">
              <span>📄 Attached HTML Single-File Website</span>
              <span className="text-emerald-400 font-mono text-[10px]">areva-paints_a2364c60.html</span>
            </div>
            <div className="flex-1">
              <iframe
                src="/assets/aistudio/areva-paints_a2364c60.html"
                title="Attached HTML Preview in Split View"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <Navbar
            onOpenVisualizer={() => scrollToSection('visualizer')}
            onOpenCalculator={() => scrollToSection('calculator')}
            onOpenImprovements={() => setIsImprovementsOpen(true)}
            onOpenEnquiry={() => handleOpenEnquiry()}
            onOpenLiveAR={() => setIsLiveArOpen(true)}
            onOpenSwatches={() => setIsSwatchOpen(true)}
            onOpenLoyalty={() => setIsLoyaltyOpen(true)}
            onOpenDownload={() => setIsDownloadOpen(true)}
            onToggleAttachedView={() => setViewMode('attached')}
            isAttachedViewActive={false}
            activeSection="hero"
          />
          <main className="flex-1">
            {/* Grand Multi-Slide Hero Carousel with Sliding Images & Color Swatches */}
            <HeroSlider
              onOpenVisualizer={() => scrollToSection('visualizer')}
              onExploreProducts={() => scrollToSection('products')}
              onOpenLiveAR={() => setIsLiveArOpen(true)}
              onSelectCategory={(_catId) => {
                scrollToSection('products');
              }}
            />

            {/* Continuous Gliding Color Marquee Ticker */}
            <ColorTicker
              onSelectColor={handleSelectColor}
              onOpenVisualizer={() => scrollToSection('visualizer')}
            />

            {/* 8-Category Colorful Tiles & Formulations Product Catalog */}
            <ProductCatalog
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
              onViewProductDetails={(prod) => setDetailProduct(prod)}
              onOpenVisualizerWithProduct={(_prod) => {
                scrollToSection('visualizer');
              }}
              onRequestQuoteForProduct={(prod) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  product: prod.name,
                  message: `Please share technical specifications, packaging sizes, and trade pricing for ${prod.name}.`,
                });
              }}
            />

            {/* Interactive Color Studio & Room Visualizer */}
            <ColorVisualizer
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
              onSelectColor={handleSelectColor}
              onOpenLiveAR={() => setIsLiveArOpen(true)}
              onRequestQuote={(shadeName, shadeCode) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  shade: `${shadeName} (${shadeCode})`,
                  message: `I visualized the shade ${shadeName} on my room walls and would like a price quotation and dealer availability.`,
                });
              }}
            />


            {/* Precision Paint Coverage Calculator */}
            <PaintCalculator
              onRequestQuoteWithEstimate={({ productName, paintableArea, litersNeeded, canBreakdown, unit }) => {
                handleOpenEnquiry({
                  topic: 'Request a quotation',
                  product: productName,
                  message: `Paint Calculator Estimate: ${productName} for ${paintableArea} sq ft. Estimated volume: ${litersNeeded} ${unit || 'L'} (${canBreakdown}).`,
                });
              }}
              selectedColorHex={selectedColorHex}
              selectedColorName={selectedColorName}
            />

            {/* Latest project photo albums */}
            <ProjectGallery />
            {/* Dealers & On-Site Technical Services */}
            <DealersAndServices />

            {/* Grand Vibrant Multi-Gradient Call-to-Action Banner */}
            <GrandCtaBanner
              onOpenVisualizer={() => scrollToSection('visualizer')}
              onOpenEnquiry={() => handleOpenEnquiry({ topic: 'Request a quotation' })}
              onOpenDownload={() => setIsDownloadOpen(true)}
            />
          </main>

          {/* Grand Colorful Footer */}
          <Footer
            onOpenImprovements={() => setIsImprovementsOpen(true)}
            onOpenVisualizer={() => scrollToSection('visualizer')}
            onOpenCalculator={() => scrollToSection('calculator')}
            onOpenDownload={() => setIsDownloadOpen(true)}
          />
        </>
      )}

      {/* Technical Data Sheet (TDS) Modal */}
      <ProductDetailModal
        product={detailProduct}
        onClose={() => setDetailProduct(null)}
        selectedColorHex={selectedColorHex}
        selectedColorName={selectedColorName}
        onRequestQuote={(prod) => {
          handleOpenEnquiry({
            topic: 'Request a quotation',
            product: prod.name,
            message: `Please share trade pricing and dealer availability for ${prod.name}.`,
          });
        }}
        onOpenVisualizer={() => scrollToSection('visualizer')}
      />

      {/* Quotation & Technical Enquiry Modal */}
      <EnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => setIsEnquiryOpen(false)}
        initialTopic={enquiryInitialData.topic}
        initialProduct={enquiryInitialData.product}
        initialShade={enquiryInitialData.shade}
        initialMessage={enquiryInitialData.message}
      />

      {/* Website Improvement Suggestions Modal */}
      <ImprovementRoadmapModal
        isOpen={isImprovementsOpen}
        onClose={() => setIsImprovementsOpen(false)}
        onOpenLiveAR={() => setIsLiveArOpen(true)}
        onOpenSwatches={() => setIsSwatchOpen(true)}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
      />

      {/* Point 2: Peel-and-Stick Swatch Sample Packs Modal */}
      <SwatchSampleOrderModal
        isOpen={isSwatchOpen}
        onClose={() => setIsSwatchOpen(false)}
        onOpenEnquiry={() => handleOpenEnquiry({ topic: 'Color Consultation', shade: selectedColorName })}
      />

      {/* Point 3: Contractor & Painter Loyalty App / QR Reward Engine Modal */}
      <PainterLoyaltyPortal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        onOpenEnquiry={() => handleOpenEnquiry({ topic: 'Contractor Partnership' })}
      />

      {/* Full Project Code Download Modal */}
      <ProjectDownloadModal
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
      />

      {/* WebXR Live Camera Augmented Reality (AR) Studio */}
      <LiveCameraARVisualizer
        isOpen={isLiveArOpen}
        onClose={() => setIsLiveArOpen(false)}
        initialShadeHex={selectedColorHex}
        initialShadeName={selectedColorName}
        onRequestQuoteWithShade={(shadeName, shadeCode, snapshotUrl) => {
          handleOpenEnquiry({
            topic: 'Request a quotation',
            shade: `${shadeName} (${shadeCode})`,
            message: `Visualized ${shadeName} (${shadeCode}) live on my walls via WebXR AR Camera.${snapshotUrl ? ' Frame snapshot captured.' : ''}`,
          });
        }}
      />

      {/* Floating WhatsApp Action Button */}
      <a
        href="https://wa.me/919876543210?text=Hello%20Areva%20Paints%2C%20I%20have%20an%20enquiry%20regarding%20coatings."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Direct WhatsApp Consultation"
        className="fixed bottom-20 md:bottom-6 right-5 z-40 w-13 h-13 rounded-full bg-[#1fa855] hover:bg-[#189148] text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="Chat with Technical Expert on WhatsApp"
      >
        <MessageSquare className="w-6 h-6" />
      </a>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 md:bottom-6 left-5 z-40 w-11 h-11 rounded-full bg-white border border-stone-200 text-[#1b1340] hover:text-[#6c4cf5] shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Dedicated Color Splash Arcade Mini-Game (Non-disturbing Launcher & Modal) */}
      {viewMode !== 'attached' && (
        <ColorSplashArcade
          onApplyPaletteToVisualizer={(shadeHex) => {
            scrollToSection('visualizer');
            setSelectedColorHex(shadeHex);
          }}
        />
      )}

    </div>
  );
}
