🛡️ FleetGuard: Enterprise Incident Management Platform
Master Deployment & Architecture Documentation
Date Compiled: March 2026
1. 🏗️ Architecture & Tech Stack
This platform is built using a modern, serverless, full-stack architecture designed for maximum speed, security, and scalability.
Frontend (Client Side)
Framework: Next.js 14+ (App Router)
Library: React 18
Styling: Tailwind CSS v4 (Using modern color spaces like oklab)
Icons: lucide-react
Data Visualization: recharts (for dynamic Pie and Bar charts)
Maps: react-leaflet connected to OpenStreetMap (OSM)
PDF Generation: Native Browser Print API (@media print CSS) to bypass canvas CORS issues.
Excel Export: xlsx library
Backend & Database (Server Side)
Database: Supabase (PostgreSQL)
Authentication: Supabase Auth (Email/Password with JWT sessions)
Storage: Supabase Storage Buckets (For images and heavy video files)
Security: Row Level Security (RLS) policies acting as a strict database firewall.
Server Actions: Next.js 'use server' functions (for secure background tasks like user provisioning).
Third-Party APIs
Geocoding: Nominatim API (OpenStreetMap) to convert text locations to Lat/Lng.
Email Engine: Resend API (for automated status alert emails).
2. 🔐 Environment Variables (.env.local)
To run this project locally or in production, these exact keys must be configured in your environment variables.
code
Env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key

# Backend Admin Keys (NEVER expose to the frontend)
SUPABASE_SERVICE_ROLE_KEY=your_secret_service_role_key

# Email API Key
RESEND_API_KEY=re_your_resend_api_key
3. 🗄️ Master Database Schema
If you ever need to rebuild the software from scratch on a new Supabase project, run this exact SQL script in the Supabase SQL Editor:
code
SQL
-- 1. Create Profiles Table (Linked to Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  role TEXT CHECK (role IN ('admin', 'client', 'driver')),
  company_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Master Client Directory
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Incidents Table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Audit Logs Table
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  record_id TEXT,
  details TEXT,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Setup Storage Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('accident-media', 'accident-media', true) ON CONFLICT DO NOTHING;

-- 6. ENABLE SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE accidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. MASTER POLICIES (Allow authenticated users to operate)
CREATE POLICY "Enable all for authenticated users" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON accidents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'accident-media');
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'accident-media');

5. ✉️ Activating the Live Email API
To send real emails instead of console simulations:
Go toResend.com and create a free account.
Click API Keys and click Create API Key.
Copy the key (it starts with re_...).
Go to your Vercel Dashboard -> Settings -> Environment Variables.
Update RESEND_API_KEY with this new real key.
Go to the "Domains" tab in Resend and verify your actual website domain so the emails don't go to Spam folders.
6. 🛠️ Known Behaviors & Upgrade Guide
If you upgrade Next.js or Tailwind in the future, keep these historical fixes in mind:
The PDF/Canvas CORS Bug:
Issue: html2canvas crashes when attempting to parse modern Tailwind v4 colors (like oklab) or when taking screenshots of Cloud videos.
Resolution: Do not use html2canvas. This software relies on a perfectly styled @media print CSS block and the native window.print() function to generate vector-crisp, searchable PDF reports with clickable video links.
The Session Lock Crash:
Issue: supabase.auth.getUser() crashes React 18 Strict Mode during double-invocation (lock was released because another request stole it).
Resolution: Always use supabase.auth.getSession() for client-side component mounting to fetch the user state instantly from local storage.
The Multi-File Upload Delay:
Issue: Uploading 5 heavy files sequentially takes too long.
Resolution: The handleSubmit functions utilize `Promise.all(