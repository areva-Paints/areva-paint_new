/*
 * Reuse the official Areva logo asset with consistent accessible text across public, warranty and admin pages.
 */
export const AREVA_LOGO_SRC = "/assets/images/areva-brand-logo.png";

/* Reuse the official Areva logo asset with consistent accessible text across public, warranty and admin pages.. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={AREVA_LOGO_SRC}
      alt="Areva Paints"
      width={112}
      height={84}
      className={`areva-brand-logo ${className}`.trim()}
    />
  );
}
