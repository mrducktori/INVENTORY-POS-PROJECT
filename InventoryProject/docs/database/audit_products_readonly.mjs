import "dotenv/config";
import { supabase } from "../../server/config/supabaseClient.js";
const { data: prods, error } = await supabase.from("products").select("id,name,category,price,image_url,is_archived,sizes").order("category").order("name");
if (error) throw error;
const { data: rec } = await supabase.from("recipes").select("product_id,quantity_used,recipe_unit,ingredients(name,unit)");
const byP = {};
for (const r of rec || []) (byP[r.product_id] ||= []).push(`${r.ingredients?.name} ${r.quantity_used}${r.recipe_unit||''}`);
for (const p of prods) console.log([p.id, p.is_archived?'ARCH':'', p.category, p.name, p.price, p.image_url ? p.image_url.slice(0,90) : 'NO_IMAGE', '| R:', (byP[p.id]||[]).join('; ')||'NONE'].join(' | '));
console.log('total', prods.length);
