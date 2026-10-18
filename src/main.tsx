import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./quiz-experience.css";
import "./theme.css";
import "./workspace.css";
import { ResultNavigation } from "./components/ResultNavigation";

if (import.meta.env.PROD) {
  const script = document.createElement("script");
  script.src = `${import.meta.env.BASE_URL}pwa.js`;
  script.defer = true;
  document.head.append(script);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ResultNavigation />
  </React.StrictMode>
);
