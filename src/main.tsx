import { WarrantyPage } from "./warranty/WarrantyPage";
import { AdminPage } from "./admin/AdminPage";
import { ContentProvider } from "./admin/ContentContext";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "../public/assets/brand.css";

const pagePath = window.location.pathname.replace(/\/$/, "");
createRoot(document.getElementById("root")!).render(
  pagePath === "/warranty" ? (
    <WarrantyPage />
  ) : pagePath === "/admin" ? (
    <AdminPage />
  ) : (
    <ContentProvider>
      <App />
    </ContentProvider>
  ),
);
