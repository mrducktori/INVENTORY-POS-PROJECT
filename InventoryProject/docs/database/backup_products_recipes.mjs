import "dotenv/config";
import fs from "fs";
import { supabase } from "../../server/config/supabaseClient.js";
const { data: p } = await supabase.from("products").select("id,name,category,image_url");
const { data: r } = await supabase.from("recipes").select("*");
fs.writeFileSync("../docs/database/backup_products_images_20261104.json", JSON.stringify({products:p,recipes:r},null,1));
console.log(p.length, r.length);
