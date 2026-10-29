import React, { useState } from 'react';
import { Product } from '../types';
import { CATEGORIES, PRODUCTS } from '../data/paintsData';
import { Info, Eye, MessageSquare, Check, Sparkles, Filter } from 'lucide-react';
import { ProductImageZoom } from './ProductImageZoom';

interface ProductCatalogProps {
  selectedColorHex: string;
  selectedColorName: string;
  onViewProductDetails: (product: Product) => void;
  onOpenVisualizerWithProduct: (product: Product) => void;
  onRequestQuoteForProduct: (product: Product) => void;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  selectedColorHex,
  selectedColorName,
  onViewProductDetails,
  onOpenVisualizerWithProduct,
  onRequestQuoteForProduct,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'coverage' | 'name'>('featured');

  const CATEGORY_GRADIENTS: Record<string, string> = {
    'interior': 'linear-gradient(135deg, #6c4cf5, #ff4fa3)',
    'exterior': 'linear-gradient(135deg, #ff7a18, #ffb800)',
    'waterproofing': 'linear-gradient(135deg, #0b7bd6, #2dd4e0)',
    'tile-adhesives': 'linear-gradient(135deg, #ff5a5f, #ff8a5f)',
    'sealants': 'linear-gradient(135deg, #0fb5a2, #6ddb8c)',
    'putty-primers': 'linear-gradient(135deg, #8a4cf5, #2d9cff)',
    'textures': 'linear-gradient(135deg, #ff4fa3, #ffb800)',
    'chemicals': 'linear-gradient(135deg, #1b6fd1, #6c4cf5)',
  };

  // Filter products
  const filteredProducts = PRODUCTS.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  }).sort((a, b) => {
    if (sortBy === 'coverage') return b.coverageSqFtPerLiter - a.coverageSqFtPerLiter;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <section id="products" className="py-16 lg:py-24 bg-gradient-to-b from-[#fbfaff] via-white to-[#fbfaff] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#6c4cf5] uppercase tracking-wider mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Products for Every Surface</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#1b1340] tracking-tight">
              High-Performance Coatings & Construction Solutions
            </h2>
            <p className="text-stone-600 text-base mt-2 max-w-2xl">
              Tap any category card below to filter formulations. Select any coating to view full technical data sheets (TDS), coverage, and request trade quotes.
            </p>
          </div>

          {/* Quick Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <input
              type="text"
              placeholder="Search coatings, waterproofing, primers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2.5 text-xs border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6c4cf5] bg-white shadow-xs min-w-[240px]"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 text-xs border border-stone-200 rounded-xl bg-white font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#6c4cf5] shadow-xs"
            >
              <option value="featured">Featured Formulations</option>
              <option value="coverage">Coverage (sq ft/L)</option>
              <option value="name">Product Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Grand 8-Category Colorful Tiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {CATEGORIES.map((cat, idx) => {
            const isSelected = selectedCategory === cat.id;
            const count = PRODUCTS.filter((p) => p.categoryId === cat.id).length;
            const gradient = CATEGORY_GRADIENTS[cat.id] || 'linear-gradient(135deg, #6c4cf5, #ff4fa3)';

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
                className={`relative rounded-3xl p-6 text-left text-white overflow-hidden transition-all duration-300 min-h-[170px] flex flex-col justify-between shadow-md hover:shadow-xl cursor-pointer ${
                  isSelected
                    ? 'ring-4 ring-[#1b1340] scale-[1.02]'
                    : 'hover:-translate-y-1'
                }`}
                style={{
                  background: gradient,
                  transform: isSelected ? 'scale(1.02)' : idx % 2 === 0 ? 'rotate(-0.5deg)' : 'rotate(0.5deg)',
                }}
              >
                {/* Background ambient bubble */}
                <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/20 blur-xl pointer-events-none" />

                {/* Top Emoji Badge & Count */}
                <div className="flex items-center justify-between z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner border border-white/30">
                    {cat.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md text-[11px] font-bold tracking-wide">
                    {count} Products
                  </span>
                </div>

                {/* Details */}
                <div className="z-10 mt-4">
                  <h3 className="font-display text-lg font-extrabold leading-snug">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-white/90 line-clamp-2 mt-1 leading-snug">
                    {cat.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter Indicator Bar */}
        <div className="flex items-center justify-between gap-4 mb-8 pb-3 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-2xl font-extrabold text-[#1b1340]">
              {selectedCategory === 'all' ? 'All Coatings & Formulations' : activeCategoryObj?.name}
            </h3>
            <span className="px-3 py-1 rounded-full bg-stone-100 font-bold text-xs text-stone-600">
              {filteredProducts.length} Results
            </span>
          </div>

          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold text-[#6c4cf5] hover:underline"
            >
              Reset to All ({PRODUCTS.length})
            </button>
          )}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const gradient = CATEGORY_GRADIENTS[product.categoryId] || 'linear-gradient(135deg, #6c4cf5, #ff4fa3)';

            return (
              <article
                key={product.id}
                className="group flex flex-col bg-white rounded-3xl border border-stone-200 overflow-hidden hover:border-[#6c4cf5]/40 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Colorful Gradient Header Banner */}
                <div
                  className="h-28 relative flex items-center justify-between px-6 text-white overflow-hidden"
                  style={{ background: gradient }}
                >
                  <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/20 blur-md pointer-events-none" />
                  
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider opacity-90 block">
                      {product.categoryName}
                    </span>
                    <span className="font-display text-2xl font-black">
                      {product.name.replace('Areva ', '')}
                    </span>
                  </div>

                  <div className="w-10 h-10 rounded-full bg-white/25 backdrop-blur-md flex items-center justify-center font-display font-extrabold text-lg text-white shadow-xs">
                    {product.name[product.name.indexOf(' ') + 1] || 'A'}
                  </div>
                </div>

                {/* Interactive Hover-to-Zoom Imagery Area */}
                <ProductImageZoom
                  src={product.image}
                  alt={product.name}
                  sheen={product.sheen}
                  tintable={product.tintable}
                  selectedColorHex={selectedColorHex}
                  selectedColorName={selectedColorName}
                />

                {/* Card Body */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  
                  <div>
                    <h3 className="font-display text-xl font-bold text-[#1b1340] group-hover:text-[#6c4cf5] transition-colors">
                      {product.name}
                    </h3>

                    <p className="text-xs text-stone-600 line-clamp-2 mt-1.5 leading-relaxed">
                      {product.tagline}
                    </p>

                    {/* Technical Snapshot Strip */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-stone-100 text-xs text-stone-600">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Coverage</span>
                        <span className="font-bold text-stone-900 font-mono">{product.coverageSqFtPerLiter} sq ft/L</span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">VOC Rating</span>
                        <span className="font-bold text-emerald-700">{product.vocLevel.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>

                  {/* Packaging Sizes */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-500 font-semibold text-[11px]">Pack Sizes:</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-stone-900">
                      {product.availableSizes.map((sz) => (
                        <span key={sz} className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                          {sz}L
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onViewProductDetails(product)}
                      className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-800 hover:text-stone-950 hover:bg-stone-50 transition-colors text-xs font-bold flex items-center gap-1.5"
                    >
                      <Info className="w-3.5 h-3.5 text-stone-500" />
                      <span>Tech Specs (TDS)</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {product.tintable && (
                        <button
                          onClick={() => onOpenVisualizerWithProduct(product)}
                          className="p-2.5 rounded-xl border border-[#6c4cf5]/20 text-[#6c4cf5] hover:bg-[#6c4cf5]/10 transition-colors"
                          title="Preview in Color Visualizer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onRequestQuoteForProduct(product)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#1b1340] hover:bg-[#6c4cf5] text-white transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Enquire</span>
                      </button>
                    </div>
                  </div>

                </div>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
};
