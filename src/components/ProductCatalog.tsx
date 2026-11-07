import { useSiteContent } from '../admin/ContentContext';
import React, { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { CATEGORIES, PRODUCTS as DEFAULT_PRODUCTS } from '../data/paintsData';
import { ArrowLeft, ArrowUpRight, Eye, Image as ImageIcon, Info, MessageSquare, Search, Sparkles, X } from 'lucide-react';
import '../product-category.css';

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
  const products = useSiteContent()?.products || DEFAULT_PRODUCTS;
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'coverage' | 'name'>('featured');
  const sectionRef = useRef<HTMLElement>(null);
  const categoryHeading = useRef<HTMLHeadingElement>(null);
  const overviewHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterChange = useRef(false);
  const activeCategory = CATEGORIES.find((category) => category.id === selectedCategory);

  // A plain Products navigation link always returns to the category overview.
  useEffect(() => {
    const resetFromNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href="#products"]');
      if (link && link.getAttribute('target') !== '_blank') {
        focusAfterChange.current = true;
        setSelectedCategory('all');
      }
    };
    document.addEventListener('click', resetFromNavigation);
    return () => document.removeEventListener('click', resetFromNavigation);
  }, []);

  useEffect(() => {
    if (!focusAfterChange.current) return;
    focusAfterChange.current = false;
    (selectedCategory === 'all' ? overviewHeading.current : categoryHeading.current)?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selectedCategory]);

  function openCategory(categoryId: string) {
    focusAfterChange.current = true;
    setSelectedCategory(categoryId);
  }

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesQuery = `${product.name} ${product.tagline} ${product.categoryName}`.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  }).sort((a, b) => {
    if (sortBy === 'coverage') return b.coverageSqFtPerLiter - a.coverageSqFtPerLiter;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
  });

  return (
    <section id="products" className={`pc-catalog${activeCategory ? ' pc-category-view' : ''}`} ref={sectionRef}>
      {activeCategory ? (
        <div className="pc-category-banner">
          <div className="pc-container">
            <nav className="pc-breadcrumb" aria-label="Product category breadcrumb">
              <button type="button" onClick={() => openCategory('all')}>Products</button>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{activeCategory.name}</span>
            </nav>
            <span className="pc-eyebrow">AREVA PAINTS · {activeCategory.name.toUpperCase()}</span>
            <h1 ref={categoryHeading} tabIndex={-1}>{activeCategory.name}</h1>
            <p>{activeCategory.description}</p>
          </div>
        </div>
      ) : (
        <div className="pc-container pc-overview">
          <div className="pc-overview-heading">
            <span className="pc-eyebrow"><Sparkles aria-hidden="true" />PRODUCTS FOR EVERY SURFACE</span>
            <h2 ref={overviewHeading} tabIndex={-1}>Find your perfect finish</h2>
            <p>Explore our paint and coating ranges, compare specifications and find the right solution for your space.</p>
          </div>
          <div className="pc-category-grid">
            {CATEGORIES.map((category) => {
              const count = products.filter((product) => product.categoryId === category.id).length;
              return (
                <button className="pc-category-card" type="button" key={category.id} onClick={() => openCategory(category.id)}>
                  <span className="pc-category-card-top"><span className="pc-category-icon" aria-hidden="true">{category.icon}</span><span className="pc-category-count">{count} {count === 1 ? 'product' : 'products'}</span></span>
                  <span className="pc-category-title">{category.name}</span>
                  <span className="pc-category-description">{category.description}</span>
                  <span className="pc-category-link">Explore range <ArrowUpRight aria-hidden="true" /></span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pc-container pc-range">
        {activeCategory && <button className="pc-back" type="button" onClick={() => openCategory('all')}><ArrowLeft aria-hidden="true" />Back to all categories</button>}
        <div className="pc-toolbar">
          <div className="pc-results-heading">
            <h2>{activeCategory ? `${activeCategory.name} collection` : 'All coatings & formulations'}</h2>
            <p className="pc-result-count" role="status">{filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}{query ? ` matching “${searchQuery.trim()}”` : ' available'}</p>
          </div>
          <div className="pc-search-sort">
            <label className="pc-search">
              <span className="pc-sr-only">Search {activeCategory?.name || 'all products'}</span>
              <Search aria-hidden="true" />
              <input type="search" placeholder={activeCategory ? 'Search this range…' : 'Search all products…'} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </label>
            <label className="pc-sort">
              <span className="pc-sr-only">Sort products</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="featured">Featured products</option>
                <option value="coverage">Coverage (sq ft/unit)</option>
                <option value="name">Product name (A–Z)</option>
              </select>
            </label>
          </div>
        </div>

        <div className="pc-product-list">
          {filteredProducts.map((product) => {
            const unit = product.coverageUnit || 'L';
            const specifications = [
              ['FINISH', product.sheen],
              ['COVERAGE', product.coverageSqFtPerLiter > 0 ? `${product.coverageSqFtPerLiter} sq ft/${unit}/coat` : 'Ask for technical guidance'],
              ['PACK SIZES', product.availableSizes.map((size) => `${size} ${unit}`).join(' · ')],
              ['RECOMMENDED COATS', product.recommendedCoats > 0 ? String(product.recommendedCoats) : ''],
              ['DRYING TIME', product.specs.dryingTime],
              ['APPLICATION', product.specs.applicationMethod],
            ].filter(([, value]) => value);
            const productName = product.name.replace(/^Areva\s+/i, '');
            return (
              <article className="pc-product-row" key={product.id}>
                <div className="pc-details">
                  <span className="pc-product-category">{product.categoryName}</span>
                  <h3>{product.name}</h3>
                  {product.sheen && <p className="pc-finish">{product.sheen}</p>}
                  <p className="pc-product-description">{product.description || product.tagline}</p>
                  <dl className="pc-specifications">
                    {specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                  </dl>
                  {product.tintable && <p className="pc-selected-shade"><span style={{ backgroundColor: selectedColorHex }} aria-hidden="true" />Selected shade: {selectedColorName}</p>}
                  <div className="pc-product-actions">
                    <button className="pc-action pc-action-outline" type="button" onClick={() => onViewProductDetails(product)}><Info aria-hidden="true" />View specifications</button>
                    {product.tintable && <button className="pc-action pc-action-outline" type="button" onClick={() => onOpenVisualizerWithProduct(product)}><Eye aria-hidden="true" />Try in visualizer</button>}
                    <button className="pc-action pc-action-gold" type="button" onClick={() => onRequestQuoteForProduct(product)}><MessageSquare aria-hidden="true" />Enquire</button>
                  </div>
                </div>
                <div className="pc-product-visual">
                  <button className="pc-name-badge" type="button" onClick={() => onViewProductDetails(product)} aria-label={`View ${product.name} photo and specifications`}>
                    <span className="pc-badge-brand">AREVA<span>PAINTS</span></span>
                    <span className="pc-badge-line" aria-hidden="true" />
                    <span className="pc-badge-name">{productName}</span>
                    {product.sheen && <span className="pc-badge-finish">{product.sheen}</span>}
                  </button>
                  <button className="pc-photo-link" type="button" onClick={() => onViewProductDetails(product)}><ImageIcon aria-hidden="true" />View product photo <ArrowUpRight aria-hidden="true" /></button>
                </div>
              </article>
            );
          })}
        </div>
        {!filteredProducts.length && (
          <div className="pc-empty">
            <Search aria-hidden="true" />
            <h3>{query ? 'No matching products' : 'This range is coming soon'}</h3>
            <p>{query ? 'Try a different product name or clear your search.' : 'Explore our other categories or contact us for product guidance.'}</p>
            {query && <button className="pc-back" type="button" onClick={() => setSearchQuery('')}><X aria-hidden="true" />Clear search</button>}
          </div>
        )}
      </div>
    </section>
  );
};
