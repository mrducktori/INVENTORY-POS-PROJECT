import "dotenv/config";
import { supabase } from "../../server/config/supabaseClient.js";
const { data } = await supabase.from("ingredients").select("id,name,unit,is_archived").order("name");
console.log(data.map(i=>`${i.name} [${i.unit}]${i.is_archived?' ARCH':''} ${i.id.slice(0,8)}`).join('\n'));
const { data: r } = await supabase.from("recipes").select("*").limit(1); console.log(Object.keys(r[0]));
const { data: rr } = await supabase.from("recipes").select("recipe_unit,ingredients(name,unit),quantity_used,products(name,category)").in("products.category",["FRAPPE"]);
