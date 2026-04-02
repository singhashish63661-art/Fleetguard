'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Camera, MapPin, Loader2, Send, CheckCircle, Navigation, AlertTriangle, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DriverMobilePortal() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isFetchingGPS, setIsFetchingGPS] = useState(false)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    vehicle_number: '', accident_date: new Date().toISOString().split('T')[0], 
    accident_time: new Date().toTimeString().slice(0, 5),
    place: '', remarks: '', lat: null as number | null, lng: null as number | null,
    driver_name: '', company_name: '' // In a real app, this would auto-fill from their profile
  })

  const [files, setFiles] = useState({
    vehiclePic: null as File | null,
  })

  // --- HTML5 GPS GEOLOCATION ---
  const fetchLocation = () => {
    setIsFetchingGPS(true)
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            place: `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
          })
          setIsFetchingGPS(false)
        },
        (_error) => {
          alert("Please enable Location Services on your phone.")
          setIsFetchingGPS(false)
        },
        { enableHighAccuracy: true }
      )
    } else {
      alert("Geolocation is not supported by your browser.")
      setIsFetchingGPS(false)
    }
  }

  const uploadMedia = async (file: File | null) => {
    if (!file) return null
    const fileExt = file.name.split('.').pop()
    const fileName = `mobile-uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const { error } = await supabase.storage.from('accident-media').upload(fileName, file)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('accident-media').getPublicUrl(fileName)
    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const vehicle_image_url = await uploadMedia(files.vehiclePic)

      const { error } = await supabase.from('accidents').insert([{
        vehicle_number: formData.vehicle_number,
        accident_date: formData.accident_date,
        accident_time: formData.accident_time,
        place: formData.place,
        lat: formData.lat,
        lng: formData.lng,
        remarks: formData.remarks,
        driver_name: formData.driver_name || 'Mobile Field Agent',
        company_name: formData.company_name || 'Pending Assignment',
        video_provided: false,
        status: 'Pending Investigation',
        vehicle_image_url
      }])

      if (error) throw error
      setSuccess(true)
    } catch (error: any) { 
      alert("Error: " + error.message) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFiles({ vehiclePic: e.target.files[0] })
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-24 w-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={48} className="text-emerald-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Report Sent</h1>
        <p className="text-slate-400 mb-10">Your incident report and GPS coordinates have been securely transmitted to the admin team.</p>
        <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-xl w-full">Submit Another Report</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans sm:bg-slate-200">
      {/* Restrict width to simulate a mobile phone shape on desktop */}
      <div className="max-w-md mx-auto bg-slate-50 min-h-screen shadow-2xl relative flex flex-col">
        
        {/* Mobile Header */}
        <header className="bg-[#020617] pt-12 pb-6 px-6 rounded-b-3xl shadow-lg sticky top-0 z-10 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-rose-500 p-2 rounded-xl shadow-lg shadow-rose-500/30"><AlertTriangle className="h-5 w-5 text-white"/></div>
              <h1 className="text-xl font-black text-white">Emergency<span className="text-rose-400">Log</span></h1>
            </div>
            <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="text-slate-400 hover:text-white transition"><LogOut size={20}/></button>
          </div>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">Ensure you are in a safe location before submitting this report.</p>
        </header>

        {/* Mobile Form Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-8 pb-32">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Action Card: Camera */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">1. Photographic Evidence</h3>
              <div className="relative">
                {/* capture="environment" forces mobile devices to open the rear camera instantly! */}
                <input required type="file" id="camera" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <label htmlFor="camera" className={`cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all ${files.vehiclePic ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
                  {files.vehiclePic ? (
                    <><CheckCircle size={32} className="text-emerald-500 mb-2"/><p className="font-bold text-emerald-700">Photo Captured</p></>
                  ) : (
                    <><Camera size={32} className="text-indigo-500 mb-2"/><p className="font-bold text-slate-700">Tap to Open Camera</p><p className="text-xs text-slate-500 mt-1">Take a photo of the vehicle</p></>
                  )}
                </label>
              </div>
            </div>

            {/* Action Card: GPS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">2. Exact Location</h3>
              <button type="button" onClick={fetchLocation} disabled={isFetchingGPS} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 mb-4 transition-all ${formData.lat ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                {isFetchingGPS ? <><Loader2 className="animate-spin h-5 w-5"/> Locating Satellite...</> : formData.lat ? <><MapPin className="h-5 w-5"/> Location Secured</> : <><Navigation className="h-5 w-5"/> Auto-Detect My Location</>}
              </button>
              
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 pl-11 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} placeholder="Or type nearest landmark..." />
              </div>
            </div>

            {/* Action Card: Incident Details */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">3. Basic Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Vehicle Number</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase" value={formData.vehicle_number} onChange={e => setFormData({...formData, vehicle_number: e.target.value})} placeholder="e.g. AB 12 CD 3456" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Your Name (Driver)</label>
                  <input required type="text" className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: e.target.value})} placeholder="Full Name" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Brief Remarks</label>
                  <textarea rows={2} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none resize-none" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="What happened?" />
                </div>
              </div>
            </div>

            {/* Mobile Sticky Footer Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 sm:max-w-md sm:mx-auto">
              <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white font-black text-lg py-4 px-6 rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center disabled:bg-indigo-400 active:scale-95 transition-all">
                {isSubmitting ? <><Loader2 className="animate-spin mr-2 h-6 w-6" /> Uploading securely...</> : <><Send className="mr-2 h-6 w-6"/> Submit Alert to Admin</>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
