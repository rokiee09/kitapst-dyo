import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <TooltipProvider delayDuration={250}>
        <App />
        <Toaster richColors position="bottom-right" theme="dark" />
      </TooltipProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
