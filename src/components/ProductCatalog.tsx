import { getProductDisplayDetails } from '../data/productDetails';
import { ProductSummaryHeading } from './ProductSummaryHeading';
import { useSiteContent } from '../admin/ContentContext';
import React, { useEffect, useRef, useState } from 'react';
import type { Product } from '../types';
import { CATEGORIES, PRODUCTS as DEFAULT_PRODUCTS } from '../data/paintsData';
import { ArrowLeft, ArrowUpRight, Eye, Image as ImageIcon, Info, MessageSquare, Search, Sparkles, X } from 'lucide-react';
import { ProductFlipBadge } from './ProductFlipBadge';
import { CategorySceneCard } from './CategorySceneCard';
import { CategoryLandingHero } from './CategoryLandingHero';
import '../product-category.css';
import '../../public/assets/category-scenes.css';
import '../../public/assets/category-landings.css';

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
  const hubRef = useRef<HTMLElement>(null);
  const rangeRef = useRef<HTMLDivElement>(null);
  const categoryHeading = useRef<HTMLHeadingElement>(null);
  const overviewHeading = useRef<HTMLHeadingElement>(null);
  const rangeHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterChange = useRef(false);
  const destinationAfterChange = useRef<'hub' | 'range'>('hub');
  const activeCategory = CATEGORIES.find((category) => category.id === selectedCategory);

  function focusOverview(destination: 'hub' | 'range') {
    const heading = destination === 'range' ? rangeHeading.current : overviewHeading.current;
    const target = destination === 'range' ? rangeRef.current : hubRef.current;
    heading?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function focusCategory() {
    categoryHeading.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // Products opens Interior Paints; explicit hub and complete-catalogue links retain their destinations.
  useEffect(() => {
    const resetFromNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href="#solutions"], a[href="#products"], a[href="#products/all"]');
      if (link && link.getAttribute('target') !== '_blank') {
        event.preventDefault();
        if (link.getAttribute('href') === '#products') {
          if (selectedCategory === 'interior') focusCategory();
          else {
            focusAfterChange.current = true;
            setSelectedCategory('interior');
          }
          return;
        }
        const destination = link.getAttribute('href') === '#products/all' ? 'range' : 'hub';
        destinationAfterChange.current = destination;
        if (selectedCategory === 'all') requestAnimationFrame(() => focusOverview(destination));
        else {
          focusAfterChange.current = true;
          setSelectedCategory('all');
        }
      }
    };
    document.addEventListener('click', resetFromNavigation);
    return () => document.removeEventListener('click', resetFromNavigation);
  }, [selectedCategory]);

  useEffect(() => {
    if (!focusAfterChange.current) return;
    focusAfterChange.current = false;
    if (selectedCategory === 'all') focusOverview(destinationAfterChange.current);
    else focusCategory();
  }, [selectedCategory]);

  function openCategory(categoryId: string) {
    destinationAfterChange.current = 'hub';
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
        <CategoryLandingHero category={activeCategory} headingRef={categoryHeading} onExplore={() => focusOverview('range')} onCategoryChange={openCategory} />
      ) : (
        <section id="solutions" className="pc-container pc-overview" ref={hubRef} aria-labelledby="pc-solutions-heading">
          <div className="pc-overview-heading">
            <span className="pc-eyebrow"><Sparkles aria-hidden="true" />PRODUCTS FOR EVERY SURFACE</span>
            <h2 id="pc-solutions-heading" className="category-hub-title" ref={overviewHeading} tabIndex={-1}>Solutions for <em>every surface.</em></h2>
            <p>Choose a category to explore the right paints, protective coatings and finishes for your space.</p>
            <a className="pc-all-products-link" href="#products/all">View all products <ArrowUpRight aria-hidden="true" /></a>
          </div>
          <div className="category-scene-grid">
            {CATEGORIES.map((category) => {
              return (
                <button className="category-scene-card" type="button" key={category.id} aria-label={`Explore ${category.name}`} onClick={() => openCategory(category.id)}>
                  <CategorySceneCard category={category} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="pc-container pc-range" ref={rangeRef}>
        {activeCategory && <button className="pc-back" type="button" onClick={() => openCategory('all')}><ArrowLeft aria-hidden="true" />Back to all categories</button>}
        <div className="pc-toolbar">
          <div className="pc-results-heading">
            <h2 ref={rangeHeading} tabIndex={-1}>{activeCategory ? `${activeCategory.name} collection` : 'All coatings & formulations'}</h2>
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
            const specifications = getProductDisplayDetails(product);
            return (
              <article className="pc-product-row" key={product.id}>
                <div className="pc-details">
                  <ProductSummaryHeading product={product}/>
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
                  <ProductFlipBadge
                    key={JSON.stringify([product.id, product.image, selectedCategory, searchQuery, sortBy])}
                    name={product.name}
                    image={product.image}
                    sheen={product.sheen}
                    onOpen={() => onViewProductDetails(product)}
                  />
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
