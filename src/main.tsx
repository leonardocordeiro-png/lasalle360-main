import React from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";

// Handle OAuth callback BEFORE React renders
// This prevents the 404 flash when Supabase redirects with tokens in hash
const hash = window.location.hash;
if (hash && (hash.includes('access_token=') || hash.includes('error='))) {
  // OAuth callback detected - let Supabase process tokens first
  // Parse the hash to extract tokens for Supabase
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  
  if (accessToken && refreshToken) {
    // Set the session from the URL tokens
    supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).finally(() => {
      // Clean URL for HashRouter after Supabase processes tokens
      window.history.replaceState(null, '', window.location.pathname + '#/');
    });
  } else {
    // No valid tokens, just clean the URL
    window.history.replaceState(null, '', window.location.pathname + '#/');
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
