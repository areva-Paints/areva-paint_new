import { useSiteContent } from '../admin/ContentContext';
import React, { useState } from 'react';
import { MapPin, Phone, MessageSquare, Check, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

export const DealersAndServices: React.FC = () => {
  const [pincodeQuery, setPincodeQuery] = useState<string>('560038');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [serviceBooked, setServiceBooked] = useState<boolean>(false);
  const [serviceName, setServiceName] = useState<string>('Free Site Moisture & Waterproofing Inspection');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientCity, setClientCity] = useState<string>('Bengaluru');

  const DEFAULT_DEALERS: Array<{ pin: string; city: string; state: string; name: string; phone: string; address: string; badges: string[] }> = [
    { pin: '560038', city: 'Bengaluru Central', state: 'Karnataka', name: 'Sri Balaji Paint & Hardware Depot', phone: '+91 98451 22334', address: 'Plot 42, 100 Feet Road, HAL 2nd Stage, Indiranagar', badges: ['Automated Tinting', 'Putty & Waterproofing', 'Site Delivery'] },
    { pin: '560078', city: 'Bengaluru South', state: 'Karnataka', name: 'Chamundi Color World', phone: '+91 98801 44556', address: 'Kanakapura Main Road, Near Metro, JP Nagar 6th Phase', badges: ['Computerized Tinting', 'Moisture Survey', 'Express Delivery'] },
    { pin: '570001', city: 'Mysuru', state: 'Karnataka', name: 'Cauvery Building Coatings', phone: '+91 94480 33221', address: 'Shop 18, Sayyaji Rao Road, Near City Bus Stand', badges: ['Full Architectural Range', 'Contractor Rates'] },
    { pin: '580020', city: 'Hubli - Dharwad', state: 'Karnataka', name: 'North Karnataka Paint Distributors', phone: '+91 98440 77889', address: '88 Station Road, Opposite Railway Office, Hubli', badges: ['Industrial Putty', 'Regional Master Depot'] },
    { pin: '400058', city: 'Mumbai Suburban', state: 'Maharashtra', name: 'Maruti Waterproofing & Surface Coatings', phone: '+91 98200 44332', address: 'Shop 4, SV Road, Near Andheri Station, Andheri West', badges: ['Waterproofing Specialist', 'Color Dispenser'] },
    { pin: '411028', city: 'Pune East', state: 'Maharashtra', name: 'Shree Ganesh Paint Center', phone: '+91 98220 11223', address: 'Bypass Road, Near Magarpatta City, Hadapsar', badges: ['Texture Coatings', 'Same-Day Dispatch'] },
    { pin: '422005', city: 'Nashik', state: 'Maharashtra', name: 'Godavari Color Plaza', phone: '+91 94222 55667', address: '22 College Road, Near Canada Corner, Nashik', badges: ['Builder Supply', 'Direct Warranty'] },
    { pin: '600010', city: 'Chennai Central', state: 'Tamil Nadu', name: 'Meenakshi Paints & Chemicals', phone: '+91 98400 99887', address: 'Poonamallee High Road, Near Ega Theatre, Kilpauk', badges: ['Certified Depot', 'Computer Tinting', 'Bulk Stock'] },
    { pin: '641004', city: 'Coimbatore', state: 'Tamil Nadu', name: 'Kongu Surface Solutions', phone: '+91 94430 11445', address: '450 Avinashi Road, Peelamedu, Coimbatore', badges: ['Exterior Range', 'Site Technical Team'] },
    { pin: '625001', city: 'Madurai', state: 'Tamil Nadu', name: 'Pandian Paint House', phone: '+91 98421 66778', address: '76 West Veli Street, Near Town Hall, Madurai', badges: ['Primer & Putty', 'Free Shade Card'] },
    { pin: '500072', city: 'Hyderabad', state: 'Andhra Pradesh', name: 'Deccan Coating Systems', phone: '+91 98480 22119', address: 'Plot 104, Kukatpally Main Road, Near Metro Station', badges: ['Regional Master Hub', 'Same-Day Dispatch'] },
    { pin: '530020', city: 'Visakhapatnam', state: 'Andhra Pradesh', name: 'Coastal Wall Protection Hub', phone: '+91 98491 55662', address: 'Main Road, Daba Gardens, Near Jagadamba Center', badges: ['Coastal Grade', 'Waterproofing'] },
    { pin: '520002', city: 'Vijayawada', state: 'Andhra Pradesh', name: 'Krishna Paints & Adhesives', phone: '+91 98481 88990', address: 'MG Road, Governorpet, Opposite Swarna Palace', badges: ['Tile Adhesive', 'Wall Putty'] },
  ];

  const ALL_DEALERS = useSiteContent()?.dealers || DEFAULT_DEALERS;

  const POPULAR_PINS = ['560038', '560078', '400058', '411028', '600010', '641004', '500072', '530020'];

  const filteredDealers = ALL_DEALERS.filter((d) => {
    const matchState = selectedState === 'All' || d.state === selectedState;
    if (!matchState) return false;
    const q = pincodeQuery.trim().toLowerCase();
    if (!q) return true;
    if (/^\d{1,6}$/.test(q)) {
      return d.pin === q || d.pin.startsWith(q);
    }
    return d.city.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q);
  });

  const handleBookService = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceBooked(true);
    setTimeout(() => setServiceBooked(false), 3500);
  };

  return (
    <section id="dealers" className="py-16 lg:py-24 bg-stone-100 border-b border-stone-200">
      <div className="page-gradient-banner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
          {/* Section Heading */}
          <div className="page-gradient-heading max-w-3xl mb-10">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 tracking-wider uppercase mb-1">
              <MapPin className="w-4 h-4" />
              <span>Regional Distribution & Turnkey Services</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-950 tracking-tight">
              Certified Dealers & Professional Application Support
            </h2>
            <p className="text-stone-600 text-base mt-2">
              With manufacturing roots established in Karnataka since 2003, our authorised distribution and technical site specialists span 4 key states.
            </p>
          </div>

        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 2-Column Split: Dealer Locator Left, On-Site Service Booking Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Dealer Network (7 Cols) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-stone-950">
                    Find an Authorised Dealer Depot
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    Type your 6-digit Pincode to view stockists with tinting machines, putty, and waterproofing solutions.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <a
                    href="tel:+919876543210"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs shadow-xs transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                    <span>Head Office: +91 98765 43210</span>
                  </a>
                  <a
                    href="https://wa.me/919876543210?text=Hello%20Areva%20Paints%20Head%20Office,%20please%20connect%20me%20with%20the%20nearest%20dealer."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Support</span>
                  </a>
                </div>
              </div>

              {/* State Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
                {['All', ...new Set(ALL_DEALERS.map(d => d.state))].map((state) => (
                  <button
                    key={state}
                    onClick={() => setSelectedState(state)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      selectedState === state
                        ? 'bg-stone-950 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            {/* Pincode Input & Quick Chips */}
            <div className="space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-stone-300 focus-within:ring-2 focus-within:ring-amber-500">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <input
                  type="text"
                  maxLength={6}
                  value={pincodeQuery}
                  onChange={(e) => setPincodeQuery(e.target.value)}
                  placeholder="Type 6-digit Pincode (e.g. 560038, 400058)..."
                  className="w-full text-xs font-semibold text-stone-900 bg-transparent outline-none placeholder:text-stone-400"
                />
                {pincodeQuery && (
                  <button
                    type="button"
                    onClick={() => setPincodeQuery('')}
                    className="text-stone-400 hover:text-stone-600 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Popular Pincode Suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-stone-500">Popular:</span>
                {POPULAR_PINS.map((pin) => (
                  <button
                    key={pin}
                    type="button"
                    onClick={() => setPincodeQuery(pin)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                      pincodeQuery === pin
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {pin}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Output */}
            {filteredDealers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {filteredDealers.map((dealer, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl border border-stone-200 bg-stone-50 hover:border-stone-400 hover:bg-white transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                            {dealer.city}
                          </span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded">
                            PIN {dealer.pin}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors mt-0.5">
                          {dealer.name}
                        </h4>
                      </div>
                      <MapPin className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors shrink-0" />
                    </div>

                    <p className="text-[11px] text-stone-500 leading-snug">
                      {dealer.address}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {dealer.badges.map((b, bi) => (
                        <span key={bi} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {b}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                      <a
                        href={`tel:${dealer.phone}`}
                        className="text-xs font-semibold text-stone-800 hover:text-amber-700 flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-amber-600" />
                        <span>{dealer.phone}</span>
                      </a>
                      <a
                        href={`https://wa.me/${dealer.phone.replace(/[^0-9]/g, '')}?text=Hello ${dealer.name}, I need Areva Paints stock in PIN ${dealer.pin}.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Unserved Pincode Card with Head Office Mobile Fallback */
              <div className="p-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                    📍
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      No Authorised Retail Depot in Pincode "{pincodeQuery}" Yet
                    </h4>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      We do not have a retail store in this pincode yet, but <b>Areva Paints ships factory-direct with door delivery across India</b>! You can contact our Head Office directly for immediate dispatch:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <a
                    href="tel:+919876543210"
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-stone-950 text-white font-bold text-xs hover:bg-stone-800 transition-colors shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Call Head Office: +91 98765 43210</span>
                  </a>

                  <a
                    href={`https://wa.me/919876543210?text=Hello Areva Paints Head Office, I am looking for paints in pincode ${pincodeQuery}. Please guide on direct factory delivery.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Head Office</span>
                  </a>
                </div>
              </div>
            )}

          </div>

          {/* On-Site Application Services (5 Cols) */}
          <div className="lg:col-span-5 bg-stone-900 text-white p-6 sm:p-8 rounded-3xl border border-stone-800 shadow-xl space-y-6">
            
            <div>
              <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block mb-1">
                Turnkey Project Services
              </span>
              <h3 className="font-display text-2xl font-bold">
                Book a Site Technical Survey
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Our certified application engineers visit your villa or commercial project to test wall moisture content and recommend the optimal primer/topcoat system.
              </p>
            </div>

            <form onSubmit={handleBookService} className="space-y-3 text-xs">
              <div>
                <label className="text-stone-300 font-semibold block mb-1">Select Service</label>
                <select
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option>Free Site Moisture & Waterproofing Inspection</option>
                  <option>Architectural Color Consultation with Swatches</option>
                  <option>Trained Crew Painting Estimate & Turnkey Execution</option>
                  <option>Terrace Ponding & Crack-Bridging Assessment</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-300 font-semibold block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-stone-300 font-semibold block mb-1">Mobile (WhatsApp)</label>
                  <input
                    type="tel"
                    required
                    placeholder="98450 12345"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md ${
                    serviceBooked
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95'
                  }`}
                >
                  {serviceBooked ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Survey Request Confirmed! Our Team Will Call You.</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4" />
                      <span>Request Free Technical Visit</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-stone-400 text-center pt-1">
                Zero obligation · Certified technical inspection report delivered within 24h
              </div>
            </form>

          </div>

        </div>

      </div>
    </section>
  );
};
