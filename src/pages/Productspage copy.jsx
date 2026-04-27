import React from "react";
import { API_URL, apiFetch, currency } from "../lib/config";
import DataTable from "../components/DataTable";
import SearchInput from "../components/SearchInput";
import KpiCard from "../components/KpiCard";
import ItemHistoryModal from "../components/ItemHistoryModal";

/* ============================================================
   TIREHUB — PRODUCTS PAGE
   Fetches:
     GET  /api/items/:shop_id               — list all items with stock
     POST /api/items                        — create item
     PUT  /api/items/:item_id/selling-price — update price
     PUT  /api/items/:item_id/unit-cost     — update cost
     POST /api/inventory/adjustment         — adjust stock
     GET  /api/inventory-ledger/:shop_id?item_id=  — item history
   ============================================================ */

function prodCurrency(n) {
  try {
    return currency(n);
  } catch {
    return `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

const PAGE_SIZE = 10;

const DEFAULT_TIRE_CATS = [
  "PCR",
  "SUV",
  "TBR",
  "LT",
  "MOTORCYCLE",
  "TUBE",
  "RECAP",
];
const DEFAULT_OTHER_CATS = [
  "VALVE",
  "WHEEL WEIGHT",
  "WHEEL BALANCING",
  "ACCESSORIES",
  "OTHER",
];
const PROD_LS = { tire: "pur-cats-tire-v3", other: "pur-cats-other" };
function prodLoadCats(key, defaults) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : [...defaults];
  } catch {
    return [...defaults];
  }
}
function prodSaveCats(key, cats) {
  try {
    localStorage.setItem(key, JSON.stringify(cats));
  } catch { }
}

function buildSKU(form) {
  if (!form.itemType) return "";
  const parts = [];
  if (form.brand) parts.push(form.brand.trim().substring(0, 5).toUpperCase());
  if (form.design) parts.push(form.design.trim().substring(0, 4).toUpperCase());
  if (form.size) parts.push(form.size.trim().replace(/[\/ \-]/g, ""));
  if (parts.length === 0) return "";
  return (form.itemType === "TIRE" ? "TIRE" : "ITEM") + "-" + parts.join("-");
}
function extractRimSize(s) {
  if (!s) return null;
  const r = s.match(/R(\d+)/i);
  if (r) return parseInt(r[1]);
  const d = s.match(/-(\d+)$/);
  if (d) return parseInt(d[1]);
  return null;
}
function generateSKU(brand, design, size) {
  if (!brand && !design && !size) return "";
  const b = (brand || "").trim().substring(0, 5).toUpperCase();
  const d = (design || "").trim().substring(0, 4).toUpperCase();
  const s = (size || "").trim().replace(/[\/\-]/g, "");
  return [b, d, s].filter(Boolean).join("-");
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function Productspage({ shopId }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [catFilter, setCatFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);

  // Suppliers
  const [suppliers, setSuppliers] = React.useState([]);

  // Form state
  const [formOpen, setFormOpen] = React.useState(false);
  const [itemType, setItemType] = React.useState("TIRE");
  const [form, setForm] = React.useState({
    sku: "",
    item_name: "",
    category: "TIRE",
    brand: "",
    design: "",
    size: "",
    rim_size: "",
    dot_number: "",
    unit_cost: "",
    selling_price: "",
    quantity: "",
    reorder_point: "5",
    supplier_id: "",
    newCategory: "",
  });
  const [tireCats, setTireCats] = React.useState(() =>
    prodLoadCats(PROD_LS.tire, DEFAULT_TIRE_CATS),
  );
  const [otherCats, setOtherCats] = React.useState(() =>
    prodLoadCats(PROD_LS.other, DEFAULT_OTHER_CATS),
  );
  const [saving, setSaving] = React.useState(false);
  const [pending, setPending] = React.useState(null);
  const [pendingAdj, setPendingAdj] = React.useState(null);

  // Detail panel
  const [selected, setSelected] = React.useState(null);
  const [history, setHistory] = React.useState([]);
  const [histLoading, setHistLoading] = React.useState(false);
  const [priceHistory, setPriceHistory] = React.useState([]);
  const [priceHistLoading, setPriceHistLoading] = React.useState(false);
  const [detailTab, setDetailTab] = React.useState("transactions");
  const [adjQty, setAdjQty] = React.useState("");

  // Archive
  const [showArchived, setShowArchived] = React.useState(false);
  const [archivedItems, setArchivedItems] = React.useState([]);
  const [archiveLoading, setArchiveLoading] = React.useState(false);
  const [adjSaving, setAdjSaving] = React.useState(false);

  // Inline editing
  const [editCell, setEditCell] = React.useState(null); // { item_id, field }
  const [editVal, setEditVal] = React.useState("");

  // Toast
  const [toasts, setToasts] = React.useState([]);

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute(
        "data-theme",
        (() => {
          try {
            return localStorage.getItem("th-theme") || "dark";
          } catch {
            return "dark";
          }
        })(),
      );
    }
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    fetchItems();
    fetchArchivedItems();
    fetchSuppliers();
    return () => obs.disconnect();
  }, [shopId]);

  async function fetchSuppliers() {
    try {
      const qs = shopId ? `?shop_id=${encodeURIComponent(shopId)}` : "";
      const r = await apiFetch(`${API_URL}/suppliers${qs}`);
      setSuppliers((await r.json()) || []);
    } catch (err) {
      console.error("fetchSuppliers failed:", err);
    }
  }

  function toast(msg, type = "success") {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  async function fetchItems() {
    setLoading(true);
    try {
      const data = await apiFetch(`${API_URL}/items/${shopId}`).then((r) =>
        r.json(),
      );
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }

  async function fetchArchivedItems() {
    setArchiveLoading(true);
    try {
      const data = await apiFetch(`${API_URL}/items-archived/${shopId}`).then(
        (r) => r.json(),
      );
      setArchivedItems(Array.isArray(data) ? data : []);
    } catch {
      setArchivedItems([]);
    }
    setArchiveLoading(false);
  }

  async function archiveItem(item) {
    try {
      await apiFetch(`${API_URL}/items/${item.item_id}/archive`, {
        method: "PUT",
      });
      toast(`"${item.item_name}" archived`);
      fetchItems();
      fetchArchivedItems();
      if (selected?.item_id === item.item_id) setSelected(null);
    } catch {
      toast("Failed to archive item", "error");
    }
  }

  async function restoreItem(item) {
    try {
      await apiFetch(`${API_URL}/items/${item.item_id}/restore`, {
        method: "PUT",
      });
      toast(`"${item.item_name}" restored`);
      fetchItems();
      fetchArchivedItems();
    } catch {
      toast("Failed to restore item", "error");
    }
  }

  /* ── Derived ── */
  const allCats = [
    "ALL",
    ...Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
  ];

  const filtered = items
    .filter((i) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (i.item_name || "").toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.brand || "").toLowerCase().includes(q) ||
        (i.size || "").toLowerCase().includes(q);
      const matchCat = catFilter === "ALL" || i.category === catFilter;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      // Low stock first
      const aq = a.current_quantity ?? 999999,
        bq = b.current_quantity ?? 999999;
      if (aq !== bq) return aq - bq;
      return (a.item_name || "").localeCompare(b.item_name || "");
    });

  React.useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const seen = new Set();
    const sugs = [];
    const add = (text, type, icon) => {
      const key = type + ":" + text;
      if (!seen.has(key) && text.toLowerCase().includes(q)) {
        seen.add(key);
        sugs.push({ text, type, icon });
      }
    };
    for (const i of items) {
      add(i.item_name || "", "Item", "📦");
      add(i.brand || "", "Brand", "🏷️");
      add(i.design || "", "Design", "🎨");
      add(i.size || "", "Size", "📏");
      add(i.sku || "", "SKU", "🔢");
      add(i.category || "", "Category", "🗂️");
    }
    setSuggestions(sugs.slice(0, 10));
  }, [search, items]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Form ── */
  function setField(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (!next.sku || next.sku === buildSKU({ ...f, itemType })) {
        next.sku = buildSKU({ ...next, itemType });
      }
      return next;
    });
  }
  function switchItemType(t) {
    setItemType(t);
    setForm((f) => ({
      ...f,
      category: t === "TIRE" ? "TIRE" : "OTHER",
      sku: buildSKU({ ...f, itemType: t }),
    }));
  }

  async function handleAddItem() {
    const isTire = itemType === "TIRE";
    const autoItemName = isTire
      ? [form.brand, form.design, form.size].filter(Boolean).join(" ")
      : form.item_name;
    if (isTire && (!form.brand || !form.design || !form.size)) {
      toast("Brand, Design, and Size are required for tire items.", "error");
      return;
    }
    if (!isTire && !form.item_name) {
      toast("Item name is required.", "error");
      return;
    }
    if (!form.category) {
      toast("Category is required.", "error");
      return;
    }
    if (!form.unit_cost || !form.selling_price) {
      toast("Unit Cost and Selling Price are required.", "error");
      return;
    }
    if (isTire && !form.dot_number.trim()) {
      toast("DOT number is required for tire items.", "error");
      return;
    }
    const autoSku = isTire
      ? generateSKU(form.brand, form.design, form.size)
      : `${(form.item_name || "").toUpperCase().replace(/\s+/g, "-")}-${(form.category || "").toUpperCase()}`;
    const dup = items.find((i) => i.sku === autoSku);
    if (dup) {
      toast(`SKU "${autoSku}" already exists: ${dup.item_name}`, "error");
      return;
    }
    // Show confirmation modal
    setPending({
      sku: autoSku,
      item_name: autoItemName,
      category: form.category,
      brand: form.brand || null,
      design: form.design || null,
      size: form.size || null,
      rim_size: isTire
        ? extractRimSize(form.size)
        : form.rim_size
          ? parseFloat(form.rim_size)
          : null,
      unit_cost: parseFloat(form.unit_cost),
      selling_price: parseFloat(form.selling_price),
      reorder_point: parseInt(form.reorder_point) || 5,
      quantity: form.quantity,
      supplier_id: form.supplier_id,
      dot_number: form.dot_number.trim() || null,
    });
  }

  async function confirmAddItem() {
    const payload = pending;
    setPending(null);
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) {
        toast(data.error, "error");
      } else {
        // Create initial stock entry if qty provided
        if (payload.quantity && parseInt(payload.quantity) > 0) {
          try {
            await apiFetch(`${API_URL}/inventory/purchase`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                shop_id: shopId,
                item_id: data.item_id,
                quantity: parseInt(payload.quantity),
                unit_cost: payload.unit_cost,
                supplier_id: payload.supplier_id || null,
                created_by: "PRODUCTS",
              }),
            });
          } catch { }
        }
        toast("Product added successfully!");
        setForm({
          sku: "",
          item_name: "",
          category: itemType === "TIRE" ? "TIRE" : "OTHER",
          brand: "",
          design: "",
          size: "",
          rim_size: "",
          dot_number: "",
          unit_cost: "",
          selling_price: "",
          quantity: "",
          reorder_point: "5",
          supplier_id: "",
          newCategory: "",
        });
        setFormOpen(false);
        fetchItems();
      }
    } catch {
      toast("Failed to save product.", "error");
    }
    setSaving(false);
  }

  /* ── Inline edit ── */
  function startEdit(e, item, field) {
    e.stopPropagation();
    setEditCell({ item_id: item.item_id, field });
    setEditVal(field === "selling_price" ? item.selling_price : item.unit_cost);
  }
  async function commitEdit(item) {
    if (!editCell) return;
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) {
      toast("Invalid value", "error");
      setEditCell(null);
      return;
    }
    const endpoint =
      editCell.field === "selling_price"
        ? `items/${item.item_id}/selling-price`
        : `items/${item.item_id}/unit-cost`;
    const body =
      editCell.field === "selling_price"
        ? { selling_price: val }
        : { unit_cost: val };
    try {
      const res = await apiFetch(`${API_URL}/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else {
        toast("Updated!");
        fetchItems();
        if (selected?.item_id === item.item_id) {
          if (editCell.field === "unit_cost" && data.selling_price != null)
            setSelected((s) => ({
              ...s,
              unit_cost: val,
              selling_price: data.selling_price,
            }));
          else setSelected((s) => ({ ...s, [editCell.field]: val }));
        }
      }
    } catch {
      toast("Failed to update.", "error");
    }
    setEditCell(null);
  }

  /* ── Detail panel ── */
  async function openDetail(item) {
    setSelected(item);
    setAdjQty("");
    setDetailTab("transactions");
    setHistLoading(true);
    setPriceHistLoading(true);
    try {
      const data = await apiFetch(
        `${API_URL}/inventory-ledger/${shopId}?item_id=${item.item_id}&page=1&perPage=100`,
      ).then((r) => r.json());
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setHistory(rows);
    } catch {
      setHistory([]);
    }
    setHistLoading(false);
    try {
      const data = await apiFetch(
        `${API_URL}/item-price-history/${item.item_id}`,
      ).then((r) => r.json());
      setPriceHistory(Array.isArray(data) ? data : []);
    } catch {
      setPriceHistory([]);
    }
    setPriceHistLoading(false);
  }

  function handleAdjust() {
    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty === 0) {
      toast("Enter a non-zero quantity (+/-).", "error");
      return;
    }
    setPendingAdj({ qty, item: selected });
  }

  async function confirmAdjust() {
    const { qty, item } = pendingAdj;
    setPendingAdj(null);
    setAdjSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/inventory/adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          item_id: item.item_id,
          quantity: qty,
          created_by: "PRODUCTS_PAGE",
        }),
      });
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else {
        toast(`Stock adjusted by ${qty > 0 ? "+" : ""}${qty}`);
        setAdjQty("");
        fetchItems();
        const updated = await apiFetch(
          `${API_URL}/inventory-ledger/${shopId}?item_id=${item.item_id}&page=1&perPage=20`,
        ).then((r) => r.json());
        const rows = Array.isArray(updated?.data) ? updated.data : (Array.isArray(updated) ? updated : []);
        setHistory(rows.slice(0, 20));
        setSelected((s) => ({
          ...s,
          current_quantity: (s.current_quantity || 0) + qty,
        }));
      }
    } catch {
      toast("Failed to adjust stock.", "error");
    }
    setAdjSaving(false);
  }

  function stockClass(qty) {
    if (qty <= 0) return "out";
    if (qty <= 2) return "critical";
    if (qty <= 3) return "low";
    return "ok";
  }

  const pencilIcon = (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  const archivedColumns = [
    {
      key: "sku",
      label: "SKU",
      render: (item) => (
        <>
          <span className="prod-td-sku" title={item.sku}>
            {item.sku}
          </span>
          <span className="prod-archived-badge">Archived</span>
        </>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (item) => (
        <span
          style={{
            background: "var(--th-orange-bg)",
            color: "var(--th-orange)",
            padding: "0.15rem 0.45rem",
            borderRadius: 4,
            fontSize: "0.72rem",
            fontFamily: "'Barlow Condensed',sans-serif",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {item.category}
        </span>
      ),
    },
    {
      key: "brand",
      label: "Brand",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.brand || "—"}</span>
      ),
    },
    {
      key: "design",
      label: "Design",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.design || "—"}</span>
      ),
    },
    {
      key: "size",
      label: "Size",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.size || "—"}</span>
      ),
    },
    {
      key: "dot_number",
      label: "DOT",
      render: (item) =>
        item.dot_number ? (
          <span
            style={{
              background: "var(--th-amber-bg)",
              color: "var(--th-amber)",
              padding: "0.15rem 0.45rem",
              borderRadius: 4,
              fontSize: "0.72rem",
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {item.dot_number}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "unit_cost",
      label: "Cost",
      align: "right",
      render: (item) => (
        <span style={{ fontSize: "0.85rem" }}>
          {prodCurrency(item.unit_cost)}
        </span>
      ),
    },
    {
      key: "selling_price",
      label: "Price",
      align: "right",
      render: (item) => (
        <span
          style={{
            fontWeight: 600,
            color: "var(--th-emerald)",
            fontSize: "0.85rem",
          }}
        >
          {prodCurrency(item.selling_price)}
        </span>
      ),
    },
    {
      key: "_restore",
      label: "",
      render: (item) => (
        <button
          className="prod-btn-restore"
          onClick={(e) => {
            e.stopPropagation();
            restoreItem(item);
          }}
        >
          Restore
        </button>
      ),
    },
  ];

  const prodColumns = [
    {
      key: "sku",
      label: "SKU",
      render: (item) => (
        <span className="prod-td-sku" title={item.sku}>
          {item.sku}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (item) => (
        <span
          style={{
            background: "var(--th-orange-bg)",
            color: "var(--th-orange)",
            padding: "0.15rem 0.45rem",
            borderRadius: 4,
            fontSize: "0.72rem",
            fontFamily: "'Barlow Condensed',sans-serif",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {item.category}
        </span>
      ),
    },
    {
      key: "brand",
      label: "Brand",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.brand || "—"}</span>
      ),
    },
    {
      key: "design",
      label: "Design",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.design || "—"}</span>
      ),
    },
    {
      key: "size",
      label: "Size",
      render: (item) => (
        <span style={{ fontSize: "0.82rem" }}>{item.size || "—"}</span>
      ),
    },
    {
      key: "dot_number",
      label: "DOT",
      render: (item) =>
        item.dot_number ? (
          <span
            style={{
              background: "var(--th-amber-bg)",
              color: "var(--th-amber)",
              padding: "0.15rem 0.45rem",
              borderRadius: 4,
              fontSize: "0.72rem",
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {item.dot_number}
          </span>
        ) : item.parent_item_id ? (
          "—"
        ) : (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--th-text-faint)",
              fontFamily: "'Barlow Condensed',sans-serif",
            }}
          >
            —
          </span>
        ),
    },
    {
      key: "current_quantity",
      label: "Stock",
      align: "right",
      render: (item) => (
        <span
          className={`prod-stock-badge ${stockClass(item.current_quantity)}`}
        >
          {item.current_quantity ?? 0}
        </span>
      ),
    },
    {
      key: "unit_cost",
      label: "Cost",
      align: "right",
      render: (item) => {
        const isEditCost =
          editCell?.item_id === item.item_id && editCell?.field === "unit_cost";
        return (
          <div
            className="prod-inline-edit"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditCost ? (
              <input
                autoFocus
                className="prod-inline-input"
                type="number"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit(item);
                  if (e.key === "Escape") setEditCell(null);
                }}
              />
            ) : (
              <>
                <span style={{ fontSize: "0.85rem" }}>
                  {prodCurrency(item.unit_cost)}
                </span>
                <button
                  className="prod-pencil-btn"
                  title="Edit cost"
                  onClick={(e) => startEdit(e, item, "unit_cost")}
                >
                  {pencilIcon}
                </button>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: "selling_price",
      label: "Price",
      align: "right",
      render: (item) => {
        const isEditPrice =
          editCell?.item_id === item.item_id &&
          editCell?.field === "selling_price";
        return (
          <div
            className="prod-inline-edit"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditPrice ? (
              <input
                autoFocus
                className="prod-inline-input"
                type="number"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit(item);
                  if (e.key === "Escape") setEditCell(null);
                }}
              />
            ) : (
              <>
                <span style={{ fontWeight: 600, color: "var(--th-emerald)" }}>
                  {prodCurrency(item.selling_price)}
                </span>
                <button
                  className="prod-pencil-btn"
                  title="Edit price"
                  onClick={(e) => startEdit(e, item, "selling_price")}
                >
                  {pencilIcon}
                </button>
              </>
            )}
          </div>
        );
      },
    },
    {
      key: "_margin",
      label: "Margin",
      align: "right",
      render: (item) => {
        const margin =
          item.selling_price > 0
            ? ((item.selling_price - item.unit_cost) / item.selling_price) * 100
            : 0;
        return (
          <span
            style={{
              color:
                margin >= 20
                  ? "var(--th-emerald)"
                  : margin >= 10
                    ? "var(--th-amber)"
                    : "var(--th-rose)",
              fontFamily: "'Barlow Condensed',sans-serif",
              fontWeight: 700,
            }}
          >
            {margin.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="prod-root">
      {/* Header */}
      <div className="prod-header">
        <div className="prod-title">
          Product <span>Management</span>
        </div>
        <button className="prod-btn-primary" onClick={() => setFormOpen(true)}>
          + Add Product
        </button>
      </div>

      {/* Add Product Modal */}
      {formOpen && (
        <div
          className="prod-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFormOpen(false);
          }}
        >
          <div className="prod-modal-box">
            <div className="prod-modal-header">
              <div className="prod-modal-title">Add New Product</div>
              <button
                className="prod-modal-close"
                onClick={() => setFormOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Item Type Toggle */}
            <div
              style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
            >
              <button
                onClick={() => switchItemType("TIRE")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 1rem",
                  borderRadius: 6,
                  border:
                    itemType === "TIRE"
                      ? "2px solid var(--th-orange)"
                      : "1px solid var(--th-border-strong)",
                  background:
                    itemType === "TIRE" ? "var(--th-orange)" : "transparent",
                  color: itemType === "TIRE" ? "#fff" : "var(--th-text-muted)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                🛞 Tire
              </button>
              <button
                onClick={() => switchItemType("OTHER")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 1rem",
                  borderRadius: 6,
                  border:
                    itemType === "OTHER"
                      ? "2px solid var(--th-orange)"
                      : "1px solid var(--th-border-strong)",
                  background:
                    itemType === "OTHER" ? "var(--th-orange)" : "transparent",
                  color: itemType === "OTHER" ? "#fff" : "var(--th-text-muted)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                📦 Other
              </button>
            </div>

            {/* Row 1: main fields */}
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              {itemType === "TIRE" ? (
                <>
                  <div style={{ flex: "1 1 120px", minWidth: 100 }}>
                    <div
                      className="prod-label"
                      style={{ marginBottom: "0.3rem" }}
                    >
                      Brand <span style={{ color: "var(--th-orange)" }}>*</span>
                    </div>
                    <input
                      className="prod-input"
                      placeholder="e.g. Bridgestone"
                      value={form.brand}
                      onChange={(e) => setField("brand", e.target.value)}
                    />
                  </div>
                  <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                    <div
                      className="prod-label"
                      style={{ marginBottom: "0.3rem" }}
                    >
                      Design{" "}
                      <span style={{ color: "var(--th-orange)" }}>*</span>
                    </div>
                    <input
                      className="prod-input"
                      placeholder="e.g. Turanza"
                      value={form.design}
                      onChange={(e) => setField("design", e.target.value)}
                    />
                  </div>
                  <div style={{ flex: "1 1 120px", minWidth: 100 }}>
                    <div
                      className="prod-label"
                      style={{ marginBottom: "0.3rem" }}
                    >
                      Size <span style={{ color: "var(--th-orange)" }}>*</span>
                    </div>
                    <input
                      className="prod-input"
                      placeholder="e.g. 205/55R16"
                      value={form.size}
                      onChange={(e) => {
                        setField("size", e.target.value);
                        const r = extractRimSize(e.target.value);
                        if (r) setField("rim_size", r);
                      }}
                    />
                  </div>
                  <div style={{ flex: "0 1 100px", minWidth: 90 }}>
                    <div
                      className="prod-label"
                      style={{
                        marginBottom: "0.3rem",
                        color: "var(--th-amber)",
                      }}
                    >
                      DOT / Year{" "}
                      <span style={{ color: "var(--th-orange)" }}>*</span>
                    </div>
                    <input
                      className="prod-input"
                      placeholder="e.g. 2025"
                      value={form.dot_number}
                      onChange={(e) => setField("dot_number", e.target.value)}
                      style={{
                        borderColor: !form.dot_number.trim()
                          ? "var(--th-rose)"
                          : undefined,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ flex: "2 1 200px", minWidth: 160 }}>
                  <div
                    className="prod-label"
                    style={{ marginBottom: "0.3rem" }}
                  >
                    Item Name{" "}
                    <span style={{ color: "var(--th-orange)" }}>*</span>
                  </div>
                  <input
                    className="prod-input"
                    placeholder="e.g. Bridgestone Turanza"
                    value={form.item_name}
                    onChange={(e) => setField("item_name", e.target.value)}
                  />
                </div>
              )}
              <div style={{ flex: "1 1 120px", minWidth: 100 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Category <span style={{ color: "var(--th-orange)" }}>*</span>
                </div>
                <select
                  className="prod-input"
                  value={form.category}
                  style={{ height: "38px" }}
                  onChange={(e) => {
                    if (e.target.value === "__ADD__") {
                      const name = window.prompt("Enter new category name:");
                      if (name && name.trim()) {
                        const trimmed = name.trim();
                        if (itemType === "TIRE") {
                          const next = tireCats.includes(trimmed)
                            ? tireCats
                            : [...tireCats, trimmed];
                          setTireCats(next);
                          prodSaveCats(PROD_LS.tire, next);
                        } else {
                          const next = otherCats.includes(trimmed)
                            ? otherCats
                            : [...otherCats, trimmed];
                          setOtherCats(next);
                          prodSaveCats(PROD_LS.other, next);
                        }
                        setField("category", trimmed);
                      }
                    } else {
                      setField("category", e.target.value);
                    }
                  }}
                >
                  {(itemType === "TIRE" ? tireCats : otherCats).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                  <option value="__ADD__">+ Add category…</option>
                </select>
              </div>
              <div style={{ flex: "0 1 110px", minWidth: 90 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Unit Cost <span style={{ color: "var(--th-orange)" }}>*</span>
                </div>
                <input
                  className="prod-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unit_cost}
                  onChange={(e) => setField("unit_cost", e.target.value)}
                />
              </div>
              <div style={{ flex: "0 1 110px", minWidth: 90 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Selling Price{" "}
                  <span style={{ color: "var(--th-orange)" }}>*</span>
                </div>
                <input
                  className="prod-input"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.selling_price}
                  onChange={(e) => setField("selling_price", e.target.value)}
                />
              </div>
            </div>

            {/* Row 2: qty + reorder + supplier + actions */}
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                flexWrap: "wrap",
                alignItems: "flex-end",
                marginTop: "0.6rem",
              }}
            >
              <div style={{ flex: "0 1 90px", minWidth: 70 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Init. Qty
                </div>
                <input
                  className="prod-input"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                />
              </div>
              <div style={{ flex: "0 1 90px", minWidth: 70 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Reorder Pt.
                </div>
                <input
                  className="prod-input"
                  type="number"
                  min="0"
                  placeholder="5"
                  value={form.reorder_point}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reorder_point: e.target.value }))
                  }
                />
              </div>
              <div style={{ flex: "1 1 150px", minWidth: 130 }}>
                <div className="prod-label" style={{ marginBottom: "0.3rem" }}>
                  Supplier
                </div>
                <select
                  className="prod-input"
                  value={form.supplier_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, supplier_id: e.target.value }))
                  }
                  style={{ height: "38px" }}
                >
                  <option value="">— None —</option>
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flex: "0 0 auto",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  onClick={handleAddItem}
                  disabled={saving}
                  style={{
                    padding: "0.5rem 1.2rem",
                    borderRadius: 7,
                    background: "var(--th-orange)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    border: "none",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? "Saving…" : "✓ Save Product"}
                </button>
                <button
                  onClick={() => setFormOpen(false)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: 7,
                    background: "transparent",
                    color: "var(--th-text-muted)",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    border: "1px solid var(--th-border-strong)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {(() => {
        const tires = items.filter(
          (i) => i.item_type === "TIRE" || (i.sku || "").startsWith("TIRE"),
        );
        const others = items.filter(
          (i) => i.item_type !== "TIRE" && !(i.sku || "").startsWith("TIRE"),
        );
        const margins = items.filter(
          (i) => i.unit_cost > 0 && i.selling_price > 0,
        );
        const avgMargin = margins.length
          ? margins.reduce(
            (s, i) =>
              s + ((i.selling_price - i.unit_cost) / i.selling_price) * 100,
            0,
          ) / margins.length
          : 0;
        const cards = [
          {
            label: "Total Products",
            value: items.length,
            accent: "sky",
            sub: "active SKUs",
          },
          {
            label: "Tire Items",
            value: tires.length,
            accent: "violet",
            sub: "tire SKUs",
          },
          {
            label: "Other Items",
            value: others.length,
            accent: "amber",
            sub: "non-tire SKUs",
          },
          {
            label: "Avg Margin",
            value: avgMargin.toFixed(1) + "%",
            accent: "emerald",
            sub: "on priced items",
          },
        ];
        return (
          <div
            className="prod-kpi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: "0.75rem",
            }}
          >
            {cards.map((c, i) => (
              <KpiCard
                key={i}
                label={c.label}
                value={c.value}
                accent={c.accent}
                sub={c.sub}
              />
            ))}
          </div>
        );
      })()}

      {/* Toolbar */}
      <div className="prod-toolbar">
        <div className="prod-view-tabs">
          <button
            className={`prod-view-tab${!showArchived ? " active" : ""}`}
            onClick={() => setShowArchived(false)}
          >
            Active
          </button>
          <button
            className={`prod-view-tab archive-tab${showArchived ? " active" : ""}`}
            onClick={() => {
              setShowArchived(true);
              fetchArchivedItems();
            }}
          >
            Archived{" "}
            {archivedItems.length > 0 && (
              <span
                style={{
                  marginLeft: "0.3rem",
                  background: "var(--th-amber-bg)",
                  color: "var(--th-amber)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontSize: "0.72rem",
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 700,
                }}
              >
                {archivedItems.length}
              </span>
            )}
          </button>
        </div>
        <div className="prod-search-wrap">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search by name, SKU, brand, size…"
            suggestions={suggestions}
            onSuggestionSelect={(s) => {
              setSearch(s.text);
              setPage(1);
            }}
            style={{ marginBottom: 0 }}
          />
        </div>
        <div className="prod-cat-pills">
          {allCats.slice(0, 8).map((c) => (
            <button
              key={c}
              className={`prod-cat-pill${catFilter === c ? " active" : ""}`}
              onClick={() => {
                setCatFilter(c);
                setPage(1);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile-only add button above table */}
      <div className="prod-mobile-add-wrap">
        <button className="prod-btn-primary" onClick={() => setFormOpen(true)}>
          + Add Product
        </button>
      </div>

      {/* Table + Detail Panel side by side */}
      <div className="th-section-label">Products</div>
      <div
        className="prod-table-panel-layout"
        style={{
          display: "flex",
          gap: "1rem",
          minHeight: 0,
          alignItems: "flex-start",
        }}
      >
        {showArchived ? (
          <DataTable
            columns={archivedColumns}
            rows={archivedItems}
            rowKey="item_id"
            loading={archiveLoading}
            skeletonRows={6}
            emptyTitle="No Archived Items"
            emptyMessage="No archived items."
            minWidth={800}
            style={{ flex: 1, minWidth: 0 }}
          />
        ) : (
          <DataTable
            columns={prodColumns}
            rows={paginated}
            rowKey="item_id"
            onRowClick={openDetail}
            selectedKey={selected?.item_id}
            getRowStyle={(item) =>
              item.dot_number
                ? {
                  borderLeft: "3px solid var(--th-amber)",
                  backgroundColor: "rgba(251,191,36,0.03)",
                }
                : undefined
            }
            loading={loading}
            skeletonRows={8}
            skeletonWidths={[
              "w80",
              "w40",
              "w30",
              "w40",
              "w30",
              "w20",
              "w20",
              "w30",
              "w30",
              "w20",
            ]}
            emptyTitle="No Products Found"
            emptyMessage={
              search ? "No products match your search." : "No products found."
            }
            emptyIcon={
              <svg
                style={{ opacity: 0.25, marginBottom: "0.25rem" }}
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
            }
            minWidth={920}
            currentPage={page}
            totalPages={Math.ceil(filtered.length / PAGE_SIZE)}
            onPageChange={setPage}
            style={{ flex: 1, minWidth: 0 }}
          />
        )}
      </div>
      {/* end flex row */}

      {/* History Modal */}
      {selected && (
        <ItemHistoryModal
          item={selected}
          onClose={() => setSelected(null)}
          currency={prodCurrency}
          historyContent={
            histLoading || priceHistLoading ? (
              <div className="inv-hist-loading">
                <div className="inv-hist-spinner" /> Loading…
              </div>
            ) : (
              (() => {
                const txEntries = history.map((h) => ({
                  _key: h.inventory_ledger_id,
                  _ts: new Date(h.created_at).getTime(),
                  _kind: "tx",
                  ...h,
                }));
                const phEntries = priceHistory.map((p) => ({
                  _key: p.history_id,
                  _ts: new Date(p.changed_at).getTime(),
                  _kind: "ph",
                  ...p,
                }));
                const all = [...txEntries, ...phEntries].sort(
                  (a, b) => b._ts - a._ts,
                );
                if (all.length === 0)
                  return <div className="inv-hist-empty">No history found</div>;

                const groups = [];
                const usedPh = new Set();
                for (const e of all) {
                  if (e._kind !== "tx") continue;
                  const attached = all.filter(
                    (p) =>
                      p._kind === "ph" &&
                      !usedPh.has(p._key) &&
                      Math.abs(p._ts - e._ts) <= 10000,
                  );
                  attached.forEach((p) => usedPh.add(p._key));
                  groups.push({ tx: e, ph: attached, _ts: e._ts });
                }
                const remainingPh = all.filter(
                  (e) => e._kind === "ph" && !usedPh.has(e._key),
                );
                const usedRemaining = new Set();
                for (const e of remainingPh) {
                  if (usedRemaining.has(e._key)) continue;
                  const cluster = remainingPh.filter(
                    (p) =>
                      !usedRemaining.has(p._key) &&
                      Math.abs(p._ts - e._ts) <= 10000,
                  );
                  cluster.forEach((p) => usedRemaining.add(p._key));
                  groups.push({ tx: null, ph: cluster, _ts: e._ts });
                }
                groups.sort((a, b) => b._ts - a._ts);

                return groups.map((g, gi) => {
                  const { tx, ph } = g;
                  const dotPh = ph.find((p) => p.price_type === "DOT_NUMBER");
                  const costPh = ph.find((p) => p.price_type === "UNIT_COST");
                  const sellPh = ph.find(
                    (p) => p.price_type === "SELLING_PRICE",
                  );

                  if (tx) {
                    const tc =
                      tx.transaction_type === "PURCHASE"
                        ? "PURCHASE"
                        : tx.transaction_type === "SALE"
                          ? "SALE"
                          : tx.transaction_type === "ADJUSTMENT"
                            ? "ADJUSTMENT"
                            : "other";
                    return (
                      <>
                        <div key={tx._key} className={`inv-hist-entry ${tc}`}>
                          <div className="inv-hist-entry-top">
                            <span className={`inv-hist-type ${tc}`}>
                              {tx.transaction_type}
                            </span>
                            <span className="inv-hist-date">
                              {new Date(tx._ts).toLocaleString("en-PH", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </span>
                          </div>
                          <div className="inv-hist-entry-data">
                            <div>
                              Qty: <b>{tx.quantity}</b>
                            </div>
                            <div>
                              Total:{" "}
                              <b>
                                {prodCurrency(
                                  (tx.unit_cost || 0) * Math.abs(tx.quantity),
                                )}
                              </b>
                            </div>
                          </div>
                          {dotPh && (
                            <div
                              className="inv-hist-ref"
                              style={{
                                color: "var(--th-amber, #fbbf24)",
                                fontWeight: 700,
                              }}
                            >
                              DOT{" "}
                              {dotPh.old_price != null
                                ? `${dotPh.old_price} → `
                                : ""}
                              DOT {dotPh.new_price}
                            </div>
                          )}
                          {costPh && costPh.old_price != null && (
                            <div className="inv-hist-ref">
                              Cost: {prodCurrency(costPh.old_price)} →{" "}
                              {prodCurrency(costPh.new_price)}
                            </div>
                          )}
                          {sellPh && sellPh.old_price != null && (
                            <div className="inv-hist-ref">
                              Sell: {prodCurrency(sellPh.old_price)} →{" "}
                              {prodCurrency(sellPh.new_price)}
                            </div>
                          )}
                          {(tx.ledger_dot_number || tx.dot_number) &&
                            !dotPh && (
                              <div
                                className="inv-hist-ref"
                                style={{
                                  color: "var(--th-amber, #fbbf24)",
                                  fontWeight: 700,
                                }}
                              >
                                DOT {tx.ledger_dot_number || tx.dot_number}
                              </div>
                            )}
                          {tx.reference_id && (
                            <div className="inv-hist-ref">
                              Ref: {tx.reference_id}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  } else {
                    const dotPh2 = ph.find(
                      (p) => p.price_type === "DOT_NUMBER",
                    );
                    const costPh2 = ph.find(
                      (p) => p.price_type === "UNIT_COST",
                    );
                    const sellPh2 = ph.find(
                      (p) => p.price_type === "SELLING_PRICE",
                    );
                    const anchor = ph[0];
                    const label = dotPh2
                      ? "DOT Update"
                      : costPh2
                        ? "Price Change"
                        : "Price Change";
                    return (
                      <div key={`ph-${gi}`} className="inv-hist-entry PURCHASE">
                        <div className="inv-hist-entry-top">
                          <span className="inv-hist-type PURCHASE">
                            {label}
                          </span>
                          <span className="inv-hist-date">
                            {new Date(anchor._ts).toLocaleString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>
                        {dotPh2 && (
                          <div
                            className="inv-hist-ref"
                            style={{
                              color: "var(--th-amber, #fbbf24)",
                              fontWeight: 700,
                            }}
                          >
                            DOT{" "}
                            {dotPh2.old_price != null
                              ? `${dotPh2.old_price} → `
                              : ""}
                            DOT {dotPh2.new_price}
                          </div>
                        )}
                        {costPh2 && (
                          <div className="inv-hist-ref">
                            Cost:{" "}
                            {costPh2.old_price != null
                              ? prodCurrency(costPh2.old_price)
                              : "—"}{" "}
                            → <b>{prodCurrency(costPh2.new_price)}</b>
                          </div>
                        )}
                        {sellPh2 && (
                          <div className="inv-hist-ref">
                            Sell:{" "}
                            {sellPh2.old_price != null
                              ? prodCurrency(sellPh2.old_price)
                              : "—"}{" "}
                            → <b>{prodCurrency(sellPh2.new_price)}</b>
                          </div>
                        )}
                        {anchor.notes && !costPh2 && !sellPh2 && !dotPh2 && (
                          <div className="inv-hist-ref">{anchor.notes}</div>
                        )}
                      </div>
                    );
                  }
                });
              })()
            )
          }
        >
          {(selected.current_quantity ?? 0) <= 0 && (
            <div
              style={{
                padding: "0.65rem 1.2rem",
                borderBottom: "1px solid var(--th-border)",
              }}
            >
              <button
                className="prod-btn-archive"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  fontSize: "0.82rem",
                }}
                onClick={() => archiveItem(selected)}
              >
                Archive this item (stock is 0)
              </button>
            </div>
          )}
          <div className="prod-adj-wrap">
            <div className="th-section-label">Stock Adjustment</div>
            <div className="prod-adj-row">
              <input
                className="prod-adj-input"
                type="number"
                placeholder="e.g. +10 or -3"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
              />
              <button
                className="prod-btn-primary"
                style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem" }}
                onClick={handleAdjust}
                disabled={adjSaving}
              >
                {adjSaving ? "…" : "Apply"}
              </button>
            </div>
          </div>
        </ItemHistoryModal>
      )}

      {/* Toasts */}
      <div className="prod-toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`prod-toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Confirm Add Product */}
      {pending && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Add Product</div>
            <div className="confirm-details">
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Item</span>
                <span className="confirm-detail-val">{pending.item_name}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">SKU</span>
                <span className="confirm-detail-val">{pending.sku}</span>
              </div>
              {pending.brand && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Brand</span>
                  <span className="confirm-detail-val">{pending.brand}</span>
                </div>
              )}
              {pending.design && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Design</span>
                  <span className="confirm-detail-val">{pending.design}</span>
                </div>
              )}
              {pending.size && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Size</span>
                  <span className="confirm-detail-val">{pending.size}</span>
                </div>
              )}
              {pending.dot_number && (
                <div className="confirm-detail-row">
                  <span
                    className="confirm-detail-label"
                    style={{ color: "var(--th-amber)" }}
                  >
                    DOT
                  </span>
                  <span className="confirm-detail-val">
                    {pending.dot_number}
                  </span>
                </div>
              )}
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Category</span>
                <span className="confirm-detail-val">{pending.category}</span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Unit Cost</span>
                <span className="confirm-detail-val">
                  ₱
                  {Number(pending.unit_cost).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Selling Price</span>
                <span className="confirm-detail-val">
                  ₱
                  {Number(pending.selling_price).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {pending.quantity && (
                <div className="confirm-detail-row">
                  <span className="confirm-detail-label">Init. Qty</span>
                  <span className="confirm-detail-val">{pending.quantity}</span>
                </div>
              )}
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-btn-cancel"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button className="confirm-btn-ok" onClick={confirmAddItem}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Stock Adjustment */}
      {pendingAdj && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-title">Confirm Stock Adjustment</div>
            <div className="confirm-details">
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Product</span>
                <span className="confirm-detail-val">
                  {pendingAdj.item.item_name}
                </span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Current Stock</span>
                <span className="confirm-detail-val">
                  {pendingAdj.item.current_quantity ?? 0}
                </span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">Adjustment</span>
                <span
                  className="confirm-detail-val"
                  style={{
                    color:
                      pendingAdj.qty > 0
                        ? "var(--th-emerald)"
                        : "var(--th-rose)",
                  }}
                >
                  {pendingAdj.qty > 0 ? "+" : ""}
                  {pendingAdj.qty}
                </span>
              </div>
              <div className="confirm-detail-row">
                <span className="confirm-detail-label">New Stock</span>
                <span className="confirm-detail-val">
                  {(pendingAdj.item.current_quantity ?? 0) + pendingAdj.qty}
                </span>
              </div>
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-btn-cancel"
                onClick={() => setPendingAdj(null)}
              >
                Cancel
              </button>
              <button className="confirm-btn-ok" onClick={confirmAdjust}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Productspage;
