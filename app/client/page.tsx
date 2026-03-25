'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { 
  Download, LogOut, Search, X, Image as ImageIcon, Film, 
  LayoutDashboard, PlaySquare, AlertCircle, FileSignature, 
  Phone, User, Building2, Calendar, MapPin, Database, 
  PieChart as PieChartIcon, CheckCircle2, ShieldAlert, Printer, 
  Activity, Map as MapIcon, List, Link as LinkIcon, CalendarDays,
  Clock, Briefcase, Loader2, FileDown
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const AccidentMap = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-50 text-slate-400 font-bold"><Activity className="animate-spin mr-2"/> Loading Geospatial Data...</div> 
})

export default function ClientDashboard() {
  const router = useRouter()
  
  const[data, setData] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const[search, setSearch] = useState('')
  const[dateFilter, setDateFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table')
  const [selectedAccident, setSelectedAccident] = useState<any | null>(null)

  useEffect(() => {
    fetchCurrentUser()
    fetchData()
  },[])

  const fetchCurrentUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setCurrentUser({ ...profile, email: session.user.email })
      }
    } catch (error) { console.log("Auth bypass:", error) }
  }

  const fetchData = async () => {
    const { data: accidents } = await supabase.from('accidents').select('*').order('created_at', { ascending: false })
    if (accidents) setData(accidents)
  }

  const filteredData = data.filter(item => {
    const term = search.toLowerCase()
    const matchesSearch = (item.vehicle_number && item.vehicle_number.toLowerCase().includes(term)) ||
                          (item.driver_name && item.driver_name.toLowerCase().includes(term)) ||
                          (item.company_name && item.company_name.toLowerCase().includes(term));
    if (!matchesSearch) return false;

    if (dateFilter !== 'all') {
      const logDate = new Date(item.accident_date);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (dateFilter === '7d' && diffDays > 7) return false;
      if (dateFilter === '30d' && diffDays > 30) return false;
      if (dateFilter === 'year' && logDate.getFullYear() !== now.getFullYear()) return false;
    }
    return true;
  })

  const totalAccidents = filteredData.length
  const videosProvided = filteredData.filter(d => d.video_provided).length
  const videosNotProvided = totalAccidents - videosProvided

  const pendingCount = filteredData.filter(d => d.status === 'Pending Investigation' || !d.status).length
  const claimFiledCount = filteredData.filter(d => d.status === 'Claim Filed').length
  const closedCount = filteredData.filter(d => d.status === 'Case Closed').length
  
  const statusChartData =[
    { name: 'Pending', count: pendingCount },
    { name: 'Claim Filed', count: claimFiledCount },
    { name: 'Closed', count: closedCount }
  ]
  const STATUS_COLORS =['#f59e0b', '#3b82f6', '#10b981']

  const evidenceChartData =[{ name: 'Video Provided', value: videosProvided }, { name: 'Missing Video', value: videosNotProvided }]
  const EVIDENCE_COLORS =['#10b981', '#f43f5e'] 

  const companyStats = filteredData.reduce((acc: any, log) => {
    const company = log.company_name || 'Unknown Entity';
    if (!acc[company]) acc[company] = 0;
    acc[company]++;
    return acc;
  }, {});

  const clientChartData = Object.keys(companyStats).map(company => ({ name: company, Accidents: companyStats[company] })).sort((a, b) => b.Accidents - a.Accidents);
  const uniqueClientsCount = Object.keys(companyStats).length;
  const averageAccidents = uniqueClientsCount > 0 ? (totalAccidents / uniqueClientsCount).toFixed(1) : '0';
  const CLIENT_COLORS =['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

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

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-900 overflow-hidden">
      
      {/* --- FLAWLESS NATIVE PDF/PRINT ENGINE --- */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background-color: white !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          
          /* Hide main dashboard */
          body > div > aside, body > div > main { display: none !important; }
          
          /* Unroll Modal into Document */
          #print-wrapper { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; padding: 0 !important; margin: 0 !important; display: block !important; }
          #print-area { position: static !important; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: none !important; display: block !important; }
          
          /* Ensure layout does not break */
          .print-grid { display: block !important; }
          .print-block { display: block !important; width: 100% !important; page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 24px !important; }
          
          .no-print { display: none !important; }
        }
      `}} />

      <aside className="w-72 bg-[#020617] text-slate-300 flex flex-col z-20 shrink-0 shadow-2xl no-print">
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-lg mr-3 shadow-lg shadow-indigo-900/50"><ShieldAlert className="h-5 w-5 text-white" /></div>
          <h1 className="text-xl font-bold tracking-tight text-white">Fleet<span className="text-indigo-400">Guard</span></h1>
        </div>
        <div className="px-6 py-6 flex-1">
          <p className="text-[11px] font-bold text-slate-500 tracking-widest uppercase mb-4 px-2">Master Client Portal</p>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-800/80 text-white shadow-inner text-sm font-semibold border border-slate-700/50 transition-all"><LayoutDashboard size={18} className="text-indigo-400" /> Executive Dashboard</button>
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
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 bg-slate-800 hover:bg-rose-600 hover:text-white border border-slate-700 hover:border-rose-500 transition-all shadow-sm"><LogOut size={16} /> Secure Sign Out</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative no-print">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Intelligence Dashboard</h2>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ml-2 flex items-center"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>All Data Live</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-inner">
              <CalendarDays size={16} className="text-slate-400 mr-2"/>
              <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="year">This Year</option>
              </select>
            </div>
            <div className="flex items-center w-64 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all shadow-inner">
              <Search size={16} className="text-slate-400" />
              <input type="text" placeholder="Search database..." className="bg-transparent outline-none ml-2 text-sm w-full font-semibold text-slate-700 placeholder:text-slate-400" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="p-0.5 hover:bg-slate-200 rounded-md"><X size={14} className="text-slate-500"/></button>}
            </div>
            <button onClick={exportToExcel} className="flex items-center bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg font-bold transition-all text-sm shadow-sm"><Download size={16} className="mr-2 text-slate-500"/> Export Master</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Incidents</p><h3 className="text-3xl font-black text-slate-900 mt-2">{totalAccidents}</h3></div><div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><Database size={24}/></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-amber-500/20"><div><p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending Action</p><h3 className="text-3xl font-black text-amber-600 mt-2">{pendingCount}</h3></div><div className="h-12 w-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500"><Clock size={24}/></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-blue-500/20"><div><p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Claims Filed</p><h3 className="text-3xl font-black text-blue-600 mt-2">{claimFiledCount}</h3></div><div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500"><FileSignature size={24}/></div></div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-emerald-500/20"><div><p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Cases Closed</p><h3 className="text-3xl font-black text-emerald-600 mt-2">{closedCount}</h3></div><div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500"><CheckCircle2 size={24}/></div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Film className="w-4 h-4 mr-2 text-indigo-500"/> Evidence Compliance</h3></div>
              <div className="flex-1 p-4 relative flex flex-col">
                {totalAccidents > 0 ? (
                  <><div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={evidenceChartData} innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" stroke="none">{evidenceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={EVIDENCE_COLORS[index % EVIDENCE_COLORS.length]} />)}</Pie><RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/></PieChart></ResponsiveContainer></div><div className="mt-2 flex justify-center gap-4 text-xs font-bold text-slate-600"><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></span> Secured</div><div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></span> Missing</div></div></>
                ) : (<div className="flex flex-col items-center justify-center h-full text-slate-400"><PieChartIcon size={40} className="mb-4 opacity-20"/><p className="font-bold text-sm">No data</p></div>)}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[350px] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm flex items-center"><Briefcase className="w-4 h-4 mr-2 text-indigo-500"/> Claims Pipeline</h3></div>
              <div className="flex-1 p-6">
                {totalAccidents > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                      <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/>
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={50}>
                        {statusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No data</div>)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center"><Database size={18} className="text-indigo-500 mr-2"/><h3 className="font-bold text-slate-800">Master Claims Database</h3></div>
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
      </main>

      {/* --- EVIDENCE VIEWER MODAL (NATIVE PRINT ENGINE) --- */}
      {selectedAccident && (
        <div id="print-wrapper" className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200 print:bg-white print:static print:inset-auto">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden print:max-h-none print:overflow-visible print:border-none print:shadow-none print:ring-0">
            
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 no-print shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><LayoutDashboard className="text-indigo-600 h-6 w-6"/> Evidence Profile</h2>
                <p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedAccident.vehicle_number}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2"><Printer className="h-4 w-4"/> Print / Save PDF</button>
                <button onClick={() => setSelectedAccident(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto bg-slate-50/50 print:bg-white grid grid-cols-1 lg:grid-cols-2 gap-8 print-grid print:overflow-visible print:bg-white flex-1">
              
              <div className="lg:col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between page-break-avoid print-block">
                <div><h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1><p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p></div>
                <div className="text-right"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(selectedAccident.status)}`}>{selectedAccident.status || 'Pending'}</span><p className="text-sm font-bold text-slate-800 mt-2">{selectedAccident.company_name}</p></div>
              </div>

              <div className="space-y-8 print-stack-item">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Information</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="font-bold text-slate-800 text-lg">{selectedAccident.driver_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-2"/> {selectedAccident.driver_contact || 'N/A'}</p></div></div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Accident Vehicle Picture</h3>{selectedAccident.vehicle_image_url ? <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[350px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><User className="mr-2 h-5 w-5 text-indigo-500"/> Driver Picture</h3>{selectedAccident.driver_image_url ? <img src={selectedAccident.driver_image_url} alt="Driver" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner print:max-h-[350px] print:object-contain" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div>
              </div>

              <div className="space-y-8 print-stack-item">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Incident Data</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500 uppercase font-bold">Date</p><p className="font-bold text-slate-800">{selectedAccident.accident_date}</p></div><div><p className="text-xs text-slate-500 uppercase font-bold">Time</p><p className="font-bold text-slate-800">{selectedAccident.accident_time}</p></div><div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold flex items-center"><MapPin size={12} className="mr-1"/> Location & GPS</p><p className="font-bold text-slate-800">{selectedAccident.place}</p></div><div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold">Remarks</p><p className="font-medium text-sm text-slate-700">{selectedAccident.remarks || 'No remarks provided.'}</p></div></div></div>
                
                {selectedAccident.video_provided ? (
                  <>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid">
                      <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Front Dashcam Footage</h3>
                      {selectedAccident.front_video_url ? (
                        <div className="space-y-4">
                          <video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner no-print"><source src={selectedAccident.front_video_url} type="video/mp4" /></video>
                          <a href={selectedAccident.front_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Click here to View Front Video</a>
                        </div>
                      ) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Front Video Uploaded</div>)}
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm page-break-avoid">
                      <h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Rear Dashcam Footage</h3>
                      {selectedAccident.rear_video_url ? (
                        <div className="space-y-4">
                          <video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner no-print"><source src={selectedAccident.rear_video_url} type="video/mp4" /></video>
                          <a href={selectedAccident.rear_video_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><LinkIcon size={16} className="mr-2"/> Click here to View Rear Video</a>
                        </div>
                      ) : (<div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Rear Video Uploaded</div>)}
                    </div>
                  </>
                ) : (
                  <div className="bg-white p-8 rounded-2xl border-2 border-rose-200 shadow-sm h-full flex flex-col justify-center items-center text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-50/50 to-white page-break-avoid">
                    <div className="h-20 w-20 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner rotate-3"><AlertCircle size={40} className="text-rose-500"/></div>
                    <h3 className="text-2xl font-black text-slate-900 mb-3">Video Evidence Missing</h3>
                    {selectedAccident.investigation_doc_url ? (
                      <a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" className="no-print bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center transition-all mt-4"><FileSignature className="mr-3" size={24}/> View Official Document</a>
                    ) : (<div className="px-6 py-4 bg-slate-100 rounded-xl text-slate-500 text-sm font-bold border border-slate-200 flex items-center shadow-inner mt-4"><X size={20} className="mr-2 text-slate-400"/> No Document Uploaded</div>)}
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 mt-8 pt-6 border-t border-slate-200 text-center page-break-avoid hidden print:block print-stack-item">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">© {new Date().getFullYear()} All Rights Reserved For Ashish Rajput<br/>Confidential & Proprietary Incident Data</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}