import { Router, raw } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/prisma.js';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { addPhoto } from '../services/photo.service.js';

export const extendedSeasonRoutes = Router();
extendedSeasonRoutes.use(requireUser);
const IMAGE_LIMIT = 6 * 1024 * 1024;
const storageRoot = path.resolve(process.env.AGROCHIE_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));
const formatOf = (mime, bytes) => {
  if (mime === 'image/jpeg' && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'jpg';
  if (mime === 'image/png' && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png';
  if (mime === 'image/webp' && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') return 'webp';
  throw new HttpError(400, 'File foto harus JPEG, PNG, atau WebP yang valid');
};

/** Prototype local, private storage. Production should replace this with authenticated object storage. */
extendedSeasonRoutes.post('/:id/photos/upload', raw({ type: 'application/octet-stream', limit: IMAGE_LIMIT }), asyncHandler(async (req, res) => {
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length<100 || bytes.length>IMAGE_LIMIT) throw new HttpError(400, 'Ukuran gambar tidak valid (maksimal 6 MB)');
  const ext = formatOf(req.header('x-photo-type'), bytes);
  const name = `${randomBytes(18).toString('hex')}.${ext}`;
  const key = `local/${name}`;
  await mkdir(storageRoot, { recursive:true, mode:0o700 });
  await writeFile(path.join(storageRoot, name), bytes, { flag:'wx', mode:0o600 });
  try {
    const row = await addPhoto(req.userId, req.params.id, {
      kind:'SAMPEL', objectKey:key, sha256:createHash('sha256').update(bytes).digest('hex'),
      takenAt:new Date(), latitude:null, longitude:null,
    });
    res.status(201).json(row);
  } catch (error) { await unlink(path.join(storageRoot, name)).catch(()=>{}); throw error; }
}));

extendedSeasonRoutes.get('/:id/photos/:photoId/file', asyncHandler(async(req,res)=>{
  const row = await prisma.photo.findFirst({ where:{ id:req.params.photoId, seasonId:req.params.id, season:{farm:{userId:req.userId}} }, select:{objectKey:true} });
  if (!row || !/^local\/[a-f0-9]{36}\.(jpg|png|webp)$/.test(row.objectKey)) throw new HttpError(404,'Foto tidak ditemukan');
  const name = row.objectKey.slice('local/'.length);
  let contents;
  try { contents = await readFile(path.join(storageRoot,name)); }
  catch { throw new HttpError(404,'Berkas foto tidak tersedia'); }
  res.set('Cache-Control','private, no-store');
  res.type(name.endsWith('.png')?'png':name.endsWith('.webp')?'webp':'jpeg').send(contents);
}));

async function ownedSeason(userId, id) {
  const row = await prisma.season.findFirst({ where:{id,farm:{userId}}, select:{id:true,status:true,crop:true} });
  if(!row) throw new HttpError(404,'Musim tidak ditemukan');
  return row;
}
extendedSeasonRoutes.get('/:id/sample', asyncHandler(async(req,res)=>{
  const season=await ownedSeason(req.userId,req.params.id);
  const sample=await prisma.harvestSample.findUnique({where:{seasonId:season.id},select:{sampleKg:true,sampleM2:true,mismatchOver30:true}});
  res.json(sample);
}));

const TASK_KEYS = ['cek_hama','cek_air','cek_nutrisi','catat_biaya'];
function weekNo(value) {const n=Number(value);if(!Number.isInteger(n)||n<1||n>16) throw new HttpError(400,'Minggu harus 1 sampai 16');return n;}

extendedSeasonRoutes.get('/:id/checklist', asyncHandler(async(req,res)=>{
  const season=await ownedSeason(req.userId,req.params.id); const week=weekNo(req.query.week);
  const checks=await prisma.reminderCheck.findMany({where:{seasonId:season.id,weekNo:week},select:{itemKey:true,doneAt:true}});
  res.json({week,items:TASK_KEYS.map(k=>({key:k,done:checks.some(x=>x.itemKey===k)}))});
}));
extendedSeasonRoutes.put('/:id/checklist/:taskKey', asyncHandler(async(req,res)=>{
  const season=await ownedSeason(req.userId,req.params.id);
  if(!['TANAM','PANEN'].includes(season.status)) throw new HttpError(409,'Checklist hanya aktif saat penanaman atau panen');
  const week=weekNo(req.body?.week);
  const key=req.params.taskKey;
  if(!TASK_KEYS.includes(key))throw new HttpError(400,'Aktivitas tidak dikenal');
  if(typeof req.body?.done !== 'boolean')throw new HttpError(400,'done harus boolean');
  const where={seasonId_weekNo_itemKey:{seasonId:season.id,weekNo:week,itemKey:key}};
  if(req.body.done)await prisma.reminderCheck.upsert({where,create:{seasonId:season.id,weekNo:week,itemKey:key},update:{doneAt:new Date()}});
  else await prisma.reminderCheck.deleteMany({where:{seasonId:season.id,weekNo:week,itemKey:key}});
  res.json({week,key,done:req.body.done});
}));

extendedSeasonRoutes.get('/:id/loans', asyncHandler(async(req,res)=>{
  const season=await ownedSeason(req.userId,req.params.id);
  res.json(await prisma.loanApplication.findMany({where:{seasonId:season.id},select:{id:true,amountJt:true,tenorWeeks:true,purpose:true,status:true,referralCode:true,expiresAt:true,createdAt:true,consentShare:true},orderBy:{createdAt:'desc'}}));
}));
extendedSeasonRoutes.post('/:id/loans', asyncHandler(async(req,res)=>{
  const season=await ownedSeason(req.userId,req.params.id);
  if(season.status==='DRAFT'||season.status==='SELESAI')throw new HttpError(409,'Pengajuan hanya tersedia saat pembiayaan aktif');
  const {amountJt,tenorWeeks,purpose,consentShare}=req.body??{};
  if(!/^\d+(\.\d{1,2})?$/.test(String(amountJt??''))||Number(amountJt)<=0||Number(amountJt)>99999999)throw new HttpError(400,'Nominal harus lebih dari nol dan maksimal 2 desimal (juta Rp)');
  if(!Number.isInteger(tenorWeeks)||tenorWeeks<1||tenorWeeks>52)throw new HttpError(400,'Tenor harus 1 sampai 52 minggu');
  if(typeof purpose!=='string'||purpose.trim().length<3||purpose.length>300)throw new HttpError(400,'Tujuan harus 3 sampai 300 karakter');
  if(consentShare!==true)throw new HttpError(400,'Persetujuan berbagi data harus diberikan');
  const ref='AGR-'+randomBytes(6).toString('hex').toUpperCase();
  const record=await prisma.loanApplication.create({data:{seasonId:season.id,amountJt:String(amountJt),tenorWeeks,purpose:purpose.trim(),consentShare:true,referralCode:ref,expiresAt:new Date(Date.now()+14*86400_000)}});
  res.status(201).json({id:record.id,amountJt:record.amountJt,tenorWeeks:record.tenorWeeks,status:record.status,referralCode:record.referralCode,expiresAt:record.expiresAt,consentShare:record.consentShare});
}));
