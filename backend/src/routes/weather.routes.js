import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';

export const weatherRoutes = Router();
weatherRoutes.use(requireUser);

function coordinates(req) {
  const lat=Number(req.query.latitude), lon=Number(req.query.longitude);
  if (req.query.latitude === undefined || req.query.longitude === undefined ||
      !Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) throw new HttpError(400,'Koordinat tidak valid');
  return {lat,lon};
}
async function openMeteo(req,fields) {
  const {lat,lon}=coordinates(req);
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',String(lat));url.searchParams.set('longitude',String(lon));
  url.searchParams.set('timezone','Asia/Jakarta');
  for(const [k,v] of Object.entries(fields))url.searchParams.set(k,v);
  let response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(7000)});}
  catch{throw new HttpError(503,'Layanan cuaca sementara tidak dapat dihubungi');}
  if(!response.ok)throw new HttpError(503,'Data cuaca tidak tersedia');
  return response.json();
}
weatherRoutes.get('/current',asyncHandler(async(req,res)=>{
  const data=await openMeteo(req,{current:'temperature_2m,precipitation,wind_speed_10m'});
  res.json({tempC:data.current?.temperature_2m??null,windKmh:data.current?.wind_speed_10m??null,
    rainMm:data.current?.precipitation??null,time:data.current?.time??null,source:'Open-Meteo'});
}));
weatherRoutes.get('/forecast',asyncHandler(async(req,res)=>{
  const data=await openMeteo(req,{daily:'precipitation_sum,temperature_2m_max',forecast_days:'7'});
  res.json({source:'Open-Meteo',days:(data.daily?.time??[]).map((date,i)=>({date,rainMm:data.daily?.precipitation_sum?.[i]??null,maxTempC:data.daily?.temperature_2m_max?.[i]??null}))});
}));
