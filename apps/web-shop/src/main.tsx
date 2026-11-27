import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import "./styles.css";
import { auth, isLoggedIn, setOnExpired, shopApi } from "./lib/api";
import { ForgotPage, LoginPage, ResetPage, SignupPage } from "./pages/Auth";
import { DashboardPage, OrdersPage, ProductsPage } from "./pages/Dashboard";
import { AdminPage, ApiPage, DocsSection, SettingsPage } from "./pages/Settings";

function Guard({ role, children }: { role: "shop" | "admin"; children: ReactNode }) {
  const nav = useNavigate();
  const [ok, setOk] = useState(isLoggedIn(role));
  useEffect(() => {
    setOnExpired((r) => {
      if (r === role) {
        setOk(false);
        nav(role === "admin" ? "/admin/login" : "/login");
      }
    });
  }, [nav, role]);
  if (!ok) return <Navigate to={role === "admin" ? "/admin/login" : "/login"} replace />;
  return <>{children}</>;
}

function Layout({ role, children }: { role: "shop" | "admin"; children: ReactNode }) {
  const nav = useNavigate();
  const [name, setName] = useState<string>("");
  useEffect(() => {
    if (role === "shop") shopApi.me().then((s) => setName(s.name)).catch(() => {});
    else setName("מנהל/ת המערכת");
  }, [role]);
  const links: Array<[string, string]> =
    role === "shop"
      ? [["/", "📊 לוח בקרה"], ["/orders", "🧾 הזמנות"], ["/products", "🧸 מוצרים ומלאי"], ["/api", "🔑 API וחיבורים"], ["/settings", "⚙️ פרטי החנות"]]
      : [["/admin", "🛡️ אישור חנויות"]];
  return (
    <div className="min-h-dvh">
      <header className="bg-gradient-to-l from-sky to-[#5bc0ff] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-2xl" aria-hidden>🏪</span>
            <div>
              <p className="text-lg font-extrabold">{name || "…"}</p>
              <p className="text-xs opacity-90">פורטל החנויות · רשימת משאלות</p>
            </div>
          </div>
          <button className="btn-press rounded-xl bg-white/20 px-3 py-2 font-bold" onClick={async () => { await auth.logout(role); nav(role === "admin" ? "/admin/login" : "/login"); }}>
            יציאה
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2" aria-label="ניווט ראשי">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => `whitespace-nowrap rounded-t-2xl px-4 py-2 font-bold ${isActive ? "bg-bg text-ink" : "text-white/90 hover:bg-white/10"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

const shop = (el: ReactNode) => (
  <Guard role="shop">
    <Layout role="shop">{el}</Layout>
  </Guard>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/docs" element={<div className="mx-auto max-w-4xl p-4"><DocsSection /></div>} />
        <Route path="/" element={shop(<DashboardPage />)} />
        <Route path="/orders" element={shop(<OrdersPage />)} />
        <Route path="/products" element={shop(<ProductsPage />)} />
        <Route path="/api" element={shop(<ApiPage />)} />
        <Route path="/settings" element={shop(<SettingsPage />)} />
        <Route path="/admin/login" element={<LoginPage role="admin" />} />
        <Route path="/admin" element={<Guard role="admin"><Layout role="admin"><AdminPage /></Layout></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
