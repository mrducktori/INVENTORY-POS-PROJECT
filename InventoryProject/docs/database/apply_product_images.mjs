// One-off: upload regenerated product images to Supabase Storage (cms-images/public/products)
// and update products.image_url. Also clears the picture of test products.
// Usage (from /server): node ../docs/database/apply_product_images.mjs <finalDir> <indexFile> [--dry]
// <finalDir> contains NN.jpg where NN matches the line index in <indexFile> (file|category|name|id).
import "dotenv/config";
import fs from "fs";
import path from "path";
import { supabase } from "../../server/config/supabaseClient.js";

const [finalDir, indexFile, flag] = process.argv.slice(2);
const dry = flag === "--dry";
const idx = fs.readFileSync(indexFile, "utf8").split(/\r?\n/).filter(Boolean).map((l) => {
  const [file, category, name, id] = l.split("|");
  return { file, category, name, id, n: file.replace(".jpg", "") };
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

for (const f of fs.readdirSync(finalDir).filter((x) => x.endsWith(".jpg")).sort()) {
  if (fs.statSync(path.join(finalDir, f)).size < 5000) { console.log("skip empty/tiny", f); continue; }
  const row = idx.find((r) => r.n === f.replace(".jpg", ""));
  if (!row) { console.log("skip (no index)", f); continue; }
  const key = `public/products/product-${slug(row.name)}-${Date.now()}.jpg`;
  if (dry) { console.log("DRY", row.category, row.name, "->", key); continue; }
  const { error: upErr } = await supabase.storage.from("cms-images").upload(key, fs.readFileSync(path.join(finalDir, f)), { contentType: "image/jpeg", upsert: false });
  if (upErr) { console.error("UPLOAD FAIL", row.name, upErr.message); continue; }
  const { data: pub } = supabase.storage.from("cms-images").getPublicUrl(key);
  const { error } = await supabase.from("products").update({ image_url: pub.publicUrl }).eq("id", row.id);
  console.log(error ? `DB FAIL ${row.name}: ${error.message}` : `OK ${row.category} / ${row.name}`);
}


