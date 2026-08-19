import React from "react";
import { useDB, Toaster, Ic, Btn } from "./components/ui";
import { useRoute, navTo } from "./lib/nav";
import { currentUser, logout, resetDemo } from "./lib/data";

/** Last line of defense: never show a blank page — show what actually broke. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-paper p-6">
          <div className="w-full max-w-lg rounded-2xl border border-clay-600/30 bg-card p-7 shadow-xl">
            <div className="flex items-center gap-2.5 text-clay-600">
              <Ic.alert size={22} />
              <h1 className="font-display text-xl font-extrabold text-ink-900">LandSafe hit a runtime error</h1>
            </div>
            <p className="mt-2 text-sm text-moss-500">The screen went dark because of the exception below. Resetting the demo data usually clears it.</p>
            <pre className="mt-4 max-h-44 overflow-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] leading-relaxed text-marigold-500">
              {this.state.error.message}
            </pre>
            <div className="mt-5 flex gap-2.5">
              <Btn variant="danger" onClick={() => { try { resetDemo(); } catch { /* noop */ } location.reload(); }}>Reset demo data & reload</Btn>
              <Btn variant="outline" onClick={() => location.reload()}>Just reload</Btn>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { PublicNav, Home, FindPlots, Footer } from "./pages/customer";
import { VerificationDetail } from "./pages/verification";
import { AdminShell } from "./pages/admin";
import { VenturePortal } from "./pages/venture";
import { LoginScreen, CustomerPortal, SurveyorPortal } from "./pages/portals";

function DemoRibbon() {
  return (
    <div className="border-b border-marigold-600/30 bg-marigold-500 px-4 py-1.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-900">
      Demo mode · simulated data, OCR & Razorpay test payments · no real land records, money or government lookups
    </div>
  );
}

export default function App() {
  const route = useRoute();
  useDB(); // re-render on store changes
  const user = currentUser();

  let view: React.ReactNode;
  switch (route.page) {
    case "find":
      view = <FindPlots initialProject={route.findProject} />;
      break;
    case "login":
      view = <LoginScreen />;
      break;
    case "verify":
      view = (
        <div className="min-h-screen bg-paper">
          <PublicNav />
          <VerificationDetail jobId={route.jobId ?? "VRF-117"} />
          <Footer />
        </div>
      );
      break;
    case "app":
      if (!user) { view = <LoginScreen />; break; }
      if (user.role === "admin" || user.role === "sales") view = <AdminShell />;
      else if (user.role === "venture") view = <VenturePortal />;
      else if (user.role === "surveyor") view = <SurveyorPortal />;
      else view = <CustomerPortal />;
      break;
    default:
      view = (
        <div className="min-h-screen">
          <PublicNav />
          <Home />
        </div>
      );
  }

  // signed-in user opening the app shell needs a sign-out affordance on home pages
  const onPublicPage = route.page === "home" || route.page === "find" || route.page === "verify" || route.page === "login";
  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <DemoRibbon />
        {view}
      {onPublicPage && user && route.page !== "login" && (
        <button
          onClick={() => { logout(); navTo({ page: "home" }); }}
          className="no-print fixed bottom-5 left-5 z-[80] flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-4 py-2.5 text-xs font-bold text-pine-100 shadow-xl transition-transform hover:scale-105 cursor-pointer"
        >
          <Ic.out size={14} /> Sign out ({user.name.split(" ")[0]})
        </button>
      )}
      {route.page === "verify" && user?.role === "admin" && (
        <div className="fixed bottom-5 right-5 z-[80]">
          <Btn variant="dark" onClick={() => navTo({ page: "app" })}><Ic.arrowR size={14} className="rotate-180" /> Back to console</Btn>
        </div>
      )}
      <Toaster />
      </div>
    </ErrorBoundary>
  );
}
