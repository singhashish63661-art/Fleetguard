'use client'
/* eslint-disable @next/next/no-img-element */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { 
  Download, LogOut, Search, X, Image as ImageIcon, Film, 
  LayoutDashboard, PlaySquare, AlertCircle, FileSignature, 
  Phone, User, Building2, Calendar, MapPin, Database, 
  PieChart as PieChartIcon, CheckCircle2, ShieldAlert, 
  Activity, Map as MapIcon, List, Link as LinkIcon, CalendarDays,
  Clock, Briefcase, FileDown, TrendingDown, AlertTriangle, UserCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const AccidentMap = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold"><Activity className="animate-spin mr-2"/> Loading Geospatial Data...</div> 
})

type DashboardTab = 'overview' | 'pipeline' | 'risk' | 'database'
type DateFilter = 'all' | '7d' | '30d' | 'year'
type ClaimStatus = 'Pending Investigation' | 'Claim Filed' | 'Case Closed'

interface ClientProfile {
  company_name?: string | null
  email?: string | null
  role?: string | null
}

interface AccidentRecord {
  id: string
  accident_date: string
  accident_time: string
  vehicle_number: string
  driver_name: string
  driver_contact?: string | null
  company_name?: string | null
  client_id_number?: string | null
  place: string
  status?: string | null
  video_provided: boolean
  vehicle_image_url?: string | null
  driver_image_url?: string | null
  front_video_url?: string | null
  rear_video_url?: string | null
  investigation_doc_url?: string | null
  remarks?: string | null
}

interface DriverStatSummary {
  count: number
  company: string
  contact: string
  latest: string
}

interface DriverRiskEntry extends DriverStatSummary {
  name: string
}

const PIPELINE_COLUMNS: ClaimStatus[] = ['Pending Investigation', 'Claim Filed', 'Case Closed']

export default function ClientDashboard() {
  const router = useRouter()
  
  const[activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [data, setData] = useState<AccidentRecord[]>([])
  const [currentUser, setCurrentUser] = useState<ClientProfile | null>(null)
  
  const [search, setSearch] = useState('')
  const[dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table')
  const [selectedAccident, setSelectedAccident] = useState<AccidentRecord | null>(null)

  const fetchCurrentUser = async (): Promise<ClientProfile | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('company_name, role').eq('id', session.user.id).single()
        return { ...profile, email: session.user.email ?? null }
      }
    } catch (error) {
      console.log("Auth bypass:", error)
    }

    return null
  }

  const fetchData = async (): Promise<AccidentRecord[]> => {
    const { data: accidents } = await supabase.from('accidents').select('*').order('created_at', { ascending: false })
    return (accidents as AccidentRecord[]) || []
  }

  useEffect(() => {
    let isActive = true

    void (async () => {
      const [profile, accidents] = await Promise.all([fetchCurrentUser(), fetchData()])
      if (!isActive) return

      setCurrentUser(profile)
      setData(accidents)
    })()

    return () => {
      isActive = false
    }
  }, [])

  // --- UNLOCKED MASTER FILTERING ---
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

  // --- METRICS ---
  const totalAccidents = filteredData.length
  const videosProvided = filteredData.filter(d => d.video_provided).length
  const videosNotProvided = totalAccidents - videosProvided

  const evidenceChartData =[{ name: 'Video Provided', value: videosProvided }, { name: 'Missing Video', value: videosNotProvided }]
  const EVIDENCE_COLORS =['#10b981', '#f43f5e'] 

  const driverStats = filteredData.reduce<Record<string, DriverStatSummary>>((acc, log) => {
    const driver = log.driver_name || 'Unknown Driver'
    if (!acc[driver]) {
      acc[driver] = {
        count: 0,
        company: log.company_name || 'Unknown Entity',
        contact: log.driver_contact || 'N/A',
        latest: log.accident_date,
      }
    }
    acc[driver].count++
    if (new Date(log.accident_date) > new Date(acc[driver].latest)) acc[driver].latest = log.accident_date
    return acc
  }, {})
  
  const driverRiskData: DriverRiskEntry[] = Object.keys(driverStats)
    .map((driver) => ({ name: driver, ...driverStats[driver] }))
    .sort((a, b) => b.count - a.count)
  const topDriversChart = driverRiskData.slice(0, 10); 

  const companyStats = filteredData.reduce<Record<string, number>>((acc, log) => {
    const company = log.company_name || 'Unknown Entity'
    if (!acc[company]) acc[company] = 0
    acc[company]++
    return acc
  }, {})

  const clientChartData = Object.keys(companyStats).map(company => ({ name: company, Accidents: companyStats[company] })).sort((a, b) => b.Accidents - a.Accidents);
  const uniqueClientsCount = Object.keys(companyStats).length;
  const averageAccidents = uniqueClientsCount > 0 ? (totalAccidents / uniqueClientsCount).toFixed(1) : '0';

  const pipelineData = PIPELINE_COLUMNS.reduce<Record<ClaimStatus, AccidentRecord[]>>((acc, statusColumn) => {
    acc[statusColumn] = filteredData.filter((log) => (log.status || 'Pending Investigation') === statusColumn)
    return acc
  }, {
    'Pending Investigation': [],
    'Claim Filed': [],
    'Case Closed': [],
  })

  const exportToExcel = () => {
    const exportData = filteredData.map(item => ({
      Entity: item.company_name || 'N/A', Date: item.accident_date, Time: item.accident_time,
      Vehicle_No: item.vehicle_number, Driver: item.driver_name, Contact: item.driver_contact || 'N/A',
      Location: item.place, Status: getDisplayStatus(item), Video_Provided: item.video_provided ? 'Yes' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master_Report")
    XLSX.writeFile(wb, `Master_Incident_Report.xlsx`)
  }

  const getDisplayStatus = (record: AccidentRecord) => {
    const baseStatus = record.status || 'Pending Investigation'
    if (baseStatus === 'Pending Investigation' && !record.video_provided && record.investigation_doc_url) {
      return 'Investigation Document Submitted'
    }
    return baseStatus
  }

  const getStatusColor = (status: string) => {
    if (status === 'Investigation Document Submitted') return 'bg-violet-100 text-violet-800 border-violet-200'
    if (status === 'Pending Investigation') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'Claim Filed') return 'bg-blue-100 text-blue-800 border-blue-200'
    if (status === 'Case Closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  // --- NATIVE PDF ENGINE (Replaces Buggy html2canvas) ---
  const handleDownloadPdf = () => {
    window.print();
  }

  return (
    // ROOT APP CONTAINER
    // We add print:h-auto and print:block to unroll the app during printing so it doesn't get cut off!
    <div className="flex min-h-screen lg:h-screen bg-[#f8fafc] font-sans text-slate-900 overflow-hidden print:h-auto print:block print:overflow-visible print:bg-white">
      
      {/* GLOBAL NATIVE PRINT CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body, html { background-color: white !important; height: auto !important; min-height: auto !important; overflow: visible !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          body * { visibility: hidden; }
          #print-wrapper, #print-wrapper * { visibility: visible; }
          #print-wrapper { position: static !important; inset: auto !important; display: block !important; padding: 0 !important; margin: 0 !important; background: white !important; backdrop-filter: none !important; }
          #print-area { width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; border: none !important; box-shadow: none !important; }
          .page-break-avoid { break-inside: avoid !important; page-break-inside: avoid !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}} />

      {/* SIDEBAR (Hidden on Print) */}
      <aside className="hidden lg:flex w-72 bg-[#020617] text-slate-300 flex-col z-20 shrink-0 shadow-2xl print:hidden">
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-lg mr-3 shadow-lg shadow-indigo-900/50"><ShieldAlert className="h-5 w-5 text-white" /></div>
          <h1 className="text-xl font-bold tracking-tight text-white">Fleet<span className="text-indigo-400">Guard</span></h1>
        </div>
        <div className="px-6 py-6 flex-1 space-y-2 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mb-4 px-2">Analytics Engine</p>
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50'}`}><LayoutDashboard size={18} className={activeTab === 'overview' ? 'text-white' : 'text-indigo-400'} /> Executive Dashboard</button>
          <button onClick={() => setActiveTab('pipeline')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold ${activeTab === 'pipeline' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50'}`}><Briefcase size={18} className={activeTab === 'pipeline' ? 'text-white' : 'text-indigo-400'} /> Claims Pipeline</button>
          <button onClick={() => setActiveTab('risk')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold ${activeTab === 'risk' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50'}`}><AlertTriangle size={18} className={activeTab === 'risk' ? 'text-white' : 'text-indigo-400'} /> Driver Risk</button>
          <button onClick={() => setActiveTab('database')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-sm font-semibold ${activeTab === 'database' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-700/50'}`}><Database size={18} className={activeTab === 'database' ? 'text-white' : 'text-indigo-400'} /> Master Database</button>
        </div>
        <div className="p-6 border-t border-slate-800 bg-[#0f172a]/50">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md uppercase">MC</div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{currentUser?.company_name || 'Master Client'}</p>
              <p className="text-xs text-indigo-400 truncate font-medium">{currentUser?.email || 'Authenticated'}</p>
            </div>
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 bg-slate-800 hover:bg-rose-600 hover:text-white transition-all shadow-sm"><LogOut size={16} /> Secure Sign Out</button>
        </div>
      </aside>

      {/* MAIN APP AREA (Hidden on Print) */}
      <main className="flex-1 flex flex-col min-h-screen lg:h-screen overflow-hidden relative print:hidden">
        
        <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Intelligence Dashboard</h2>
            {currentUser?.role === 'admin' && <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ml-2 flex items-center">Admin View</span>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:items-center lg:justify-end">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-inner w-full sm:w-auto">
              <CalendarDays size={16} className="text-slate-400 mr-2"/>
              <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)}>
                <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="year">This Year</option>
              </select>
            </div>
            <div className="flex items-center w-full sm:w-64 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all shadow-inner">
              <Search size={16} className="text-slate-400" />
              <input type="text" placeholder="Search database..." className="bg-transparent outline-none ml-2 text-sm w-full font-semibold text-slate-700 placeholder:text-slate-400" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="p-0.5 hover:bg-slate-200 rounded-md"><X size={14} className="text-slate-500"/></button>}
            </div>
            <button onClick={exportToExcel} className="flex items-center justify-center bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm w-full sm:w-auto"><Download size={16} className="mr-2 text-slate-500"/> Export Data</button>
          </div>
          </div>
        </header>

        <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Client Panel</p>
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.company_name || 'Master Client'}</p>
            </div>
            <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => setActiveTab('overview')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Overview</button>
            <button onClick={() => setActiveTab('pipeline')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'pipeline' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Pipeline</button>
            <button onClick={() => setActiveTab('risk')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'risk' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Risk</button>
            <button onClick={() => setActiveTab('database')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'database' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Database</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-[1600px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtered Records</p><h3 className="text-3xl font-black text-slate-900 mt-2">{totalAccidents}</h3></div><div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><Database size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-indigo-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Per Client</p><h3 className="text-3xl font-black text-indigo-600 mt-2">{averageAccidents}</h3></div><div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Activity size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-emerald-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Uploaded</p><h3 className="text-3xl font-black text-emerald-600 mt-2">{videosProvided}</h3></div><div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><Film size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-rose-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Missing Video</p><h3 className="text-3xl font-black text-rose-600 mt-2">{videosNotProvided}</h3></div><div className="h-12 w-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600"><AlertCircle size={24}/></div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden"><div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Film className="w-4 h-4 mr-2 text-indigo-500"/> Evidence Compliance</h3></div><div className="flex-1 p-4 relative flex flex-col">{totalAccidents > 0 ? (<><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={evidenceChartData} innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">{evidenceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={EVIDENCE_COLORS[index % EVIDENCE_COLORS.length]} />)}</Pie><RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/></PieChart></ResponsiveContainer></div><div className="mt-2 flex justify-center gap-4 text-xs font-bold text-slate-600"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Secured</div><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></span> Missing</div></div></>) : (<div className="flex flex-col items-center justify-center h-full text-slate-400"><PieChartIcon size={40} className="mb-4 opacity-20"/><p className="font-bold text-sm">No data</p></div>)}</div></div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden"><div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Activity className="w-4 h-4 mr-2 text-indigo-500"/> Client Volume Comparison</h3><span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest">Avg: {averageAccidents}</span></div><div className="flex-1 p-6">{clientChartData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={clientChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} /><RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/><Bar dataKey="Accidents" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} /><ReferenceLine y={Number(averageAccidents)} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'top', value: 'Avg', fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' }} /></BarChart></ResponsiveContainer>) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No data</div>)}</div></div>
              </div>

              {/* MASTER DATA VIEW (BOTTOM OF OVERVIEW) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                <div className="px-4 sm:px-6 py-5 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
                  <div className="flex items-center"><Database size={18} className="text-indigo-500 mr-2"/><h3 className="font-bold text-slate-800">Master Incident Database</h3></div>
                  <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
                    <button onClick={() => setViewMode('table')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} className="mr-1.5"/> Table View</button>
                    <button onClick={() => setViewMode('map')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={14} className="mr-1.5"/> Incident Map</button>
                  </div>
                </div>
                
                {viewMode === 'table' ? (
                  <div className="overflow-auto w-full max-h-[600px]">
                    <table className="w-full text-left whitespace-nowrap min-w-[760px]">
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
                            <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm ${getStatusColor(getDisplayStatus(acc))}`}>{getDisplayStatus(acc)}</span></td>
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

          {/* TAB 2: CLAIMS PIPELINE KANBAN */}
          {activeTab === 'pipeline' && (
            <div className="animate-in fade-in duration-300 max-w-[1600px] mx-auto h-full flex flex-col">
              <div className="mb-6"><h3 className="text-xl sm:text-2xl font-black text-slate-800">Active Claims Pipeline</h3><p className="text-sm text-slate-500 mt-1 font-medium">Visual workflow of all ongoing and completed claims.</p></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 items-start">
                {PIPELINE_COLUMNS.map((statusColumn) => (
                  <div key={statusColumn} className="bg-slate-100/50 rounded-2xl border border-slate-200 p-4 min-h-[500px]">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="font-black text-slate-700 uppercase tracking-widest text-xs flex items-center">
                        {statusColumn === 'Pending Investigation' && <Clock size={16} className="mr-2 text-amber-500"/>}
                        {statusColumn === 'Claim Filed' && <FileSignature size={16} className="mr-2 text-blue-500"/>}
                        {statusColumn === 'Case Closed' && <CheckCircle2 size={16} className="mr-2 text-emerald-500"/>}
                        {statusColumn}
                      </h4>
                      <span className="bg-white text-slate-600 font-bold text-xs px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                        {pipelineData[statusColumn].length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {pipelineData[statusColumn].map((log) => (
                        <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all group hover:border-indigo-300">
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

          {/* TAB 3: DRIVER RISK PROFILES */}
          {activeTab === 'risk' && (
            <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="mb-6"><h3 className="text-xl sm:text-2xl font-black text-slate-800">Driver Intelligence & Risk Profiling</h3><p className="text-sm text-slate-500 mt-1 font-medium">Identify high-risk operators based on incident frequency.</p></div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden mb-6">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm flex items-center"><TrendingDown className="w-4 h-4 mr-2 text-rose-500"/> Operator Incident Frequency</h3></div>
                <div className="flex-1 p-6">
                  {topDriversChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDriversChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                        <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', backgroundColor: '#fff', color: '#000', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3)', fontWeight: 'bold'}}/>
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
                  <table className="w-full text-left whitespace-nowrap min-w-[720px]">
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
                      {driverRiskData.map((driver, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900 flex items-center"><UserCircle size={16} className="mr-2 text-slate-400"/> {driver.name}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">{driver.company}</td>
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

          {/* TAB 4: MASTER DATABASE ONLY */}
          {activeTab === 'database' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1600px] mx-auto">
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
                <div className="flex items-center"><Database size={18} className="text-indigo-500 mr-2"/><h3 className="font-bold text-slate-800">Secure Incident Database</h3></div>
                <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200 w-full sm:w-auto">
                  <button onClick={() => setViewMode('table')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={14} className="mr-1.5"/> Table View</button>
                  <button onClick={() => setViewMode('map')} className={`flex items-center px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={14} className="mr-1.5"/> Incident Map</button>
                </div>
              </div>
              
              {viewMode === 'table' ? (
                <div className="overflow-auto w-full max-h-[600px]">
                  <table className="w-full text-left whitespace-nowrap min-w-[760px]">
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
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-full border shadow-sm ${getStatusColor(getDisplayStatus(acc))}`}>{getDisplayStatus(acc)}</span></td>
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
          )}

        </div>
      </main>

      {/* --- EVIDENCE VIEWER MODAL (NATIVE PDF ENGINE) --- */}
      {selectedAccident && (
        <div id="print-wrapper" className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200 print:absolute print:inset-0 print:block print:bg-white print:z-auto print:p-0">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden print:shadow-none print:ring-0 print:border-none print:max-h-none print:overflow-visible print:w-full print:block">
            
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 shrink-0 print:hidden">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><LayoutDashboard className="text-indigo-600 h-6 w-6"/> Evidence Profile</h2>
                <p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedAccident.vehicle_number}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleDownloadPdf} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2">
                  <FileDown className="h-4 w-4"/> Download PDF Report
                </button>
                <button onClick={() => setSelectedAccident(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-50/50 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 print:hidden">
              
              <div className="lg:col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between page-break-avoid">
                <div>
                  <h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1>
                  <p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(getDisplayStatus(selectedAccident))}`}>{getDisplayStatus(selectedAccident)}</span>
                  <p className="text-sm font-bold text-slate-800 mt-2">{selectedAccident.company_name}</p>
                </div>
              </div>

              <div className="space-y-8 page-break-avoid">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Information</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-800 text-lg">{selectedAccident.driver_name}</p>
                    <p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-2"/> {selectedAccident.driver_contact || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Accident Vehicle Picture</h3>
                  {selectedAccident.vehicle_image_url ? <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}
                </div>
                
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><User className="mr-2 h-5 w-5 text-indigo-500"/> Driver Picture</h3>
                  {selectedAccident.driver_image_url ? <img src={selectedAccident.driver_image_url} alt="Driver" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[300px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}
                </div>
              </div>

              <div className="space-y-8 page-break-avoid">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Incident Data</h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-slate-500 uppercase font-bold">Date</p><p className="font-bold text-slate-800">{selectedAccident.accident_date}</p></div>
                    <div><p className="text-xs text-slate-500 uppercase font-bold">Time</p><p className="font-bold text-slate-800">{selectedAccident.accident_time}</p></div>
                    <div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold flex items-center"><MapPin size={12} className="mr-1"/> Location & GPS</p><p className="font-bold text-slate-800">{selectedAccident.place}</p></div>
                    <div className="col-span-2 pt-2 border-t border-slate-200"><p className="text-xs text-slate-500 uppercase font-bold">Remarks / Notes</p><p className="font-medium text-sm text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">{selectedAccident.remarks || 'No remarks provided.'}</p></div>
                  </div>
                </div>

                {selectedAccident.video_provided ? (
                  <>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Front Dashcam Footage</h3>
                      {selectedAccident.front_video_url ? (
                        <div className="space-y-4">
                          <video controls preload="metadata" className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner object-cover border border-slate-800 no-print">
                            <source src={selectedAccident.front_video_url} type="video/mp4" />
                          </video>
                          <a href={selectedAccident.front_video_url} target="_blank" rel="noopener noreferrer" download className="no-print flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Download Front Video</a>
                        </div>
                      ) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm"><Film size={32} className="mb-2 opacity-20"/>No Front Video Uploaded</div>)}
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Rear Dashcam Footage</h3>
                      {selectedAccident.rear_video_url ? (
                        <div className="space-y-4">
                          <video controls preload="metadata" className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner object-cover border border-slate-800 no-print">
                            <source src={selectedAccident.rear_video_url} type="video/mp4" />
                          </video>
                          <a href={selectedAccident.rear_video_url} target="_blank" rel="noopener noreferrer" download className="no-print flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Download Rear Video</a>
                        </div>
                      ) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm"><Film size={32} className="mb-2 opacity-20"/>No Rear Video Uploaded</div>)}
                    </div>
                  </>
                ) : (
                  <div className="bg-white p-8 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-50/50 to-white">
                    <div className="h-20 w-20 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner rotate-3"><AlertCircle size={40} className="text-rose-500"/></div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3">Video Evidence Missing</h3>
                    {selectedAccident.investigation_doc_url ? (
                      <a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" download className="no-print bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center transition-all mt-4"><FileSignature className="mr-3" size={24}/> Download Official Document</a>
                    ) : (<div className="px-6 py-4 bg-slate-100 rounded-xl text-slate-500 text-sm font-bold border border-slate-200 flex items-center shadow-inner mt-4"><X size={20} className="mr-2 text-slate-400"/> No Document Uploaded</div>)}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 mt-8 pt-6 border-t border-slate-200 text-center page-break-avoid hidden print:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  © {new Date().getFullYear()} All Rights Reserved For Ashish Rajput<br/>
                  Confidential & Proprietary Incident Data
                </p>
              </div>

            </div>

            <div className="hidden print-only">
              <div className="border-b border-slate-200 pb-4 mb-6 page-break-avoid">
                <h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1>
                <p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p>
                <div className="mt-4 space-y-2">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(getDisplayStatus(selectedAccident))}`}>{getDisplayStatus(selectedAccident)}</span>
                  <p className="text-sm font-bold text-slate-800">{selectedAccident.company_name}</p>
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Information</h3>
                <div className="space-y-2 text-sm">
                  <p className="font-bold text-slate-900">{selectedAccident.driver_name}</p>
                  <p className="text-slate-600">Contact: {selectedAccident.driver_contact || 'N/A'}</p>
                  <p className="text-slate-600">Vehicle: {selectedAccident.vehicle_number}</p>
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Incident Data</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-slate-500 font-bold uppercase text-xs">Date</p><p className="font-semibold text-slate-900">{selectedAccident.accident_date}</p></div>
                  <div><p className="text-slate-500 font-bold uppercase text-xs">Time</p><p className="font-semibold text-slate-900">{selectedAccident.accident_time}</p></div>
                  <div className="col-span-2"><p className="text-slate-500 font-bold uppercase text-xs">Location</p><p className="font-semibold text-slate-900">{selectedAccident.place}</p></div>
                  <div className="col-span-2"><p className="text-slate-500 font-bold uppercase text-xs">Remarks</p><p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedAccident.remarks || 'No remarks provided.'}</p></div>
                </div>
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Vehicle Picture</h3>
                {selectedAccident.vehicle_image_url ? (
                  <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full max-h-[320px] object-contain rounded-xl border border-slate-200" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-48 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>
                )}
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Picture</h3>
                {selectedAccident.driver_image_url ? (
                  <img src={selectedAccident.driver_image_url} alt="Driver" className="w-full max-h-[320px] object-contain rounded-xl border border-slate-200" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-48 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>
                )}
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Evidence Summary</h3>
                {selectedAccident.video_provided ? (
                  <div className="space-y-3 text-sm text-slate-700">
                    <p>Front video: {selectedAccident.front_video_url ? 'Attached' : 'Not uploaded'}</p>
                    <p>Rear video: {selectedAccident.rear_video_url ? 'Attached' : 'Not uploaded'}</p>
                    <p>Videos are available in the digital record and are omitted from the printed report.</p>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-slate-700">
                    <p className="font-bold text-rose-600">Video evidence missing.</p>
                    <p>Investigation document: {selectedAccident.investigation_doc_url ? 'Attached in digital record' : 'Not uploaded'}</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-2xl mb-6 page-break-avoid">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Download Links</h3>
                <div className="space-y-4 text-sm">
                  {selectedAccident.front_video_url ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                      <p className="font-bold text-indigo-900">Front Video</p>
                      <a href={selectedAccident.front_video_url} target="_blank" rel="noopener noreferrer" download className="mt-2 inline-flex items-center text-indigo-700 hover:text-indigo-900 underline break-all">
                        <LinkIcon size={14} className="mr-2 shrink-0" />
                        {selectedAccident.front_video_url}
                      </a>
                    </div>
                  ) : null}

                  {selectedAccident.rear_video_url ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                      <p className="font-bold text-indigo-900">Rear Video</p>
                      <a href={selectedAccident.rear_video_url} target="_blank" rel="noopener noreferrer" download className="mt-2 inline-flex items-center text-indigo-700 hover:text-indigo-900 underline break-all">
                        <LinkIcon size={14} className="mr-2 shrink-0" />
                        {selectedAccident.rear_video_url}
                      </a>
                    </div>
                  ) : null}

                  {selectedAccident.investigation_doc_url ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-bold text-slate-900">Investigation Document</p>
                      <a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" download className="mt-2 inline-flex items-center text-slate-700 hover:text-slate-900 underline break-all">
                        <FileSignature size={14} className="mr-2 shrink-0" />
                        {selectedAccident.investigation_doc_url}
                      </a>
                    </div>
                  ) : null}

                  {!selectedAccident.front_video_url && !selectedAccident.rear_video_url && !selectedAccident.investigation_doc_url ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500">
                      No downloadable media or document links available for this record.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 text-center page-break-avoid">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">
                  © {new Date().getFullYear()} All Rights Reserved For Ashish Rajput<br/>
                  Confidential & Proprietary Incident Data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
