import React from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";

// Handle OAuth callback BEFORE React renders
// This prevents the 404 flash when Supabase redirects with tokens in hash
const hash = window.location.hash;
const isOAuthCallback = hash && (hash.includes('access_token=') || hash.includes('error='));

async function initializeApp() {
  if (isOAuthCallback) {
    // OAuth callback detected - process tokens before rendering
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    // Clean URL IMMEDIATELY to prevent 404
    window.history.replaceState(null, '', window.location.pathname + '#/');
    
    if (accessToken && refreshToken) {
      // Set the session from the extracted tokens
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  }
  
  // Now render the app
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initializeApp();
