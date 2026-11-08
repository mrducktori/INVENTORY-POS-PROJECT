import "dotenv/config";
import { supabase } from "../../server/config/supabaseClient.js";
const { error } = await supabase.from("products").update({ image_url: null }).eq("id","9f764f1f-4980-4e2c-93e3-9741f85c1ead");
console.log(error ? error.message : "TESTPRODUCT picture cleared");
const { data } = await supabase.from("products").select("name,image_url").in("name",["TESTPRODUCT","ORIGINAL LATTE","HOKKAIDO"]);
for (const p of data) { const r = p.image_url ? await fetch(p.image_url,{method:"HEAD"}) : null; console.log(p.name, r ? r.status+" "+r.headers.get("content-length") : "no image"); }
