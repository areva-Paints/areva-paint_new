import React from 'react';
import { Product } from '../types';
import { X, Clock, Droplet, Layers, Paintbrush, FileText, MessageSquare, Eye, Printer } from 'lucide-react';
import { ProductImageZoom } from './ProductImageZoom';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  selectedColorHex: string;
  selectedColorName: string;
  onRequestQuote: (product: Product) => void;
  onOpenVisualizer: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  selectedColorHex,
  selectedColorName,
  onRequestQuote,
  onOpenVisualizer,
}) => {
  if (!product) return null;

  const handlePrintTDS = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
              <span>{product.categoryName}</span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-500 font-mono">TDS #ARV-{product.id.slice(0, 4).toUpperCase()}</span>
            </div>
            <h2 className="font-display text-xl font-bold text-stone-950">{product.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-950 rounded-xl hover:bg-stone-200/60 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          
          {/* Top Overview Split */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 rounded-2xl overflow-hidden border border-stone-200">
              <ProductImageZoom
                src={product.image}
                alt={product.name}
                sheen={product.sheen}
                tintable={product.tintable}
                selectedColorHex={selectedColorHex}
                selectedColorName={selectedColorName}
              />
            </div>

            <div className="md:col-span-7 space-y-4">
              <p className="text-sm text-stone-700 leading-relaxed">
                {product.description}
              </p>

              {/* Core Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Sheen Level</span>
                  <span className="font-bold text-stone-900">{product.sheen}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Coverage Rate</span>
                  <span className="font-bold text-stone-900 font-mono">{product.coverageSqFtPerLiter} sq ft / Litre</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Environmental</span>
                  <span className="font-bold text-stone-900">{product.vocLevel}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">Warranty</span>
                  <span className="font-bold text-stone-900">{product.specs.warrantyYears} Years Performance</span>
                </div>
              </div>

              {/* Available Sizes */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500 font-semibold">Standard Pack Sizes:</span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-stone-900">
                  {product.availableSizes.map((sz) => (
                    <span key={sz} className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200">
                      {sz} Litres
                    </span>
                  ))}
                </div>
              </div>

              {/* Selected Tint Preview */}
              {product.tintable && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-xs">
                  <span
                    className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-xs"
                    style={{ backgroundColor: selectedColorHex }}
                  />
                  <div>
                    <span className="text-stone-600">Active Tint in Visualizer:</span>
                    <strong className="text-stone-950 font-bold ml-1">{selectedColorName}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Data Sheet Sections */}
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <h3 className="font-display text-sm font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span>Application & Engineering Specifications</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500" /> Drying & Recoat
                </span>
                <p className="text-stone-600 pl-5">Touch dry: {product.specs.dryingTime}. Recoat: {product.specs.recoatTime}.</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-stone-500" /> Thinning / Dilution
                </span>
                <p className="text-stone-600 pl-5">{product.specs.thinnedWith}</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-stone-500" /> Substrate Compatibility
                </span>
                <p className="text-stone-600 pl-5">{product.specs.recommendedSurfaces.join(', ')}.</p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                  <Paintbrush className="w-3.5 h-3.5 text-stone-500" /> Surface Preparation
                </span>
                <p className="text-stone-600 pl-5">{product.specs.surfacePreparation}</p>
              </div>
            </div>
          </div>

          {/* Inquiry & Action Module (No Cart) */}
          <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-stone-900">Need Bulk Quantity or Dealer Pricing?</h4>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Our technical support team provides site estimation, dealer stock availability, and architect submittals.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {product.tintable && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVisualizer();
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-stone-300 text-stone-800 hover:bg-stone-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4 text-amber-700" />
                  <span>Try in Visualizer</span>
                </button>
              )}

              <button
                onClick={() => {
                  onClose();
                  onRequestQuote(product);
                }}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Quotation</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
