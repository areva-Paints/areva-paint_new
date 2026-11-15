import React from "react";
import { useSiteContent } from "../admin/ContentContext";
import { contentUrl } from "../site-content";
import { CertificationsSection } from "./CertificationCards";

export function Certifications() {
  const content = useSiteContent();
  return (
    <>
      <link rel="stylesheet" href={contentUrl("/assets/certifications.css")} />
      <CertificationsSection content={content} />
    </>
  );
}
