'use client'
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { 
  Download, LogOut, Search, X, Image as ImageIcon, Film, Bell,
  LayoutDashboard, PlaySquare, AlertCircle, FileSignature, 
  Phone, User, Building2, Calendar, MapPin, Database, 
  PieChart as PieChartIcon, CheckCircle2, ShieldAlert, Printer, 
  Activity, Map as MapIcon, List, Link as LinkIcon, CalendarDays, CreditCard,
  Clock, Briefcase, Loader2, TrendingDown, AlertTriangle, UserCircle,
  Wrench, ThumbsUp, ThumbsDown
} from 'lucide-react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const AccidentMap = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold"><Activity className="animate-spin mr-2"/> Loading Geospatial Data...</div> 
})

export default function ClientDashboard() {
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'risk' | 'database' | 'tampering'>('overview')
  const [data, setData] = useState<any[]>([])
  const [tamperingLogs, setTamperingLogs] = useState<any[]>([]) // NEW: Tampering Logs
  const [currentUser, setCurrentUser] = useState<any>(null)
  const triggerToast = (message: string, tone: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, tone })
    setNotifications(prev => [{ id: `${Date.now()}`, message, tone, ts: Date.now() }, ...prev].slice(0, 6))
    setUnreadCount(prev => prev + 1)
    setTimeout(() => setToast(null), 4200)
  }
  
  const[search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedAccident, setSelectedAccident] = useState<any | null>(null)

  // NEW: Tampering States
  const [selectedTampering, setSelectedTampering] = useState<any | null>(null)
  const[rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [toast, setToast] = useState<{ message: string, tone: 'info' | 'success' | 'warning' } | null>(null)
  const [notifications, setNotifications] = useState<{ id: string, message: string, tone: 'info' | 'success' | 'warning', ts: number }[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifCenter, setShowNotifCenter] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [clientSettings, setClientSettings] = useState(() => ({
    primaryColor: 'emerald' as 'emerald' | 'blue' | 'indigo' | 'orange',
    theme: 'light' as 'light' | 'dark',
    navStyle: 'blend' as 'blend' | 'discrete' | 'evident',
    layout: 'vertical' as 'vertical' | 'horizontal',
    orientation: 'ltr' as 'ltr' | 'rtl',
  }))

  function applyPrimaryColor(preset: 'emerald' | 'blue' | 'indigo' | 'orange') {
    if (typeof document === 'undefined') return
    const palette = {
      emerald: '#10b981',
      blue: '#3b82f6',
      indigo: '#6366f1',
      orange: '#f97316',
    }
    document.documentElement.style.setProperty('--client-primary', palette[preset])
  }

  function applyTheme(theme: 'light' | 'dark') {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.body.classList.toggle('dark', theme === 'dark')
  }

  function applyOrientation(dir: 'ltr' | 'rtl') {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('dir', dir)
  }

  async function fetchCurrentUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setCurrentUser({ ...profile, email: session.user.email })
      }
    } catch (error) { console.log("Auth bypass:", error) }
  }

  async function fetchData() {
    const { data: accidents } = await supabase.from('accidents').select('*').order('created_at', { ascending: false })
    if (accidents) setData(accidents)
  }

  async function fetchTamperingLogs() {
    const { data } = await supabase.from('tampering_incidents').select('*').order('created_at', { ascending: false })
    if (data) setTamperingLogs(data)
  }

  useEffect(() => {
    fetchCurrentUser()
    fetchData()
    fetchTamperingLogs()
  },[])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('client-app-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setClientSettings(prev => ({ ...prev, ...parsed }))
          applyTheme(parsed.theme || 'light')
          applyPrimaryColor(parsed.primaryColor || 'emerald')
          applyOrientation(parsed.orientation || 'ltr')
        } catch {}
      } else {
        applyPrimaryColor(clientSettings.primaryColor)
        applyTheme(clientSettings.theme)
        applyOrientation(clientSettings.orientation)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('client-app-settings', JSON.stringify(clientSettings))
      applyPrimaryColor(clientSettings.primaryColor)
      applyTheme(clientSettings.theme)
      applyOrientation(clientSettings.orientation)
    }
  }, [clientSettings])

  useEffect(() => {
    const incidentChannel = supabase
      .channel('realtime-incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'accidents' }, (payload) => {
        triggerToast(`New incident logged: ${payload.new.vehicle_number}`, 'info')
        fetchData()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'accidents' }, (payload) => {
        triggerToast(`Incident updated: ${payload.new.vehicle_number}`, 'success')
        fetchData()
      })
      .subscribe()

    const tamperingChannel = supabase
      .channel('realtime-tampering')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tampering_incidents' }, (payload) => {
        triggerToast(`New tampering request for ${payload.new.vehicle_number}`, 'info')
        fetchTamperingLogs()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tampering_incidents' }, (payload) => {
        const tone = payload.new.status === 'Rejected' ? 'warning' : 'success'
        triggerToast(`Tampering ${payload.new.status}: ${payload.new.vehicle_number}`, tone)
        fetchTamperingLogs()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(tamperingChannel)
    }
  }, [])

  const getTamperingDriverContact = (log: any) => log.driver_contact_number || log.driver_contact || 'N/A'
  const getTamperingTechnicianContact = (log: any) => log.technician_contact_number || log.technician_contact || 'N/A'
  const getTamperingRepairCharge = (log: any) => log.tampering_repair_charge || log.repair_charge || 0
  const getTamperingRepairImage = (log: any) => log.repair_device_image_url || log.repair_image_url || null

  // --- UNLOCKED MASTER FILTERING ---
  // Client sees EVERYTHING in the database.
  const filteredData = data.filter(item => {
    const term = search.toLowerCase()
    const matchesSearch = (item.vehicle_number && item.vehicle_number.toLowerCase().includes(term)) ||
                          (item.driver_name && item.driver_name.toLowerCase().includes(term)) ||
                          (item.company_name && item.company_name.toLowerCase().includes(term));
    if (!matchesSearch) return false;

    if (dateFilter !== 'all') {
      const logDate = new Date(item.accident_date); const now = new Date();
      const diffDays = Math.ceil(Math.abs(now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dateFilter === '7d' && diffDays > 7) return false;
      if (dateFilter === '30d' && diffDays > 30) return false;
      if (dateFilter === 'year' && logDate.getFullYear() !== now.getFullYear()) return false;
    }
    return true;
  })

  // UNLOCKED TAMPERING DATA
  const filteredTamperingLogs = tamperingLogs.filter(log => {
    const term = search.toLowerCase()

    if (!term) return true
    return (
      (log.vehicle_number && log.vehicle_number.toLowerCase().includes(term)) ||
      (log.client_name && log.client_name.toLowerCase().includes(term)) ||
      (log.driver_name && log.driver_name.toLowerCase().includes(term)) ||
      (log.technician_name && log.technician_name.toLowerCase().includes(term))
    )
  })

  // --- TAMPERING APPROVAL HANDLERS ---
  const handleApproveTampering = async (id: string) => {
    setIsUpdatingStatus(true)
    const { error } = await supabase.from('tampering_incidents').update({ status: 'Approved' }).eq('id', id)
    if (error) alert("Failed to approve: " + error.message)
    else { alert("✅ Tampering Repair Approved."); setSelectedTampering(null); fetchTamperingLogs() }
    setIsUpdatingStatus(false)
  }

  const handleRejectTampering = async (id: string) => {
    if (!rejectReason.trim()) return alert("Please provide a reason for rejection.");
    setIsUpdatingStatus(true)
    const { error } = await supabase.from('tampering_incidents').update({ status: 'Rejected', rejection_reason: rejectReason }).eq('id', id)
    if (error) alert("Failed to reject: " + error.message)
    else { alert("❌ Tampering Repair Rejected."); setShowRejectInput(false); setRejectReason(''); setSelectedTampering(null); fetchTamperingLogs() }
    setIsUpdatingStatus(false)
  }

  // --- METRICS ---
  const totalAccidents = filteredData.length
  const videosProvided = filteredData.filter(d => d.video_provided).length
  const videosNotProvided = totalAccidents - videosProvided

  const pendingCount = filteredData.filter(d => d.status === 'Pending Investigation' || !d.status).length
  const claimFiledCount = filteredData.filter(d => d.status === 'Claim Filed').length
  const closedCount = filteredData.filter(d => d.status === 'Case Closed').length
  
  const statusChartData =[{ name: 'Pending', count: pendingCount }, { name: 'Claim Filed', count: claimFiledCount }, { name: 'Closed', count: closedCount }]
  const STATUS_COLORS =['#f59e0b', '#3b82f6', '#10b981']

  const evidenceChartData =[{ name: 'Video Provided', value: videosProvided }, { name: 'Missing Video', value: videosNotProvided }]
  const EVIDENCE_COLORS =['#10b981', '#f43f5e'] 

  const driverStats = filteredData.reduce((acc: any, log) => {
    const driver = log.driver_name || 'Unknown Driver';
    if (!acc[driver]) acc[driver] = { count: 0, company: log.company_name, contact: log.driver_contact, latest: log.accident_date };
    acc[driver].count++;
    if (new Date(log.accident_date) > new Date(acc[driver].latest)) acc[driver].latest = log.accident_date;
    return acc;
  }, {});
  
  const driverRiskData = Object.keys(driverStats).map(driver => ({ name: driver, ...driverStats[driver] })).sort((a, b) => b.count - a.count);
  const topDriversChart = driverRiskData.slice(0, 10); 

  const companyStats = filteredData.reduce((acc: any, log) => {
    const company = log.company_name || 'Unknown Entity';
    if (!acc[company]) acc[company] = 0; acc[company]++; return acc;
  }, {});

  const clientChartData = Object.keys(companyStats).map(company => ({ name: company, Accidents: companyStats[company] })).sort((a, b) => b.Accidents - a.Accidents);
  const uniqueClientsCount = Object.keys(companyStats).length;
  const averageAccidents = uniqueClientsCount > 0 ? (totalAccidents / uniqueClientsCount).toFixed(1) : '0';
  const CLIENT_COLORS =['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  // --- TAMPERING OVERVIEW (CLIENT-WISE COUNTS & AMOUNTS) ---
  const tamperingSummaryMap: Record<string, {
    name: string
    approved: number
    pending: number
    rejected: number
    amountApproved: number
    amountPending: number
    amountRejected: number
  }> = {};

  tamperingLogs.forEach(log => {
    const client = log.client_name || 'Unknown Client';
    if (!tamperingSummaryMap[client]) {
      tamperingSummaryMap[client] = { name: client, approved: 0, pending: 0, rejected: 0, amountApproved: 0, amountPending: 0, amountRejected: 0 };
    }
    const status = (log.status || 'Pending').toLowerCase();
    const charge = Number(log.tampering_repair_charge || log.repair_charge || 0);
    if (status === 'approved') {
      tamperingSummaryMap[client].approved += 1;
      tamperingSummaryMap[client].amountApproved += charge;
    } else if (status === 'rejected') {
      tamperingSummaryMap[client].rejected += 1;
      tamperingSummaryMap[client].amountRejected += charge;
    } else {
      tamperingSummaryMap[client].pending += 1;
      tamperingSummaryMap[client].amountPending += charge;
    }
  });

  const tamperingSummaryData = Object.values(tamperingSummaryMap).sort((a, b) => (b.approved + b.pending + b.rejected) - (a.approved + a.pending + a.rejected));
  const tamperingTotals = tamperingSummaryData.reduce((acc, row) => {
    acc.approved += row.approved; acc.pending += row.pending; acc.rejected += row.rejected;
    acc.amountApproved += row.amountApproved; acc.amountPending += row.amountPending; acc.amountRejected += row.amountRejected;
    return acc;
  }, { approved: 0, pending: 0, rejected: 0, amountApproved: 0, amountPending: 0, amountRejected: 0 });

  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      Entity: item.company_name || 'N/A', Date: item.accident_date, Time: item.accident_time,
      Vehicle_No: item.vehicle_number, Driver: item.driver_name, Contact: item.driver_contact || 'N/A',
      Location: item.place, Status: item.status || 'Pending Investigation', Video_Provided: item.video_provided ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master_Report")
    XLSX.writeFile(wb, `Master_Incident_Report.xlsx`)
  }

  const getStatusColor = (status: string) => {
    if (status === 'Pending Investigation') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'Claim Filed') return 'bg-blue-100 text-blue-800 border-blue-200'
    if (status === 'Case Closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }
  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggingId(id); e.dataTransfer.setData('recordId', id) }
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('recordId')
    if (!id) return
    setData(prev => prev.map(log => log.id === id ? { ...log, status: newStatus } : log))
    const { error } = await supabase.from('accidents').update({ status: newStatus }).eq('id', id)
    if (error) { alert('Failed to move card'); fetchData() }
    setDraggingId(null)
  }

  const getTamperingStatusColor = (status: string) => {
    if (status === 'Pending Approval') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'Rejected') return 'bg-rose-100 text-rose-800 border-rose-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.focus()
      setTimeout(() => window.print(), 50)
    }
  }

  const isHorizontalLayout = clientSettings.layout === 'horizontal'

  return (
    <div id="client-app-shell" className={`${isHorizontalLayout ? 'flex flex-col' : 'flex flex-row'} min-h-screen bg-[#f8fafc] font-sans text-slate-900 overflow-hidden relative`} dir={clientSettings.orientation}>
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --accent: var(--client-primary, #6366f1);
          --accent-soft: rgba(99, 102, 241, 0.08);
          --surface: ${clientSettings.theme === 'dark' ? '#0b1220' : '#f8fafc'};
          --card: ${clientSettings.theme === 'dark' ? '#111827' : '#ffffff'};
          --text: ${clientSettings.theme === 'dark' ? '#e2e8f0' : '#0f172a'};
        }
        body { background: var(--surface); color: var(--text); }
        .btn-accent { background: var(--accent); color: white; border-color: var(--accent); }
        .pill-accent { background: var(--accent-soft); color: var(--text); border-color: var(--accent); }
      `}} />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" strategy="lazyOnload" />
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" strategy="lazyOnload" />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 ${toast.tone === 'success' ? 'bg-emerald-600' : toast.tone === 'warning' ? 'bg-amber-600' : 'bg-indigo-600'}`}>
          <AlertCircle size={18} className="opacity-80" />
          <span className="text-sm font-semibold">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-white/80 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {showNotifCenter && (
        <div className="fixed top-20 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-black text-slate-800">Notifications</p>
            <button onClick={() => setShowNotifCenter(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 && <div className="p-4 text-sm text-slate-500">No alerts yet.</div>}
            {notifications.map(note => (
              <div key={note.id} className="p-4 flex gap-3">
                <span className={`h-2.5 w-2.5 rounded-full mt-2 ${note.tone === 'success' ? 'bg-emerald-500' : note.tone === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{note.message}</p>
                  <p className="text-[11px] text-slate-500">{new Date(note.ts).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-black text-slate-900">App Settings</p>
                <p className="text-xs text-slate-500">Personalize your client view.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Primary color</p>
                <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'emerald', label: 'Chateau Green', color: '#10b981' },
              { key: 'blue', label: 'Neon Blue', color: '#3b82f6' },
              { key: 'indigo', label: 'Royal Blue', color: '#6366f1' },
              { key: 'orange', label: 'Tomato Orange', color: '#f97316' },
            ].map(opt => (
              <button key={opt.key} onClick={() => { setClientSettings(prev => ({ ...prev, primaryColor: opt.key as any })); applyPrimaryColor(opt.key as any) }} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${clientSettings.primaryColor === opt.key ? 'border-primary bg-primary/10 text-slate-900' : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.color }}></span>
                <span className="text-xs font-semibold">{opt.label}</span>
              </button>
            ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Color scheme</p>
                <div className="flex gap-3">
                  {[
                    { key: 'light', label: 'Light' },
                    { key: 'dark', label: 'Dark' },
                  ].map(opt => {
                    const active = clientSettings.theme === opt.key
                    return (
                      <button key={opt.key} onClick={() => { setClientSettings(prev => ({ ...prev, theme: opt.key as any })); applyTheme(opt.key as 'light'|'dark') }} className="px-4 py-2 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Nav color</p>
                <div className="flex gap-3">
                  {[
                    { key: 'blend', label: 'Blend-in' },
                    { key: 'discrete', label: 'Discrete' },
                    { key: 'evident', label: 'Evident' },
                  ].map(opt => {
                    const active = clientSettings.navStyle === opt.key
                    return (
                      <button key={opt.key} onClick={() => setClientSettings(prev => ({ ...prev, navStyle: opt.key as any }))} className="px-4 py-2 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Layout</p>
                <div className="flex gap-3">
                  {[
                    { key: 'vertical', label: 'Vertical' },
                    { key: 'horizontal', label: 'Horizontal' },
                  ].map(opt => {
                    const active = clientSettings.layout === opt.key
                    return (
                      <button key={opt.key} onClick={() => setClientSettings(prev => ({ ...prev, layout: opt.key as any }))} className="flex-1 px-4 py-3 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Orientation</p>
                <div className="flex gap-3">
                  {[
                    { key: 'ltr', label: 'Left-to-right' },
                    { key: 'rtl', label: 'Right-to-left' },
                  ].map(opt => {
                    const active = clientSettings.orientation === opt.key
                    return (
                      <button key={opt.key} onClick={() => { setClientSettings(prev => ({ ...prev, orientation: opt.key as any })); applyOrientation(opt.key as 'ltr'|'rtl') }} className="px-4 py-2 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body, html { background-color: white !important; height: auto !important; min-height: 100% !important; overflow: visible !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; width: auto !important; }
          #client-app-shell { height: auto !important; min-height: 100% !important; overflow: visible !important; }
          aside, header, main { display: none !important; }
          #print-wrapper { position: static !important; width: 100% !important; background: white !important; display: block !important; padding: 0 !important; margin: 0 auto !important; z-index: 1 !important; height: auto !important; }
          #print-area { position: static !important; display: block !important; width: 100% !important; max-width: 200mm !important; margin: 0 auto !important; max-height: none !important; height: auto !important; overflow: visible !important; box-shadow: none !important; border: none !important; }
          .print-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 24px !important; align-items: start !important; background: white !important;}
          .print-col-span-2 { grid-column: span 2 / span 2 !important; }
          .page-break-avoid { break-inside: avoid !important; page-break-inside: avoid !important; display: block !important; margin-bottom: 20px !important;}
          .print-box { border: 1px solid #cbd5e1 !important; box-shadow: none !important; background-color: #f8fafc !important; padding: 20px !important;}
          img { max-height: 250px !important; width: 100% !important; object-fit: contain !important; border-radius: 8px !important; background-color: #f8fafc !important; }
          .no-print { display: none !important; }
        }
        :root { --client-primary: #6366f1; }
        .accent-primary { color: var(--client-primary); }
        .bg-primary { background-color: var(--client-primary); }
        .border-primary { border-color: var(--client-primary); }
      `}} />

      {clientSettings.layout === 'horizontal' ? (
        <aside className="w-full min-h-[90px] flex flex-wrap items-center px-6 py-3 gap-3 bg-slate-900 text-slate-100 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3 mr-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-900/50"><ShieldAlert className="h-5 w-5 text-white" /></div>
            <span className="text-sm font-bold">FleetGuard</span>
          </div>
          <div className="flex-1 overflow-x-auto flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Executive Dashboard' },
              { id: 'pipeline', label: 'Claims Pipeline' },
              { id: 'risk', label: 'Driver Risk' },
              { id: 'database', label: 'Master Database' },
              { id: 'tampering', label: 'Tampering Devices' },
            ].map(item => {
              const accent = clientSettings.primaryColor === 'emerald' ? '#10b981' : clientSettings.primaryColor === 'blue' ? '#3b82f6' : clientSettings.primaryColor === 'orange' ? '#f97316' : '#6366f1'
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id as any)} className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : { borderColor: '#334155', color: '#e2e8f0' }}>
                  {item.label}
                </button>
              )
            })}
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="ml-4 text-xs font-bold bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:bg-rose-600 hover:text-white">Sign Out</button>
        </aside>
      ) : (() => {
        const accent = clientSettings.primaryColor === 'emerald' ? '#10b981' : clientSettings.primaryColor === 'blue' ? '#3b82f6' : clientSettings.primaryColor === 'orange' ? '#f97316' : '#6366f1'
        const navBg = clientSettings.navStyle === 'discrete' ? '#0f172a' : clientSettings.navStyle === 'evident' ? accent : '#020617'
        const navBorder = clientSettings.navStyle === 'evident' ? 'border-r-2' : 'border-slate-800'
        return (
          <aside className={`w-72 text-slate-300 flex flex-col z-20 shrink-0 shadow-2xl border-r ${navBorder} no-print`} style={{ backgroundColor: navBg, borderColor: accent }}>
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-lg mr-3 shadow-lg shadow-indigo-900/50"><ShieldAlert className="h-5 w-5 text-white" /></div>
          <h1 className="text-xl font-bold tracking-tight text-white">Fleet<span className="text-indigo-400">Guard</span></h1>
        </div>
        <div className="px-6 py-6 flex-1 space-y-2 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mb-4 px-2">Data Intelligence</p>
          {[
            { id: 'overview', label: 'Executive Dashboard', icon: <LayoutDashboard size={18}/> },
            { id: 'pipeline', label: 'Claims Pipeline', icon: <Briefcase size={18}/> },
            { id: 'risk', label: 'Driver Risk', icon: <AlertTriangle size={18}/> },
            { id: 'database', label: 'Master Database', icon: <Database size={18}/> },
          ].map(item => {
            const accent = clientSettings.primaryColor === 'emerald' ? '#10b981' : clientSettings.primaryColor === 'blue' ? '#3b82f6' : clientSettings.primaryColor === 'orange' ? '#f97316' : '#6366f1'
            const isActive = activeTab === item.id
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id as any)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : {}}>
                {item.icon} {item.label}
              </button>
            )
          })}
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 px-2">Hardware Security</p>
            {(() => {
              const accent = clientSettings.primaryColor === 'emerald' ? '#10b981' : clientSettings.primaryColor === 'blue' ? '#3b82f6' : clientSettings.primaryColor === 'orange' ? '#f97316' : '#6366f1'
              const isActive = activeTab === 'tampering'
              return (
                <button onClick={() => setActiveTab('tampering')} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : {}}>
                  <Wrench size={18}/> Tampering Devices
                </button>
              )
            })()}
          </div>
        </div>
        <div className="p-6 border-t border-slate-800 bg-[#0f172a]/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md uppercase">
              MC
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">Master Client</p>
              <p className="text-xs text-indigo-400 truncate font-medium">{currentUser?.email || 'Authenticated'}</p>
            </div>
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 bg-slate-800 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><LogOut size={16} /> Secure Sign Out</button>
        </div>
          </aside>
        )
      })()}

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative no-print">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10 shadow-sm transition-colors">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Intelligence Dashboard</h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ml-2 flex items-center"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>Live Data</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-inner">
              <CalendarDays size={16} className="text-slate-400 mr-2"/>
              <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="year">This Year</option>
              </select>
            </div>
            <div className="flex items-center w-64 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-inner">
              <Search size={16} className="text-slate-400" />
              <input type="text" placeholder="Search database..." className="bg-transparent outline-none ml-2 text-sm w-full font-semibold text-slate-700 placeholder:text-slate-400" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="p-0.5 hover:bg-slate-200 rounded-md"><X size={14} className="text-slate-500"/></button>}
            </div>
            <button onClick={exportToExcel} className="flex items-center bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm"><Download size={16} className="mr-2 text-slate-500"/> Export</button>
            <button onClick={() => { setShowNotifCenter(!showNotifCenter); setUnreadCount(0) }} className="relative h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 transition">
              <Bell size={18} className="text-slate-600" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{unreadCount}</span>}
            </button>
            <button onClick={() => setShowSettings(true)} className="h-10 px-3 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--client-primary, #6366f1)' }}></span>
              App Settings
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 w-full">
          
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-[1600px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtered Records</p><h3 className="text-3xl font-black text-slate-900 mt-2">{totalAccidents}</h3></div><div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><Database size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-indigo-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Per Client</p><h3 className="text-3xl font-black text-indigo-600 mt-2">{averageAccidents}</h3></div><div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Activity size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-emerald-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Uploaded</p><h3 className="text-3xl font-black text-emerald-600 mt-2">{videosProvided}</h3></div><div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><CheckCircle2 size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-rose-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Missing Video</p><h3 className="text-3xl font-black text-rose-600 mt-2">{videosNotProvided}</h3></div><div className="h-12 w-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600"><AlertCircle size={24}/></div></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Film className="w-4 h-4 mr-2 text-indigo-500"/> Evidence Compliance</h3></div>
                  <div className="flex-1 p-4 relative flex flex-col">
                    {totalAccidents > 0 ? (
                      <><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={evidenceChartData} innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">{evidenceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={EVIDENCE_COLORS[index % EVIDENCE_COLORS.length]} />)}</Pie><RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/></PieChart></ResponsiveContainer></div><div className="mt-2 flex justify-center gap-4 text-xs font-bold text-slate-600"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Secured</div><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></span> Missing</div></div></>
                    ) : (<div className="flex flex-col items-center justify-center h-full text-slate-400"><PieChartIcon size={40} className="mb-4 opacity-20"/><p className="font-bold text-sm">No data</p></div>)}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Activity className="w-4 h-4 mr-2 text-indigo-500"/> Client Volume Comparison</h3><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">Avg: {averageAccidents}</span></div>
                  <div className="flex-1 p-6">
                    {clientChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={clientChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                          <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/>
                          <Bar dataKey="Accidents" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                          <ReferenceLine y={Number(averageAccidents)} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'top', value: 'Avg', fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No data</div>)}
                  </div>
                </div>
              </div>

              {/* NEW: TAMPERING DEVICE OVERVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[360px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-bold text-slate-800 text-sm">Tampering Overview — Counts</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black tracking-widest">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">A {tamperingTotals.approved}</span>
                      <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">P {tamperingTotals.pending}</span>
                      <span className="px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">R {tamperingTotals.rejected}</span>
                    </div>
                  </div>
                  <div className="flex-1 p-6">
                    {tamperingSummaryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tamperingSummaryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                          <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/>
                          <Bar dataKey="approved" stackId="status" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
                          <Bar dataKey="pending" stackId="status" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="rejected" stackId="status" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No tampering data</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[360px] overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-indigo-500" />
                      <h3 className="font-bold text-slate-800 text-sm">Tampering Overview — Amounts (₹)</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black tracking-widest">
                      <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">₹{tamperingTotals.amountApproved.toLocaleString()}</span>
                      <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700">₹{tamperingTotals.amountPending.toLocaleString()}</span>
                      <span className="px-2 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700">₹{tamperingTotals.amountRejected.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex-1 p-6">
                    {tamperingSummaryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tamperingSummaryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                          <RechartsTooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/>
                          <Bar dataKey="amountApproved" stackId="amt" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
                          <Bar dataKey="amountPending" stackId="amt" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="amountRejected" stackId="amt" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No tampering amount data</div>
                    )}
                  </div>
                </div>
              </div>

              {/* MASTER DATABASE IN OVERVIEW */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center"><Database size={18} className="text-indigo-500 mr-2"/><h3 className="font-bold text-slate-800">Master Incident Database</h3></div>
                  <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
                    <button onClick={() => setViewMode('table')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} className="mr-1.5"/> Table View</button>
                    <button onClick={() => setViewMode('map')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={14} className="mr-1.5"/> Incident Map</button>
                  </div>
                </div>
                
                {viewMode === 'table' ? (
                  <div className="overflow-auto w-full max-h-[600px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-white sticky top-0 z-10 shadow-sm ring-1 ring-slate-200/50">
                        <tr>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Date & Time</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Entity / Company</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Vehicle & Driver</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Claim Status</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 text-right">Evidence Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredData.map(acc => (
                          <tr key={acc.id} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-6 py-4"><div className="text-sm font-bold text-slate-900 flex items-center mb-1"><Calendar size={14} className="mr-2 text-indigo-400"/>{acc.accident_date}</div><div className="text-xs text-slate-500 font-semibold ml-6">{acc.accident_time}</div></td>
                            <td className="px-6 py-4"><div className="text-sm font-black text-slate-800">{acc.company_name}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{acc.client_id_number || 'No ID'}</div></td>
                            <td className="px-6 py-4"><div className="mb-1"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-sm">{acc.vehicle_number}</span></div><div className="text-xs text-slate-500 font-semibold flex items-center"><User size={12} className="mr-1 text-slate-400 shrink-0"/>{acc.driver_name}</div></td>
                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm ${getStatusColor(acc.status)}`}>{acc.status || 'Pending Investigation'}</span></td>
                            <td className="px-6 py-4 text-right"><button onClick={() => setSelectedAccident(acc)} className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm hover:shadow-md"><PlaySquare size={16} /> View Profile</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredData.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-500 bg-slate-50/50"><div className="h-12 w-12 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center mb-3"><Search size={24} className="text-slate-300"/></div><p className="font-bold text-slate-800 text-sm">Database empty.</p></div>
                    )}
                  </div>
                ) : (
                  <div className="h-[600px] w-full bg-slate-100 relative"><AccidentMap data={filteredData} onMarkerClick={(acc) => setSelectedAccident(acc)} /></div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-[1600px] mx-auto">
              <div className="mb-2">
                <h3 className="text-2xl font-black text-slate-800">Master Database</h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">Browse all incident records in table or map view.</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center"><Database size={18} className="text-indigo-500 mr-2"/><h3 className="font-bold text-slate-800">Master Incident Database</h3></div>
                  <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
                    <button onClick={() => setViewMode('table')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} className="mr-1.5"/> Table View</button>
                    <button onClick={() => setViewMode('map')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={14} className="mr-1.5"/> Incident Map</button>
                  </div>
                </div>

                {viewMode === 'table' ? (
                  <div className="overflow-auto w-full max-h-[600px]">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-white sticky top-0 z-10 shadow-sm ring-1 ring-slate-200/50">
                        <tr>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Date & Time</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Entity / Company</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Vehicle & Driver</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">Claim Status</th>
                          <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 text-right">Evidence Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredData.map(acc => (
                          <tr key={acc.id} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-6 py-4"><div className="text-sm font-bold text-slate-900 flex items-center mb-1"><Calendar size={14} className="mr-2 text-indigo-400"/>{acc.accident_date}</div><div className="text-xs text-slate-500 font-semibold ml-6">{acc.accident_time}</div></td>
                            <td className="px-6 py-4"><div className="text-sm font-black text-slate-800">{acc.company_name}</div><div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{acc.client_id_number || 'No ID'}</div></td>
                            <td className="px-6 py-4"><div className="mb-1"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-sm">{acc.vehicle_number}</span></div><div className="text-xs text-slate-500 font-semibold flex items-center"><User size={12} className="mr-1 text-slate-400 shrink-0"/>{acc.driver_name}</div></td>
                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm ${getStatusColor(acc.status)}`}>{acc.status || 'Pending Investigation'}</span></td>
                            <td className="px-6 py-4 text-right"><button onClick={() => setSelectedAccident(acc)} className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm hover:shadow-md"><PlaySquare size={16} /> View Profile</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredData.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-500 bg-slate-50/50"><div className="h-12 w-12 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center mb-3"><Search size={24} className="text-slate-300"/></div><p className="font-bold text-slate-800 text-sm">Database empty.</p></div>
                    )}
                  </div>
                ) : (
                  <div className="h-[600px] w-full bg-slate-100 relative"><AccidentMap data={filteredData} onMarkerClick={(acc) => setSelectedAccident(acc)} /></div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PIPELINE KANBAN */}
          {activeTab === 'pipeline' && (
            <div className="animate-in fade-in duration-300 max-w-[1600px] mx-auto h-full flex flex-col">
              <div className="mb-6"><h3 className="text-2xl font-black text-slate-800">Active Claims Pipeline</h3><p className="text-sm text-slate-500 mt-1 font-medium">Visual workflow of all ongoing and completed claims.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
                {['Pending Investigation', 'Claim Filed', 'Case Closed'].map((statusColumn) => (
                  <div key={statusColumn} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, statusColumn)} className="bg-slate-100/50 rounded-2xl border border-slate-200 p-4 min-h-[500px]">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="font-black text-slate-700 uppercase tracking-widest text-xs flex items-center">
                        {statusColumn === 'Pending Investigation' && <Clock size={16} className="mr-2 text-amber-500"/>}
                        {statusColumn === 'Claim Filed' && <FileSignature size={16} className="mr-2 text-blue-500"/>}
                        {statusColumn === 'Case Closed' && <CheckCircle2 size={16} className="mr-2 text-emerald-500"/>}
                        {statusColumn}
                      </h4>
                      <span className="bg-white text-slate-600 font-bold text-xs px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                        {filteredData.filter(log => (log.status || 'Pending Investigation') === statusColumn).length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {filteredData.filter(log => (log.status || 'Pending Investigation') === statusColumn).map(log => (
                        <div key={log.id} draggable onDragStart={(e) => handleDragStart(e, log.id)} className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all group hover:border-indigo-300 ${draggingId === log.id ? 'opacity-70' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.accident_date).toLocaleDateString()}</span>
                          </div>
                          <h5 className="font-bold text-slate-900 text-sm mb-1">{log.vehicle_number}</h5>
                          <p className="text-xs font-semibold text-slate-500 mb-3 flex items-center"><Building2 size={12} className="mr-1"/> {log.company_name}</p>
                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold rounded border ${log.video_provided ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{log.video_provided ? 'Video' : 'Doc Only'}</span>
                            <button onClick={() => setSelectedAccident(log)} className="text-xs font-bold text-indigo-600 hover:underline flex items-center"><PlaySquare size={12} className="mr-1"/> Open</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DRIVER RISK */}
          {activeTab === 'risk' && (
            <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="mb-6"><h3 className="text-2xl font-black text-slate-800">Driver Risk Intelligence</h3><p className="text-sm text-slate-500 mt-1 font-medium">Identify high-risk operators based on incident frequency.</p></div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden mb-6">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm flex items-center"><TrendingDown className="w-4 h-4 mr-2 text-rose-500"/> Operator Incident Frequency</h3></div>
                <div className="flex-1 p-6">
                  {topDriversChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDriversChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/>
                        <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No driver data available</div>)}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center"><AlertTriangle className="mr-2 h-4 w-4 text-amber-500"/> Complete Driver Risk Directory</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-white border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Incidents</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Level</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Latest Incident</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {driverRiskData.map((driver: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900 flex items-center"><UserCircle size={16} className="mr-2 text-slate-400"/> {driver.name}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600">{driver.company}</td>
                          <td className="px-6 py-4 text-center"><span className="text-lg font-black text-slate-800">{driver.count}</span></td>
                          <td className="px-6 py-4">
                            {driver.count >= 3 ? <span className="inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border bg-rose-100 text-rose-700 border-rose-200"><TrendingDown size={14} className="mr-1.5"/> High Risk</span> :
                             driver.count === 2 ? <span className="inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle size={14} className="mr-1.5"/> Medium Risk</span> :
                             <span className="inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 size={14} className="mr-1.5"/> Standard</span>}
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">{new Date(driver.latest).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {driverRiskData.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">No driver data available.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* NEW: TAMPERING MODULE FOR CLIENT */}
          {activeTab === 'tampering' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center"><Wrench className="mr-2 h-5 w-5 text-indigo-600"/> Device Tampering Information</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Review every tampering request, inspect full details, and approve or reject it from one structured view.</p>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">{filteredTamperingLogs.length} Total Requests</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[1080px]">
                    <thead className="bg-white border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Vehicle</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technician</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Repair Charge</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTamperingLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-black text-slate-800">{log.client_name}</div>
                            <div className="text-xs font-bold text-slate-500 mt-1">{log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'}</div>
                            <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">{log.vehicle_number}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-800">{log.driver_name}</div>
                            <div className="text-xs font-medium text-slate-500 mt-1">{getTamperingDriverContact(log)}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-800">{log.technician_name}</div>
                            <div className="text-xs font-medium text-slate-500 mt-1">{getTamperingTechnicianContact(log)}</div>
                          </td>
                          <td className="px-6 py-4 font-black text-rose-600">₹{getTamperingRepairCharge(log)}</td>
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-3 py-1 text-[11px] font-bold rounded-full border shadow-sm ${getTamperingStatusColor(log.status)}`}>{log.status}</span></td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => setSelectedTampering(log)} className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm hover:shadow-md"><PlaySquare size={14} /> Review Request</button>
                          </td>
                        </tr>
                      ))}
                      {filteredTamperingLogs.length === 0 && (<tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">No hardware tampering requests found.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- EVIDENCE VIEWER MODAL (PERFECT PRINT CSS) --- */}
      {selectedAccident && (
        <div id="print-wrapper" className="fixed print:static print:inset-auto inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:ring-0">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 no-print">
              <div><h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><LayoutDashboard className="text-indigo-600 h-6 w-6"/> Evidence Profile</h2><p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedAccident.vehicle_number}</span></p></div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2"><Printer className="h-4 w-4"/> Save Official PDF</button>
                <button onClick={() => setSelectedAccident(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-50/50 print:bg-white grid grid-cols-1 lg:grid-cols-2 gap-8 print-grid print:overflow-visible flex-1">
              <div className="lg:col-span-2 print-col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between page-break-avoid print-block">
                <div><h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1><p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p></div>
                <div className="text-right"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(selectedAccident.status)}`}>{selectedAccident.status || 'Pending'}</span><p className="text-sm font-bold text-slate-800 mt-2">{selectedAccident.company_name}</p></div>
              </div>

              {/* DATA SECTION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 print-col-span-2 page-break-avoid print-box">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver & Incident Data</h4>
                <div className="bg-slate-50 print:bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold mb-1">Driver Name</p><p className="font-bold text-slate-800 text-lg">{selectedAccident.driver_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-1"/> {selectedAccident.driver_contact || 'N/A'}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Date</p><p className="font-bold text-slate-800">{selectedAccident.accident_date}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Time</p><p className="font-bold text-slate-800">{selectedAccident.accident_time}</p></div>
                  <div className="col-span-2 md:col-span-4"><p className="text-xs text-slate-500 uppercase font-bold flex items-center mb-1"><MapPin size={12} className="mr-1"/> Location & GPS</p><p className="font-bold text-slate-800">{selectedAccident.place}</p></div>
                  <div className="col-span-2 md:col-span-4 pt-2 border-t border-slate-200"><p className="text-xs text-slate-500 uppercase font-bold mb-1">Remarks / Notes</p><p className="font-medium text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{selectedAccident.remarks || 'No remarks provided.'}</p></div>
                </div>
              </div>

              {/* IMAGES */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 print-col-span-1 page-break-avoid print-box"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Accident Vehicle Picture</h3>{selectedAccident.vehicle_image_url ? <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 print-col-span-1 page-break-avoid print-box"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><User className="mr-2 h-5 w-5 text-indigo-500"/> Driver Picture</h3>{selectedAccident.driver_image_url ? <img src={selectedAccident.driver_image_url} alt="Driver" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div>

              {/* VIDEOS */}
              {selectedAccident.video_provided ? (
                <>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 print-col-span-1 page-break-avoid print-box"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Front Dashcam Footage</h3>{selectedAccident.front_video_url ? (<div className="space-y-4"><video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner object-cover border border-slate-800 no-print"><source src={selectedAccident.front_video_url} type="video/mp4" /></video><a href={selectedAccident.front_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Click to View Front Video</a></div>) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm"><Film size={32} className="mb-2 opacity-20"/>No Front Video Uploaded</div>)}</div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm col-span-1 print-col-span-1 page-break-avoid print-box"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Rear Dashcam Footage</h3>{selectedAccident.rear_video_url ? (<div className="space-y-4"><video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner object-cover border border-slate-800 no-print"><source src={selectedAccident.rear_video_url} type="video/mp4" /></video><a href={selectedAccident.rear_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Click to View Rear Video</a></div>) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm"><Film size={32} className="mb-2 opacity-20"/>No Rear Video Uploaded</div>)}</div>
                </>
              ) : (
                <div className="bg-white p-8 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-50/50 to-white lg:col-span-2 print-col-span-2 page-break-avoid print-box"><div className="h-20 w-20 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner rotate-3"><AlertCircle size={40} className="text-rose-500"/></div><h3 className="text-2xl font-black text-slate-900 mb-3">Video Evidence Missing</h3>{selectedAccident.investigation_doc_url ? (<a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" className="no-print bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center transition-all mt-4"><FileSignature className="mr-3" size={24}/> View Official Document</a>) : (<div className="px-6 py-4 bg-slate-100 rounded-xl text-slate-500 text-sm font-bold border border-slate-200 flex items-center shadow-inner mt-4"><X size={20} className="mr-2 text-slate-400"/> No Document Uploaded</div>)}</div>
              )}
              
              <div className="lg:col-span-2 print-col-span-2 mt-8 pt-6 border-t border-slate-200 text-center page-break-avoid hidden print:block print-stack-item"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">© {new Date().getFullYear()} All Rights Reserved For Ashish Rajput<br/>Confidential & Proprietary Incident Data</p></div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAMPERING VIEWER MODAL --- */}
      {selectedTampering && (
        <div id="print-wrapper" className="fixed print:static print:inset-auto inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:ring-0">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 no-print">
              <div><h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><Wrench className="text-indigo-600 h-6 w-6"/> Device Tampering Review</h2><p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedTampering.vehicle_number}</span></p></div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2"><Printer className="h-4 w-4"/> Print Report</button>
                <button onClick={() => {setSelectedTampering(null); setShowRejectInput(false);}} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-50/50 print:bg-white grid grid-cols-1 lg:grid-cols-2 gap-8 print-grid print:overflow-visible flex-1">
              <div className="lg:col-span-2 print-col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between page-break-avoid print-block">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">{selectedTampering.client_name}</h1>
                  <p className="text-slate-500 font-medium mt-1 flex items-center"><CalendarDays size={14} className="mr-1"/> Logged on {selectedTampering.created_at ? new Date(selectedTampering.created_at).toLocaleDateString() : 'Unknown date'}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getTamperingStatusColor(selectedTampering.status)}`}>{selectedTampering.status}</span>
                  <p className="text-xs font-bold text-slate-400 mt-2">Logged by: {selectedTampering.created_by || 'System Admin'}</p>
                </div>
              </div>

              {selectedTampering.status === 'Rejected' && selectedTampering.rejection_reason && (
                <div className="lg:col-span-2 print-col-span-2 bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 page-break-avoid"><AlertCircle className="text-rose-500 shrink-0 mt-0.5"/><div><h4 className="text-sm font-black text-rose-800">Client Rejection Reason</h4><p className="text-sm font-medium text-rose-600 mt-1">{selectedTampering.rejection_reason}</p></div></div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 print-col-span-2 page-break-avoid print-box">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tampering Request Details</h4>
                <div className="bg-slate-50 print:bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Driver Name</p><p className="font-bold text-slate-800 text-lg">{selectedTampering.driver_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-1"/> {getTamperingDriverContact(selectedTampering)}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Technician Name</p><p className="font-bold text-slate-800 text-lg">{selectedTampering.technician_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-1"/> {getTamperingTechnicianContact(selectedTampering)}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Vehicle Number</p><p className="font-bold text-slate-800">{selectedTampering.vehicle_number}</p></div>
                  <div><p className="text-xs text-slate-500 uppercase font-bold mb-1">Repair Charge</p><p className="font-black text-lg text-rose-600">₹{getTamperingRepairCharge(selectedTampering)}</p></div>
                  <div className="md:col-span-2"><p className="text-xs text-slate-500 uppercase font-bold flex items-center mb-1"><MapPin size={12} className="mr-1"/> Address</p><p className="font-bold text-slate-800">{selectedTampering.address}</p></div>
                  <div className="md:col-span-2 pt-2 border-t border-slate-200"><p className="text-xs text-slate-500 uppercase font-bold mb-1">Tampering Details</p><p className="font-medium text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTampering.tampering_details}</p></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid print-box">
                <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Device Tampering Evidence</h3>
                {selectedTampering.tampering_image_url ? <img src={selectedTampering.tampering_image_url} alt="Tampering evidence" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">Image Missing</div>}
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid print-box">
                <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Wrench className="mr-2 h-5 w-5 text-indigo-500"/> Repair Device Evidence</h3>
                {getTamperingRepairImage(selectedTampering) ? <img src={getTamperingRepairImage(selectedTampering) || ''} alt="Repair device evidence" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-75[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">Image Missing</div>}
              </div>

              {selectedTampering.status === 'Pending Approval' && (
                <div className="lg:col-span-2 print-col-span-2 mt-8 pt-8 border-t border-slate-200 no-print">
                  <h3 className="text-lg font-black text-slate-800 mb-4">Required Action</h3>
                  {!showRejectInput ? (
                    <div className="flex gap-4">
                      <button onClick={() => handleApproveTampering(selectedTampering.id)} disabled={isUpdatingStatus} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center">{isUpdatingStatus ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <ThumbsUp className="h-5 w-5 mr-2"/>} Approve Repair</button>
                      <button onClick={() => setShowRejectInput(true)} className="flex-1 bg-white border-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold py-4 rounded-xl transition-all flex items-center justify-center"><ThumbsDown className="h-5 w-5 mr-2"/> Reject Repair</button>
                    </div>
                  ) : (
                    <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 animate-in fade-in slide-in-from-bottom-4">
                      <h4 className="text-sm font-bold text-rose-800 mb-3">Reason for Rejection <span className="text-rose-500">*</span></h4>
                      <textarea rows={3} className="w-full p-3 rounded-xl border border-rose-200 focus:ring-2 focus:ring-rose-500 outline-none mb-4 text-sm font-medium" placeholder="Please explain why you are rejecting this repair request..." value={rejectReason} onChange={e => setRejectReason(e.target.value)}></textarea>
                      <div className="flex gap-3">
                        <button onClick={() => setShowRejectInput(false)} className="px-6 py-3 font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                        <button onClick={() => handleRejectTampering(selectedTampering.id)} disabled={isUpdatingStatus || !rejectReason.trim()} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-200 flex items-center justify-center disabled:opacity-50">{isUpdatingStatus ? <Loader2 className="animate-spin h-5 w-5 mr-2"/> : <ThumbsDown className="h-5 w-5 mr-2"/>} Confirm Rejection</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="lg:col-span-2 print-col-span-2 mt-8 pt-6 border-t border-slate-200 text-center page-break-avoid hidden print:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">© {new Date().getFullYear()} All Rights Reserved For Ashish Rajput<br/>Confidential & Proprietary Tampering Device Data</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
