import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./theme.css";
import "./studio.css";
import "./desktop.css";
import "./sharing.css";
import "./design.css";
import "./headings.css";
import "./readability.css";
import "./workflow.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
