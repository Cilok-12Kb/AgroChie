'use client';
import { MapPin, Layers3, Crosshair, Sprout, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import type { Farm } from './api';
import { useTranslation } from '@/i18n';
import { countryLabel } from './forms/countries';

/** Map illustration by default. Real Esri tiles are opt-in to avoid silently sending location to third parties. */
function tilesAt(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latitude = Math.max(-85.051, Math.min(85.051, lat)) * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * n;
  return Array.from({ length: 5 * 7 }, (_, i) => {
    const dx = (i % 7) - 3, dy = Math.floor(i / 7) - 2;
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    return { id: `${tx}:${ty}`, x: tx, y: ty,
      left: (tx - x) * 256, top: (ty - y) * 256 };
  }).filter(t => t.y >= 0 && t.y < n);
}

export function FieldMap({ farm, className = '' }: { farm: Farm | null; className?: string }) {
  const { lang } = useTranslation();
  // [REVISI] provinsi teks bebas; nama negara (Intl, sesuai bahasa aktif) ikut bila bukan "ID"
  const lokasi = [farm?.province, farm?.country && farm.country !== 'ID' ? countryLabel(farm.country, lang) : null].filter(Boolean).join(', ');
  const [satellite, setSatellite] = useState(false);
  const [zoom, setZoom] = useState(14);
  const valid = Number.isFinite(Number(farm?.latitude)) && Number.isFinite(Number(farm?.longitude)) && farm?.latitude != null && farm?.longitude != null;
  const useTiles = valid && satellite;
  const tiles = useTiles ? tilesAt(Number(farm?.latitude), Number(farm?.longitude), zoom) : [];
  return <div className={`farm-map ${className}`} aria-label={useTiles ? 'Citra satelit Esri pada titik lahan, bukan batas lahan' : 'Ilustrasi lahan, bukan citra satelit atau batas lahan sebenarnya'}>
    {useTiles && <div className="absolute inset-0 z-0 overflow-hidden bg-[#577c58]" aria-label="Citra satelit tersedia dari Esri">
      {tiles.map(t => <img key={t.id} alt="" draggable={false} loading="lazy" decoding="async" width="256" height="256"
        className="absolute max-w-none select-none" style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
        src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${t.y}/${((t.x%(2**zoom))+(2**zoom))%(2**zoom)}`}/>) }
    </div>}
    {!useTiles && <svg className="farm-map-art" viewBox="0 0 1100 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="mapbg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6f906b"/><stop offset=".5" stopColor="#527954"/><stop offset="1" stopColor="#8c9b6b"/></linearGradient>
        <pattern id="cropLines" width="21" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 9H21" stroke="#dae6bd" strokeWidth="1.6" opacity=".22"/></pattern>
        <pattern id="plotDots" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="7" cy="7" r="1.8" fill="#eff9cd" opacity=".74"/></pattern>
        <filter id="maps" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="11" floodOpacity=".22"/></filter>
      </defs>
      <rect width="1100" height="660" fill="url(#mapbg)"/>
      <path d="M-30 160 120 20 390 -50 455 185 310 320 70 285Z" fill="#a5a86d" stroke="#d1cda0" strokeWidth="8"/>
      <path d="M-60 320 190 330 300 515 170 730-50 660Z" fill="#70875b" stroke="#d0c7a0" strokeWidth="9"/>
      <path d="M410 -80 705 -10 662 260 432 244Z" fill="#a1a66a" stroke="#c9c69a" strokeWidth="9"/>
      <path d="M715 -30 1140 40 1040 257 650 287Z" fill="#3a7146" stroke="#afab81" strokeWidth="9"/>
      <path d="M385 270 676 310 732 640 473 710 267 466Z" fill="#668c51" stroke="#d5ccaa" strokeWidth="9"/>
      <path d="M738 316 1056 280 1190 662 705 704Z" fill="#a9aa65" stroke="#ded3a7" strokeWidth="8"/>
      <path d="M-70 345Q 168 285 285 275T 760 240 1170 190" fill="none" stroke="#c8bea0" strokeWidth="24" opacity=".65"/>
      <path d="M-70 345Q 168 285 285 275T 760 240 1170 190" fill="none" stroke="#ece4d0" strokeWidth="8"/>
      <path d="M280 -80Q 340 120 360 320T 450 740" fill="none" stroke="#ded7ba" strokeWidth="16" opacity=".85"/>
      <path d="M280 -80Q 340 120 360 320T 450 740" fill="none" stroke="#a89e84" strokeWidth="3"/>
      <rect width="1100" height="660" fill="url(#cropLines)" opacity=".9"/>
      <path d="M540 130 825 65 1050 254 945 465 648 427 515 280Z" fill="#8fc67c" fillOpacity=".69" stroke="white" strokeWidth="7" strokeLinejoin="round" filter="url(#maps)"/>
      <path d="M540 130 825 65 1050 254 945 465 648 427 515 280Z" fill="url(#plotDots)"/>
      <path d="M86 367 286 330 365 484 185 586-25 490Z" fill="#ebae71" fillOpacity=".33" stroke="#f1c88a" strokeWidth="3" strokeDasharray="11 10"/>
      <circle cx="784" cy="263" r="47" stroke="#fff" strokeOpacity=".42" fill="none" strokeWidth="2"/>
      <circle cx="784" cy="263" r="10" fill="white"/>
      <circle cx="784" cy="263" r="22" stroke="white" strokeOpacity=".82" fill="none" strokeWidth="3"/>
    </svg>}
    <div className="absolute top-5 left-5 flex flex-wrap items-center gap-2 max-w-[85%]">
      <span className="farm-map-label"><Layers3 size={16}/> {useTiles ? 'Citra satelit · titik lahan' : 'Ilustrasi area lahan'}</span>
      <button type="button" className="farm-map-label hover:bg-emerald-50" onClick={() => setSatellite(v=>!v)} disabled={!valid} title={!valid?'Isi koordinat lahan pada Profil':'Ganti jenis tampilan'}>{useTiles?'Lihat ilustrasi':'Lihat satelit'}</button>
    </div>
    {useTiles && <div className="absolute top-20 right-5 flex flex-col gap-2"><button type="button" onClick={()=>setZoom(z=>Math.min(17,z+1))} className="farm-map-icon" aria-label="Perbesar peta"><Plus size={17}/></button><button type="button" onClick={()=>setZoom(z=>Math.max(11,z-1))} className="farm-map-icon" aria-label="Perkecil peta"><Minus size={17}/></button></div>}
    <div className="absolute left-[55%] top-[52%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 backdrop-blur-md p-3 shadow-xl border border-white/80 min-w-[154px]">
      <span className="flex items-center gap-2 text-emerald-700 text-xs font-black"><Sprout size={14}/> {useTiles?'Titik lahan':'Area contoh'}</span>
      <p data-no-translate className="font-extrabold text-slate-800 text-sm mt-1 truncate">{farm?.name ?? 'Lahan belum diatur'}</p>
      <p className="text-xs text-slate-500">{farm ? `${farm.areaHa} hektare` : 'Isi profil untuk memulai'}</p>
    </div>
    <div className="absolute bottom-5 left-5 right-5 flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md px-4 py-3 max-w-sm border border-white/80">
        <p className="flex items-center gap-2 text-slate-800 text-sm font-black"><MapPin size={15} className="text-emerald-700"/> {lokasi ? <span data-no-translate>{lokasi}</span> : 'Lokasi belum ditentukan'}</p>
        <p className="text-[11px] text-slate-500 mt-1">{useTiles?'Titik GPS, bukan poligon batas lahan · Esri, Maxar, Earthstar Geographics':'Visual konseptual; bukan batas lahan terverifikasi.'}</p>
      </div>
      <div className="bg-white/95 rounded-full p-3 shadow-md self-end text-emerald-700"><Crosshair size={18}/></div>
    </div>
  </div>;
}
