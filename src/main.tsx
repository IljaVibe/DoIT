import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./themes.css";
import Widget from "./Widget";
import { AccountShell } from "./Account";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has("widget") ? (
      <Widget />
    ) : (
      <AccountShell>
        <App />
      </AccountShell>
    )}
  </React.StrictMode>,
);
