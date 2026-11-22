/*
 * Share illustrated More navigation cards between React and server-rendered public layouts.
 */
import { ArrowRight, X } from "lucide-react";

const links = [
  {
    title: "Services",
    description: "Painting, colour advice and protection for every surface.",
    href: "#services",
    view: "services",
    image: "/assets/images/more/services.webp",
  },
  {
    title: "About Areva",
    description: "Discover our story, services and partner resources.",
    href: "#about",
    view: "about",
    image: "/assets/images/more/about.webp",
  },
  {
    title: "Authorised dealers",
    description: "Find your local Areva dealer and the right product support.",
    href: "#portals",
    view: "portals",
    image: "/assets/images/more/dealers.webp",
  },
  {
    title: "Certifications and documents",
    description: "Browse certificates, reports and product data sheets.",
    href: "#certs",
    view: undefined,
    image: "/assets/images/more/documents.webp",
  },
  {
    title: "Terms and conditions",
    description: "Read the warranty terms for your product or product type.",
    href: "#terms",
    view: "terms",
    image: "/assets/images/more/terms.webp",
  },
  {
    title: "Contact",
    description: "Ask for product guidance, a quotation or customer care.",
    href: "#contact",
    view: "contact",
    image: "/assets/images/more/contact.webp",
  },
  {
    title: "Admin portal",
    description: "Sign in to manage your Areva website and content.",
    href: "/admin",
    view: undefined,
    image: "/assets/images/more/admin.webp",
  },
] as const;

/** Card links inside the header's native, keyboard-accessible More disclosure. */
export function MoreMenuCards() {
  return (
    <div
      id="ref-more-panel"
      className="ref-more-panel"
      role="region"
      aria-label="More Areva pages"
    >
      <div className="ref-more-toolbar">
        <div>
          <span className="ref-more-kicker">EXPLORE AREVA</span>
          <p className="ref-more-intro">Services, support and resources</p>
        </div>
        <button
          type="button"
          className="ref-more-close"
          data-close-more
          aria-label="Close more menu"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="ref-more-grid">
        {links.map((link, index) => (
          <a
            key={link.href}
            className="ref-more-card"
            href={link.href}
            data-ref-nav={link.view}
            target={link.href.startsWith("/") ? "_top" : undefined}
            aria-labelledby={`ref-more-title-${index}`}
            aria-describedby={`ref-more-copy-${index}`}
          >
            <span className="ref-more-media">
              <img
                src={link.image}
                alt=""
                width={600}
                height={300}
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="ref-more-copy">
              <span className="ref-more-card-heading">
                <span id={`ref-more-title-${index}`}>{link.title}</span>
                <ArrowRight size={20} aria-hidden="true" />
              </span>
              <span
                id={`ref-more-copy-${index}`}
                className="ref-more-description"
              >
                {link.description}
              </span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
