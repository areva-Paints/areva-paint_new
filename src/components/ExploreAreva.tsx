import React from "react";
import {
  Building2,
  Store,
  BookOpen,
  Headphones,
  ShieldCheck,
  LockKeyhole,
  ChevronRight,
} from "lucide-react";

export const EXPLORE_AREVA_RESOURCES = [
  {
    title: "Our Story",
    description: "Discover Areva Paints",
    href: "#our-story",
    icon: Building2,
  },
  {
    title: "Dealer Network",
    description: "Find authorised dealers",
    href: "#portals",
    icon: Store,
  },
  {
    title: "Resource Centre",
    description: "Brochures, TDS & certificates",
    href: "#certs",
    icon: BookOpen,
  },
  {
    title: "Customer Care",
    description: "Get expert assistance",
    href: "#contact",
    icon: Headphones,
  },
  {
    title: "Warranty & Support",
    description: "Product warranty services",
    href: "/warranty",
    icon: ShieldCheck,
  },
  {
    title: "Partner Login",
    description: "Authorised portal access",
    href: "/admin",
    icon: LockKeyhole,
  },
] as const;

export function ExploreAreva({
  resolveLink = (path) => path,
}: {
  resolveLink?: (path: string) => string;
}) {
  return (
    <section
      id="about"
      className="ea-explore"
      data-ref-view="about"
      aria-labelledby="ea-title"
    >
      <div className="ea-banner">
        <div className="ea-wrap">
          <div className="ea-heading">
            <p className="ea-kicker">SERVICES / SUPPORT / PARTNER RESOURCES</p>
            <h1 id="ea-title">Explore Areva</h1>
            <p className="ea-intro">
              Discover our services, support and partner resources, all in one
              place.
            </p>
          </div>
        </div>
      </div>
      <div className="ea-wrap ea-content">
        <div className="ea-section-heading">
          <h2>How can we help you?</h2>
          <p>Explore the resources and support available from Areva Paints.</p>
        </div>
        <div className="ea-grid">
          {EXPLORE_AREVA_RESOURCES.map((item) => {
            const href = resolveLink(item.href);
            return (
              <a
                key={item.title}
                className="ea-card"
                href={href}
                target={href.startsWith("#") ? undefined : "_top"}
              >
                <span className="ea-icon" aria-hidden="true">
                  <item.icon strokeWidth={1.65} />
                </span>
                <div className="ea-card-copy">
                  <h3>{item.title}</h3>
                  <span>{item.description}</span>
                </div>
                <ChevronRight className="ea-arrow" aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
