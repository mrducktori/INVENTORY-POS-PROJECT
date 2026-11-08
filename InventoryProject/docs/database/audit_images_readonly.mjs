import "dotenv/config";
import { supabase } from "../../server/config/supabaseClient.js";
const { data } = await supabase.from("products").select("id,name,category,image_url,is_archived").order("category").order("name");
const g = {};
for (const p of data) (g[p.image_url||'NONE'] ||= []).push(`${p.category}/${p.name}`);
for (const [u,n] of Object.entries(g)) console.log((u.split('/').pop()), '=>', n.join(', '));
