'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createSystemUser, sendIncidentEmail } from '@/app/actions'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { 
  LogOut, UploadCloud, FileText, Loader2, LayoutDashboard, Plus, 
  ShieldCheck, Database, Image as ImageIcon, CheckCircle, 
  Clock, MapPin, User, Car, Film, AlertCircle, Phone, FileSignature, 
  Activity, CheckCircle2, PlaySquare, X, Users, Mail, Key, Building2, 
  UserCircle, Edit2, CalendarDays, History, ShieldAlert, BookOpen, Hash, Briefcase
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'log' | 'clients' | 'audit' | 'directory'>('overview')
  
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([]) 
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [clientList, setClientList] = useState<any[]>([]) // NEW: Master Client Directory
  const[currentUser, setCurrentUser] = useState<any>(null) 
  
  const[isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isAddingClient, setIsAddingClient] = useState(false)
  const[selectedAccident, setSelectedAccident] = useState<any | null>(null)
  
  const[isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('all') 

  const[isGeocoding, setIsGeocoding] = useState(false)
  const[geoSuccess, setGeoSuccess] = useState(false)
  const [showManualGPS, setShowManualGPS] = useState(false) 
  
  // Added client_id_number to formData
  const [formData, setFormData] = useState({
    vehicle_number: '', accident_date: '', accident_time: '',
    place: '', driver_name: '', driver_contact: '', company_name: '', client_email: '', client_id_number: '',
    video_provided: 'No', remarks: '', status: 'Pending Investigation',
    lat: null as number | null, lng: null as number | null,
    existing_vehicle: null as string | null, existing_driver: null as string | null,
    existing_front: null as string | null, existing_rear: null as string | null, existing_doc: null as string | null,
  })

  const[files, setFiles] = useState({
    vehiclePic: null as File | null, driverPic: null as File | null,
    frontVideo: null as File | null, rearVideo: null as File | null, investigationDoc: null as File | null,
  })

  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'client', company_name: '' })
  
  // NEW: State for adding to Client Directory
  const [newClientDir, setNewClientDir] = useState({ client_id_number: '', company_name: '', contact_email: '' })

  useEffect(() => { 
    fetchCurrentUser(); fetchLogs(); fetchProfiles(); fetchAuditLogs(); fetchClientDirectory();
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

  const fetchLogs = async () => {
    const { data } = await supabase.from('accidents').select('*').order('created_at', { ascending: false })
    if (data) setAllLogs(data)
  }

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) throw error; if (data) setProfiles(data)
    } catch (err) {
      const { data } = await supabase.from('profiles').select('*'); if (data) setProfiles(data)
    }
  }

  const fetchAuditLogs = async () => {
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
    if (data) setAuditLogs(data)
  }

  // --- NEW: FETCH CLIENT DIRECTORY ---
  const fetchClientDirectory = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (data) setClientList(data)
  }

  const logAudit = async (action: string, entity: string, record_id: string, details: string) => {
    await supabase.from('audit_logs').insert([{
      action, entity, record_id, details, performed_by: currentUser?.email || 'System User'
    }])
    fetchAuditLogs()
  }

  // --- NEW: ADD CLIENT TO DIRECTORY ---
  const handleAddClientToDirectory = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingClient(true)
    const { error } = await supabase.from('clients').insert([newClientDir])
    if (error) {
      alert("Failed to save client: " + error.message)
    } else {
      await logAudit('CREATE', 'Client Directory', newClientDir.client_id_number, `Added ${newClientDir.company_name} to Master Directory`)
      alert("✅ Client Successfully Added to Directory!")
      setNewClientDir({ client_id_number: '', company_name: '', contact_email: '' })
      fetchClientDirectory()
    }
    setIsAddingClient(false)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingUser(true)
    const res = await createSystemUser(newUser)
    if (res.error) { alert("Failed to create user: " + res.error) } 
    else {
      await logAudit('PROVISION', 'User Account', newUser.email, `Created new ${newUser.role} account for ${newUser.company_name}`)
      alert("✅ New Account Generated & Secured!")
      setNewUser({ email: '', password: '', role: 'client', company_name: '' })
      fetchProfiles() 
    }
    setIsCreatingUser(false)
  }

  const handleEditRecord = (log: any) => {
    setIsEditing(true); setEditingId(log.id)
    setFormData({
      vehicle_number: log.vehicle_number, accident_date: log.accident_date, accident_time: log.accident_time,
      place: log.place, driver_name: log.driver_name, driver_contact: log.driver_contact || '',
      company_name: log.company_name, client_email: '', client_id_number: log.client_id_number || '', video_provided: log.video_provided ? 'Yes' : 'No',
      remarks: log.remarks || '', status: log.status || 'Pending Investigation', lat: log.lat, lng: log.lng,
      existing_vehicle: log.vehicle_image_url, existing_driver: log.driver_image_url,
      existing_front: log.front_video_url, existing_rear: log.rear_video_url, existing_doc: log.investigation_doc_url
    })
    setFiles({ vehiclePic: null, driverPic: null, frontVideo: null, rearVideo: null, investigationDoc: null })
    setActiveTab('log')
  }

  const cancelEdit = () => {
    setIsEditing(false); setEditingId(null);
    setFormData({ vehicle_number: '', accident_date: '', accident_time: '', place: '', driver_name: '', driver_contact: '', company_name: '', client_email: '', client_id_number: '', video_provided: 'No', remarks: '', status: 'Pending Investigation', lat: null, lng: null, existing_vehicle: null, existing_driver: null, existing_front: null, existing_rear: null, existing_doc: null })
    setActiveTab('overview')
  }

  const handleGeocode = async () => {
    if (!formData.place) return alert("Please type a location first.");
    setIsGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.place)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setFormData({ ...formData, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setGeoSuccess(true); setShowManualGPS(false);
        setTimeout(() => setGeoSuccess(false), 3000);
      } else {
        alert("The satellite couldn't find this exact area. Please enter the GPS coordinates manually.");
        setShowManualGPS(true);
      }
    } catch(e) { setShowManualGPS(true); } finally { setIsGeocoding(false); }
  }

  const uploadMedia = async (file: File | null, folder: string) => {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const { error } = await supabase.storage.from('accident-media').upload(fileName, file)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('accident-media').getPublicUrl(fileName)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const[vehicle_img, driver_img, front_vid, rear_vid, inv_doc] = await Promise.all([
        files.vehiclePic ? uploadMedia(files.vehiclePic, 'vehicles') : Promise.resolve(formData.existing_vehicle),
        files.driverPic ? uploadMedia(files.driverPic, 'drivers') : Promise.resolve(formData.existing_driver),
        formData.video_provided === 'Yes' ? (files.frontVideo ? uploadMedia(files.frontVideo, 'videos/front') : Promise.resolve(formData.existing_front)) : Promise.resolve(null),
        formData.video_provided === 'Yes' ? (files.rearVideo ? uploadMedia(files.rearVideo, 'videos/rear') : Promise.resolve(formData.existing_rear)) : Promise.resolve(null),
        formData.video_provided === 'No' ? (files.investigationDoc ? uploadMedia(files.investigationDoc, 'documents') : Promise.resolve(formData.existing_doc)) : Promise.resolve(null)
      ]);

      const payload = {
        vehicle_number: formData.vehicle_number, accident_date: formData.accident_date, accident_time: formData.accident_time,
        place: formData.place, driver_name: formData.driver_name, driver_contact: formData.driver_contact, 
        company_name: formData.company_name, client_id_number: formData.client_id_number, video_provided: formData.video_provided === 'Yes', remarks: formData.remarks, 
        status: formData.status, lat: formData.lat, lng: formData.lng,
        vehicle_image_url: vehicle_img, driver_image_url: driver_img, front_video_url: front_vid, rear_video_url: rear_vid, investigation_doc_url: inv_doc,
        updated_by: currentUser?.email || 'System User'
      }

      if (isEditing) {
        const { error } = await supabase.from('accidents').update(payload).eq('id', editingId)
        if (error) throw error
        await logAudit('UPDATE', 'Incident Record', formData.vehicle_number, `Updated status to [${formData.status}]`)
        alert("✅ Database Record Successfully UPDATED!")
      } else {
        const { error } = await supabase.from('accidents').insert([{ ...payload, created_by: currentUser?.email || 'System User' }])
        if (error) throw error
        await logAudit('CREATE', 'Incident Record', formData.vehicle_number, `Logged new incident for ${formData.company_name}`)
        if (formData.client_email) await sendIncidentEmail(formData.client_email, formData.vehicle_number, formData.status)
        alert("✅ Database Record Created & Logged by: " + (currentUser?.email || 'System'))
      }
      
      cancelEdit(); fetchLogs();
    } catch (error: any) { alert("Error: " + error.message) } 
    finally { setIsSubmitting(false) }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    if (e.target.files && e.target.files[0]) setFiles({ ...files,[type]: e.target.files[0] })
  }

  const filteredLogs = allLogs.filter(log => {
    if (dateFilter === 'all') return true;
    const logDate = new Date(log.accident_date); const now = new Date();
    const diffTime = Math.abs(now.getTime() - logDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (dateFilter === '7d' && diffDays > 7) return false;
    if (dateFilter === '30d' && diffDays > 30) return false;
    if (dateFilter === 'year' && logDate.getFullYear() !== now.getFullYear()) return false;
    return true;
  });

  const totalAccidents = filteredLogs.length
  const videosProvided = filteredLogs.filter(d => d.video_provided).length
  const videosNotProvided = totalAccidents - videosProvided
  const companyStats = filteredLogs.reduce((acc: any, log) => {
    const company = log.company_name || 'Unknown Client';
    if (!acc[company]) acc[company] = 0; acc[company]++; return acc;
  }, {});
  const clientChartData = Object.keys(companyStats).map(company => ({ name: company, Accidents: companyStats[company] })).sort((a, b) => b.Accidents - a.Accidents);
  const uniqueClientsCount = Object.keys(companyStats).length;
  const averageAccidents = uniqueClientsCount > 0 ? (totalAccidents / uniqueClientsCount).toFixed(1) : '0';
  const CHART_COLORS =['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  const getStatusColor = (status: string) => {
    if (status === 'Pending Investigation') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'Claim Filed') return 'bg-blue-100 text-blue-800 border-blue-200'
    if (status === 'Case Closed') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    return 'bg-slate-100 text-slate-800 border-slate-200'
  }

  const getAuditColor = (action: string) => {
    if (action === 'CREATE') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (action === 'UPDATE') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (action === 'PROVISION') return 'bg-purple-100 text-purple-700 border-purple-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative">
      
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col z-20 shadow-xl shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 text-white mb-1">
            <ShieldCheck className="h-7 w-7 text-indigo-500" />
            <h1 className="text-2xl font-black tracking-tight">Sys<span className="text-indigo-500">Admin</span></h1>
          </div>
          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-2">Control Center</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-6">
          <button onClick={() => {cancelEdit(); setActiveTab('overview');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={18} /> Dashboard Overview</button>
          <button onClick={() => {cancelEdit(); setActiveTab('log');}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold ${activeTab === 'log' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Plus size={18} /> {isEditing ? 'Edit Incident Mode' : 'Log New Incident'}</button>
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 px-2">CRM & Directory</p>
            <button onClick={() => setActiveTab('directory')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold ${activeTab === 'directory' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><BookOpen size={18} /> Client Directory</button>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 px-2">System Security</p>
            <button onClick={() => setActiveTab('clients')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold ${activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Users size={18} /> Web Portal Access</button>
            <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><History size={18} /> Security & Audit Logs</button>
          </div>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-slate-400 hover:bg-rose-500 hover:text-white transition-all"><LogOut size={18} /> Secure Sign Out</button>
          <div className="mt-6 text-center pb-2"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">© {new Date().getFullYear()} All Rights Reserved<br/>For Ashish Rajput</p></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50/50">
        
        <header className="bg-white px-8 h-20 border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-sm">
          <div><h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {activeTab === 'overview' && 'System Overview'}
            {activeTab === 'log' && (isEditing ? 'Data Edit Module' : 'Data Entry Module')}
            {activeTab === 'directory' && 'Master Client Directory'}
            {activeTab === 'clients' && 'Web Portal Access Rules'}
            {activeTab === 'audit' && 'System Audit Trail'}
          </h2></div>
          
          <div className="flex items-center gap-4">
            {activeTab === 'overview' && (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-inner">
                <CalendarDays size={16} className="text-slate-400 mr-2"/>
                <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="year">This Year</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 py-2 px-4 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer ml-2">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-900">{currentUser?.company_name || 'System Administrator'}</div>
                <div className="text-xs font-semibold text-indigo-600">{currentUser?.email || 'Authenticated'}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md border border-indigo-200 uppercase">
                {currentUser?.company_name ? currentUser.company_name.substring(0,2) : 'SA'}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 w-full max-w-[1600px] mx-auto flex-1">
          
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtered Records</p><h3 className="text-3xl font-black text-slate-900 mt-2">{totalAccidents}</h3></div><div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600"><Database size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-indigo-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Per Client</p><h3 className="text-3xl font-black text-indigo-600 mt-2">{averageAccidents}</h3></div><div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Activity size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-emerald-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Video Uploaded</p><h3 className="text-3xl font-black text-emerald-600 mt-2">{videosProvided}</h3></div><div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><Film size={24}/></div></div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between ring-1 ring-rose-500/10"><div><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Missing Video</p><h3 className="text-3xl font-black text-rose-600 mt-2">{videosNotProvided}</h3></div><div className="h-12 w-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600"><AlertCircle size={24}/></div></div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 flex flex-col h-[400px] overflow-hidden"><div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 text-sm">Incident Distribution by Client</h3></div><div className="flex-1 p-4">{clientChartData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={clientChartData} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="Accidents" stroke="none">{clientChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/></PieChart></ResponsiveContainer>) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No client data available</div>)}</div></div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 col-span-1 lg:col-span-2 flex flex-col h-[400px] overflow-hidden"><div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-800 text-sm">Client Volume Comparison</h3><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">System Avg: {averageAccidents}</span></div><div className="flex-1 p-6">{clientChartData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={clientChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} /><RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}/><Bar dataKey="Accidents" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} /><ReferenceLine y={Number(averageAccidents)} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'top', value: 'Avg', fill: '#f43f5e', fontSize: 12, fontWeight: 'bold' }} /></BarChart></ResponsiveContainer>) : (<div className="flex items-center justify-center h-full text-slate-400 font-medium text-sm">No client data available</div>)}</div></div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 bg-white flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800">Master Database Records</h3><button onClick={() => {cancelEdit(); setActiveTab('log')}} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-semibold flex items-center gap-2 text-sm"><Plus size={18}/> New Record</button></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vehicle & Driver</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Workflow Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Logged By</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900">{log.company_name} <br/><span className="text-[10px] text-slate-400 uppercase tracking-widest">{log.client_id_number}</span></td>
                          <td className="px-6 py-4"><div className="text-sm font-bold text-slate-800">{log.vehicle_number}</div><div className="text-xs text-slate-500 font-medium mt-0.5">{log.driver_name}</div></td>
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(log.status)}`}>{log.status || 'Pending Investigation'}</span></td>
                          <td className="px-6 py-4">
                            <div className="text-xs font-semibold text-slate-700 flex items-center"><UserCircle size={14} className="mr-1.5 text-slate-400"/>{log.updated_by || log.created_by || 'System Generated'}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-1">{new Date(log.created_at).toLocaleDateString()}</div>
                          </td>
                          <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button onClick={() => handleEditRecord(log)} className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200"><Edit2 size={14} /> Edit</button>
                            <button onClick={() => setSelectedAccident(log)} className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm hover:shadow-md"><PlaySquare size={14} /> View</button>
                          </td>
                        </tr>
                      ))}
                      {filteredLogs.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">No records found for this date range.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --- NEW: CLIENT DIRECTORY TAB (CRM) --- */}
          {activeTab === 'directory' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Briefcase size={18} className="text-indigo-600"/> Add Client to Master Directory</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Save clients here so they instantly appear in the Log Incident dropdown menu.</p>
                </div>
                <form onSubmit={handleAddClientToDirectory} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Unique Client ID <span className="text-rose-500">*</span></label>
                      <div className="relative"><Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.client_id_number} onChange={e => setNewClientDir({...newClientDir, client_id_number: e.target.value})} placeholder="e.g. ACME-001" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company / Entity Name <span className="text-rose-500">*</span></label>
                      <div className="relative"><Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.company_name} onChange={e => setNewClientDir({...newClientDir, company_name: e.target.value})} placeholder="Acme Corporation" /></div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Alert Email (Optional)</label>
                      <div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input type="email" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.contact_email} onChange={e => setNewClientDir({...newClientDir, contact_email: e.target.value})} placeholder="alerts@acme.com" /></div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isAddingClient} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center transition-all">
                      {isAddingClient ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/> Saving...</> : <><Plus className="h-5 w-5 mr-2"/> Add to Directory</>}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><BookOpen size={18} className="text-indigo-600"/> Master Client Directory</h3><span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">{clientList.length} Saved Clients</span></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-white border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client ID</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alert Email</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientList.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-indigo-600 bg-indigo-50/50">{c.client_id_number}</td>
                          <td className="px-6 py-4 font-black text-slate-800">{c.company_name}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium">{c.contact_email || 'No email provided'}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {clientList.length === 0 && (<tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">Directory is empty. Add a client above.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PORTAL ACCESS (AUTH) TAB */}
          {activeTab === 'clients' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18} className="text-indigo-600"/> Generate Secure Portal Login</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Create a web portal login for a user. This securely ties an email to a password.</p>
                </div>
                <form onSubmit={handleCreateUser} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company Link</label><div className="relative"><Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.company_name} onChange={e => setNewUser({...newUser, company_name: e.target.value})} placeholder="Acme Corp" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Login Email</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="email" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="admin@acme.com" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Secure Password</label><div className="relative"><Key className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="SecurePass123!" /></div></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Account Role</label>
                      <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                        <option value="client">Client Dashboard Access</option><option value="driver">Mobile Field Agent</option><option value="admin">System Administrator</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button type="submit" disabled={isCreatingUser} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center transition-all">
                      {isCreatingUser ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/> Provisioning...</> : <><ShieldCheck className="h-5 w-5 mr-2"/> Generate Login</>}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-indigo-600"/> Active Gateway Logins</h3><span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">{profiles.length} Active Profiles</span></div>
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity / Company</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Email</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Permission Level</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profiles.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800">{p.company_name || 'System Admin'}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{p.email || 'Hidden'}</td>
                        <td className="px-6 py-4"><span className={`inline-flex items-center px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${p.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-200' : p.role === 'client' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{p.role}</span></td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">{new Date(p.created_at || Date.now()).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT LOG TAB */}
          {activeTab === 'audit' && (
            <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><History className="text-indigo-600"/> Immutable Audit Trail</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">A secure, chronological record of all system activity.</p>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full border border-slate-200 flex items-center"><ShieldAlert size={14} className="mr-1.5 text-slate-400"/> System Compliant</span>
                </div>
                <div className="p-6 overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Type</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Entity</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Details</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performed By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-slate-900">{new Date(log.created_at).toLocaleDateString()}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleTimeString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black tracking-widest rounded-md border ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4"><div className="text-xs font-bold text-slate-800">{log.entity}</div><div className="text-xs font-mono text-slate-500 mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded inline-block border border-slate-200">{log.record_id}</div></td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-normal min-w-[250px]">{log.details}</td>
                          <td className="px-6 py-4"><div className="text-xs font-semibold text-slate-700 flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-200 w-fit"><UserCircle size={14} className="mr-1.5 text-slate-400"/>{log.performed_by}</div></td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (<tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">No audit logs recorded yet.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LOG ACCIDENT TAB (FORM) */}
          {activeTab === 'log' && (
            <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><FileText className="text-indigo-600"/> Incident Information {isEditing && <span className="bg-amber-100 text-amber-800 text-[10px] uppercase px-2 py-0.5 rounded border border-amber-200 ml-2 shadow-sm">Edit Mode</span>}</h3>
                      {isEditing && <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">Cancel Edit</button>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* --- NEW: PULL FROM MASTER DIRECTORY --- */}
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company / Client Name <span className="text-rose-500">*</span></label>
                        {isEditing ? (
                          <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} placeholder="e.g. Acme Corporation" />
                        ) : (
                          <select required className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none cursor-pointer" 
                            value={formData.company_name} 
                            onChange={e => {
                              const selectedCompany = e.target.value;
                              const c = clientList.find(x => x.company_name === selectedCompany);
                              setFormData({...formData, company_name: selectedCompany, client_id_number: c?.client_id_number || '', client_email: c?.contact_email || ''});
                            }}>
                            <option value="">Select from Directory...</option>
                            {clientList.map(c => <option key={c.id} value={c.company_name}>[{c.client_id_number}] {c.company_name}</option>)}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Is Video Provided? <span className="text-rose-500">*</span></label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-700 cursor-pointer" value={formData.video_provided} onChange={e => setFormData({...formData, video_provided: e.target.value})}>
                          <option value="No">No Video</option><option value="Yes">Yes, Video Attached</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Current Status <span className="text-rose-500">*</span></label>
                        <select className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all text-slate-700 cursor-pointer" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                          <option value="Pending Investigation">Pending Investigation</option><option value="Claim Filed">Claim Filed</option><option value="Case Closed">Case Closed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Vehicle Registration <span className="text-rose-500">*</span></label>
                        <div className="relative"><Car className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.vehicle_number} onChange={e => setFormData({...formData, vehicle_number: e.target.value})} placeholder="AB 12 CD 3456" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Name <span className="text-rose-500">*</span></label>
                        <div className="relative"><User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: e.target.value})} placeholder="John Doe" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Contact No. <span className="text-rose-500">*</span></label>
                        <div className="relative"><Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.driver_contact} onChange={e => setFormData({...formData, driver_contact: e.target.value})} placeholder="+91 9876543210" /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Incident Date <span className="text-rose-500">*</span></label>
                        <input required type="date" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.accident_date} onChange={e => setFormData({...formData, accident_date: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Incident Time <span className="text-rose-500">*</span></label>
                        <div className="relative"><Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="time" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.accident_time} onChange={e => setFormData({...formData, accident_time: e.target.value})} /></div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Exact Location <span className="text-rose-500">*</span></label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                          <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} placeholder="e.g. Mumbai, India" />
                        </div>
                        <button type="button" onClick={handleGeocode} disabled={isGeocoding} className="bg-slate-900 hover:bg-slate-800 text-white px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center min-w-[150px] shadow-md shadow-slate-900/20 active:scale-95 disabled:opacity-70">
                          {isGeocoding ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : geoSuccess ? <CheckCircle2 className="h-4 w-4 text-emerald-400 mr-2"/> : <MapPin className="h-4 w-4 mr-2"/>}
                          {geoSuccess ? 'GPS Locked!' : 'Get GPS Pin'}
                        </button>
                      </div>
                      {formData.lat && <p className="text-xs text-emerald-600 font-bold mt-2 ml-1 flex items-center"><CheckCircle2 className="h-3 w-3 mr-1"/> Coordinates saved: {formData.lat.toFixed(4)}, {formData.lng?.toFixed(4)}</p>}
                      {showManualGPS && (
                        <div className="grid grid-cols-2 gap-4 mt-3 p-4 bg-slate-100 rounded-xl border border-slate-200 animate-in fade-in duration-300">
                          <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Latitude</label><input type="number" step="any" className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.lat || ''} onChange={e => setFormData({...formData, lat: parseFloat(e.target.value)})} placeholder="e.g. 28.6139"/></div>
                          <div><label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Longitude</label><input type="number" step="any" className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.lng || ''} onChange={e => setFormData({...formData, lng: parseFloat(e.target.value)})} placeholder="e.g. 77.2090"/></div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Remarks / Additional Notes</label>
                      <textarea rows={4} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Provide any additional context about the incident..." />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-1 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 h-full flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-6"><UploadCloud className="text-indigo-600"/> Evidence Uploads</h3>

                    <div className="space-y-5 flex-1">
                      {[
                        { id: 'vehiclePic', label: 'Vehicle Image', icon: <ImageIcon size={24}/>, accept: 'image/*', existingKey: 'existing_vehicle' },
                        { id: 'driverPic', label: 'Driver Image', icon: <User size={24}/>, accept: 'image/*', existingKey: 'existing_driver' },
                      ].map((field) => (
                        <div key={field.id} className="relative"><input type="file" id={field.id} accept={field.accept} className="hidden" onChange={(e) => handleFileChange(e, field.id as keyof typeof files)} /><label htmlFor={field.id} className={`cursor-pointer flex items-center p-4 border-2 border-dashed rounded-xl transition-all group ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'}`}><div className={`p-3 rounded-lg mr-4 transition-colors ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 shadow-sm'}`}>{field.icon}</div><div className="flex-1 overflow-hidden"><p className={`text-sm font-bold truncate ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'text-emerald-700' : 'text-slate-700'}`}>{field.label}</p><p className="text-[10px] font-bold text-slate-500 truncate mt-0.5 uppercase tracking-wide">{files[field.id as keyof typeof files] ? files[field.id as keyof typeof files]?.name : (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'Existing file attached' : 'Click to browse files'}</p></div>{(files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData])) && <CheckCircle className="text-emerald-500 ml-2 shrink-0" size={20}/>}</label></div>
                      ))}

                      {formData.video_provided === 'Yes' && (
                        <div className="pt-4 space-y-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dashcam Footage</h4>
                          {[
                            { id: 'frontVideo', label: 'Front Dashcam', icon: <Film size={24}/>, accept: 'video/*', existingKey: 'existing_front' },
                            { id: 'rearVideo', label: 'Rear Dashcam', icon: <Film size={24}/>, accept: 'video/*', existingKey: 'existing_rear' },
                          ].map((field) => (
                            <div key={field.id} className="relative"><input type="file" id={field.id} accept={field.accept} className="hidden" onChange={(e) => handleFileChange(e, field.id as keyof typeof files)} /><label htmlFor={field.id} className={`cursor-pointer flex items-center p-4 border-2 border-dashed rounded-xl transition-all group ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'}`}><div className={`p-3 rounded-lg mr-4 transition-colors ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 shadow-sm'}`}>{field.icon}</div><div className="flex-1 overflow-hidden"><p className={`text-sm font-bold truncate ${files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'text-indigo-700' : 'text-slate-700'}`}>{field.label}</p><p className="text-[10px] font-bold text-slate-500 truncate mt-0.5 uppercase tracking-wide">{files[field.id as keyof typeof files] ? files[field.id as keyof typeof files]?.name : (isEditing && formData[field.existingKey as keyof typeof formData]) ? 'Existing file attached' : 'Click to browse files'}</p></div>{(files[field.id as keyof typeof files] || (isEditing && formData[field.existingKey as keyof typeof formData])) && <CheckCircle className="text-indigo-500 ml-2 shrink-0" size={20}/>}</label></div>
                          ))}
                        </div>
                      )}

                      {formData.video_provided === 'No' && (
                        <div className="pt-4 space-y-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-4">
                          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">Required: Investigation Document</h4>
                          <div className="relative">
                            <input type="file" id="investigationDoc" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => handleFileChange(e, 'investigationDoc')} />
                            <label htmlFor="investigationDoc" className={`cursor-pointer flex items-center p-4 border-2 border-dashed rounded-xl transition-all group ${files.investigationDoc || (isEditing && formData.existing_doc) ? 'border-rose-400 bg-rose-50' : 'border-rose-300 bg-rose-50/50 hover:bg-rose-50 hover:border-rose-400'}`}>
                              <div className={`p-3 rounded-lg mr-4 transition-colors ${files.investigationDoc || (isEditing && formData.existing_doc) ? 'bg-rose-100 text-rose-600' : 'bg-white text-rose-400 shadow-sm'}`}><FileSignature size={24}/></div>
                              <div className="flex-1 overflow-hidden">
                                <p className={`text-sm font-bold truncate ${files.investigationDoc || (isEditing && formData.existing_doc) ? 'text-rose-700' : 'text-rose-700'}`}>Investigation Doc</p>
                                <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5 uppercase tracking-wide">{files.investigationDoc ? files.investigationDoc.name : (isEditing && formData.existing_doc) ? 'Existing doc attached' : 'Why is video missing? Upload doc.'}</p>
                              </div>
                              {(files.investigationDoc || (isEditing && formData.existing_doc)) && <CheckCircle className="text-rose-500 ml-2 shrink-0" size={20}/>}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-8 mt-4 border-t border-slate-100">
                      <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-extrabold text-base py-4 px-6 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200 transition-all">
                        {isSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> Processing Data...</> : (isEditing ? "Update Database Record" : "Submit Complete Record")}
                      </button>
                    </div>

                  </div>
                </div>
              </form>
            </div>
          )}

          {/* VIEW PROFILE MODAL */}
          {selectedAccident && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 shrink-0">
                  <div><h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><LayoutDashboard className="text-indigo-600 h-6 w-6"/> Evidence Profile</h2><p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedAccident.vehicle_number}</span></p></div>
                  <button onClick={() => setSelectedAccident(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
                </div>
                <div className="p-8 overflow-y-auto bg-slate-50/50 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
                  <div className="lg:col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between">
                    <div><h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1><p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p></div>
                    <div className="text-right"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(selectedAccident.status)}`}>{selectedAccident.status || 'Pending'}</span><p className="text-sm font-bold text-slate-800 mt-2">{selectedAccident.company_name}</p></div>
                  </div>
                  <div className="space-y-8"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Information</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="font-bold text-slate-800 text-lg">{selectedAccident.driver_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-2"/> {selectedAccident.driver_contact || 'N/A'}</p></div></div><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Accident Vehicle Picture</h3>{selectedAccident.vehicle_image_url ? <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div></div>
                  <div className="space-y-8"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Incident Data</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500 uppercase font-bold">Date</p><p className="font-bold text-slate-800">{selectedAccident.accident_date}</p></div><div><p className="text-xs text-slate-500 uppercase font-bold">Time</p><p className="font-bold text-slate-800">{selectedAccident.accident_time}</p></div><div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold flex items-center"><MapPin size={12} className="mr-1"/> Location</p><p className="font-bold text-slate-800">{selectedAccident.place}</p></div></div></div>{selectedAccident.video_provided ? (<div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Dashcam Footage</h3>{selectedAccident.front_video_url ? <video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner"><source src={selectedAccident.front_video_url} type="video/mp4" /></video> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Front Video</div>}</div>) : (<div className="bg-white p-8 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-50/50 to-white"><AlertCircle size={40} className="text-rose-500 mb-4"/><h3 className="text-2xl font-black text-slate-900 mb-3">Video Evidence Missing</h3>{selectedAccident.investigation_doc_url && <a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center mt-4"><FileSignature className="mr-3" size={24}/> View Official Document</a>}</div>)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}