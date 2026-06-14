'use server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key')

/** Lazily create admin client so email-only actions do not require SUPABASE_SERVICE_ROLE_KEY at import time. */
let supabaseAdminSingleton: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing or empty. Add it from Supabase → Settings → API → service_role (server env only, never NEXT_PUBLIC_*). Required only when creating portal users from the admin panel.'
    )
  }
  if (!supabaseAdminSingleton) supabaseAdminSingleton = createClient(url, key)
  return supabaseAdminSingleton
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

/** Base URL for email links (set NEXT_PUBLIC_APP_URL in production). */
function getAppOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, '')
    return `https://${host}`
  }
  return 'http://localhost:3000'
}

// --- 1. SUPER-ADMIN: CREATE NEW CLIENT ---
export async function createSystemUser(data: { email: string, password: string, role: string, company_name: string }) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    // 1. Create the user in Supabase Authentication
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true
    })
    if (authError) throw authError

    // 2. Save their profile data so they show up in the Client Manager
    const { error: profileError } = await supabaseAdmin.from('profiles').insert([{
      id: authData.user.id,
      role: data.role,
      company_name: data.company_name,
      email: data.email
    }])
    if (profileError) throw profileError

    return { success: true }
  } catch (error: unknown) {
    return { error: getErrorMessage(error) }
  }
}

// --- 2. AUTOMATED EMAIL ENGINE ---
export async function sendIncidentEmail(clientEmail: string, vehicleNumber: string, status: string) {
  // If no real API key is found, simulate the email to prevent crashing
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('mock')) {
    console.log(`[EMAIL SIMULATION] Alert sent to ${clientEmail} for vehicle ${vehicleNumber}`)
    return { success: true }
  }

  try {
    const origin = getAppOrigin()
    const clientPortalUrl = `${origin}/client`
    await resend.emails.send({
      from: 'Shoora Monitoring <onboarding@resend.dev>',
      to: clientEmail,
      subject: `🚨 Incident Alert Updated: ${vehicleNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #020617; padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0;">Shoora Monitoring</h2>
          </div>
          <div style="padding: 32px; background-color: #f8fafc;">
            <h3 style="color: #0f172a; margin-top: 0;">Official Incident Notification</h3>
            <p style="color: #475569; line-height: 1.6;">An incident report involving vehicle <strong>${vehicleNumber}</strong> has been logged or updated in the master database.</p>
            
            <div style="background-color: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Current Workflow Status</p>
              <p style="margin: 8px 0 0 0; font-weight: bold; color: #4f46e5; font-size: 16px;">${status}</p>
            </div>

            <p style="color: #475569; line-height: 1.6;">Please log in to your secure Client Portal to view the full evidence profile, download the PDF report, and monitor GPS data.</p>
            
            <a href="${clientPortalUrl}" style="display: block; width: 100%; text-align: center; background-color: #4f46e5; color: white; padding: 16px 0; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 32px;">Access Secure Dashboard</a>
          </div>
        </div>
      `
    })
    return { success: true }
  } catch (error: unknown) {
    return { error: getErrorMessage(error) }
  }
}

export async function sendTamperingIncidentEmail(data: {
  clientEmail: string
  clientName: string
  vehicleNumber: string
  technicianName: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('mock')) {
    console.log(`[EMAIL SIMULATION] Tampering incident alert sent to ${data.clientEmail} for vehicle ${data.vehicleNumber}`)
    return { success: true }
  }

  try {
    const clientPortalUrl = `${getAppOrigin()}/client`
    await resend.emails.send({
      from: 'Shoora Monitoring <onboarding@resend.dev>',
      to: data.clientEmail,
      subject: `Tampering Device Approval Needed: ${data.vehicleNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #020617; padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0;">Shoora Monitoring</h2>
          </div>
          <div style="padding: 32px; background-color: #f8fafc;">
            <h3 style="color: #0f172a; margin-top: 0;">Tampering Device Incident Logged</h3>
            <p style="color: #475569; line-height: 1.6;">A tampering device incident has been created for <strong>${data.clientName}</strong>.</p>
            <div style="background-color: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Vehicle Number</p>
              <p style="margin: 8px 0 0 0; font-weight: bold; color: #0f172a; font-size: 16px;">${data.vehicleNumber}</p>
              <p style="margin: 16px 0 0 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Technician</p>
              <p style="margin: 8px 0 0 0; font-weight: bold; color: #0f172a; font-size: 16px;">${data.technicianName}</p>
            </div>
            <p style="color: #475569; line-height: 1.6;">Please review the evidence and approve or reject the request from the Client Panel.</p>
            <a href="${clientPortalUrl}" style="display: block; width: 100%; text-align: center; background-color: #4f46e5; color: white; padding: 16px 0; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 24px;">Open Client Portal</a>
          </div>
        </div>
      `,
    })
    return { success: true }
  } catch (error: unknown) {
    return { error: getErrorMessage(error) }
  }
}

export async function sendTamperingDecisionEmail(data: {
  adminEmail: string
  clientName: string
  vehicleNumber: string
  status: 'Approved' | 'Rejected'
  rejectionReason?: string
}) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.includes('mock')) {
    console.log(`[EMAIL SIMULATION] Tampering decision sent to ${data.adminEmail} for vehicle ${data.vehicleNumber}: ${data.status}`)
    return { success: true }
  }

  try {
    const adminUrl = `${getAppOrigin()}/admin`
    await resend.emails.send({
      from: 'Shoora Monitoring <onboarding@resend.dev>',
      to: data.adminEmail,
      subject: `Tampering Device ${data.status}: ${data.vehicleNumber}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #020617; padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0;">Shoora Monitoring</h2>
          </div>
          <div style="padding: 32px; background-color: #f8fafc;">
            <h3 style="color: #0f172a; margin-top: 0;">Client Decision Received</h3>
            <p style="color: #475569; line-height: 1.6;">The client <strong>${data.clientName}</strong> has <strong>${data.status.toLowerCase()}</strong> the tampering device request for vehicle <strong>${data.vehicleNumber}</strong>.</p>
            ${data.rejectionReason ? `<div style="background-color: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 24px 0;"><p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Rejection Reason</p><p style="margin: 8px 0 0 0; color: #0f172a; line-height: 1.6;">${data.rejectionReason}</p></div>` : ''}
            <a href="${adminUrl}" style="display: block; width: 100%; text-align: center; background-color: #4f46e5; color: white; padding: 16px 0; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 24px;">Open Admin Dashboard</a>
          </div>
        </div>
      `,
    })
    return { success: true }
  } catch (error: unknown) {
    return { error: getErrorMessage(error) }
  }
}
