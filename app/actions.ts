'use server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// The Service Role Key allows the Admin Panel to create Auth users securely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key')

// --- 1. SUPER-ADMIN: CREATE NEW CLIENT/DRIVER ---
export async function createSystemUser(data: { email: string, password: string, role: string, company_name: string }) {
  try {
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
  } catch (error: any) {
    return { error: error.message }
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
    await resend.emails.send({
      from: 'FleetGuard Alerts <onboarding@resend.dev>',
      to: clientEmail,
      subject: `🚨 Incident Alert Updated: ${vehicleNumber}`,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #020617; padding: 24px; text-align: center;">
            <h2 style="color: white; margin: 0;">FleetGuard Intelligence</h2>
          </div>
          <div style="padding: 32px; background-color: #f8fafc;">
            <h3 style="color: #0f172a; margin-top: 0;">Official Incident Notification</h3>
            <p style="color: #475569; line-height: 1.6;">An incident report involving vehicle <strong>${vehicleNumber}</strong> has been logged or updated in the master database.</p>
            
            <div style="background-color: white; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 24px 0;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Current Workflow Status</p>
              <p style="margin: 8px 0 0 0; font-weight: bold; color: #4f46e5; font-size: 16px;">${status}</p>
            </div>

            <p style="color: #475569; line-height: 1.6;">Please log in to your secure Client Portal to view the full evidence profile, download the PDF report, and monitor GPS data.</p>
            
            <a href="http://localhost:3000" style="display: block; width: 100%; text-align: center; background-color: #4f46e5; color: white; padding: 16px 0; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 32px;">Access Secure Dashboard</a>
          </div>
        </div>
      `
    })
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}