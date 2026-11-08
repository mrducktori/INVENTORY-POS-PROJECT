import "dotenv/config";
import fs from "fs";
import { supabase } from "../../server/config/supabaseClient.js";
const bak = JSON.parse(fs.readFileSync("../docs/database/backup_products_images_20261104.json","utf8"));
const ids = ["75be78b3-49e1-4621-897f-cc3de9d34acd","1aa5e565-717f-4443-8f88-09069ccffd48","a6f5b4e4-2e13-4060-87bb-a49116391165","b02ce080-11c3-4b49-b400-0e4bcd4d130b","040ea4fe-d083-4440-914c-d7a5e417830e","0a00bc96-ce97-4361-944a-1cce44e2e6f2","b55c8ba6-6923-4016-86de-4eb6dfb1f4f9","fb7f2788-eae3-4592-ad8e-37bbb4fbca9e","b29c5b74-3507-48e1-9c88-82283fe4ca95","310bd918-117f-4434-b856-83060b9b1894","e2b7b2b4-1244-446f-90aa-a84b2f9ef2d4"];
for (const id of ids) { const o = bak.products.find(p=>p.id===id); const {error}=await supabase.from("products").update({image_url:o.image_url}).eq("id",id); console.log(error?"FAIL":"restored", o.name); }
// remove the empty uploads
const { data: files } = await supabase.storage.from("cms-images").list("public/products",{limit:1000});
const bad = files.filter(f=>f.metadata && f.metadata.size===0).map(f=>"public/products/"+f.name);
console.log("empty files", bad.length);
if (bad.length) { const {error}=await supabase.storage.from("cms-images").remove(bad); console.log(error?error.message:"removed empties"); }
