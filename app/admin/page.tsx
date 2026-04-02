'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { createSystemUser, sendIncidentEmail, sendTamperingIncidentEmail } from '@/app/actions'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { 
  LogOut, UploadCloud, FileText, Loader2, LayoutDashboard, Plus, 
  ShieldCheck, Database, Image as ImageIcon, CheckCircle, 
  Clock, MapPin, User, Car, Film, AlertCircle, Phone, FileSignature, 
  Activity, CheckCircle2, PlaySquare, X, Users, Mail, Key, Building2, 
  UserCircle, Edit2, CalendarDays, History, ShieldAlert, BookOpen, Hash, 
  Briefcase, GripVertical, AlertTriangle, TrendingDown, FileSpreadsheet, Download, Printer
} from 'lucide-react'
import { useRouter } from 'next/navigation'


export default function AdminDashboard() {
  const router = useRouter()
  
  const[activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'risk' | 'log' | 'tampering' | 'clients' | 'audit' | 'directory'>('overview')
  
  type Accident = {
    id: string
    vehicle_number: string
    accident_date: string
    accident_time: string
    place?: string
    driver_name: string
    driver_contact?: string
    company_name: string
    client_id_number?: string
    video_provided?: boolean
    status?: string
    lat?: number | null
    lng?: number | null
    remarks?: string
    vehicle_image_url?: string | null
    driver_image_url?: string | null
    front_video_url?: string | null
    rear_video_url?: string | null
    investigation_doc_url?: string | null
    created_at?: string
    updated_by?: string
    created_by?: string
  }
  type TamperingIncident = {
    id: string
    client_name: string
    vehicle_number: string
    driver_name: string
    driver_contact_number?: string
    tampering_details?: string
    address?: string
    technician_name: string
    technician_contact_number?: string
    tampering_repair_charge?: number | null
    tampering_image_url?: string | null
    repair_device_image_url?: string | null
    status: string
    rejection_reason?: string | null
    created_at?: string
    created_by?: string
    updated_by?: string
  }
  type Profile = { id: string; company_name?: string; email?: string; role?: string; created_at?: string }
  type AuditLog = { id: string; action: string; entity: string; details: string; performed_by: string; created_at: string }
  type ClientDirectory = { id: string; client_id_number: string; company_name: string; contact_email?: string; created_at?: string }

  const[allLogs, setAllLogs] = useState<Accident[]>([])
  const [tamperingLogs, setTamperingLogs] = useState<TamperingIncident[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([]) 
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const[clientList, setClientList] = useState<ClientDirectory[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null) 
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const[isAddingClient, setIsAddingClient] = useState(false)
  const [selectedAccident, setSelectedAccident] = useState<Accident | null>(null)
  
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState<Record<string, unknown>[]>([])
  const[isImporting, setIsImporting] = useState(false)
  const [isTamperingSubmitting, setIsTamperingSubmitting] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const[dateFilter, setDateFilter] = useState('all') 

  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geoSuccess, setGeoSuccess] = useState(false)
  const [showManualGPS, setShowManualGPS] = useState(false) 

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
  const [tamperingFormData, setTamperingFormData] = useState({
    client_name: '',
    vehicle_number: '',
    driver_name: '',
    driver_contact_number: '',
    tampering_details: '',
    address: '',
    technician_name: '',
    technician_contact_number: '',
    tampering_repair_charge: '',
  })
  const [tamperingFiles, setTamperingFiles] = useState({
    tamperingImage: null as File | null,
    repairDeviceImage: null as File | null,
  })

  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'client', company_name: '' })
  const[newClientDir, setNewClientDir] = useState({ client_id_number: '', company_name: '', contact_email: '' })
  const [appSettings, setAppSettings] = useState(() => ({
    theme: 'light' as 'light' | 'dark',
    primaryColor: 'indigo' as 'emerald' | 'blue' | 'indigo' | 'orange',
    navStyle: 'blend' as 'blend' | 'discrete' | 'evident',
    layout: 'vertical' as 'vertical' | 'horizontal',
    orientation: 'ltr' as 'ltr' | 'rtl',
    enforceUppercase: true,
    requireTenDigitPhone: true,
    requireEvidence: true,
  }))
  const [showSettings, setShowSettings] = useState(false)
  const [tamperingEditingId, setTamperingEditingId] = useState<string | null>(null)
  const [existingTamperingEvidence, setExistingTamperingEvidence] = useState({
    tampering_image_url: '',
    repair_device_image_url: '',
  })
  const toggleSetting = (key: 'enforceUppercase' | 'requireTenDigitPhone' | 'requireEvidence') => {
    setAppSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toUppercaseText = (value: string) => appSettings.enforceUppercase ? value.toUpperCase() : value
  const normalizeEmail = (value: string) => value.trim().toLowerCase()
  const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').slice(0, 10)
  const isValidPhoneNumber = (value: string) => !appSettings.requireTenDigitPhone || /^\d{10}$/.test(normalizePhoneNumber(value))
  const applyTheme = (theme: 'light' | 'dark') => {
    syncThemeToDom(theme)
    setAppSettings(prev => ({ ...prev, theme }))
  }
  const applyPrimaryColor = (preset: 'emerald' | 'blue' | 'indigo' | 'orange') => {
    if (typeof document === 'undefined') return
    const palette: Record<typeof preset, string> = {
      emerald: '#10b981',
      blue: '#3b82f6',
      indigo: '#6366f1',
      orange: '#f97316',
    } as any
    const accent = palette[preset]
    document.documentElement.style.setProperty('--accent', accent)
    document.documentElement.style.setProperty('--accent-soft', `${accent}1a`)
    document.documentElement.style.setProperty('--client-primary', accent)
  }
  const applyOrientation = (dir: 'ltr' | 'rtl') => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('dir', dir)
  }
  const syncThemeToDom = (theme: 'light' | 'dark') => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.body.classList.toggle('dark', theme === 'dark')
    const surface = theme === 'dark' ? '#0b1220' : '#f8fafc'
    const card = theme === 'dark' ? '#111827' : '#ffffff'
    const text = theme === 'dark' ? '#e2e8f0' : '#0f172a'
    document.documentElement.style.setProperty('--surface', surface)
    document.documentElement.style.setProperty('--card', card)
    document.documentElement.style.setProperty('--text', text)
    window.localStorage.setItem('dashboard-theme', theme)
  }
  const hasIncidentEvidence = () => ({
    vehicle: Boolean(files.vehiclePic || (isEditing && formData.existing_vehicle)),
    driver: Boolean(files.driverPic || (isEditing && formData.existing_driver)),
    front: Boolean(files.frontVideo || (isEditing && formData.existing_front)),
    rear: Boolean(files.rearVideo || (isEditing && formData.existing_rear)),
    document: Boolean(files.investigationDoc || (isEditing && formData.existing_doc)),
  })

  const handlePrint = () => { if (typeof window !== 'undefined') setTimeout(() => window.print(), 50) }

  const accentColor = (primary: 'emerald' | 'blue' | 'indigo' | 'orange') => {
    if (primary === 'emerald') return '#10b981'
    if (primary === 'blue') return '#3b82f6'
    if (primary === 'orange') return '#f97316'
    return '#6366f1'
  }
  const navBackground = (style: 'blend' | 'discrete' | 'evident', accent: string) => {
    if (style === 'discrete') return '#0f172a'
    if (style === 'evident') return accent
    return '#020617'
  }

  useEffect(() => { 
    fetchCurrentUser(); fetchLogs(); fetchTamperingLogs(); fetchProfiles(); fetchAuditLogs(); fetchClientDirectory();
  },[])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = window.localStorage.getItem('dashboard-theme')
      const savedSettings = window.localStorage.getItem('admin-app-settings')
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setAppSettings(prev => ({ ...prev, theme: savedTheme }))
        syncThemeToDom(savedTheme)
      }
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setAppSettings(prev => ({ ...prev, ...parsed }))
          applyPrimaryColor(parsed.primaryColor || 'indigo')
          applyOrientation(parsed.orientation || 'ltr')
        } catch {}
      }
      applyPrimaryColor(appSettings.primaryColor)
      applyOrientation(appSettings.orientation)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('admin-app-settings', JSON.stringify(appSettings))
      syncThemeToDom(appSettings.theme)
      applyPrimaryColor(appSettings.primaryColor)
      applyOrientation(appSettings.orientation)
    }
  }, [appSettings])

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

  const fetchTamperingLogs = async () => {
    const { data } = await supabase.from('tampering_incidents').select('*').order('created_at', { ascending: false })
    if (data) setTamperingLogs(data)
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

  const fetchClientDirectory = async () => {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    if (data) setClientList(data)
  }

  const logAudit = async (action: string, entity: string, record_id: string, details: string) => {
    await supabase.from('audit_logs').insert([{ action, entity, record_id, details, performed_by: currentUser?.email || 'System Admin' }])
    fetchAuditLogs()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr as string, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      setImportData(data);
    };
    reader.readAsBinaryString(file);
  }

  const confirmBulkImport = async () => {
    if (importData.length === 0) return;
    setIsImporting(true);
    try {
      const formattedData = importData.map(row => ({
        company_name: row.Company || row.Client || 'Unknown Client', vehicle_number: row.Vehicle_No || row.Vehicle || 'UNKNOWN',
        driver_name: row.Driver || row.Driver_Name || 'Unknown', accident_date: row.Date || new Date().toISOString().split('T')[0],
        accident_time: row.Time || '12:00', place: row.Location || row.Place || 'Unknown Location',
        status: row.Status || 'Case Closed', remarks: row.Remarks || 'Imported via Bulk Excel Tool', video_provided: false, 
        created_by: currentUser?.email || 'System Bulk Import', updated_by: currentUser?.email || 'System Bulk Import'
      }));
      const { error } = await supabase.from('accidents').insert(formattedData);
      if (error) throw error;
      await logAudit('CREATE', 'Bulk Import', 'Excel File', `Imported ${formattedData.length} records.`);
      alert(`✅ Successfully imported ${formattedData.length} historical records!`);
      setShowImportModal(false); setImportData([]); fetchLogs();
    } catch(err: any) { alert("Bulk Import Failed: " + err.message); } finally { setIsImporting(false); }
  }

  const downloadExcelTemplate = () => {
    const template =[{ Company: "Acme Corp", Vehicle_No: "AB 12 CD 3456", Driver: "John Doe", Date: "2026-03-24", Time: "14:30", Location: "Mumbai Highway", Status: "Case Closed", Remarks: "Historical Record" }];
    const ws = XLSX.utils.json_to_sheet(template); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template"); XLSX.writeFile(wb, "FleetGuard_Import_Template.xlsx");
  }

  const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData('recordId', id) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('recordId')
    if (!id) return
    setAllLogs(prev => prev.map(log => log.id === id ? { ...log, status: newStatus } : log))
    const { error } = await supabase.from('accidents').update({ status: newStatus, updated_by: currentUser?.email }).eq('id', id)
    if (error) { alert("Failed to move card."); fetchLogs(); } 
    else { logAudit('UPDATE', 'Claims Pipeline', `ID: ${id.substring(0,6)}`, `Moved status to [${newStatus}]`) }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingUser(true)
    const normalizedUser = {
      ...newUser,
      email: normalizeEmail(newUser.email),
      company_name: toUppercaseText(newUser.company_name),
    }
    const res = await createSystemUser(normalizedUser)
    if (res.error) { alert("Failed to create user: " + res.error) } else {
      await logAudit('PROVISION', 'User Account', normalizedUser.email, `Created new ${normalizedUser.role} account for ${normalizedUser.company_name}`)
      alert("✅ New Account Generated & Secured!"); setNewUser({ email: '', password: '', role: 'client', company_name: '' }); fetchProfiles() 
    }
    setIsCreatingUser(false)
  }

  const handleAddClientToDirectory = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAddingClient(true)
    const normalizedClient = {
      client_id_number: toUppercaseText(newClientDir.client_id_number),
      company_name: toUppercaseText(newClientDir.company_name),
      contact_email: normalizeEmail(newClientDir.contact_email),
    }
    const { error } = await supabase.from('clients').insert([normalizedClient])
    if (error) { alert("Failed to save client: " + error.message) } else {
      await logAudit('CREATE', 'Client Directory', normalizedClient.client_id_number, `Added ${normalizedClient.company_name} to Master Directory`)
      alert("✅ Client Successfully Added to Directory!"); setNewClientDir({ client_id_number: '', company_name: '', contact_email: '' }); fetchClientDirectory()
    }
    setIsAddingClient(false)
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
        setGeoSuccess(true); setShowManualGPS(false); setTimeout(() => setGeoSuccess(false), 3000);
      } else { alert("Couldn't auto-locate. Enter GPS manually."); setShowManualGPS(true); }
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
    const incidentEvidence = hasIncidentEvidence()
    const normalizedDriverContact = appSettings.requireTenDigitPhone ? normalizePhoneNumber(formData.driver_contact) : formData.driver_contact.trim()
    if (!isValidPhoneNumber(normalizedDriverContact)) {
      alert('Driver contact number must be exactly 10 digits.')
      return
    }
    if (appSettings.requireEvidence) {
      if (!incidentEvidence.vehicle || !incidentEvidence.driver) {
        alert('Vehicle image and driver image are mandatory evidence for every incident.')
        return
      }
      if (formData.video_provided === 'Yes' && (!incidentEvidence.front || !incidentEvidence.rear)) {
        alert('Front and rear dashcam videos are mandatory when video evidence is marked as provided.')
        return
      }
      if (formData.video_provided === 'No' && !incidentEvidence.document) {
        alert('Investigation document is mandatory when video evidence is not available.')
        return
      }
    }

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
        vehicle_number: toUppercaseText(formData.vehicle_number), accident_date: formData.accident_date, accident_time: formData.accident_time,
        place: toUppercaseText(formData.place), driver_name: toUppercaseText(formData.driver_name), driver_contact: normalizedDriverContact, 
        company_name: toUppercaseText(formData.company_name), client_id_number: toUppercaseText(formData.client_id_number), video_provided: formData.video_provided === 'Yes', remarks: toUppercaseText(formData.remarks), 
        status: formData.status, lat: formData.lat, lng: formData.lng,
        vehicle_image_url: vehicle_img, driver_image_url: driver_img, front_video_url: front_vid, rear_video_url: rear_vid, investigation_doc_url: inv_doc,
        updated_by: currentUser?.email || 'System Admin'
      } 

      if (isEditing) {
        const { error } = await supabase.from('accidents').update(payload).eq('id', editingId)
        if (error) throw error; await logAudit('UPDATE', 'Incident Record', formData.vehicle_number, `Updated status to[${formData.status}]`); alert("✅ Record Successfully UPDATED!")
      } else {
        const { error } = await supabase.from('accidents').insert([{ ...payload, created_by: currentUser?.email || 'System Admin' }])
        if (error) throw error; await logAudit('CREATE', 'Incident Record', formData.vehicle_number, `Logged new incident for ${formData.company_name}`)
        if (formData.client_email) await sendIncidentEmail(formData.client_email, formData.vehicle_number, formData.status)
        alert("✅ Database Record Created & Logged")
      }
      cancelEdit(); fetchLogs();
    } catch (error: any) { alert("Error: " + error.message) } 
    finally { setIsSubmitting(false) }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => { if (e.target.files && e.target.files[0]) setFiles({ ...files,[type]: e.target.files[0] }) }
  const handleTamperingFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof tamperingFiles) => {
    if (e.target.files && e.target.files[0]) setTamperingFiles({ ...tamperingFiles, [type]: e.target.files[0] })
  }

  const resetTamperingForm = () => {
    setTamperingFormData({
      client_name: '',
      vehicle_number: '',
      driver_name: '',
      driver_contact_number: '',
      tampering_details: '',
      address: '',
      technician_name: '',
      technician_contact_number: '',
      tampering_repair_charge: '',
    })
    setTamperingFiles({ tamperingImage: null, repairDeviceImage: null })
    setTamperingEditingId(null)
    setExistingTamperingEvidence({ tampering_image_url: '', repair_device_image_url: '' })
  }

  const startTamperingEdit = (incident: any) => {
    setActiveTab('tampering')
    setTamperingEditingId(incident.id)
    setExistingTamperingEvidence({
      tampering_image_url: incident.tampering_image_url || '',
      repair_device_image_url: incident.repair_device_image_url || '',
    })
    setTamperingFormData({
      client_name: incident.client_name || '',
      vehicle_number: incident.vehicle_number || '',
      driver_name: incident.driver_name || '',
      driver_contact_number: incident.driver_contact_number || incident.driver_contact || '',
      tampering_details: incident.tampering_details || '',
      address: incident.address || '',
      technician_name: incident.technician_name || '',
      technician_contact_number: incident.technician_contact_number || incident.technician_contact || '',
      tampering_repair_charge: incident.tampering_repair_charge ? String(incident.tampering_repair_charge) : '',
    })
    setTamperingFiles({ tamperingImage: null, repairDeviceImage: null })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleTamperingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedDriverContact = appSettings.requireTenDigitPhone ? normalizePhoneNumber(tamperingFormData.driver_contact_number) : tamperingFormData.driver_contact_number.trim()
    const normalizedTechnicianContact = appSettings.requireTenDigitPhone ? normalizePhoneNumber(tamperingFormData.technician_contact_number) : tamperingFormData.technician_contact_number.trim()
    if (!isValidPhoneNumber(normalizedDriverContact) || !isValidPhoneNumber(normalizedTechnicianContact)) {
      alert('Driver and technician mobile numbers must be exactly 10 digits.')
      return
    }
    if (appSettings.requireEvidence) {
      if (!tamperingFiles.tamperingImage && !existingTamperingEvidence.tampering_image_url) {
        alert('Tampering image is required before submission.')
        return
      }
      if (!tamperingFiles.repairDeviceImage && !existingTamperingEvidence.repair_device_image_url) {
        alert('Repair device image is required before submission.')
        return
      }
    }

    setIsTamperingSubmitting(true)
    try {
      const [tamperingImageUrl, repairDeviceImageUrl] = await Promise.all([
        tamperingFiles.tamperingImage ? uploadMedia(tamperingFiles.tamperingImage, 'tampering/tampering-images') : Promise.resolve(existingTamperingEvidence.tampering_image_url || null),
        tamperingFiles.repairDeviceImage ? uploadMedia(tamperingFiles.repairDeviceImage, 'tampering/repair-device-images') : Promise.resolve(existingTamperingEvidence.repair_device_image_url || null),
      ])

      const payload = {
        client_name: toUppercaseText(tamperingFormData.client_name),
        vehicle_number: toUppercaseText(tamperingFormData.vehicle_number),
        driver_name: toUppercaseText(tamperingFormData.driver_name),
        driver_contact_number: normalizedDriverContact,
        tampering_details: toUppercaseText(tamperingFormData.tampering_details),
        address: toUppercaseText(tamperingFormData.address),
        technician_name: toUppercaseText(tamperingFormData.technician_name),
        technician_contact_number: normalizedTechnicianContact,
        tampering_repair_charge: tamperingFormData.tampering_repair_charge ? Number(tamperingFormData.tampering_repair_charge) : null,
        tampering_image_url: tamperingImageUrl,
        repair_device_image_url: repairDeviceImageUrl,
        status: 'Pending Approval',
        rejection_reason: null,
        updated_by: currentUser?.email || 'System Admin',
      }

      const selectedClient = clientList.find((client) => toUppercaseText(client.company_name || '') === payload.client_name)

      if (tamperingEditingId) {
        const { error } = await supabase.from('tampering_incidents').update(payload).eq('id', tamperingEditingId)
        if (error) throw error
        await logAudit('UPDATE', 'Tampering Incident', payload.vehicle_number, 'Edited & resubmitted after client rejection')
      } else {
        const { error } = await supabase.from('tampering_incidents').insert([{ ...payload, created_by: currentUser?.email || 'System Admin' }])
        if (error) throw error
        await logAudit('CREATE', 'Tampering Incident', payload.vehicle_number, `Logged tampering incident for ${payload.client_name}`)
      }

      if (selectedClient?.contact_email) {
        await sendTamperingIncidentEmail({
          clientEmail: selectedClient.contact_email,
          clientName: payload.client_name,
          vehicleNumber: payload.vehicle_number,
          technicianName: payload.technician_name,
        })
      }

      alert(tamperingEditingId ? '✅ Tampering record updated and resubmitted.' : '✅ Tampering device incident created and sent for client approval.')
      resetTamperingForm()
      setTamperingEditingId(null)
      setExistingTamperingEvidence({ tampering_image_url: '', repair_device_image_url: '' })
      fetchTamperingLogs()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsTamperingSubmitting(false)
    }
  }

  const filteredLogs = allLogs.filter(log => {
    if (dateFilter === 'all') return true;
    const logDate = new Date(log.accident_date); const now = new Date();
    const diffDays = Math.ceil(Math.abs(now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    if (dateFilter === '7d' && diffDays > 7) return false;
    if (dateFilter === '30d' && diffDays > 30) return false;
    if (dateFilter === 'year' && logDate.getFullYear() !== now.getFullYear()) return false;
    return true;
  });

  const recentTamperingLogs = tamperingLogs

  const driverStats = filteredLogs.reduce((acc: any, log) => {
    const driver = log.driver_name || 'Unknown Driver';
    if (!acc[driver]) acc[driver] = { count: 0, company: log.company_name, contact: log.driver_contact, latest: log.accident_date };
    acc[driver].count++;
    if (new Date(log.accident_date) > new Date(acc[driver].latest)) acc[driver].latest = log.accident_date;
    return acc;
  }, {});
  
  const driverRiskData = Object.keys(driverStats).map(driver => ({ name: driver, ...driverStats[driver] })).sort((a, b) => b.count - a.count);
  const topDriversChart = driverRiskData.slice(0, 10);

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

  const getDisplayStatus = (record: any) => {
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

  const getAuditColor = (action: string) => {
    if (action === 'CREATE') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (action === 'UPDATE') return 'bg-blue-100 text-blue-700 border-blue-200'
    if (action === 'PROVISION') return 'bg-purple-100 text-purple-700 border-purple-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
  }

  const getTamperingStatusColor = (status: string) => {
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'Rejected') return 'bg-rose-100 text-rose-700 border-rose-200'
    return 'bg-amber-100 text-amber-800 border-amber-200'
  }

  const isHorizontalLayout = appSettings.layout === 'horizontal'

  return (
    <div id="admin-app-shell" className={`${isHorizontalLayout ? 'flex flex-col' : 'flex flex-row'} min-h-screen lg:h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative`} dir={appSettings.orientation}>
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --accent: var(--client-primary, #6366f1);
          --accent-soft: rgba(99, 102, 241, 0.08);
          --surface: ${appSettings.theme === 'dark' ? '#0b1220' : '#f8fafc'};
          --card: ${appSettings.theme === 'dark' ? '#111827' : '#ffffff'};
          --text: ${appSettings.theme === 'dark' ? '#e2e8f0' : '#0f172a'};
        }
        body { background: var(--surface); color: var(--text); }
        .btn-accent { background: var(--accent); color: white; border-color: var(--accent); }
        .pill-accent { background: var(--accent-soft); color: var(--text); border-color: var(--accent); }
      `}} />
      
      {/* PERFECT PDF PRINT ENGINE CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: white !important; width: auto !important; height: auto !important; min-height: 100% !important; overflow: visible !important; -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
          #admin-app-shell { height: auto !important; min-height: 100% !important; overflow: visible !important; }
          body > div > aside, body > div > main { display: none !important; }

          #print-wrapper { position: static !important; width: 100% !important; background: white !important; margin: 0 auto !important; padding: 0 !important; display: block !important; }
          #print-area { position: static !important; width: 100% !important; max-width: 200mm !important; margin: 0 auto !important; height: auto !important; overflow: visible !important; box-shadow: none !important; border: none !important; display: block !important; }

          /* Force single column stacked layout for print */
          .print-grid { display: block !important; }
          .print-stack-item { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 24px !important; border: 1px solid #e2e8f0 !important; border-radius: 12px !important; box-shadow: none !important; }

          /* Prevent stretched images */
          img { max-height: 300px !important; object-fit: contain !important; background-color: #f8fafc !important; }

          .no-print { display: none !important; }
        }
        :root { --client-primary: #6366f1; }
      `}} />

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-black text-slate-900">App Settings</p>
                <p className="text-xs text-slate-500">Control admin experience.</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Primary color</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'emerald', label: 'Chateau Green', color: '#10b981' },
                    { key: 'blue', label: 'Neon Blue', color: '#3b82f6' },
                    { key: 'indigo', label: 'Royal Blue', color: '#6366f1' },
                    { key: 'orange', label: 'Tomato Orange', color: '#f97316' },
                  ].map(opt => {
                    const active = appSettings.primaryColor === opt.key
                    return (
                      <button key={opt.key} onClick={() => { setAppSettings(prev => ({ ...prev, primaryColor: opt.key as any })); applyPrimaryColor(opt.key as any) }} className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: opt.color }}></span>
                        <span className="text-xs font-semibold">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Color scheme</p>
                <div className="flex gap-3">
                  {['light','dark'].map(opt => {
                    const active = appSettings.theme === opt
                    return (
                      <button key={opt} onClick={() => applyTheme(opt as 'light'|'dark')} className="px-4 py-2 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
                        {opt === 'light' ? 'Light' : 'Dark'}
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
                    const active = appSettings.navStyle === opt.key
                    return (
                      <button key={opt.key} onClick={() => setAppSettings(prev => ({ ...prev, navStyle: opt.key as any }))} className="px-4 py-2 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
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
                    const active = appSettings.layout === opt.key
                    return (
                      <button key={opt.key} onClick={() => setAppSettings(prev => ({ ...prev, layout: opt.key as any }))} className="flex-1 px-4 py-3 rounded-xl border text-sm font-bold" style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)', color: 'var(--text)' } : {}}>
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
                  ].map(opt => (
                    <button key={opt.key} onClick={() => { setAppSettings(prev => ({ ...prev, orientation: opt.key as any })); applyOrientation(opt.key as 'ltr'|'rtl') }} className={`px-4 py-2 rounded-xl border text-sm font-bold ${appSettings.orientation === opt.key ? 'border-[var(--client-primary,#6366f1)] bg-[var(--client-primary,#6366f1)]/10 text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-3">Data Rules</p>
                {[
                  { key: 'enforceUppercase', title: 'Enforce Uppercase', desc: 'Auto-convert text inputs to uppercase.' },
                  { key: 'requireTenDigitPhone', title: 'Require 10-digit Phones', desc: 'Validate driver/technician numbers strictly.' },
                  { key: 'requireEvidence', title: 'Require Evidence', desc: 'Block submissions without required media/docs.' },
                ].map(rule => (
                  <div key={rule.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm mb-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{rule.title}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1">{rule.desc}</p>
                    </div>
                    <button type="button" onClick={() => toggleSetting(rule.key as 'enforceUppercase'|'requireTenDigitPhone'|'requireEvidence')} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${appSettings[rule.key as keyof typeof appSettings] ? 'bg-[var(--client-primary,#6366f1)]' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition ${appSettings[rule.key as keyof typeof appSettings] ? 'translate-x-6' : 'translate-x-1'}`}></span>
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-semibold text-slate-500">Settings persist in this browser and apply instantly.</p>
            </div>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-indigo-600"/> Bulk Excel Import</h2><button onClick={() => {setShowImportModal(false); setImportData([])}} className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"><X size={20}/></button></div>
            <div className="p-6">
              <div className="mb-6"><p className="text-sm font-semibold text-slate-600 mb-2">1. Download the required Excel format template.</p><button onClick={downloadExcelTemplate} className="flex items-center text-xs font-bold bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors"><Download size={14} className="mr-2"/> Download Template.xlsx</button></div>
              <div className="mb-6"><p className="text-sm font-semibold text-slate-600 mb-2">2. Upload your completed file.</p><input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer border border-slate-200 rounded-xl" /></div>
              {importData.length > 0 && (<div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3"><CheckCircle className="text-emerald-500 shrink-0 mt-0.5"/><div><h4 className="text-sm font-black text-emerald-800">File Parsed Successfully!</h4><p className="text-xs font-medium text-emerald-600 mt-1">Ready to insert <strong>{importData.length} records</strong> into the database.</p></div></div>)}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3"><button onClick={() => {setShowImportModal(false); setImportData([])}} className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors">Cancel</button><button onClick={confirmBulkImport} disabled={isImporting || importData.length === 0} className="px-6 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all">{isImporting ? <><Loader2 size={16} className="animate-spin mr-2"/> Importing...</> : <><UploadCloud size={16} className="mr-2"/> Confirm Bulk Import</>}</button></div>
          </div>
        </div>
      )}

      {isHorizontalLayout ? (
        <aside className="w-full min-h-[90px] flex flex-wrap items-center px-6 py-3 gap-3 bg-slate-900 text-slate-100 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3 mr-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-900/50"><ShieldAlert className="h-5 w-5 text-white" /></div>
            <span className="text-sm font-bold">SysAdmin</span>
          </div>
          <div className="flex-1 overflow-x-auto flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Dashboard Overview' },
              { id: 'pipeline', label: 'Claims Pipeline' },
              { id: 'risk', label: 'Driver Risk Profiles' },
              { id: 'log', label: isEditing ? 'Edit Incident Mode' : 'Log Incident' },
              { id: 'tampering', label: 'Tampering Device Module' },
              { id: 'directory', label: 'Client Directory' },
              { id: 'clients', label: 'Web Portal Access' },
              { id: 'audit', label: 'Security & Audit Logs' },
            ].map(item => {
              const accent = accentColor(appSettings.primaryColor)
              const isActive = activeTab === item.id
              return (
                <button key={item.id} onClick={() => { cancelEdit(); setActiveTab(item.id as any); }} className="px-3 py-1.5 rounded-full text-xs font-bold border transition-colors" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : { borderColor: '#334155', color: '#e2e8f0' }}>
                  {item.label}
                </button>
              )
            })}
          </div>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="ml-4 text-xs font-bold bg-slate-800 px-3 py-2 rounded-lg border border-slate-700 hover:bg-rose-600 hover:text-white">Sign Out</button>
        </aside>
      ) : (() => {
        const accent = accentColor(appSettings.primaryColor)
        const navBg = navBackground(appSettings.navStyle, accent)
        const navBorderClass = appSettings.navStyle === 'evident' ? 'border-r-2' : ''
        return (
          <aside className={`hidden lg:flex w-64 text-slate-300 flex-col z-20 shadow-xl shrink-0 no-print ${navBorderClass}`} style={{ backgroundColor: navBg, borderColor: accent }}>
        <div className="p-6">
          <div className="flex items-center gap-2 text-white mb-1">
            <ShieldCheck className="h-7 w-7 text-indigo-500" />
            <h1 className="text-2xl font-black tracking-tight">Sys<span className="text-indigo-500">Admin</span></h1>
          </div>
          <p className="text-xs text-slate-500 font-bold tracking-widest uppercase mt-2">Control Center</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-6 overflow-y-auto">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard size={18}/> },
            { id: 'pipeline', label: 'Claims Pipeline', icon: <Briefcase size={18}/> },
            { id: 'risk', label: 'Driver Risk Profiles', icon: <AlertTriangle size={18}/> },
            { id: 'log', label: isEditing ? 'Edit Incident Mode' : 'Log Incident', icon: <Plus size={18}/> },
            { id: 'tampering', label: 'Tampering Device Module', icon: <ShieldAlert size={18}/> },
          ].map(item => {
            const isActive = activeTab === item.id
            const accent = accentColor(appSettings.primaryColor)
            return (
              <button key={item.id} onClick={() => {cancelEdit(); setActiveTab(item.id as any);}} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold hover:bg-slate-800 hover:text-white" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : {}}>
                {item.icon} {item.label}
              </button>
            )
          })}
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 px-2">CRM & Directory</p>
            {(() => {
              const accent = accentColor(appSettings.primaryColor)
              const isActive = activeTab === 'directory'
              return (
                <button onClick={() => setActiveTab('directory')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold hover:bg-slate-800 hover:text-white" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : {}}>
                  <BookOpen size={18}/> Client Directory
                </button>
              )
            })()}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-3 px-2">System Security</p>
            {['clients','audit'].map(id => {
              const accent = accentColor(appSettings.primaryColor)
              const isActive = activeTab === id
              const label = id === 'clients' ? 'Web Portal Access' : 'Security & Audit Logs'
              const icon = id === 'clients' ? <Users size={18}/> : <History size={18}/>
              return (
                <button key={id} onClick={() => setActiveTab(id as any)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-semibold hover:bg-slate-800 hover:text-white" style={isActive ? { backgroundColor: accent, color: 'white', borderColor: accent } : {}}>
                  {icon} {label}
                </button>
              )
            })}
          </div>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold text-slate-400 hover:bg-rose-500 hover:text-white transition-all mb-2"><LogOut size={18} /> Secure Sign Out</button>
          <div className="text-center pb-2"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">© {new Date().getFullYear()} All Rights Reserved<br/>For Ashish Rajput</p></div>
        </div>
          </aside>
        )
      })()}

      <main className="flex-1 flex flex-col min-h-screen lg:h-screen overflow-y-auto bg-slate-50/50 no-print">
      <header className="bg-white px-4 py-4 sm:px-6 lg:px-8 border-b border-slate-200 shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
          {activeTab === 'overview' && 'System Overview'}
          {activeTab === 'pipeline' && 'Active Claims Pipeline'}
            {activeTab === 'risk' && 'Driver Intelligence & Risk'}
            {activeTab === 'log' && (isEditing ? 'Data Edit Module' : 'Data Entry Module')}
            {activeTab === 'tampering' && 'Tampering Device Incident Log'}
            {activeTab === 'directory' && 'Master Client Directory'}
            {activeTab === 'clients' && 'Web Portal Access Rules'}
            {activeTab === 'audit' && 'System Audit Trail'}
          </h2></div>
          
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:items-center lg:justify-end">
            {(activeTab === 'overview' || activeTab === 'pipeline' || activeTab === 'risk') && (
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 shadow-inner w-full sm:w-auto">
                <CalendarDays size={16} className="text-slate-400 mr-2"/>
                <select className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                  <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="year">This Year</option>
                </select>
              </div>
            )}
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setShowSettings(true)} className="hidden sm:inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-sm hover:bg-slate-800">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--client-primary, #6366f1)' }}></span>
              App Settings
            </button>
            <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 py-2 px-4 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-900">{currentUser?.company_name || 'System Administrator'}</div>
                <div className="text-xs font-semibold text-indigo-600">{currentUser?.email || 'Authenticated'}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md border border-indigo-200 uppercase">
                  {currentUser?.company_name ? currentUser.company_name.substring(0,2) : 'SA'}
                </div>
              </div>
            </div>
          </div>
          </div>
        </header>

        <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Admin Panel</p>
              <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.company_name || 'System Administrator'}</p>
            </div>
            <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button onClick={() => {cancelEdit(); setActiveTab('overview')}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Overview</button>
            <button onClick={() => {cancelEdit(); setActiveTab('pipeline')}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'pipeline' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Pipeline</button>
            <button onClick={() => {cancelEdit(); setActiveTab('risk')}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'risk' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Risk</button>
            <button onClick={() => {cancelEdit(); setActiveTab('log')}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'log' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{isEditing ? 'Edit' : 'Log'}</button>
            <button onClick={() => {cancelEdit(); setActiveTab('tampering')}} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'tampering' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Tampering</button>
            <button onClick={() => setActiveTab('directory')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'directory' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Directory</button>
            <button onClick={() => setActiveTab('clients')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'clients' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Users</button>
            <button onClick={() => setActiveTab('audit')} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${activeTab === 'audit' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Audit</button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto flex-1">
          
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
                <div className="px-4 sm:px-6 py-5 border-b border-slate-200 bg-white flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                  <h3 className="text-lg font-bold text-slate-800">Master Database Records</h3>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button onClick={() => setShowImportModal(true)} className="bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-2.5 rounded-lg shadow-sm transition-all font-semibold flex items-center gap-2 text-sm"><FileSpreadsheet size={18}/> Bulk Excel Import</button>
                    <button onClick={() => {cancelEdit(); setActiveTab('log')}} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-semibold flex items-center gap-2 text-sm"><Plus size={18}/> New Record</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap min-w-[980px]">
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
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(getDisplayStatus(log))}`}>{getDisplayStatus(log)}</span></td>
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

          {/* CLAIMS PIPELINE TAB */}
          {activeTab === 'pipeline' && (
            <div className="animate-in fade-in duration-300 max-w-[1600px] mx-auto h-full flex flex-col">
              <div className="mb-6"><h3 className="text-xl sm:text-2xl font-black text-slate-800">Claims Pipeline</h3><p className="text-sm text-slate-500 mt-1 font-medium">Drag and drop incident cards to update their status instantly.</p></div>
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
                        {filteredLogs.filter(log => (log.status || 'Pending Investigation') === statusColumn).length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {filteredLogs.filter(log => (log.status || 'Pending Investigation') === statusColumn).map(log => (
                        <div key={log.id} draggable onDragStart={(e) => handleDragStart(e, log.id)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-500/50 transition-all group">
                          <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.accident_date).toLocaleDateString()}</span><GripVertical size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors"/></div>
                          <h5 className="font-bold text-slate-900 text-sm mb-1">{log.vehicle_number}</h5>
                          <p className="text-xs font-semibold text-slate-500 mb-3">{log.company_name}</p>
                          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-400 flex items-center"><User size={12} className="mr-1"/> {log.driver_name.split(' ')[0]}</span>
                            <button onClick={() => setSelectedAccident(log)} className="text-xs font-bold text-indigo-600 hover:underline">View</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RISK PROFILING TAB */}
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
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-white border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Operator Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Incidents</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Level</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Latest Incident</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {driverRiskData.map((driver: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-900 flex items-center"><UserCircle size={16} className="mr-2 text-slate-400"/> {driver.name}</td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600">{driver.contact || 'N/A'}</td>
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

          {/* CLIENT DIRECTORY TAB */}
          {activeTab === 'directory' && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-[1400px] mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Briefcase size={18} className="text-indigo-600"/> Add Client to Master Directory</h3></div>
                <form onSubmit={handleAddClientToDirectory} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Unique Client ID <span className="text-rose-500">*</span></label><div className="relative"><Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.client_id_number} onChange={e => setNewClientDir({...newClientDir, client_id_number: toUppercaseText(e.target.value)})} placeholder="e.g. ACME-001" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company / Entity Name <span className="text-rose-500">*</span></label><div className="relative"><Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.company_name} onChange={e => setNewClientDir({...newClientDir, company_name: toUppercaseText(e.target.value)})} placeholder="ACME CORPORATION" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Alert Email (Optional)</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input type="email" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newClientDir.contact_email} onChange={e => setNewClientDir({...newClientDir, contact_email: normalizeEmail(e.target.value)})} placeholder="alerts@acme.com" /></div></div>
                  </div>
                  <div className="mt-6 flex justify-end"><button type="submit" disabled={isAddingClient} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center transition-all">{isAddingClient ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/> Saving...</> : <><Plus className="h-5 w-5 mr-2"/> Add to Directory</>}</button></div>
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
                          <td className="px-6 py-4 font-mono font-bold text-indigo-600 bg-indigo-50/50 w-32 rounded-r-md my-2">{c.client_id_number}</td>
                          <td className="px-6 py-4 font-black text-slate-800">{c.company_name}</td>
                          <td className="px-6 py-4 text-slate-600 font-medium flex items-center mt-1.5"><Mail size={14} className="mr-2 text-slate-400"/> {c.contact_email || 'No email provided'}</td>
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
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18} className="text-indigo-600"/> Generate Secure Portal Login</h3></div>
                <form onSubmit={handleCreateUser} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company Link</label><div className="relative"><Building2 className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.company_name} onChange={e => setNewUser({...newUser, company_name: toUppercaseText(e.target.value)})} placeholder="ACME CORP" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Login Email</label><div className="relative"><Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="email" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.email} onChange={e => setNewUser({...newUser, email: normalizeEmail(e.target.value)})} placeholder="admin@acme.com" /></div></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Secure Password</label><div className="relative"><Key className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3 pl-10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="SecurePass123!" /></div></div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Account Role</label>
                      <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                        <option value="client">Client Dashboard Access</option><option value="driver">Mobile Field Agent</option><option value="admin">System Administrator</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end"><button type="submit" disabled={isCreatingUser} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center transition-all">{isCreatingUser ? <><Loader2 className="animate-spin h-5 w-5 mr-2"/> Provisioning...</> : <><ShieldCheck className="h-5 w-5 mr-2"/> Generate Login</>}</button></div>
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
                  <div><h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><History className="text-indigo-600"/> Immutable Audit Trail</h3><p className="text-xs text-slate-500 font-medium mt-1">A secure, chronological record of all system activity.</p></div>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full border border-slate-200 flex items-center"><ShieldAlert size={14} className="mr-1.5 text-slate-400"/> System Compliant</span>
                </div>
                <div className="p-6 overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Type</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Entity</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Details</th><th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performed By</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4"><div className="text-sm font-bold text-slate-900">{new Date(log.created_at).toLocaleDateString()}</div><div className="text-xs font-semibold text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleTimeString()}</div></td>
                          <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black tracking-widest rounded-md border ${log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>{log.action}</span></td>
                          <td className="px-6 py-4"><div className="text-xs font-bold text-slate-800">{log.entity}</div></td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-normal min-w-[250px]">{log.details}</td>
                          <td className="px-6 py-4"><div className="text-xs font-semibold text-slate-700 flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-200 w-fit"><UserCircle size={14} className="mr-1.5 text-slate-400"/>{log.performed_by}</div></td>
                        </tr>
                      ))}
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
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company / Client Name <span className="text-rose-500">*</span></label>
                        {isEditing ? (
                          <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.company_name} onChange={e => setFormData({...formData, company_name: toUppercaseText(e.target.value)})} placeholder="e.g. ACME CORPORATION" />
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
                          <option value="Pending Investigation">Pending Investigation</option><option value="Investigation Document Submitted">Investigation Document Submitted</option><option value="Claim Filed">Claim Filed</option><option value="Case Closed">Case Closed</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Vehicle Registration <span className="text-rose-500">*</span></label>
                        <div className="relative"><Car className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.vehicle_number} onChange={e => setFormData({...formData, vehicle_number: toUppercaseText(e.target.value)})} placeholder="AB 12 CD 3456" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Name <span className="text-rose-500">*</span></label>
                        <div className="relative"><User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: toUppercaseText(e.target.value)})} placeholder="JOHN DOE" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Contact No. <span className="text-rose-500">*</span></label>
                        <div className="relative"><Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" inputMode="numeric" maxLength={appSettings.requireTenDigitPhone ? 10 : 16} className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.driver_contact} onChange={e => setFormData({...formData, driver_contact: appSettings.requireTenDigitPhone ? normalizePhoneNumber(e.target.value) : e.target.value})} placeholder="9876543210" /></div>
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
                          <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={formData.place} onChange={e => setFormData({...formData, place: toUppercaseText(e.target.value)})} placeholder="e.g. MUMBAI, INDIA" />
                        </div>
                        <button type="button" onClick={handleGeocode} disabled={isGeocoding} className="bg-slate-900 hover:bg-slate-800 text-white px-5 rounded-xl text-sm font-bold transition-all flex items-center justify-center min-w-[150px] shadow-md active:scale-95 disabled:opacity-70">
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
                      <textarea rows={4} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none" value={formData.remarks} onChange={e => setFormData({...formData, remarks: toUppercaseText(e.target.value)})} placeholder="PROVIDE ANY ADDITIONAL CONTEXT ABOUT THE INCIDENT..." />
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

          {activeTab === 'tampering' && (
            <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto space-y-8">
              <form onSubmit={handleTamperingSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><FileText className="text-indigo-600"/> Tampering Device Information</h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Add tampering details using the same structured data-entry style as the incident information module.</p>
                      </div>
                      {tamperingEditingId && (
                        <span className="px-3 py-1 text-[11px] font-black rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">Edit Mode</span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Company / Client Name <span className="text-rose-500">*</span></label>
                        <select required className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none cursor-pointer" value={tamperingFormData.client_name} onChange={(e) => setTamperingFormData({ ...tamperingFormData, client_name: e.target.value })}>
                          <option value="">Select from Directory...</option>
                          {clientList.map((client) => (
                            <option key={client.id} value={client.company_name}>[{client.client_id_number}] {client.company_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Vehicle Registration <span className="text-rose-500">*</span></label>
                        <div className="relative"><Car className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.vehicle_number} onChange={(e) => setTamperingFormData({ ...tamperingFormData, vehicle_number: toUppercaseText(e.target.value) })} placeholder="AB 12 CD 3456" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Name <span className="text-rose-500">*</span></label>
                        <div className="relative"><User className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.driver_name} onChange={(e) => setTamperingFormData({ ...tamperingFormData, driver_name: toUppercaseText(e.target.value) })} placeholder="DRIVER FULL NAME" /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Driver Contact No. <span className="text-rose-500">*</span></label>
                        <div className="relative"><Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" inputMode="numeric" maxLength={appSettings.requireTenDigitPhone ? 10 : 16} className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.driver_contact_number} onChange={(e) => setTamperingFormData({ ...tamperingFormData, driver_contact_number: appSettings.requireTenDigitPhone ? normalizePhoneNumber(e.target.value) : e.target.value })} placeholder="9876543210" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Technician Name <span className="text-rose-500">*</span></label>
                        <div className="relative"><UserCircle className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.technician_name} onChange={(e) => setTamperingFormData({ ...tamperingFormData, technician_name: toUppercaseText(e.target.value) })} placeholder="TECHNICIAN NAME" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Technician Contact No. <span className="text-rose-500">*</span></label>
                        <div className="relative"><Phone className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" inputMode="numeric" maxLength={appSettings.requireTenDigitPhone ? 10 : 16} className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.technician_contact_number} onChange={(e) => setTamperingFormData({ ...tamperingFormData, technician_contact_number: appSettings.requireTenDigitPhone ? normalizePhoneNumber(e.target.value) : e.target.value })} placeholder="9000000000" /></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 mb-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Exact Address <span className="text-rose-500">*</span></label>
                        <div className="relative"><MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.address} onChange={(e) => setTamperingFormData({ ...tamperingFormData, address: toUppercaseText(e.target.value) })} placeholder="SITE OR SERVICE ADDRESS" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Charge of Tampering Repair</label>
                        <div className="relative"><Hash className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" /><input type="number" min="0" step="0.01" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all" value={tamperingFormData.tampering_repair_charge} onChange={(e) => setTamperingFormData({ ...tamperingFormData, tampering_repair_charge: e.target.value })} placeholder="Optional repair amount" /></div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tampering Details <span className="text-rose-500">*</span></label>
                      <textarea required rows={5} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-medium uppercase focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all resize-none" value={tamperingFormData.tampering_details} onChange={(e) => setTamperingFormData({ ...tamperingFormData, tampering_details: toUppercaseText(e.target.value) })} placeholder="PROVIDE FULL TAMPERING DETAILS, REPAIR OBSERVATIONS, AND NOTES FOR CLIENT REVIEW..." />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-1">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 h-full flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-6"><UploadCloud className="text-indigo-600"/> Evidence Uploads</h3>

                    <div className="space-y-5 flex-1">
                      {[
                        { key: 'tamperingImage', label: 'Tampering Image', icon: <ImageIcon size={24}/> },
                        { key: 'repairDeviceImage', label: 'Repair Device Image', icon: <ImageIcon size={24}/> },
                      ].map((field) => (
                        <div key={field.key} className="relative">
                          <input type="file" id={field.key} accept="image/*" className="hidden" onChange={(e) => handleTamperingFileChange(e, field.key as keyof typeof tamperingFiles)} />
                          {(() => {
                            const existing = field.key === 'tamperingImage' ? existingTamperingEvidence.tampering_image_url : existingTamperingEvidence.repair_device_image_url
                            const hasNew = Boolean(tamperingFiles[field.key as keyof typeof tamperingFiles])
                            return (
                              <label htmlFor={field.key} className={`cursor-pointer flex items-center p-4 border-2 border-dashed rounded-xl transition-all group ${hasNew || existing ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'}`}>
                                <div className={`p-3 rounded-lg mr-4 transition-colors ${hasNew || existing ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 group-hover:text-indigo-500 shadow-sm'}`}>{field.icon}</div>
                                <div className="flex-1 overflow-hidden">
                                  <p className={`text-sm font-bold truncate ${hasNew || existing ? 'text-emerald-700' : 'text-slate-700'}`}>{field.label}</p>
                                  <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5 uppercase tracking-wide">
                                    {tamperingFiles[field.key as keyof typeof tamperingFiles]?.name || (existing ? 'Existing file will be kept' : 'Click to browse files')}
                                  </p>
                                </div>
                                {(hasNew || existing) && <CheckCircle className="text-emerald-500 ml-2 shrink-0" size={20}/>}
                              </label>
                            )
                          })()}
                        </div>
                      ))}

                      {appSettings.requireEvidence && (
                        <div className="pt-4 border-t border-slate-100">
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-amber-700">Required Evidence</p>
                            <p className="mt-1 text-sm font-medium text-amber-800">Both tampering and repair device images must be uploaded before the record can be submitted.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-8 mt-4 border-t border-slate-100 space-y-3">
                      <button type="submit" disabled={isTamperingSubmitting} className="w-full bg-indigo-600 text-white font-extrabold text-base py-4 px-6 rounded-xl hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-200 transition-all">
                        {isTamperingSubmitting ? <><Loader2 className="animate-spin mr-3 h-6 w-6" /> Processing Data...</> : tamperingEditingId ? 'Update & Resubmit' : 'Submit Complete Record'}
                      </button>
                      <button type="button" onClick={resetTamperingForm} className="w-full rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50">
                        Clear Form
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                  <h3 className="text-lg font-black text-slate-800">Latest Client Responses</h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium">When the client approves or rejects from the client panel, the updated status will appear here automatically.</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {recentTamperingLogs.length > 0 ? recentTamperingLogs.map((incident) => (
                    <div key={incident.id} className="px-6 py-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-black text-slate-900">{incident.client_name}</p>
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{incident.vehicle_number}</span>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ${getTamperingStatusColor(incident.status)}`}>{incident.status}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-600">{incident.driver_name} • {incident.technician_name}</p>
                          <p className="text-xs font-medium text-slate-500">Created on {new Date(incident.created_at).toLocaleString()}</p>
                          {incident.rejection_reason ? <p className="max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{incident.rejection_reason}</p> : null}
                          {incident.status === 'Rejected' && (
                            <button onClick={() => startTamperingEdit(incident)} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors">
                              <Edit2 size={14}/> Edit & Re-upload
                            </button>
                          )}
                        </div>
                        <div className="flex gap-3">
                          {incident.tampering_image_url ? <img src={incident.tampering_image_url} alt="Tampering evidence" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" /> : null}
                          {incident.repair_device_image_url ? <img src={incident.repair_device_image_url} alt="Repair device evidence" className="h-16 w-16 rounded-xl border border-slate-200 object-cover" /> : null}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                          <ShieldAlert className="text-slate-300" />
                        </div>
                        <p className="text-sm font-black text-slate-800">No client responses yet.</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">Create the first tampering incident from the form above and it will appear here with `Pending Approval` until the client responds.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- EVIDENCE VIEWER MODAL --- */}
      {selectedAccident && (
        <div id="print-wrapper" className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
          <div id="print-area" className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl ring-1 ring-white/20 overflow-hidden">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10 shrink-0">
              <div><h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><LayoutDashboard className="text-indigo-600 h-6 w-6"/> Evidence Profile</h2><p className="text-sm text-slate-500 mt-1 font-semibold">Registry: <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm ml-1">{selectedAccident.vehicle_number}</span></p></div>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition flex items-center gap-2"><Printer className="h-4 w-4"/> Print Report</button>
                <button onClick={() => setSelectedAccident(null)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-xl transition-all shadow-sm"><X size={20} strokeWidth={2.5}/></button>
              </div>
            </div>
            <div className="p-8 overflow-y-auto bg-slate-50/50 grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
              <div className="lg:col-span-2 pb-4 border-b border-slate-200 mb-4 flex justify-between">
                <div><h1 className="text-2xl font-black text-slate-900">Official Incident Report</h1><p className="text-slate-500 font-medium mt-1">Generated on {new Date().toLocaleDateString()}</p></div>
                <div className="text-right"><span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(getDisplayStatus(selectedAccident))}`}>{getDisplayStatus(selectedAccident)}</span><p className="text-sm font-bold text-slate-800 mt-2">{selectedAccident.company_name}</p></div>
              </div>
              <div className="space-y-8"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Driver Information</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="font-bold text-slate-800 text-lg">{selectedAccident.driver_name}</p><p className="text-slate-500 font-medium text-sm flex items-center mt-1"><Phone size={14} className="mr-2"/> {selectedAccident.driver_contact || 'N/A'}</p></div></div><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><ImageIcon className="mr-2 h-5 w-5 text-indigo-500"/> Accident Vehicle Picture</h3>{selectedAccident.vehicle_image_url ? <img src={selectedAccident.vehicle_image_url} alt="Vehicle" className="w-full aspect-video object-cover rounded-xl border border-slate-200 shadow-inner" crossOrigin="anonymous" /> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Image Provided</div>}</div></div>
              <div className="space-y-8"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Incident Data</h4><div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4"><div><p className="text-xs text-slate-500 uppercase font-bold">Date</p><p className="font-bold text-slate-800">{selectedAccident.accident_date}</p></div><div><p className="text-xs text-slate-500 uppercase font-bold">Time</p><p className="font-bold text-slate-800">{selectedAccident.accident_time}</p></div><div className="col-span-2"><p className="text-xs text-slate-500 uppercase font-bold flex items-center"><MapPin size={12} className="mr-1"/> Location & GPS</p><p className="font-bold text-slate-800">{selectedAccident.place}</p></div></div></div>{selectedAccident.video_provided ? (<div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-xs font-black text-slate-800 mb-4 flex items-center uppercase tracking-widest"><Film className="mr-2 h-5 w-5 text-indigo-500"/> Dashcam Footage</h3>{selectedAccident.front_video_url ? <video controls className="w-full aspect-video bg-slate-900 rounded-xl shadow-inner"><source src={selectedAccident.front_video_url} type="video/mp4" /></video> : <div className="w-full aspect-video bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 font-bold text-sm">No Front Video</div>}</div>) : (<div className="bg-white p-8 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col justify-center items-center text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-50/50 to-white"><AlertCircle size={40} className="text-rose-500 mb-4"/><h3 className="text-2xl font-black text-slate-900 mb-3">Video Evidence Missing</h3>{selectedAccident.investigation_doc_url && <a href={selectedAccident.investigation_doc_url} target="_blank" rel="noopener noreferrer" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-xl flex items-center mt-4"><FileSignature className="mr-3" size={24}/> View Official Document</a>}</div>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
