'use client';
import {useState,type FormEvent} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Save,CheckCircle2} from 'lucide-react';
import {api,dateOnly} from '../api';
import type {Workspace} from '../hooks';
import {Button,Busy,Card,ErrorLine,Field,Heading,inputClass,Message,Tag} from '../ui';
const SOILS=['Lempung','Lempung berpasir','Liat','Pasir','Tanah vulkanik (andosol)'];
const WATERS=['Embung atau sungai','Irigasi teknis','Sumur atau pompa','Tadah hujan'];
// [REVISI] PROVINCES lokal dihapus: provinsi kini teks bebas dengan saran dari countries.ts
import {useTranslation} from '@/i18n';
import {DEFAULT_COUNTRY,provinceSuggestions,sortedCountries} from './countries';
const LEVELS=['RENDAH','SEDANG','TINGGI'];
// [REVISI] dibungkus agar state negara di-remount saat lahan berganti
export function ProfileForm({ w }: { w: Workspace }) { return <ProfileFormInner key={w.farm?.id ?? 'new'} w={w}/>; }
function ProfileFormInner({ w }: { w: Workspace }) {
  const farm = w.farm;
  const {t,lang}=useTranslation();
  // [REVISI] negara (kode ISO) bawaan dari data lahan atau "ID"; label mengikuti bahasa aktif
  const [country, setCountry] = useState(farm?.country ?? DEFAULT_COUNTRY);
  const countries = sortedCountries(lang, [country]);
  const suggestions = provinceSuggestions(country);
  const mutation = useMutation({ mutationFn: (payload: object) => farm ? api.farms.update(farm.id, payload) : api.farms.create(payload), onSuccess: async () => { await w.reload(); } });
  const [done, setDone] = useState(false);
  const [localError, setLocalError] = useState('');
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setDone(false); setLocalError('');
    const f = new FormData(event.currentTarget);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const payload: Record<string, unknown> = { name: get('name'), areaHa: get('areaHa'), village: get('village') || null,
      country: get('country') || DEFAULT_COUNTRY, province: get('province') || null, soilType: get('soilType') || null, waterSource: get('waterSource') || null,
      nitrogen: get('nitrogen') || null, phosphorus: get('phosphorus') || null, potassium: get('potassium') || null,
      farmerGroup: get('farmerGroup') || null,
      latitude: get('latitude') || null, longitude: get('longitude') || null,
      ph: get('ph') || null, phMeasuredOn: get('ph') ? get('phMeasuredOn') : null,
      capitalJt: get('capitalJt') || null };
    if (payload.ph && !payload.phMeasuredOn) { setLocalError('Tanggal pengukuran pH wajib diisi bersama nilai pH.'); return; }
    mutation.mutate(payload, { onSuccess: () => setDone(true) });
  };
  if (w.loading) return <Busy/>;
  return <div className="space-y-5"><Heading title="Profil & lahan" description="Sumber data untuk prediksi, cuaca, dan satu musim tanam." action={<Tag color={farm ? 'green':'amber'}>{farm ? 'Lahan tersimpan':'Buat lahan pertama'}</Tag>}/>
    <form key={farm?.id ?? 'new'} onSubmit={save} className="space-y-5">
      <Card title="Identitas lahan" subtitle="Masukkan informasi yang sesuai kondisi sebenarnya.">
        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Nama lahan"><input className={inputClass} name="name" defaultValue={farm?.name ?? ''} placeholder="Contoh: Lahan Kebun Barat" maxLength={100} required/></Field>
          <Field label="Luas lahan (hektare)" hint="0,1–5 ha. Model awal dilatih hingga 3 ha."><input className={inputClass} name="areaHa" type="number" min="0.1" max="5" step="0.01" defaultValue={farm?.areaHa ?? '0.5'} required/></Field>
          <Field label="Desa"><input className={inputClass} name="village" defaultValue={farm?.village ?? ''} placeholder="Nama desa"/></Field>
          <Field label="Kelompok tani"><input className={inputClass} name="farmerGroup" defaultValue={farm?.farmerGroup ?? ''} placeholder="Opsional"/></Field>
          <Field label={t.profile.country}><select className={inputClass} name="country" value={country} onChange={e=>setCountry(e.target.value)} data-no-translate>{countries.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
          <Field label={t.profile.province}><input className={inputClass} name="province" list="province-suggestions" autoComplete="address-level1" maxLength={100} defaultValue={farm?.province ?? ''} placeholder={t.profile.provincePlaceholder} data-no-translate/><datalist id="province-suggestions" data-no-translate>{suggestions.map(v=><option key={v} value={v}/>)}</datalist></Field>
          <Field label="Sumber air"><select className={inputClass} name="waterSource" defaultValue={farm?.waterSource ?? ''}><option value="">Pilih sumber air</option>{WATERS.map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
          <Field label="Jenis tanah"><select className={inputClass} name="soilType" defaultValue={farm?.soilType ?? ''}><option value="">Pilih jenis tanah</option>{SOILS.map(v=><option key={v} value={v}>{v}</option>)}</select></Field>
          <Field label="Modal tersedia (juta rupiah)" hint="Boleh dikosongkan. Nilai aktual dipakai saat membuat musim."><input className={inputClass} type="number" step="0.01" min="0" name="capitalJt" defaultValue={farm?.capitalJt ?? ''} placeholder="Contoh: 12.5"/></Field>
        </div>
      </Card>
      <Card title="Kondisi tanah" subtitle="Jika pH diisi, tanggal pengukurannya juga wajib diisi.">
        <div className="grid md:grid-cols-3 gap-5">
          <Field label="pH tanah"><input className={inputClass} name="ph" type="number" step="0.1" min="3" max="9" defaultValue={farm?.ph ?? ''} placeholder="Contoh: 6.3"/></Field>
          <Field label="Tanggal ukur pH"><input className={inputClass} name="phMeasuredOn" type="date" max={dateOnly()} defaultValue={farm?.phMeasuredOn?.slice(0,10) ?? ''}/></Field>
          <div className="hidden md:block"/>
          {(['nitrogen','phosphorus','potassium'] as const).map((v,i)=><Field key={v} label={['Nitrogen (N)','Fosfor (P)','Kalium (K)'][i]}><select className={inputClass} name={v} defaultValue={farm?.[v] ?? ''}><option value="">Belum diuji</option>{LEVELS.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>)}
        </div>
      </Card>
      <Card title="Titik lokasi" subtitle="Koordinat hanya untuk mencari informasi cuaca. Peta utama tetap ilustrasi sampai batas lahan tersedia.">
        <div className="grid md:grid-cols-2 gap-5"><Field label="Latitude"><input className={inputClass} name="latitude" type="number" step="0.000001" min="-90" max="90" defaultValue={farm?.latitude ?? ''} placeholder="Contoh: -7.005145"/></Field><Field label="Longitude"><input className={inputClass} name="longitude" type="number" step="0.000001" min="-180" max="180" defaultValue={farm?.longitude ?? ''} placeholder="Contoh: 110.438125"/></Field></div>
      </Card>
      {Number(farm?.areaHa ?? 0) > 3 && <Message>Prediksi di atas 3 hektare berada di luar cakupan awal data latih dan perlu kehati-hatian.</Message>}
      {localError && <Message color="red">{localError}</Message>}<ErrorLine error={mutation.error}/>{done && <Message color="green"><CheckCircle2 size={16} className="inline"/> Profil berhasil tersimpan di backend.</Message>}
      <div className="flex justify-end"><Button type="submit" icon={Save} busy={mutation.isPending}>Simpan profil lahan</Button></div>
    </form>
  </div>;
}

