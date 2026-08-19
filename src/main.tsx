import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Crash net: if a module-level failure happens before React mounts,
// show a diagnostic instead of a blank screen.
function showCrash(msg: string) {
  const root = document.getElementById("root");
  if (root && !root.childElementCount) {
    root.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;background:#eef1ec;font-family:ui-sans-serif,system-ui;padding:24px">
      <div style="max-width:520px;background:#fbfcfa;border:1px solid #d8ded6;border-radius:16px;padding:28px;box-shadow:0 20px 50px rgba(13,27,21,.12)">
        <div style="font-weight:800;font-size:20px;color:#0d1b15">LandSafe failed to start</div>
        <p style="color:#5c6b62;font-size:14px;margin:8px 0 14px">A startup exception was caught before the UI could mount:</p>
        <pre style="background:#0d1b15;color:#e39b21;border-radius:10px;padding:12px;font-size:12px;overflow:auto;max-height:180px">${msg}</pre>
        <button onclick="localStorage.clear();location.reload()" style="margin-top:16px;background:#a33a2a;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer">Reset local data & reload</button>
      </div></div>`;
  }
}
window.addEventListener("error", (e) => showCrash(e.message || "Unknown startup error"));
window.addEventListener("unhandledrejection", (e) => showCrash(String(e.reason)));

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
