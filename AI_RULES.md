# AI Rules and Project Guidelines

This document outlines the technical stack and best practices for developing this application.

## Tech Stack Overview

*   **Frontend Framework:** React (with Vite for fast development)
*   **Language:** TypeScript (for type safety and better maintainability)
*   **Styling:** Tailwind CSS (for utility-first CSS and responsive design)
*   **UI Components:** shadcn/ui (pre-built, accessible, and customizable React components)
*   **Routing:** React Router (for declarative navigation)
*   **State Management:** React Query (for server-state management, data fetching, caching, and synchronization)
*   **Database & Backend:** Supabase (for PostgreSQL database, authentication, and serverless Edge Functions)
*   **Icons:** Lucide React
*   **Date Handling:** date-fns

## Library Usage Guidelines

*   **UI Components:**
    *   Always prioritize `shadcn/ui` components for building the user interface.
    *   If a specific `shadcn/ui` component doesn't exist or doesn't meet requirements, create a new, small, and focused component in `src/components/` using Tailwind CSS. Do not modify `shadcn/ui` source files directly.
*   **Styling:**
    *   Exclusively use Tailwind CSS classes for all styling. Avoid inline styles or custom CSS files unless absolutely necessary for complex animations or third-party library integration.
    *   Ensure designs are responsive by utilizing Tailwind's responsive utility classes.
*   **Data Fetching & Mutations:**
    *   Use `React Query` for all data fetching, caching, and mutations involving the Supabase database. This ensures consistent data, automatic re-fetching, and efficient state management.
*   **Authentication & Database Interactions:**
    *   Leverage Supabase for all authentication (sign-in, sign-up, session management) and direct database interactions.
    *   For complex server-side logic, sensitive operations, or API-to-API communication, implement Supabase Edge Functions.
    *   Always enable Row Level Security (RLS) on all database tables and define appropriate policies.
*   **Date & Time:**
    *   Use `date-fns` for all date and time manipulation and formatting.
*   **Icons:**
    *   Use `lucide-react` for all icons.
*   **Notifications:**
    *   Use `sonner` for toast notifications to inform users about important events (success, error, warning).
*   **Form Handling:**
    *   Use `react-hook-form` with `zod` for form validation.