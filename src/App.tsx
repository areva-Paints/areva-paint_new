import React, { useState, useEffect } from 'react';
import { Product } from './types';
import { COLOR_SHADES } from './data/paintsData';
import { Navbar } from './components/Navbar';
import { HeroSlider } from './components/HeroSlider';
import { ColorTicker } from './components/ColorTicker';
import { ColorBubbleGame } from './components/ColorBubbleGame';
import { ProductCatalog } from './components/ProductCatalog';
import { ColorVisualizer } from './components/ColorVisualizer';
import { InspirationGallery } from './components/InspirationGallery';
import { ProductDetailModal } from './components/ProductDetailModal';
import { PaintCalculator } from './components/PaintCalculator';
import { DealersAndServices } from './components/DealersAndServices';
import { GrandCtaBanner } from './components/GrandCtaBanner';
import { EnquiryModal } from './components/EnquiryModal';
import { ImprovementRoadmapModal } from './components/ImprovementRoadmapModal';
import { LiveCameraARVisualizer } from './components/LiveCameraARVisualizer';
import { ProjectDownloadModal } from './components/ProjectDownloadModal';
import { Footer } from './components/Footer';
import { MessageSquare, Sparkles, ArrowUp, Download } from 'lucide-react';

export default function App() {
  // Global Color State (synced across Visualizer, Catalog, Calculator, and Inspiration)
  const [selectedColorHex, setSelectedColorHex] = useState<string>(COLOR_SHADES[7].hex); // Terracotta Hearth
  const [selectedColorName, setSelectedColorName] = useState<string>(COLOR_SHADES[7].name);

  // Modal States
  const [isLiveArOpen, setIsLiveArOpen] = useState(false);
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
    <div className="min-h-screen flex flex-col font-sans text-[#1b1340] pb-16 md:pb-0">
      
      {/* Top Navbar */}
      <Navbar
        onOpenVisualizer={() => scrollToSection('visualizer')}
        onOpenCalculator={() => scrollToSection('calculator')}
        onOpenImprovements={() => setIsImprovementsOpen(true)}
        onOpenEnquiry={() => handleOpenEnquiry({ topic: 'Request a quotation' })}
        onOpenLiveAR={() => setIsLiveArOpen(true)}
        onOpenDownload={() => setIsDownloadOpen(true)}
        activeSection="home"
      />

      {/* Main Content */}
      <main className="flex-1">
        
        {/* Grand Multi-Slide Hero Carousel with Sliding Images & Color Swatches */}
        <HeroSlider
          onOpenVisualizer={() => scrollToSection('visualizer')}
          onExploreProducts={() => scrollToSection('products')}
          onOpenLiveAR={() => setIsLiveArOpen(true)}
          onSelectCategory={(catId) => {
            scrollToSection('products');
          }}
        />

        {/* Continuous Gliding Color Marquee Ticker */}
        <ColorTicker
          onSelectColor={handleSelectColor}
          onOpenVisualizer={() => scrollToSection('visualizer')}
        />

        {/* Pop the Colour Bubbles Interactive Game Arena */}
        <ColorBubbleGame />

        {/* 8-Category Colorful Tiles & Formulations Product Catalog */}
        <ProductCatalog
          selectedColorHex={selectedColorHex}
          selectedColorName={selectedColorName}
          onViewProductDetails={(prod) => setDetailProduct(prod)}
          onOpenVisualizerWithProduct={(prod) => {
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

        {/* Designer Inspiration & Project Gallery */}
        <InspirationGallery
          onSelectColor={handleSelectColor}
          onOpenVisualizer={() => scrollToSection('visualizer')}
        />

        {/* Precision Paint Coverage Calculator */}
        <PaintCalculator
          onRequestQuoteWithEstimate={({ productName, paintableArea, litersNeeded, canBreakdown }) => {
            handleOpenEnquiry({
              topic: 'Request a quotation',
              product: productName,
              message: `Paint Calculator Estimate: ${productName} for ${paintableArea} sq ft. Estimated volume: ${litersNeeded} Litres (${canBreakdown}).`,
            });
          }}
          selectedColorHex={selectedColorHex}
          selectedColorName={selectedColorName}
        />

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

    </div>
  );
}
