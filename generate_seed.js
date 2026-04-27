const XLSX = require('xlsx');

// ─── Helpers ────────────────────────────────────────────────────────────────
const pad = (n, w = 3) => String(n).padStart(w, '0');
const fmtDate = d => d.toISOString().slice(0, 10);
const fmtDT   = (d, time = '00:00:00') => `${fmtDate(d)} ${time}`;

function dateRange(startStr, endStr) {
  const dates = [];
  let cur = new Date(startStr);
  const end = new Date(endStr);
  while (cur <= end) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return dates;
}

const START = '2026-02-19';
const END   = '2026-03-21';
const allDates = dateRange(START, END);

// ─── SHOP_MASTER ─────────────────────────────────────────────────────────────
const SHOP_MASTER = [{
  shop_id: 'SHOP-001', shop_code: 'TH-MAIN', shop_name: 'CoreTrack Main Branch',
  address: '123 Rizal Ave Quezon City', is_active: 1,
  created_at: '2026-01-01 00:00:00'
}];

// ─── STAFF_MASTER ────────────────────────────────────────────────────────────
const STAFF_MASTER = [
  { staff_id:'STAFF-001', staff_code:'EMP001', full_name:'Maria Santos',    email:'maria@coretrack.ph',  role:'owner',      is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-002', staff_code:'EMP002', full_name:'Jose Reyes',      email:'jose@coretrack.ph',   role:'sales',      is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-003', staff_code:'EMP003', full_name:'Pedro Cruz',      email:'pedro@coretrack.ph',  role:'tireman',    is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-004', staff_code:'EMP004', full_name:'Juan Dela Cruz',  email:'juan@coretrack.ph',   role:'tireman',    is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-005', staff_code:'EMP005', full_name:'Ramon Bautista',  email:'ramon@coretrack.ph',  role:'technician', is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-006', staff_code:'EMP006', full_name:'Carlo Mendoza',   email:'carlo@coretrack.ph',  role:'tireman',    is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-007', staff_code:'EMP007', full_name:'Ana Lim',         email:'ana@coretrack.ph',    role:'sales',      is_active:1, created_at:'2026-01-01 00:00:00' },
  { staff_id:'STAFF-008', staff_code:'EMP008', full_name:'Bong Villanueva', email:'bong@coretrack.ph',   role:'technician', is_active:1, created_at:'2026-01-01 00:00:00' },
];

// ─── ITEM_MASTER ─────────────────────────────────────────────────────────────
const ITEM_MASTER = [
  // PCR
  { item_id:'ITEM-001', sku:'PCR-BRDG-T001-185/70R14',     item_name:'Bridgestone Turanza 185/70R14',          category:'PCR',        brand:'Bridgestone', design:'Turanza',           size:'185/70R14',    rim_size:14,   unit_cost:2800,  selling_price:3800,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-002', sku:'PCR-BRDG-T001-195/65R15',     item_name:'Bridgestone Turanza 195/65R15',          category:'PCR',        brand:'Bridgestone', design:'Turanza',           size:'195/65R15',    rim_size:15,   unit_cost:3200,  selling_price:4200,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-003', sku:'PCR-MICH-P3-205/55R16',       item_name:'Michelin Primacy 3 205/55R16',           category:'PCR',        brand:'Michelin',    design:'Primacy 3',         size:'205/55R16',    rim_size:16,   unit_cost:4500,  selling_price:6000,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-004', sku:'PCR-CONT-CC6-185/65R15',      item_name:'Continental ComfortContact 185/65R15',   category:'PCR',        brand:'Continental', design:'ComfortContact 6',  size:'185/65R15',    rim_size:15,   unit_cost:3000,  selling_price:4000,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-005', sku:'PCR-TOYO-NE-195/60R15',       item_name:'Toyo NanoEnergy 195/60R15',              category:'PCR',        brand:'Toyo',        design:'NanoEnergy 3',      size:'195/60R15',    rim_size:15,   unit_cost:2900,  selling_price:3900,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-006', sku:'PCR-HANK-K425-205/65R16',     item_name:'Hankook Kinergy 205/65R16',              category:'PCR',        brand:'Hankook',     design:'Kinergy Eco 2',     size:'205/65R16',    rim_size:16,   unit_cost:3100,  selling_price:4100,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  // SUV
  { item_id:'ITEM-007', sku:'SUV-BRDG-D840-265/65R17',     item_name:'Bridgestone Dueler 265/65R17',           category:'SUV',        brand:'Bridgestone', design:'Dueler H/T 840',    size:'265/65R17',    rim_size:17,   unit_cost:5500,  selling_price:7500,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-008', sku:'SUV-MICH-LTX-235/65R17',      item_name:'Michelin LTX 235/65R17',                 category:'SUV',        brand:'Michelin',    design:'LTX Force',         size:'235/65R17',    rim_size:17,   unit_cost:6000,  selling_price:8000,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-009', sku:'SUV-TOYO-OPAT-265/60R18',     item_name:'Toyo Open Country 265/60R18',            category:'SUV',        brand:'Toyo',        design:'Open Country A/T',  size:'265/60R18',    rim_size:18,   unit_cost:6800,  selling_price:9000,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-010', sku:'SUV-CONT-CVK-225/65R17',      item_name:'Continental CrossContact 225/65R17',     category:'SUV',        brand:'Continental', design:'CrossContact LX',   size:'225/65R17',    rim_size:17,   unit_cost:5800,  selling_price:7800,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-011', sku:'SUV-HANK-DH31-235/60R18',     item_name:'Hankook Dynapro 235/60R18',              category:'SUV',        brand:'Hankook',     design:'Dynapro HT',        size:'235/60R18',    rim_size:18,   unit_cost:5600,  selling_price:7600,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  // MOTORCYCLE
  { item_id:'ITEM-012', sku:'MOTO-IRC-MB520-70/90-14',     item_name:'IRC MB520 70/90-14',                     category:'MOTORCYCLE', brand:'IRC',         design:'MB520',             size:'70/90-14',     rim_size:14,   unit_cost:400,   selling_price:650,   unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-013', sku:'MOTO-FARO-TM22-80/90-17',     item_name:'Faros TM22 80/90-17',                    category:'MOTORCYCLE', brand:'Faros',       design:'TM22',              size:'80/90-17',     rim_size:17,   unit_cost:350,   selling_price:580,   unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-014', sku:'MOTO-METZ-M5-120/70-17',      item_name:'Metzeler M5 120/70-17',                  category:'MOTORCYCLE', brand:'Metzeler',    design:'Sportec M5',        size:'120/70-17',    rim_size:17,   unit_cost:2200,  selling_price:3200,  unit:'PCS', is_active:1, created_at:'2026-01-01' },
  // TRUCK
  { item_id:'ITEM-015', sku:'TRK-BRDG-R250-11R22.5',       item_name:'Bridgestone R250 11R22.5',               category:'TRUCK',      brand:'Bridgestone', design:'R250',              size:'11R22.5',      rim_size:22.5, unit_cost:12000, selling_price:16000, unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-016', sku:'TRK-MICH-XZE2-295/80R22.5',   item_name:'Michelin XZE2 295/80R22.5',              category:'TRUCK',      brand:'Michelin',    design:'XZE2',              size:'295/80R22.5',  rim_size:22.5, unit_cost:14000, selling_price:18500, unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-017', sku:'TRK-TOYO-M154-11R22.5',       item_name:'Toyo M154 11R22.5',                      category:'TRUCK',      brand:'Toyo',        design:'M154',              size:'11R22.5',      rim_size:22.5, unit_cost:11500, selling_price:15500, unit:'PCS', is_active:1, created_at:'2026-01-01' },
  // VALVE
  { item_id:'ITEM-018', sku:'VLV-RBR-001',                  item_name:'Rubber Tire Valve',                      category:'VALVE',      brand:'Generic',     design:'Standard',          size:'N/A',          rim_size:0,    unit_cost:15,    selling_price:30,    unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-019', sku:'VLV-STL-001',                  item_name:'Steel Tire Valve',                       category:'VALVE',      brand:'Generic',     design:'Metal',             size:'N/A',          rim_size:0,    unit_cost:25,    selling_price:50,    unit:'PCS', is_active:1, created_at:'2026-01-01' },
  // WEIGHT
  { item_id:'ITEM-020', sku:'WGT-CHRM-5G',                  item_name:'Chrome Wheel Weight 5g',                 category:'WEIGHT',     brand:'Generic',     design:'Chrome',            size:'5g',           rim_size:0,    unit_cost:1.33,  selling_price:10,    unit:'PCS', is_active:1, created_at:'2026-01-01' },
  { item_id:'ITEM-021', sku:'WGT-BLK-5G',                   item_name:'Black Wheel Weight 5g',                  category:'WEIGHT',     brand:'Generic',     design:'Black',             size:'5g',           rim_size:0,    unit_cost:1.42,  selling_price:10,    unit:'PCS', is_active:1, created_at:'2026-01-01' },
];

// ─── SERVICES_MASTER ─────────────────────────────────────────────────────────
const SERVICES_MASTER = [
  { service_id:'SVC-001', service_code:'WB-001', service_name:'Wheel Balancing',   base_price:100, is_commissionable:1, is_active:1, commission_rate:0, created_at:'2026-01-01' },
  { service_id:'SVC-002', service_code:'TR-001', service_name:'Tire Rotation',     base_price:150, is_commissionable:1, is_active:1, commission_rate:0, created_at:'2026-01-01' },
  { service_id:'SVC-003', service_code:'VL-001', service_name:'Vulcanizing',       base_price:80,  is_commissionable:1, is_active:1, commission_rate:0, created_at:'2026-01-01' },
  { service_id:'SVC-004', service_code:'TF-001', service_name:'Tire Fitting',      base_price:120, is_commissionable:1, is_active:1, commission_rate:0, created_at:'2026-01-01' },
  { service_id:'SVC-005', service_code:'NI-001', service_name:'Nitrogen Inflation',base_price:50,  is_commissionable:0, is_active:1, commission_rate:0, created_at:'2026-01-01' },
];

// ─── CUSTOMER_MASTER ──────────────────────────────────────────────────────────
const CUSTOMER_MASTER = [
  { customer_id:'CUST-001', shop_id:'SHOP-001', customer_code:'CUST-001', customer_name:'Roberto Tan',      company:'',                contact_number:'09171234567', address:'Quezon City',  created_at:'2026-01-15', updated_at:'2026-01-15' },
  { customer_id:'CUST-002', shop_id:'SHOP-001', customer_code:'CUST-002', customer_name:'Elena Gomez',      company:'Gomez Transport',  contact_number:'09281234567', address:'Caloocan',     created_at:'2026-01-20', updated_at:'2026-01-20' },
  { customer_id:'CUST-003', shop_id:'SHOP-001', customer_code:'CUST-003', customer_name:'Dennis Ong',       company:'Ong Logistics',    contact_number:'09391234567', address:'Marikina',     created_at:'2026-02-01', updated_at:'2026-02-01' },
  { customer_id:'CUST-004', shop_id:'SHOP-001', customer_code:'CUST-004', customer_name:'Ligaya Flores',    company:'',                contact_number:'09451234567', address:'Pasig',        created_at:'2026-02-05', updated_at:'2026-02-05' },
  { customer_id:'CUST-005', shop_id:'SHOP-001', customer_code:'CUST-005', customer_name:'Armando Cruz',     company:'Cruz Trucking',    contact_number:'09561234567', address:'Valenzuela',   created_at:'2026-02-10', updated_at:'2026-02-10' },
  { customer_id:'CUST-006', shop_id:'SHOP-001', customer_code:'CUST-006', customer_name:'Maricel Santos',   company:'',                contact_number:'09671234567', address:'Mandaluyong',  created_at:'2026-02-12', updated_at:'2026-02-12' },
  { customer_id:'CUST-007', shop_id:'SHOP-001', customer_code:'CUST-007', customer_name:'Rodel Bautista',   company:'Bautista Rental',  contact_number:'09781234567', address:'Taguig',       created_at:'2026-02-15', updated_at:'2026-02-15' },
  { customer_id:'CUST-008', shop_id:'SHOP-001', customer_code:'CUST-008', customer_name:'Tessie Navarro',   company:'',                contact_number:'09891234567', address:'Parañaque',    created_at:'2026-02-18', updated_at:'2026-02-18' },
  { customer_id:'CUST-009', shop_id:'SHOP-001', customer_code:'CUST-009', customer_name:'Felix Reyes',      company:'',                contact_number:'09911234567', address:'Las Piñas',    created_at:'2026-02-20', updated_at:'2026-02-20' },
  { customer_id:'CUST-010', shop_id:'SHOP-001', customer_code:'CUST-010', customer_name:'Gloria Mendoza',   company:'Mendoza Bus Lines', contact_number:'09021234567', address:'Manila',      created_at:'2026-02-22', updated_at:'2026-02-22' },
];

// ─── SUPPLIER_MASTER ──────────────────────────────────────────────────────────
const SUPPLIER_MASTER = [
  { supplier_id:'SUP-001', supplier_code:'BRDG-PH', supplier_name:'Bridgestone Philippines', supplier_type:'TIRE', contact_person:'James Tan',    contact_number:'028881234', email_address:'james@bridgestone.ph', address:'Makati City', default_payment_terms_days:30, active_status:1, created_at:'2026-01-01', created_by:'SYSTEM' },
  { supplier_id:'SUP-002', supplier_code:'MICH-PH', supplier_name:'Michelin Philippines',    supplier_type:'TIRE', contact_person:'Anne Lee',     contact_number:'028882345', email_address:'anne@michelin.ph',    address:'BGC Taguig',  default_payment_terms_days:30, active_status:1, created_at:'2026-01-01', created_by:'SYSTEM' },
  { supplier_id:'SUP-003', supplier_code:'TOYO-PH', supplier_name:'Toyo Tires Philippines',  supplier_type:'TIRE', contact_person:'Rico Santos',  contact_number:'028883456', email_address:'rico@toyo.ph',        address:'Pasig City',  default_payment_terms_days:30, active_status:1, created_at:'2026-01-01', created_by:'SYSTEM' },
  { supplier_id:'SUP-004', supplier_code:'CONT-PH', supplier_name:'Continental Philippines', supplier_type:'TIRE', contact_person:'Diane Uy',     contact_number:'028884567', email_address:'diane@continental.ph', address:'Ortigas',    default_payment_terms_days:30, active_status:1, created_at:'2026-01-01', created_by:'SYSTEM' },
  { supplier_id:'SUP-005', supplier_code:'HANK-PH', supplier_name:'Hankook Philippines',     supplier_type:'TIRE', contact_person:'Mike Lim',     contact_number:'028885678', email_address:'mike@hankook.ph',     address:'Makati',      default_payment_terms_days:30, active_status:1, created_at:'2026-01-01', created_by:'SYSTEM' },
];

// ─── COMMISSION_RULES ─────────────────────────────────────────────────────────
const COMMISSION_RULES = [
  { rule_id:'CR-001', category:'PCR',        min_rim_size:0,  max_rim_size:16, valve_type:'', commission_amount:60,  is_active:1, created_at:'2026-01-01' },
  { rule_id:'CR-002', category:'SUV',        min_rim_size:17, max_rim_size:22, valve_type:'', commission_amount:100, is_active:1, created_at:'2026-01-01' },
  { rule_id:'CR-003', category:'TRUCK',      min_rim_size:17, max_rim_size:24, valve_type:'', commission_amount:100, is_active:1, created_at:'2026-01-01' },
  { rule_id:'CR-004', category:'MOTORCYCLE', min_rim_size:0,  max_rim_size:18, valve_type:'', commission_amount:60,  is_active:1, created_at:'2026-01-01' },
  { rule_id:'CR-005', category:'VALVE',      min_rim_size:0,  max_rim_size:0,  valve_type:'RUBBER', commission_amount:40, is_active:1, created_at:'2026-01-01' },
  { rule_id:'CR-006', category:'VALVE',      min_rim_size:0,  max_rim_size:0,  valve_type:'STEEL',  commission_amount:50, is_active:1, created_at:'2026-01-01' },
];

// ─── STAFF_ATTENDANCE ─────────────────────────────────────────────────────────
// STAFF-002 absent on 3 random weekdays, STAFF-006 absent on 2 random weekdays
const staff002AbsentDates = new Set(['2026-02-24', '2026-03-04', '2026-03-12']);
const staff006AbsentDates = new Set(['2026-02-26', '2026-03-10']);

const STAFF_ATTENDANCE = [];
for (const d of allDates) {
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const dateStr = fmtDate(d);
  const recordedAt = `${dateStr} 08:00:00`;

  for (const staff of STAFF_MASTER) {
    const sid = staff.staff_id;
    let present = true;

    if (dow === 0) {
      // Sunday: only STAFF-003, STAFF-004, STAFF-005
      present = ['STAFF-003', 'STAFF-004', 'STAFF-005'].includes(sid);
    } else {
      if (sid === 'STAFF-002' && staff002AbsentDates.has(dateStr)) present = false;
      if (sid === 'STAFF-006' && staff006AbsentDates.has(dateStr)) present = false;
    }

    const numStr = sid.replace('STAFF-', '');
    STAFF_ATTENDANCE.push({
      attendance_id: `ATT-STAFF${numStr}-${dateStr.replace(/-/g, '')}`,
      staff_id: sid,
      shop_id: 'SHOP-001',
      attendance_date: dateStr,
      status: present ? 'PRESENT' : 'ABSENT',
      recorded_at: recordedAt,
    });
  }
}

// ─── INVENTORY_LEDGER ─────────────────────────────────────────────────────────
const INVENTORY_LEDGER = [];

// Initial stock on 2026-02-19
for (const item of ITEM_MASTER) {
  const num = item.item_id.replace('ITEM-', '');
  INVENTORY_LEDGER.push({
    inventory_ledger_id: `INV-INIT-ITEM${num}`,
    shop_id: 'SHOP-001',
    item_id: item.item_id,
    transaction_type: 'PURCHASE',
    quantity: 50,
    unit_cost: item.unit_cost,
    reference_id: `PO-INIT-${item.item_id}`,
    created_by: 'SYSTEM',
    created_at: '2026-02-19 08:00:00',
  });
}

// Restock on 2026-03-05 for ITEM-001 to ITEM-011
for (const item of ITEM_MASTER.slice(0, 11)) {
  const num = item.item_id.replace('ITEM-', '');
  INVENTORY_LEDGER.push({
    inventory_ledger_id: `INV-RST-ITEM${num}`,
    shop_id: 'SHOP-001',
    item_id: item.item_id,
    transaction_type: 'PURCHASE',
    quantity: 20,
    unit_cost: item.unit_cost,
    reference_id: `PO-RST-${item.item_id}`,
    created_by: 'SYSTEM',
    created_at: '2026-03-05 09:00:00',
  });
}

// ─── SALE_HEADER ──────────────────────────────────────────────────────────────
// Define sale templates: [itemId or null, qty, svcIds, customerIdOrEmpty, staffId, tiremenIds, notes]
// We'll iterate over dates and generate sales programmatically.

const salesStaff    = ['STAFF-001', 'STAFF-002', 'STAFF-007'];
const tiremenPairs  = [['STAFF-003'], ['STAFF-004'], ['STAFF-003','STAFF-004'], ['STAFF-006'], ['STAFF-003','STAFF-006']];

// Item lookup
const itemMap = {};
for (const it of ITEM_MASTER) itemMap[it.item_id] = it;

// Build sale schedule per date
// Format: { date, salesDef[] }
// salesDef: { type: 'tire'|'service'|'mix', itemId, qty, svcIds, custId, staffIdx, tiremenIdx }

function makeSaleId(itemId, dateStr) {
  if (!itemId) return `SALE-SVC-${dateStr.replace(/-/g,'')}`;
  const it = itemMap[itemId];
  const brand = it.brand.toUpperCase().slice(0,4);
  const design = it.design.replace(/\s+/g,'').toUpperCase().slice(0,4);
  const size = it.size.replace(/[\/\.]/g,'');
  return `SALE-${brand}-${design}-${size}`;
}

// We'll store sales with a running counter for uniqueness
const SALE_HEADER = [];
let invNum = 201;
const saleIdCount = {};

function uniqueSaleId(base) {
  saleIdCount[base] = (saleIdCount[base] || 0) + 1;
  return saleIdCount[base] === 1 ? base : `${base}-${saleIdCount[base]}`;
}

// Define per-day plan: [{ itemId|null, qty, svcIds:[], custId, staffIdx, tiremenIdx, time }]
// Days: 2026-02-19 to 2026-03-21
const dayPlans = {};

function addSale(dateStr, itemId, qty, svcIds, custId, staffIdx, tiremenIdx, time) {
  if (!dayPlans[dateStr]) dayPlans[dateStr] = [];
  dayPlans[dateStr].push({ itemId, qty, svcIds, custId, staffIdx, tiremenIdx, time });
}

// ── 2026-02-19 (Thu)
addSale('2026-02-19', 'ITEM-001', 4, [],         'CUST-001', 0, 0, '09:30:00');
addSale('2026-02-19', 'ITEM-007', 4, ['SVC-001'], 'CUST-002', 1, 2, '14:00:00');
// ── 2026-02-20 (Fri)
addSale('2026-02-20', 'ITEM-002', 4, [],         '',         2, 1, '10:00:00');
addSale('2026-02-20', null,       0, ['SVC-001','SVC-004'], '', 0, 0, '15:00:00');
// ── 2026-02-21 (Sat)
addSale('2026-02-21', 'ITEM-003', 4, ['SVC-004'], 'CUST-003', 1, 3, '11:00:00');
// ── 2026-02-22 (Sat)
addSale('2026-02-22', 'ITEM-012', 2, [],         '',         2, 0, '10:30:00');
// ── 2026-02-24 (Mon)
addSale('2026-02-24', 'ITEM-004', 4, ['SVC-001'], 'CUST-004', 0, 1, '09:00:00');
addSale('2026-02-24', 'ITEM-008', 4, [],         'CUST-005', 1, 2, '14:30:00');
// ── 2026-02-25 (Tue)
addSale('2026-02-25', 'ITEM-005', 4, ['SVC-002'], '',         2, 0, '10:00:00');
addSale('2026-02-25', 'ITEM-015', 6, [],         'CUST-005', 0, 4, '15:00:00');
// ── 2026-02-26 (Wed)
addSale('2026-02-26', 'ITEM-006', 4, [],         '',         1, 1, '09:30:00');
addSale('2026-02-26', null,       0, ['SVC-003','SVC-004'], '', 2, 0, '13:00:00');
// ── 2026-02-27 (Thu)
addSale('2026-02-27', 'ITEM-009', 4, ['SVC-001'], 'CUST-007', 0, 2, '10:00:00');
addSale('2026-02-27', 'ITEM-013', 2, [],         '',         1, 0, '14:00:00');
// ── 2026-02-28 (Fri)
addSale('2026-02-28', 'ITEM-001', 4, ['SVC-004'], '',         2, 3, '09:00:00');
addSale('2026-02-28', 'ITEM-016', 8, [],         'CUST-010', 0, 4, '15:30:00');
// ── 2026-03-01 (Sat)
addSale('2026-03-01', 'ITEM-002', 4, [],         'CUST-006', 1, 1, '10:00:00');
// ── 2026-03-02 (Sun) - no sales
// ── 2026-03-03 (Mon)
addSale('2026-03-03', 'ITEM-010', 4, ['SVC-001'], '',         2, 2, '09:30:00');
addSale('2026-03-03', 'ITEM-014', 2, [],         'CUST-008', 0, 0, '13:00:00');
// ── 2026-03-04 (Tue)
addSale('2026-03-04', 'ITEM-003', 4, ['SVC-002'], '',         1, 1, '10:00:00');
addSale('2026-03-04', null,       0, ['SVC-001','SVC-003'], 'CUST-009', 2, 0, '14:00:00');
// ── 2026-03-05 (Wed)
addSale('2026-03-05', 'ITEM-007', 4, [],         'CUST-002', 0, 2, '09:00:00');
addSale('2026-03-05', 'ITEM-017', 6, [],         'CUST-003', 1, 4, '15:00:00');
// ── 2026-03-06 (Thu)
addSale('2026-03-06', 'ITEM-011', 4, ['SVC-001'], '',         2, 3, '10:30:00');
addSale('2026-03-06', 'ITEM-001', 4, ['SVC-004'], '',         0, 0, '14:30:00');
// ── 2026-03-07 (Fri)
addSale('2026-03-07', 'ITEM-005', 4, [],         'CUST-001', 1, 1, '09:00:00');
addSale('2026-03-07', null,       0, ['SVC-005','SVC-004'], '', 2, 0, '13:30:00');
// ── 2026-03-08 (Sat)
addSale('2026-03-08', 'ITEM-004', 4, ['SVC-001'], '',         0, 2, '10:00:00');
// ── 2026-03-09 (Sun) - no sales
// ── 2026-03-10 (Mon)
addSale('2026-03-10', 'ITEM-008', 4, [],         'CUST-007', 1, 4, '09:30:00');
addSale('2026-03-10', 'ITEM-015', 4, ['SVC-004'], 'CUST-005', 2, 2, '14:00:00');
// ── 2026-03-11 (Tue)
addSale('2026-03-11', 'ITEM-002', 4, ['SVC-002'], '',         0, 1, '10:00:00');
addSale('2026-03-11', 'ITEM-012', 2, [],         '',         1, 0, '15:00:00');
// ── 2026-03-12 (Wed)
addSale('2026-03-12', 'ITEM-006', 4, [],         'CUST-004', 2, 3, '09:00:00');
addSale('2026-03-12', 'ITEM-009', 4, ['SVC-001'], '',         0, 2, '14:00:00');
// ── 2026-03-13 (Thu)
addSale('2026-03-13', 'ITEM-016', 6, [],         'CUST-010', 1, 4, '10:00:00');
addSale('2026-03-13', null,       0, ['SVC-003','SVC-001'], '', 2, 0, '15:30:00');
// ── 2026-03-14 (Fri)
addSale('2026-03-14', 'ITEM-003', 4, ['SVC-004'], '',         0, 1, '09:30:00');
addSale('2026-03-14', 'ITEM-010', 4, [],         'CUST-009', 1, 2, '14:00:00');
// ── 2026-03-15 (Sat)
addSale('2026-03-15', 'ITEM-013', 2, [],         '',         2, 0, '10:30:00');
// ── 2026-03-16 (Sun) - no sales
// ── 2026-03-17 (Mon)
addSale('2026-03-17', 'ITEM-001', 4, ['SVC-001'], 'CUST-001', 0, 1, '09:00:00');
addSale('2026-03-17', 'ITEM-017', 4, [],         'CUST-003', 1, 4, '14:00:00');
// ── 2026-03-18 (Tue)
addSale('2026-03-18', 'ITEM-007', 4, ['SVC-002'], '',         2, 2, '10:00:00');
addSale('2026-03-18', null,       0, ['SVC-001','SVC-004'], 'CUST-006', 0, 0, '14:30:00');
// ── 2026-03-19 (Wed)
addSale('2026-03-19', 'ITEM-005', 4, [],         '',         1, 1, '09:30:00');
addSale('2026-03-19', 'ITEM-015', 6, [],         'CUST-005', 2, 3, '15:00:00');
// ── 2026-03-20 (Thu)
addSale('2026-03-20', 'ITEM-011', 4, ['SVC-001'], '',         0, 2, '10:00:00');
addSale('2026-03-20', 'ITEM-014', 2, [],         'CUST-008', 1, 0, '14:00:00');
// ── 2026-03-21 (Fri)
addSale('2026-03-21', 'ITEM-002', 4, ['SVC-004'], 'CUST-004', 2, 1, '09:30:00');
addSale('2026-03-21', 'ITEM-008', 4, [],         'CUST-007', 0, 4, '14:00:00');

// Now generate SALE_HEADER rows
const saleIndex = {}; // dateStr -> running idx for same-day dedup

for (const dateStr of Object.keys(dayPlans).sort()) {
  const plans = dayPlans[dateStr];
  for (const plan of plans) {
    const { itemId, qty, svcIds, custId, staffIdx, tiremenIdx, time } = plan;

    // Compute total
    let total = 0;
    if (itemId && qty > 0) {
      total += itemMap[itemId].selling_price * qty;
    }
    for (const svc of svcIds) {
      const svcObj = SERVICES_MASTER.find(s => s.service_id === svc);
      if (svcObj) total += svcObj.base_price;
    }

    const baseId = makeSaleId(itemId, dateStr.replace(/-/g,''));
    const saleId = uniqueSaleId(baseId);
    const invoiceNumber = `INV-2026-${pad(invNum++, 4)}`;
    const staffId = salesStaff[staffIdx % salesStaff.length];
    const tiremen = tiremenPairs[tiremenIdx % tiremenPairs.length];
    const tiremenJson = JSON.stringify(tiremen);

    SALE_HEADER.push({
      sale_id: saleId,
      shop_id: 'SHOP-001',
      sale_datetime: `${dateStr} ${time}`,
      staff_id: staffId,
      total_amount: total,
      payment_status: 'PAID',
      created_at: `${dateStr} ${time}`,
      created_by: staffId,
      tireman_ids: tiremenJson,
      customer_id: custId || '',
      sale_notes: itemId ? `Sale of ${itemMap[itemId].item_name}` : 'Service only',
      invoice_number: invoiceNumber,
    });
  }
}

// ─── SALE_ITEMS ───────────────────────────────────────────────────────────────
const SALE_ITEMS = [];
let saleItemIdx = 1;

// Rebuild from dayPlans (we already have SALE_HEADER built in same order)
let saleHeaderIdx = 0;
for (const dateStr of Object.keys(dayPlans).sort()) {
  for (const plan of dayPlans[dateStr]) {
    const { itemId, qty, svcIds, time } = plan;
    const saleRow = SALE_HEADER[saleHeaderIdx++];
    if (!saleRow) continue;
    const saleId = saleRow.sale_id;
    const createdAt = `${dateStr} ${time}`;

    // Product item
    if (itemId && qty > 0) {
      const it = itemMap[itemId];
      SALE_ITEMS.push({
        sale_item_id: `SITEM-${pad(saleItemIdx++, 4)}`,
        sale_id: saleId,
        item_or_service_id: itemId,
        item_name: it.item_name,
        sale_type: 'PRODUCT',
        quantity: qty,
        unit_price: it.selling_price,
        line_total: it.selling_price * qty,
        sku: it.sku,
        brand: it.brand,
        design: it.design,
        tire_size: it.size,
        category: it.category,
        valve_type: '',
        valve_quantity: 0,
        wheel_balancing: 0,
        balancing_quantity: 0,
        wheel_weights_qty: 0,
        commission_amount: 0,
        created_at: createdAt,
      });
    }

    // Service items
    for (const svcId of svcIds) {
      const svc = SERVICES_MASTER.find(s => s.service_id === svcId);
      if (!svc) continue;
      SALE_ITEMS.push({
        sale_item_id: `SITEM-${pad(saleItemIdx++, 4)}`,
        sale_id: saleId,
        item_or_service_id: svcId,
        item_name: svc.service_name,
        sale_type: 'SERVICE',
        quantity: 1,
        unit_price: svc.base_price,
        line_total: svc.base_price,
        sku: '',
        brand: '',
        design: '',
        tire_size: '',
        category: 'SERVICE',
        valve_type: '',
        valve_quantity: 0,
        wheel_balancing: 0,
        balancing_quantity: 0,
        wheel_weights_qty: 0,
        commission_amount: 0,
        created_at: createdAt,
      });
    }
  }
}

// Mark large sales as PARTIAL for receivables
// Truck sales for CUST-005, CUST-010, CUST-003 fleet
const arSaleIds = [];
for (const row of SALE_HEADER) {
  if (row.total_amount >= 60000 && ['CUST-005','CUST-010','CUST-003'].includes(row.customer_id)) {
    row.payment_status = 'PARTIAL';
    arSaleIds.push(row.sale_id);
  }
}
// Also mark a couple more for receivables variety
let arCount = 0;
for (const row of SALE_HEADER) {
  if (row.payment_status === 'PAID' && row.total_amount >= 28000 && row.customer_id && arCount < 3) {
    row.payment_status = 'PARTIAL';
    arSaleIds.push(row.sale_id);
    arCount++;
  }
}

// ─── ACCOUNTS_RECEIVABLE ──────────────────────────────────────────────────────
const ACCOUNTS_RECEIVABLE = [];
let arIdx = 1;
for (const saleId of arSaleIds.slice(0, 8)) {
  const sale = SALE_HEADER.find(s => s.sale_id === saleId);
  if (!sale) continue;
  const orig = sale.total_amount;
  const isLarge = orig >= 60000;
  const isClosed = arIdx <= 3; // first 3 are closed
  const amtPaid  = isClosed ? orig : (isLarge ? Math.round(orig * 0.5) : Math.round(orig * 0.3));
  const balance  = orig - amtPaid;
  const saleDate = sale.sale_datetime.slice(0, 10);
  // closed_at = 5 days after sale for closed ones
  const closedDate = isClosed ? (() => {
    const d = new Date(saleDate); d.setDate(d.getDate() + 5); return fmtDate(d);
  })() : null;

  if (isClosed) sale.payment_status = 'PAID'; // closed = fully paid

  ACCOUNTS_RECEIVABLE.push({
    receivable_id: `AR-${pad(arIdx, 3)}`,
    shop_id: 'SHOP-001',
    customer_id: sale.customer_id,
    sale_id: saleId,
    original_amount: orig,
    amount_paid: amtPaid,
    balance_amount: balance,
    status: isClosed ? 'CLOSED' : 'OPEN',
    created_at: `${saleDate} 18:00:00`,
    created_by: sale.staff_id,
    closed_at: isClosed ? `${closedDate} 10:00:00` : '',
  });
  arIdx++;
}

// ─── ACCOUNTS_PAYABLE ─────────────────────────────────────────────────────────
const ACCOUNTS_PAYABLE = [
  {
    payable_id: 'AP-001', shop_id: 'SHOP-001', supplier_id: 'SUP-001',
    reference_id: 'PO-INIT-BRDG-001', original_amount: 203000,
    amount_paid: 203000, balance_amount: 0, status: 'CLOSED',
    due_date: '2026-03-21', created_at: '2026-02-19 08:00:00', created_by: 'STAFF-001',
    closed_at: '2026-03-15 10:00:00',
  },
  {
    payable_id: 'AP-002', shop_id: 'SHOP-001', supplier_id: 'SUP-002',
    reference_id: 'PO-INIT-MICH-001', original_amount: 242000,
    amount_paid: 242000, balance_amount: 0, status: 'CLOSED',
    due_date: '2026-03-21', created_at: '2026-02-19 08:00:00', created_by: 'STAFF-001',
    closed_at: '2026-03-18 10:00:00',
  },
  {
    payable_id: 'AP-003', shop_id: 'SHOP-001', supplier_id: 'SUP-003',
    reference_id: 'PO-INIT-TOYO-001', original_amount: 211500,
    amount_paid: 100000, balance_amount: 111500, status: 'OPEN',
    due_date: '2026-03-21', created_at: '2026-02-19 08:00:00', created_by: 'STAFF-001',
    closed_at: '',
  },
  {
    payable_id: 'AP-004', shop_id: 'SHOP-001', supplier_id: 'SUP-001',
    reference_id: 'PO-RST-BRDG-001', original_amount: 148000,
    amount_paid: 0, balance_amount: 148000, status: 'OPEN',
    due_date: '2026-04-05', created_at: '2026-03-05 09:00:00', created_by: 'STAFF-001',
    closed_at: '',
  },
  {
    payable_id: 'AP-005', shop_id: 'SHOP-001', supplier_id: 'SUP-005',
    reference_id: 'PO-INIT-HANK-001', original_amount: 116000,
    amount_paid: 116000, balance_amount: 0, status: 'CLOSED',
    due_date: '2026-03-21', created_at: '2026-02-19 08:00:00', created_by: 'STAFF-001',
    closed_at: '2026-03-10 14:00:00',
  },
];

// ─── PAYMENT_LEDGER ───────────────────────────────────────────────────────────
const PAYMENT_LEDGER = [];
let pmtIdx = 1;

// Payments for closed receivables
for (const ar of ACCOUNTS_RECEIVABLE) {
  if (ar.status === 'CLOSED') {
    PAYMENT_LEDGER.push({
      payment_id: `PMT-${pad(pmtIdx++, 3)}`,
      shop_id: 'SHOP-001',
      reference_type: 'RECEIVABLE',
      reference_id: ar.receivable_id,
      payer_type: 'CUSTOMER',
      payer_id: ar.customer_id,
      payment_method: 'CASH',
      amount: ar.amount_paid,
      payment_date: ar.closed_at.slice(0, 10),
      recorded_by: 'STAFF-001',
      created_at: ar.closed_at,
    });
  } else if (ar.amount_paid > 0) {
    // partial payment
    const payDate = ar.created_at.slice(0, 10);
    PAYMENT_LEDGER.push({
      payment_id: `PMT-${pad(pmtIdx++, 3)}`,
      shop_id: 'SHOP-001',
      reference_type: 'RECEIVABLE',
      reference_id: ar.receivable_id,
      payer_type: 'CUSTOMER',
      payer_id: ar.customer_id,
      payment_method: 'CASH',
      amount: ar.amount_paid,
      payment_date: payDate,
      recorded_by: 'STAFF-001',
      created_at: `${payDate} 18:00:00`,
    });
  }
}

// Payments for closed payables
for (const ap of ACCOUNTS_PAYABLE) {
  if (ap.status === 'CLOSED') {
    PAYMENT_LEDGER.push({
      payment_id: `PMT-${pad(pmtIdx++, 3)}`,
      shop_id: 'SHOP-001',
      reference_type: 'PAYABLE',
      reference_id: ap.payable_id,
      payer_type: 'SHOP',
      payer_id: 'SHOP-001',
      payment_method: 'BANK_TRANSFER',
      amount: ap.amount_paid,
      payment_date: ap.closed_at.slice(0, 10),
      recorded_by: 'STAFF-001',
      created_at: ap.closed_at,
    });
  } else if (ap.amount_paid > 0) {
    const payDate = ap.created_at.slice(0, 10);
    PAYMENT_LEDGER.push({
      payment_id: `PMT-${pad(pmtIdx++, 3)}`,
      shop_id: 'SHOP-001',
      reference_type: 'PAYABLE',
      reference_id: ap.payable_id,
      payer_type: 'SHOP',
      payer_id: 'SHOP-001',
      payment_method: 'BANK_TRANSFER',
      amount: ap.amount_paid,
      payment_date: payDate,
      recorded_by: 'STAFF-001',
      created_at: `${payDate} 10:00:00`,
    });
  }
}

// ─── SALES_LEDGER ─────────────────────────────────────────────────────────────
// Mirror of sale_header — one ledger row per sale
const SALES_LEDGER = SALE_HEADER.map(s => ({
  sales_ledger_id: `SL-${s.sale_id}`,
  sale_id:         s.sale_id,
  shop_id:         s.shop_id,
  staff_id:        s.staff_id,
  sale_datetime:   s.sale_datetime,
  total_amount:    s.total_amount,
  payment_status:  s.payment_status,
  created_at:      s.sale_datetime,
  created_by:      s.created_by,
}));

// ─── RECAP_JOB_MASTER ─────────────────────────────────────────────────────────
// Retreading / recapping jobs — mix of INTAKE, IN_PROCESS, READY, CLAIMED, FORFEITED
const recapStatuses = ['INTAKE','IN_PROCESS','READY','CLAIMED','CLAIMED','CLAIMED','FORFEITED'];
const recapCasings = [
  '11R22.5 used casing — good sidewall',
  '265/65R17 casing — minor tread wear',
  '295/80R22.5 casing — moderate wear',
  '235/65R17 casing — good condition',
  '11R22.5 casing — heavy wear outer edge',
  '265/60R18 casing — excellent body',
  '185/70R14 casing — standard wear',
  '205/55R16 casing — slight bead damage',
];
const RECAP_JOB_MASTER = [];
const RECAP_JOB_LEDGER = [];

const recapDefs = [
  { id:'RJM-001', custId:'CUST-005', srcItem:'ITEM-015', status:'CLAIMED',    intake:'2026-02-20', ret:'2026-03-01', claim:'2026-03-15', cost:3500, esp:7000, casing:recapCasings[0], supId:'SUP-001' },
  { id:'RJM-002', custId:'CUST-007', srcItem:'ITEM-007', status:'CLAIMED',    intake:'2026-02-22', ret:'2026-03-03', claim:'2026-03-17', cost:2800, esp:5500, casing:recapCasings[1], supId:'SUP-002' },
  { id:'RJM-003', custId:'CUST-010', srcItem:'ITEM-016', status:'CLAIMED',    intake:'2026-02-25', ret:'2026-03-07', claim:'2026-03-21', cost:4200, esp:9000, casing:recapCasings[2], supId:'SUP-002' },
  { id:'RJM-004', custId:'CUST-003', srcItem:'ITEM-008', status:'READY',      intake:'2026-03-03', ret:'2026-03-14', claim:'2026-03-28', cost:2900, esp:5800, casing:recapCasings[3], supId:'SUP-003' },
  { id:'RJM-005', custId:'CUST-005', srcItem:'ITEM-017', status:'IN_PROCESS', intake:'2026-03-08', ret:'2026-03-22', claim:'2026-04-05', cost:3800, esp:8000, casing:recapCasings[4], supId:'SUP-001' },
  { id:'RJM-006', custId:'CUST-009', srcItem:'ITEM-009', status:'IN_PROCESS', intake:'2026-03-10', ret:'2026-03-24', claim:'2026-04-07', cost:2600, esp:5200, casing:recapCasings[5], supId:'SUP-003' },
  { id:'RJM-007', custId:'CUST-004', srcItem:'ITEM-001', status:'INTAKE',     intake:'2026-03-17', ret:'2026-03-31', claim:'2026-04-14', cost:1800, esp:3800, casing:recapCasings[6], supId:'SUP-001' },
  { id:'RJM-008', custId:'CUST-006', srcItem:'ITEM-003', status:'FORFEITED',  intake:'2026-02-19', ret:'2026-03-01', claim:'2026-03-08', cost:2200, esp:4800, casing:recapCasings[7], supId:'SUP-002' },
];

// Status → sequence of ledger events
const statusFlow = {
  INTAKE:      [{ ev:'INTAKE',      prev:null,         next:'INTAKE' }],
  IN_PROCESS:  [{ ev:'INTAKE',      prev:null,         next:'INTAKE' }, { ev:'STATUS_CHANGE', prev:'INTAKE',      next:'IN_PROCESS' }],
  READY:       [{ ev:'INTAKE',      prev:null,         next:'INTAKE' }, { ev:'STATUS_CHANGE', prev:'INTAKE',      next:'IN_PROCESS' }, { ev:'STATUS_CHANGE', prev:'IN_PROCESS', next:'READY' }],
  CLAIMED:     [{ ev:'INTAKE',      prev:null,         next:'INTAKE' }, { ev:'STATUS_CHANGE', prev:'INTAKE',      next:'IN_PROCESS' }, { ev:'STATUS_CHANGE', prev:'IN_PROCESS', next:'READY' }, { ev:'CLAIMED', prev:'READY', next:'CLAIMED' }],
  FORFEITED:   [{ ev:'INTAKE',      prev:null,         next:'INTAKE' }, { ev:'STATUS_CHANGE', prev:'INTAKE',      next:'IN_PROCESS' }, { ev:'FORFEITED',     prev:'IN_PROCESS', next:'FORFEITED' }],
};

let rjlIdx = 1;
for (const r of recapDefs) {
  const isClosed = ['CLAIMED','FORFEITED'].includes(r.status);
  RECAP_JOB_MASTER.push({
    recap_job_id:           r.id,
    shop_id:                'SHOP-001',
    ownership_type:         'CUSTOMER',
    customer_id:            r.custId,
    source_item_id:         r.srcItem,
    finished_item_id:       r.status === 'CLAIMED' ? r.srcItem : '',
    casing_description:     r.casing,
    intake_date:            r.intake,
    supplier_id:            r.supId,
    recap_cost:             r.cost,
    expected_selling_price: r.esp,
    current_status:         r.status,
    return_date:            r.ret,
    claim_deadline_date:    r.claim,
    forfeited_flag:         r.status === 'FORFEITED' ? 1 : 0,
    forfeited_date:         r.status === 'FORFEITED' ? r.claim : '',
    forfeited_by_staff_id:  r.status === 'FORFEITED' ? 'STAFF-001' : '',
    forfeiture_reason:      r.status === 'FORFEITED' ? 'Customer did not claim within deadline' : '',
    related_sale_id:        '',
    created_at:             `${r.intake} 08:00:00`,
    created_by:             'STAFF-001',
    closed_at:              isClosed ? `${r.ret} 17:00:00` : '',
  });

  // Ledger events
  const events = statusFlow[r.status] || statusFlow['INTAKE'];
  const intakeDate = new Date(r.intake);
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const evDate = new Date(intakeDate);
    evDate.setDate(evDate.getDate() + i * 5);
    RECAP_JOB_LEDGER.push({
      recap_job_ledger_id:          `RJL-${pad(rjlIdx++, 4)}`,
      recap_job_id:                 r.id,
      shop_id:                      'SHOP-001',
      event_type:                   ev.ev,
      previous_status:              ev.prev || '',
      new_status:                   ev.next,
      ownership_before:             'CUSTOMER',
      ownership_after:              'CUSTOMER',
      event_reason:                 ev.ev === 'FORFEITED' ? 'No claim within deadline' : ev.ev === 'CLAIMED' ? 'Customer claimed tire' : '',
      related_inventory_ledger_id:  '',
      related_sale_id:              '',
      performed_by_staff_id:        'STAFF-001',
      performer_role:               'owner',
      event_timestamp:              `${fmtDate(evDate)} ${['08:30:00','10:00:00','14:00:00','16:00:00'][i % 4]}`,
      system_note:                  `${ev.ev} event recorded`,
    });
  }
}

// ─── BUILD WORKBOOK ───────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SHOP_MASTER),       'SHOP_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(STAFF_MASTER),      'STAFF_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ITEM_MASTER),       'ITEM_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SERVICES_MASTER),   'SERVICES_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(CUSTOMER_MASTER),   'CUSTOMER_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SUPPLIER_MASTER),   'SUPPLIER_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(COMMISSION_RULES),  'COMMISSION_RULES');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(STAFF_ATTENDANCE),  'STAFF_ATTENDANCE');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(INVENTORY_LEDGER),  'INVENTORY_LEDGER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SALE_HEADER),       'SALE_HEADER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SALE_ITEMS),        'SALE_ITEMS');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(SALES_LEDGER),      'SALES_LEDGER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(RECAP_JOB_MASTER),  'RECAP_JOB_MASTER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(RECAP_JOB_LEDGER),  'RECAP_JOB_LEDGER');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ACCOUNTS_RECEIVABLE),'ACCOUNTS_RECEIVABLE');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ACCOUNTS_PAYABLE),  'ACCOUNTS_PAYABLE');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(PAYMENT_LEDGER),    'PAYMENT_LEDGER');

XLSX.writeFile(wb, 'System_test.xlsx');

console.log('Done! System_test.xlsx generated.');
console.log(`  SHOP_MASTER:          ${SHOP_MASTER.length} rows`);
console.log(`  STAFF_MASTER:         ${STAFF_MASTER.length} rows`);
console.log(`  ITEM_MASTER:          ${ITEM_MASTER.length} rows`);
console.log(`  SERVICES_MASTER:      ${SERVICES_MASTER.length} rows`);
console.log(`  CUSTOMER_MASTER:      ${CUSTOMER_MASTER.length} rows`);
console.log(`  SUPPLIER_MASTER:      ${SUPPLIER_MASTER.length} rows`);
console.log(`  COMMISSION_RULES:     ${COMMISSION_RULES.length} rows`);
console.log(`  STAFF_ATTENDANCE:     ${STAFF_ATTENDANCE.length} rows`);
console.log(`  INVENTORY_LEDGER:     ${INVENTORY_LEDGER.length} rows`);
console.log(`  SALE_HEADER:          ${SALE_HEADER.length} rows`);
console.log(`  SALE_ITEMS:           ${SALE_ITEMS.length} rows`);
console.log(`  SALES_LEDGER:         ${SALES_LEDGER.length} rows`);
console.log(`  RECAP_JOB_MASTER:     ${RECAP_JOB_MASTER.length} rows`);
console.log(`  RECAP_JOB_LEDGER:     ${RECAP_JOB_LEDGER.length} rows`);
console.log(`  ACCOUNTS_RECEIVABLE:  ${ACCOUNTS_RECEIVABLE.length} rows`);
console.log(`  ACCOUNTS_PAYABLE:     ${ACCOUNTS_PAYABLE.length} rows`);
console.log(`  PAYMENT_LEDGER:       ${PAYMENT_LEDGER.length} rows`);
