# Shoora Monitoring — deployment and architecture kit

**Product:** Shoora Monitoring (npm package name: `shoora-monitoring`)  
**Document updated:** May 2026

This file is the single reference for stack versions, environment variables, Supabase schema, Realtime, storage, auth, email, and operational notes aligned with the current repository.

---

## 1. Architecture and tech stack

### Frontend

| Area | Technology |
|------|------------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, Tailwind CSS **v4** (`@tailwindcss/postcss`) |
| Icons | `lucide-react` |
| Charts | `recharts` |
| Maps | `react-leaflet` + Leaflet (OpenStreetMap tiles) |
| Spreadsheets | `xlsx` |
| PDF / print | Primary path: **`window.print()`** + `@media print` styles (vector-friendly, avoids canvas CORS issues with remote media). The repo also lists `html2canvas` / `jspdf`; prefer the print pipeline for production PDFs. |

### Backend and data

| Area | Technology |
|------|------------|
| Database | **Supabase** (PostgreSQL) |
| Auth | Supabase Auth (email/password, JWT in the browser) |
| File storage | Supabase Storage bucket **`accident-media`** (public read; authenticated upload) |
| Server logic | Next.js **Server Actions** (`app/actions.ts`) for admin user creation and Resend emails |

### External APIs

- **Nominatim** (OpenStreetMap) for geocoding in the admin UI.
- **Resend** for transactional email (`RESEND_API_KEY`).

---

## 2. Repository layout (high level)

| Path | Role |
|------|------|
| `app/page.tsx` | Login; routes `admin` → `/admin`, everyone else → `/client` |
| `app/admin/page.tsx` | Admin control center (accidents, tampering, clients, audit, imports, etc.) |
| `app/client/page.tsx` | Client portal (company-scoped accidents + tampering, approvals, realtime toasts) |
| `app/layout.tsx` | Root layout and metadata |
| `app/actions.ts` | Server actions: `createSystemUser`, `sendIncidentEmail`, `sendTamperingIncidentEmail`, `sendTamperingDecisionEmail` |
| `lib/supabase.ts` | Browser Supabase client; validates URL vs anon/publishable key |
| `lib/dashboard-auth.ts` | `ensureDashboardAuth()` — `getUser()` + `profiles.role` gate for `/admin` and `/client` |
| `supabase/enable_realtime_notifications.sql` | Adds `accidents` and `tampering_incidents` to `supabase_realtime` publication |

There is **no** separate `/driver` route; roles are **`admin`** and **`client`** only (`profiles.role` check constraint should match).

---

## 3. Environment variables

Copy into **`.env.local`** locally and into your host (e.g. Vercel **Settings → Environment Variables**) for production.

```bash
# --- Public (safe in the browser) ---
# Project URL from Supabase: Settings → API → Project URL (must be https://….supabase.co)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co

# Publishable (sb_publishable_…) or legacy anon JWT (eyJ…). NEVER put the service_role / secret key here.
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_or_anon_key

# Canonical public site URL for email links (no trailing slash recommended).
# Used by app/actions.ts; falls back to VERCEL_URL on Vercel, then http://localhost:3000.
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# --- Server-only (never NEXT_PUBLIC_*) ---
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret

# Resend (omit or use a mock value to log emails only in dev)
RESEND_API_KEY=re_your_resend_api_key
```

### Optional / advanced

`lib/supabase.ts` also reads **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`** if you prefer non-`NEXT_PUBLIC_` names on the server; the browser still needs the `NEXT_PUBLIC_*` pair.

### Supabase client pitfalls (read before debugging)

1. **`NEXT_PUBLIC_SUPABASE_URL`** must be the **HTTPS project URL**, not a JWT. If you paste the anon key into the URL field, the app throws a clear error in the browser.
2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** must be the **publishable** or **anon** key — never **`sb_secret_…`** or service role in the client.
3. With **`sb_publishable_…`**, you **must** set a valid **`NEXT_PUBLIC_SUPABASE_URL`** or the client refuses to start.

### Server actions dependency

`app/actions.ts` uses **`NEXT_PUBLIC_SUPABASE_URL`** plus **`SUPABASE_SERVICE_ROLE_KEY`** only for **`createSystemUser`** (admin user provisioning). Email actions (`sendIncidentEmail`, tampering emails) use **Resend** only and do not need the service role. If **`SUPABASE_SERVICE_ROLE_KEY`** is unset, **“Create portal user”** fails with a clear error; incident logging and emails still work as long as **`RESEND_API_KEY`** is set when you want real mail.

---

## 4. Supabase database schema

Run sections in order in the **Supabase SQL Editor** on a new project (adjust RLS for production strictness — the sample policies are permissive for authenticated users).

### 4.1 Profiles (linked to `auth.users`)

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('admin', 'client')),
  company_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Client directory

```sql
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Accidents (incidents)

```sql
CREATE TABLE accidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  accident_date DATE NOT NULL,
  accident_time TIME NOT NULL,
  place TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  driver_name TEXT NOT NULL,
  driver_contact TEXT,
  company_name TEXT NOT NULL,
  client_id_number TEXT,
  video_provided BOOLEAN DEFAULT false,
  vehicle_image_url TEXT,
  driver_image_url TEXT,
  front_video_url TEXT,
  rear_video_url TEXT,
  investigation_doc_url TEXT,
  status TEXT DEFAULT 'Pending Investigation',
  remarks TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Tampering incidents

Columns match `app/admin/page.tsx` insert/update payloads.

```sql
CREATE TABLE tampering_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_contact_number TEXT,
  tampering_details TEXT,
  address TEXT,
  technician_name TEXT NOT NULL,
  technician_contact_number TEXT,
  tampering_repair_charge NUMERIC,
  tampering_image_url TEXT,
  repair_device_image_url TEXT,
  status TEXT DEFAULT 'Pending Approval',
  rejection_reason TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Audit logs

```sql
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT,
  details TEXT,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Row Level Security (example)

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE accidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tampering_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_authenticated" ON profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clients_authenticated" ON clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "accidents_authenticated" ON accidents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tampering_authenticated" ON tampering_incidents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_authenticated" ON audit_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Tighten policies per tenant (e.g. clients only see rows for their `company_name`) before a production launch; the app currently assumes trusted authenticated operators for many paths.

---

## 5. Storage (Supabase)

### Bucket

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('accident-media', 'accident-media', true)
ON CONFLICT (id) DO NOTHING;
```

### Policies (example)

```sql
CREATE POLICY "accident_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'accident-media');
CREATE POLICY "accident_media_authenticated_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'accident-media');
```

### Object key prefixes (single bucket)

The admin uploader stores files under **`accident-media`** with prefixes:

| Prefix | Use |
|--------|-----|
| `vehicles/` | Vehicle images |
| `drivers/` | Driver images |
| `videos/front`, `videos/rear` | Dashcam videos when video is provided |
| `documents/` | Investigation PDF when no video |
| `tampering/tampering-images/` | Tampering evidence image |
| `tampering/repair-device-images/` | Repair device image |

---

## 6. Realtime (client dashboard notifications)

Subscriptions in `app/client/page.tsx` listen for **`postgres_changes`** on **`public.accidents`** and **`public.tampering_incidents`**.

Without publication membership, channels connect but **no events** arrive. Run the script in the repo (or equivalent in the Dashboard **Database → Publications** UI):

**File:** `supabase/enable_realtime_notifications.sql`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.accidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tampering_incidents;
```

If a table is already in the publication, Postgres may report it is already a member — that is safe to ignore.

The client also calls **`realtime.setAuth`** with the session JWT before subscribing (required for RLS-aware Realtime in many setups).

---

## 7. Authentication and routing

1. Users sign in on **`/`** via `supabase.auth.signInWithPassword`.
2. After login, **`profiles.role`** is read:
   - **`admin`** → **`/admin`**
   - Any other role (including legacy **`driver`** rows if they still exist in an old DB) → **`/client`**
3. **`ensureDashboardAuth(supabase, router.replace, 'admin' | 'client')`** (in `lib/dashboard-auth.ts`) runs on the admin and client dashboards: it uses **`supabase.auth.getUser()`** (validates with the Auth server), loads **`profiles`**, and redirects to **`/`** or the correct dashboard if the role does not match the page.

---

## 8. Email (Resend)

1. Create an account at [resend.com](https://resend.com), create an API key (`re_…`), set **`RESEND_API_KEY`** in the environment.
2. Until you verify a domain, **`from:`** uses Resend’s sandbox sender (e.g. `onboarding@resend.dev`) — fine for testing; verify your domain for production deliverability.
3. **Link targets** in HTML emails are built from **`getAppOrigin()`** in `app/actions.ts`:
   - **`NEXT_PUBLIC_APP_URL`** if set
   - else **`https://` + `VERCEL_URL`** on Vercel
   - else **`http://localhost:3000`**
   - Incident and tampering-client emails link to **`{origin}/client`**
   - Tampering decision email to admins links to **`{origin}/admin`**

If **`RESEND_API_KEY`** is missing or contains `mock`, the app **logs** a simulation line instead of sending.

### Server actions (email-related)

| Function | Purpose |
|----------|---------|
| `sendIncidentEmail` | Client notified on incident workflow updates |
| `sendTamperingIncidentEmail` | Client notified when admin creates a tampering record (if client directory has `contact_email`) |
| `sendTamperingDecisionEmail` | Admin notified on client approve/reject (available in `app/actions.ts`; ensure your client UI invokes it when you want mail on decisions) |

---

## 9. Local development

```bash
npm install
npm run dev
```

- **Lint:** `npm run lint`
- **Production build:** `npm run build` (script disables Turbopack for the build per `package.json`)

Ensure **`.env.local`** is filled and restart the dev server after any env change.

---

## 10. Production deployment (e.g. Vercel)

1. Connect the Git repository; set **Production** environment variables (section 3).
2. Set **`NEXT_PUBLIC_APP_URL`** to your canonical HTTPS URL so email buttons are correct (do not rely on preview URLs for real users).
3. Apply all SQL from sections **4**, **5**, and **6** on the Supabase project tied to those keys.
4. Create at least one **`profiles`** row per auth user (the admin panel’s “create user” flow does this via `createSystemUser`).
5. Confirm **Realtime** publication (section 6) if you need live client toasts.

---

## 11. Known behaviors and implementation notes

### PDF and printing

Prefer the built-in **print stylesheet** path for official PDFs. Remote video and modern CSS color spaces can break canvas snapshot tools; the UI is optimized for **`window.print()`**.

### Auth session vs `getUser`

- **Dashboard gate:** `ensureDashboardAuth` uses **`getUser()`** so the session is validated with Supabase Auth (not only local storage).
- **Client dashboard bootstrap** may still use **`getSession()`** where appropriate for fast UI hydration; keep both patterns unless you consolidate them intentionally.

### Parallel media uploads

Incident and tampering submits use **`Promise.all`** for independent file uploads to storage, reducing total wait time compared to strictly sequential uploads.

### Supabase “Failed to fetch” on login

Usually wrong **`NEXT_PUBLIC_SUPABASE_URL`**, wrong key in the wrong variable, ad blocker, or local Supabase not running. The login page surfaces a short checklist when the error looks like a network failure.

---

## 12. Post-deploy checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` correct in all environments  
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only on the server  
- [ ] `NEXT_PUBLIC_APP_URL` set for production email links  
- [ ] `RESEND_API_KEY` set for real mail (optional in dev)  
- [ ] Tables **`profiles`**, **`clients`**, **`accidents`**, **`tampering_incidents`**, **`audit_logs`** exist  
- [ ] Storage bucket **`accident-media`** + policies  
- [ ] Realtime publication includes **`accidents`** and **`tampering_incidents`**  
- [ ] Smoke test: login → `/admin` and `/client`, create row, confirm client sees data and (if enabled) realtime toast  




