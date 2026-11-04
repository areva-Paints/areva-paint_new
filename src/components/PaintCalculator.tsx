import { useSiteContent } from '../admin/ContentContext';
import React, { useState, useEffect } from 'react';
import { Calculator, MessageSquare, Check, Layers, Sparkles, ChevronDown } from 'lucide-react';
import { PRODUCTS as DEFAULT_PRODUCTS, CATEGORIES } from '../data/paintsData';

interface PaintCalculatorProps {
  onRequestQuoteWithEstimate: (details: {
    productName: string;
    paintableArea: number;
    litersNeeded: number;
    canBreakdown: string;
    unit?: string;
  }) => void;
  selectedColorHex: string;
  selectedColorName: string;
}

export const PaintCalculator: React.FC<PaintCalculatorProps> = ({
  onRequestQuoteWithEstimate,
  selectedColorHex,
  selectedColorName,
}) => {
  const PRODUCTS = (useSiteContent()?.products || DEFAULT_PRODUCTS).filter(p => p.coverageSqFtPerLiter > 0);
  const [length, setLength] = useState<number>(14);
  const [width, setWidth] = useState<number>(12);
  const [height, setHeight] = useState<number>(10);
  const [doors, setDoors] = useState<number>(1);
  const [windows, setWindows] = useState<number>(2);
  const [coats, setCoats] = useState<number>(2);
  const [selectedProductId, setSelectedProductId] = useState<string>('sheen-pro');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filter products for dropdown
  const filteredProducts = PRODUCTS.filter(
    (p) => filterCategory === 'all' || p.categoryId === filterCategory
  );

  // Automatically select first valid product when category changes
  useEffect(() => {
    if (filteredProducts.length > 0 && !filteredProducts.some((p) => p.id === selectedProductId)) {
      setSelectedProductId(filteredProducts[0].id);
    }
  }, [filterCategory, filteredProducts, selectedProductId]);

  const selectedProduct = PRODUCTS.find((p) => p.id === selectedProductId) || filteredProducts[0] || PRODUCTS[0];

  // Calculation Math
  const grossWallArea = 2 * (length + width) * height;
  const deductions = doors * 21 + windows * 15;
  const unit = selectedProduct.coverageUnit || 'L';
  const appliedCoats = selectedProduct.calculationBasis === 'floor' ? 1 : coats;
  const netArea = selectedProduct.calculationBasis === 'floor' ? length * width : Math.max(0, grossWallArea - deductions);

  // Liters needed = (netArea * coats / coveragePerLiter) * 1.10 (10% safety buffer)
  const exactLiters = (netArea * appliedCoats) / selectedProduct.coverageSqFtPerLiter;
  const totalLitersWithWastage = Math.ceil(exactLiters * 1.1 * 2) / 2;

  // Package sizing optimizer
  const calculateCans = (liters: number) => {
    let remaining = liters;
    const cans20L = Math.floor(remaining / 20);
    remaining %= 20;
    const cans10L = Math.floor(remaining / 10);
    remaining %= 10;
    const cans4L = Math.floor(remaining / 4);
    remaining %= 4;
    const cans1L = Math.ceil(remaining);

    const breakdown: Array<{ size: number; count: number }> = [];
    if (cans20L > 0) breakdown.push({ size: 20, count: cans20L });
    if (cans10L > 0) breakdown.push({ size: 10, count: cans10L });
    if (cans4L > 0) breakdown.push({ size: 4, count: cans4L });
    if (cans1L > 0) breakdown.push({ size: 1, count: cans1L });
    return breakdown;
  };

  const recommendedCans = calculateCans(totalLitersWithWastage);
  const canBreakdownString = recommendedCans
    .map((c) => `${c.count} × ${c.size}${unit}`)
    .join(' + ');

  const handleSendEstimate = () => {
    onRequestQuoteWithEstimate({
      productName: selectedProduct.name,
      paintableArea: Math.round(netArea),
      litersNeeded: totalLitersWithWastage,
      canBreakdown: canBreakdownString,
      unit,
    });
  };

  return (
    <section id="calculator" className="py-16 lg:py-24 bg-stone-50 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-10">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700 tracking-wider uppercase mb-1">
            <Calculator className="w-4 h-4" />
            <span>Precision Surface Estimator</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-950 tracking-tight">
            How much paint does your project require?
          </h2>
          <p className="text-stone-600 text-base mt-2">
            Select any coating formulation from our catalog to automatically calculate paint volume in Liters based on product-specific coverage, room dimensions, and opening deductions.
          </p>
        </div>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Inputs Column (7 Cols) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            
            {/* 1. Coating Product Dropdown Selection with Category Filter */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label htmlFor="coating-dropdown" className="text-xs font-bold text-stone-900 block">
                  1. Select Coating Formulation ({PRODUCTS.length} Available)
                </label>
                
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFilterCategory('all')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all whitespace-nowrap ${
                      filterCategory === 'all'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    All
                  </button>
                  {CATEGORIES.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFilterCategory(c.id)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all whitespace-nowrap ${
                        filterCategory === c.id
                          ? 'bg-stone-900 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comprehensive Product Select Dropdown */}
              <div className="relative">
                <select
                  id="coating-dropdown"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-4 py-3.5 text-xs sm:text-sm font-bold border border-stone-300 rounded-2xl bg-stone-50 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:bg-white appearance-none cursor-pointer shadow-xs transition-colors pr-10"
                >
                  {filteredProducts.map((p) => (
                    <option key={p.id} value={p.id} className="py-2">
                      {p.name} — {p.categoryName} ({p.coverageSqFtPerLiter} sq ft/{p.coverageUnit||'L'} · {p.sheen})
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>

              {/* Active Product Specs Strip */}
              <div className="mt-3 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  <span className="font-bold text-amber-950">{selectedProduct.name}</span>
                  <span className="text-stone-400">·</span>
                  <span className="text-amber-900 font-semibold">{selectedProduct.sheen}</span>
                </div>
                <div className="flex items-center gap-3 text-stone-700 font-mono text-[11px]">
                  <span>Rating: <strong>{selectedProduct.coverageSqFtPerLiter} sq ft/{unit}</strong></span>
                  <span>·</span>
                  <span>Standard: <strong>{selectedProduct.recommendedCoats} Coats</strong></span>
                </div>
              </div>
            </div>

            {/* 2. Room Dimensions */}
            <div>
              <label className="text-xs font-bold text-stone-900 block mb-2">
                2. Room Dimensions (Feet)
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Length (ft)</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={length}
                    onChange={(e) => setLength(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Width (ft)</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={width}
                    onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Height (ft)</span>
                  <input
                    type="number"
                    min="6"
                    max="30"
                    value={height}
                    onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Deductions & Application Coats */}
            <div>
              <label className="text-xs font-bold text-stone-900 block mb-2">
                3. Openings & Application Coats
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Doors (-21 sq ft)</span>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={doors}
                    onChange={(e) => setDoors(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Windows (-15 sq ft)</span>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={windows}
                    onChange={(e) => setWindows(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Number of Coats</span>
                  <select
                    value={coats}
                    onChange={(e) => setCoats(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-semibold border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    <option value={1}>1 Coat (Touch-up / Primer)</option>
                    <option value={2}>2 Coats (Standard Opacity)</option>
                    <option value={3}>3 Coats (High-Build / Exterior)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Results Summary Box (5 Cols) */}
          <div className="lg:col-span-5 bg-stone-900 text-white p-6 sm:p-8 rounded-3xl border border-stone-800 shadow-xl space-y-6">
            
            <div>
              <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block mb-1">
                Calculated Material Volume
              </span>
              <h3 className="font-display text-2xl font-bold">
                {selectedProduct.name}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Calculated for {appliedCoats} coats with {selectedProduct.coverageSqFtPerLiter} sq ft/{unit} coverage + 10% safety buffer.
              </p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-stone-800">
              <div>
                <span className="text-xs text-stone-400 block font-medium">Net Paintable Area</span>
                <span className="font-mono text-3xl font-extrabold text-white tabular-nums">
                  {Math.round(netArea)}
                </span>
                <span className="text-xs text-stone-400 ml-1">sq ft</span>
              </div>

              <div>
                <span className="text-xs text-stone-400 block font-medium">Required Paint</span>
                <span className="font-mono text-3xl font-extrabold text-amber-400 tabular-nums">
                  {totalLitersWithWastage}
                </span>
                <span className="text-xs text-stone-400 ml-1">{unit === 'kg' ? 'kg' : 'Litres'}</span>
              </div>
            </div>

            {/* Packaging Recommendation */}
            <div>
              <span className="text-xs font-semibold text-stone-300 block mb-2">
                Optimal Pack Size Configuration:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {recommendedCans.map((can, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 border border-stone-700 text-xs font-mono font-bold text-stone-200"
                  >
                    {can.count} × {can.size} {unit === 'kg' ? 'kg bag' : 'Litre can'}{can.count > 1 ? 's' : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Send Estimate Action */}
            <div className="pt-2">
              <button
                onClick={handleSendEstimate}
                className="w-full py-4 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-md active:scale-[0.99]"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Request Quotation for {totalLitersWithWastage} {unit}</span>
              </button>
              
              <div className="text-[11px] text-stone-400 text-center mt-2.5">
                Quotes include contractor discount rates & nearest depot stock availability.
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
