import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { I18nProvider } from "./lib/i18n";
import ShopPage from "./pages/ShopPage";
import BillPage from "./pages/BillPage";
import { Landing, NotFound, ResetPage } from "./pages/OtherPages";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/l/:slug" element={<ShopPage />} />
          <Route path="/bill/:id" element={<BillPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
