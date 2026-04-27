/**
 * Seeds DOT variant sample data into backup.xlsx.
 * ALL tire items (PCR, SUV, TRUCK, MOTORCYCLE, RECAP) get DOT variants.
 * Each variant gets item_master, inventory_ledger, current_stock, item_price_history entries.
 */
const path = require("path");
const XLSX = require("xlsx");
const fs = require("fs");

const excelPath = path.join(__dirname, "..", "backup.xlsx");
const wb = XLSX.readFile(excelPath);

function getSheet(name) {
  return XLSX.utils.sheet_to_json(wb.Sheets[name] || {});
}
function setSheet(name, rows) {
  const idx = wb.SheetNames.indexOf(name);
  if (idx !== -1) wb.SheetNames.splice(idx, 1);
  delete wb.Sheets[name];
  const ws = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([[]]);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const SHOP_ID = "SHOP-001";

// ALL tire items with DOT variants
// For older (2024) stock: slightly lower cost/price, fewer units
// For newer (2025) stock: full price, more units
// RECAP items get DOT too (their DOT is usually in name already, but we still track it)
const TIRE_VARIANTS = [
  // ── PCR ──────────────────────────────────────────────────────────────────────
  { parentId:"ITEM-001", sku:"PCR-BRDG-T001-185/70R14",  name:"Bridgestone Turanza 185/70R14",          category:"PCR",        brand:"Bridgestone", design:"Turanza",          size:"185/70R14",    dots:[{dot:"2024",cost:2600,price:3325,stock:8},{dot:"2025",cost:2800,price:3800,stock:12}] },
  { parentId:"ITEM-002", sku:"PCR-BRDG-T001-195/65R15",  name:"Bridgestone Turanza 195/65R15",          category:"PCR",        brand:"Bridgestone", design:"Turanza",          size:"195/65R15",    dots:[{dot:"2024",cost:3000,price:3990,stock:6},{dot:"2025",cost:3200,price:4200,stock:14}] },
  { parentId:"ITEM-003", sku:"PCR-MICH-P3-205/55R16",    name:"Michelin Primacy 3 205/55R16",           category:"PCR",        brand:"Michelin",    design:"Primacy 3",        size:"205/55R16",    dots:[{dot:"2024",cost:4200,price:5320,stock:4},{dot:"2025",cost:4500,price:6000,stock:10}] },
  { parentId:"ITEM-004", sku:"PCR-CONT-CC6-185/65R15",   name:"Continental ComfortContact 185/65R15",   category:"PCR",        brand:"Continental", design:"ComfortContact 6", size:"185/65R15",    dots:[{dot:"2024",cost:2800,price:3800,stock:5},{dot:"2025",cost:3000,price:4000,stock:10}] },
  { parentId:"ITEM-005", sku:"PCR-TOYO-NE-195/60R15",    name:"Toyo NanoEnergy 195/60R15",              category:"PCR",        brand:"Toyo",        design:"NanoEnergy 3",     size:"195/60R15",    dots:[{dot:"2024",cost:2700,price:3700,stock:6},{dot:"2025",cost:2900,price:3900,stock:12}] },
  { parentId:"ITEM-006", sku:"PCR-HANK-K425-205/65R16",  name:"Hankook Kinergy 205/65R16",              category:"PCR",        brand:"Hankook",     design:"Kinergy Eco 2",    size:"205/65R16",    dots:[{dot:"2024",cost:2900,price:3895,stock:5},{dot:"2025",cost:3100,price:4100,stock:10}] },
  // ── SUV ──────────────────────────────────────────────────────────────────────
  { parentId:"ITEM-007", sku:"SUV-BRDG-D840-265/65R17",  name:"Bridgestone Dueler 265/65R17",           category:"SUV",        brand:"Bridgestone", design:"Dueler H/T 840",   size:"265/65R17",    dots:[{dot:"2024",cost:5200,price:6650,stock:6},{dot:"2025",cost:5500,price:7500,stock:14}] },
  { parentId:"ITEM-008", sku:"SUV-MICH-LTX-235/65R17",   name:"Michelin LTX 235/65R17",                 category:"SUV",        brand:"Michelin",    design:"LTX Force",        size:"235/65R17",    dots:[{dot:"2024",cost:5700,price:7220,stock:3},{dot:"2025",cost:6000,price:8000,stock:8}] },
  { parentId:"ITEM-009", sku:"SUV-TOYO-OPAT-265/60R18",  name:"Toyo Open Country 265/60R18",            category:"SUV",        brand:"Toyo",        design:"Open Country A/T", size:"265/60R18",    dots:[{dot:"2024",cost:6500,price:8550,stock:4},{dot:"2025",cost:6800,price:9000,stock:10}] },
  { parentId:"ITEM-010", sku:"SUV-CONT-CVK-225/65R17",   name:"Continental CrossContact 225/65R17",     category:"SUV",        brand:"Continental", design:"CrossContact LX",  size:"225/65R17",    dots:[{dot:"2024",cost:5500,price:7410,stock:4},{dot:"2025",cost:5800,price:7800,stock:8}] },
  { parentId:"ITEM-011", sku:"SUV-HANK-DH31-235/60R18",  name:"Hankook Dynapro 235/60R18",              category:"SUV",        brand:"Hankook",     design:"Dynapro HT",       size:"235/60R18",    dots:[{dot:"2024",cost:5300,price:7220,stock:4},{dot:"2025",cost:5600,price:7600,stock:8}] },
  // ── TRUCK ────────────────────────────────────────────────────────────────────
  { parentId:"ITEM-015", sku:"TRK-BRDG-R250-11R22.5",   name:"Bridgestone R250 11R22.5",               category:"TRUCK",      brand:"Bridgestone", design:"R250",             size:"11R22.5",      dots:[{dot:"2024",cost:11500,price:14725,stock:4},{dot:"2025",cost:12000,price:16000,stock:8}] },
  { parentId:"ITEM-016", sku:"TRK-MICH-XZE2-295/80R22.5",name:"Michelin XZE2 295/80R22.5",             category:"TRUCK",      brand:"Michelin",    design:"XZE2",             size:"295/80R22.5",  dots:[{dot:"2024",cost:13300,price:17575,stock:3},{dot:"2025",cost:14000,price:18500,stock:6}] },
  { parentId:"ITEM-017", sku:"TRK-TOYO-M154-11R22.5",   name:"Toyo M154 11R22.5",                      category:"TRUCK",      brand:"Toyo",        design:"M154",             size:"11R22.5",      dots:[{dot:"2024",cost:10900,price:14725,stock:4},{dot:"2025",cost:11500,price:15500,stock:8}] },
  // ── MOTORCYCLE ───────────────────────────────────────────────────────────────
  { parentId:"ITEM-012", sku:"MOTO-IRC-MB520-70/90-14",  name:"IRC MB520 70/90-14",                     category:"MOTORCYCLE", brand:"IRC",         design:"MB520",            size:"70/90-14",     dots:[{dot:"2024",cost:370, price:570, stock:5},{dot:"2025",cost:400, price:650, stock:10}] },
  { parentId:"ITEM-013", sku:"MOTO-FARO-TM22-80/90-17",  name:"Faros TM22 80/90-17",                    category:"MOTORCYCLE", brand:"Faros",       design:"TM22",             size:"80/90-17",     dots:[{dot:"2024",cost:320, price:550, stock:5},{dot:"2025",cost:350, price:580, stock:8}] },
  { parentId:"ITEM-014", sku:"MOTO-METZ-M5-120/70-17",   name:"Metzeler M5 120/70-17",                  category:"MOTORCYCLE", brand:"Metzeler",    design:"Sportec M5",       size:"120/70-17",    dots:[{dot:"2024",cost:2000,price:3040,stock:3},{dot:"2025",cost:2200,price:3200,stock:6}] },
  // ── RECAP ────────────────────────────────────────────────────────────────────
  { parentId:"ITEM-RECAP-001", sku:"RECAP-GT-FLCP-75016-DOT4521",    name:"GT Fullcap 750-16",           category:"RECAP",      brand:"GT",          design:"Fullcap",          size:"750-16",       dots:[{dot:"4521",cost:1600,price:2800,stock:8}] },
  { parentId:"ITEM-RECAP-002", sku:"RECAP-BRD-TOPCP-70016-DOT3820",  name:"Bridgestone Topcap 700-16",   category:"RECAP",      brand:"Bridgestone", design:"Topcap",           size:"700-16",       dots:[{dot:"3820",cost:1300,price:2280,stock:6},{dot:"1025",cost:1400,price:2400,stock:10}] },
  { parentId:"ITEM-RECAP-003", sku:"RECAP-GY-COLD-82516-DOT2419",    name:"Goodyear Cold Process 825-16",category:"RECAP",      brand:"Goodyear",    design:"Cold Process",     size:"825-16",       dots:[{dot:"2419",cost:1800,price:3200,stock:5}] },
];

// ── Load existing sheets ───────────────────────────────────────────────────────
const itemMaster      = getSheet("ITEM_MASTER");
const inventoryLedger = getSheet("INVENTORY_LEDGER");
const currentStock    = getSheet("CURRENT_STOCK");
const priceHistory    = getSheet("ITEM_PRICE_HISTORY");

// Remove previously seeded DOT variants
const cleanItems  = itemMaster.filter(r => !String(r.item_id || "").includes("-DOT"));
const cleanLedger = inventoryLedger.filter(r => !String(r.inventory_ledger_id || "").startsWith("INV-DOT-"));
const cleanStock  = currentStock.filter(r => !String(r.item_id || "").includes("-DOT"));
const cleanPH     = priceHistory.filter(r => !String(r.item_id || "").includes("-DOT"));

const newItems   = [...cleanItems];
const newLedger  = [...cleanLedger];
const newStock   = [...cleanStock];
const newPH      = [...cleanPH];

let ledgerSeq = 1;
let phSeq     = 1;

for (const tire of TIRE_VARIANTS) {
  for (const d of tire.dots) {
    const variantId   = `${tire.parentId}-DOT${d.dot}`;
    const variantSku  = `${tire.sku}-DOT${d.dot}`;
    const variantName = `${tire.name} [DOT ${d.dot}]`;
    const rcvDate     = d.dot <= "2024" ? "2026-03-01 08:00:00" : "2026-03-15 08:00:00";

    // item_master
    newItems.push({
      item_id:        variantId,
      sku:            variantSku,
      item_name:      variantName,
      category:       tire.category,
      brand:          tire.brand,
      design:         tire.design,
      size:           tire.size,
      rim_size:       null,
      unit_cost:      d.cost,
      selling_price:  d.price,
      unit:           "PCS",
      supplier_id:    null,
      reorder_point:  5,
      dot_number:     d.dot,
      parent_item_id: tire.parentId,
      is_active:      1,
      created_at:     rcvDate,
    });

    // inventory_ledger
    newLedger.push({
      inventory_ledger_id: `INV-DOT-${ledgerSeq++}`,
      shop_id:             SHOP_ID,
      item_id:             variantId,
      transaction_type:    "PURCHASE",
      quantity:            d.stock,
      unit_cost:           d.cost,
      reference_id:        `PO-DOT-${tire.parentId}-${d.dot}`,
      supplier_id:         null,
      dot_number:          d.dot,
      created_at:          rcvDate,
      created_by:          "SYSTEM",
      linked_return_id:    null,
    });

    // current_stock
    newStock.push({
      shop_id:          SHOP_ID,
      item_id:          variantId,
      current_quantity: d.stock,
      last_updated:     rcvDate,
    });

    // price_history — initial prices on receive
    newPH.push({
      history_id: `PH-DOT-${phSeq++}`,
      item_id:    variantId,
      price_type: "UNIT_COST",
      old_price:  null,
      new_price:  d.cost,
      changed_at: rcvDate,
      changed_by: "SYSTEM",
      notes:      `Initial cost on receive — DOT ${d.dot}`,
    });
    newPH.push({
      history_id: `PH-DOT-${phSeq++}`,
      item_id:    variantId,
      price_type: "SELLING_PRICE",
      old_price:  null,
      new_price:  d.price,
      changed_at: rcvDate,
      changed_by: "SYSTEM",
      notes:      `Initial price on receive — DOT ${d.dot}`,
    });

    // For older DOT variants: simulate a clearance markdown
    const isOldDot = d.dot <= "2024" || (tire.category === "RECAP" && tire.dots.length > 1 && tire.dots.indexOf(d) === 0);
    if (isOldDot) {
      const discountedPrice = Math.round(d.price * 0.95 / 50) * 50;
      if (discountedPrice !== d.price) {
        newPH.push({
          history_id: `PH-DOT-${phSeq++}`,
          item_id:    variantId,
          price_type: "SELLING_PRICE",
          old_price:  d.price,
          new_price:  discountedPrice,
          changed_at: "2026-03-25 10:00:00",
          changed_by: "ADMIN",
          notes:      "Markdown to clear older DOT stock (FIFO)",
        });
        // Update the item's selling_price to the discounted price
        const idx = newItems.findIndex(i => i.item_id === variantId);
        if (idx !== -1) newItems[idx].selling_price = discountedPrice;
      }
    }
  }
}

// Write back
setSheet("ITEM_MASTER",        newItems);
setSheet("INVENTORY_LEDGER",   newLedger);
setSheet("CURRENT_STOCK",      newStock);
setSheet("ITEM_PRICE_HISTORY", newPH);

XLSX.writeFile(wb, excelPath);

const added = newItems.length - cleanItems.length;
console.log(`\n✅ DOT variants seeded — ${added} new variants added across all tire categories:\n`);
const byCat = {};
for (const tire of TIRE_VARIANTS) {
  if (!byCat[tire.category]) byCat[tire.category] = [];
  for (const d of tire.dots) byCat[tire.category].push(`${tire.parentId}-DOT${d.dot}  ${tire.name} [DOT ${d.dot}]  stock=${d.stock}`);
}
for (const [cat, lines] of Object.entries(byCat)) {
  console.log(`  [${cat}]`);
  lines.forEach(l => console.log(`    ${l}`));
}
