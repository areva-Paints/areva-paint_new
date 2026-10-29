import React, { useState } from 'react';
import { MapPin, Phone, MessageSquare, Check, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';

export const DealersAndServices: React.FC = () => {
  const [selectedState, setSelectedState] = useState<string>('Karnataka');
  const [serviceBooked, setServiceBooked] = useState<boolean>(false);
  const [serviceName, setServiceName] = useState<string>('Free Site Moisture & Waterproofing Inspection');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientCity, setClientCity] = useState<string>('Bengaluru');

  const DEALERS_BY_STATE: Record<string, Array<{ city: string; name: string; phone: string; address: string }>> = {
    Karnataka: [
      { city: 'Bengaluru Central', name: 'Sri Balaji Paint & Hardware Depot', phone: '+91 98451 22334', address: 'Old Madras Road, Indiranagar' },
      { city: 'Bengaluru South', name: 'Chamundi Color World', phone: '+91 98801 44556', address: 'Kanakapura Main Road, JP Nagar' },
      { city: 'Mysuru', name: 'Cauvery Building Coatings', phone: '+91 94480 33221', address: 'Sayyaji Rao Road' },
      { city: 'Hubli - Dharwad', name: 'North Karnataka Paint Distributors', phone: '+91 98440 77889', address: 'Station Road, Hubli' },
    ],
    Maharashtra: [
      { city: 'Pune East', name: 'Shree Ganesh Paint Center', phone: '+91 98220 11223', address: 'Kharadi Bypass Road, Hadapsar' },
      { city: 'Mumbai Suburban', name: 'Maruti Waterproofing & Coatings', phone: '+91 98200 44332', address: 'SV Road, Andheri West' },
      { city: 'Nashik', name: 'Godavari Color Plaza', phone: '+91 94222 55667', address: 'College Road, Nashik' },
    ],
    'Tamil Nadu': [
      { city: 'Chennai Central', name: 'Meenakshi Paints & Chemicals', phone: '+91 98400 99887', address: 'Poonamallee High Road, Kilpauk' },
      { city: 'Coimbatore', name: 'Kongu Surface Solutions', phone: '+91 94430 11445', address: 'Avinashi Road, Peelamedu' },
      { city: 'Madurai', name: 'Pandian Paint House', phone: '+91 98421 66778', address: 'West Veli Street' },
    ],
    'Andhra Pradesh': [
      { city: 'Hyderabad / Secunderabad', name: 'Deccan Coating Systems', phone: '+91 98480 22119', address: 'Kukatpally Main Road' },
      { city: 'Visakhapatnam', name: 'Coastal Wall Protection Hub', phone: '+91 98491 55662', address: 'Daba Gardens' },
      { city: 'Vijayawada', name: 'Krishna Paints & Adhesives', phone: '+91 98481 88990', address: 'MG Road, Governorpet' },
    ],
  };

  const currentDealers = DEALERS_BY_STATE[selectedState] || [];

  const handleBookService = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceBooked(true);
    setTimeout(() => setServiceBooked(false), 3500);
  };

  return (
    <section id="dealers" className="py-16 lg:py-24 bg-stone-100 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <div className="max-w-3xl mb-10">
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

        {/* 2-Column Split: Dealer Locator Left, On-Site Service Booking Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Dealer Network (7 Cols) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-stone-950">Authorised Dealer Locator</h3>
                <p className="text-xs text-stone-500">Select your state to view verified depot stockists.</p>
              </div>

              {/* State Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {Object.keys(DEALERS_BY_STATE).map((state) => (
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

            {/* Dealers List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {currentDealers.map((dealer, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl border border-stone-200 bg-stone-50 hover:border-stone-400 hover:bg-white transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                        {dealer.city}
                      </span>
                      <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                        {dealer.name}
                      </h4>
                    </div>
                    <MapPin className="w-4 h-4 text-stone-400 group-hover:text-amber-600 transition-colors shrink-0" />
                  </div>

                  <p className="text-[11px] text-stone-500 leading-snug">
                    {dealer.address}
                  </p>

                  <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                    <a
                      href={`tel:${dealer.phone}`}
                      className="text-xs font-semibold text-stone-800 hover:text-amber-700 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-amber-600" />
                      <span>{dealer.phone}</span>
                    </a>
                    <a
                      href={`https://wa.me/${dealer.phone.replace(/[^0-9]/g, '')}?text=Hello, I need Areva Paints stock availability.`}
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
