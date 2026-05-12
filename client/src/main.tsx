import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Note: the false-positive crash-signal suppressor (non-Error events,
// ResizeObserver loop noise, etc.) is registered as a capture-phase inline
// script in client/index.html so it runs before any module-loaded listener,
// including the platform health monitor's. Don't re-register it here.

createRoot(document.getElementById("root")!).render(<App />);
