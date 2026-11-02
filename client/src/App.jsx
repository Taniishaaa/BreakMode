import { useEffect } from "react";
import { useStore } from "./store";
import { useReplay } from "./useReplay";
import { useResolver } from "./useResolver";
import AuthPage from "./components/AuthPage.jsx";
import TopBar from "./components/TopBar.jsx";
import MatchesPage from "./components/MatchesPage.jsx";
import MatchView from "./components/MatchView.jsx";
import History from "./components/History.jsx";
import PointsToast from "./components/PointsToast.jsx";
import { BrandMark } from "./components/ui.jsx";

export default function App() {
  const authStatus = useStore((s) => s.authStatus);
  const route = useStore((s) => s.route);
  useReplay();
  useResolver();

  useEffect(() => {
    const { bootAuth, syncRoute } = useStore.getState();
    bootAuth();
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  if (authStatus === "checking") {
    return <div className="splash" role="status" aria-label="Loading"><BrandMark size={44} /></div>;
  }
  if (authStatus === "anon") return <AuthPage />;

  return (
    <div className="app">
      <TopBar />
      <main className="stage">
        {route.name === "match" ? <MatchView id={route.id} />
          : route.name === "predictions" ? <History />
          : <MatchesPage />}
      </main>
      <PointsToast />
    </div>
  );
}
