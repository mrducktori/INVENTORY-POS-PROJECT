import "dotenv/config";
import fs from "fs";
import { supabase } from "../../server/config/supabaseClient.js";
const { data } = await supabase.from("products").select("id,name,category,image_url").not("image_url","is",null).order("category").order("name");
let i=0; const idx=[];
for (const p of data.filter(x=>x.image_url && x.image_url.startsWith("http"))) { const r = await fetch(p.image_url); const b = Buffer.from(await r.arrayBuffer()); const f = String(i).padStart(2,'0')+'.jpg'; fs.writeFileSync("C:/Users/glory/.gemini/antigravity/brain/f013102f-5f87-4460-8427-7d10d27751d4/scratch/img/"+f,b); idx.push(f+'|'+p.category+'|'+p.name+'|'+p.id); i++; }
fs.writeFileSync("C:/Users/glory/.gemini/antigravity/brain/f013102f-5f87-4460-8427-7d10d27751d4/scratch/img/index.txt", idx.join('\n'));
console.log('saved', i);
