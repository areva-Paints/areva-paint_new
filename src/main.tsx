/*
 * Mount the React application and load shared styles.
 * Server APIs and the legacy public layout are served separately by Express.
 */
import { Component, lazy, Suspense, type ReactNode } from "react";
import { ContentProvider } from "./admin/ContentContext";
import { createRoot } from "react-dom/client";
import "./index.css";
import "../public/assets/brand.css";

const pagePath = window.location.pathname.replace(/\/$/, "");
/* Each route loads its own UI; public visitors do not download the admin editor. */
const App = lazy(() => import("./App.tsx"));
const AdminPage = lazy(() =>
  import("./admin/AdminPage").then((module) => ({ default: module.AdminPage })),
);
const WarrantyPage = lazy(() =>
  import("./warranty/WarrantyPage").then((module) => ({
    default: module.WarrantyPage,
  })),
);
/* A failed route download should offer recovery rather than leave a blank page. */
class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main
          role="alert"
          className="min-h-screen flex flex-col gap-4 items-center justify-center p-6 text-purple-900"
        >
          <p>This page could not be loaded. Please refresh and try again.</p>
          <button
            type="button"
            className="rounded-lg bg-purple-900 text-white px-5 py-3"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </button>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <RouteBoundary>
    <Suspense
      fallback={
        <main
          role="status"
          className="min-h-screen flex items-center justify-center text-purple-900"
        >
          Loading Areva Paints…
        </main>
      }
    >
      {pagePath === "/warranty" ? (
        <WarrantyPage />
      ) : pagePath === "/admin" ? (
        <AdminPage />
      ) : (
        <ContentProvider>
          <App />
        </ContentProvider>
      )}
    </Suspense>
  </RouteBoundary>,
);
