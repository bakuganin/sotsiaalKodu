import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/commissioner";
import App from "./App";
import "./styles.css";
import "./motion/site-motion.css";
import "./accessibility/accessibility.css";
import "./accessibility/readability.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.dispatchEvent(
  new CustomEvent("site:ready", { detail: { reason: "immediate" } }),
);
