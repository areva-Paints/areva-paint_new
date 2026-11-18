/*
 * Connect the public certifications section to CMS content and its shared card renderer.
 */
import React from "react";
import { useSiteContent } from "../admin/ContentContext";
import { contentUrl } from "../site-content";
import { CertificationsSection } from "./CertificationCards";

/* Connect the public certifications section to CMS content and its shared card renderer.. */
export function Certifications() {
  const content = useSiteContent();
  return (
    <>
      <link rel="stylesheet" href={contentUrl("/assets/certifications.css")} />
      <CertificationsSection content={content} />
    </>
  );
}
