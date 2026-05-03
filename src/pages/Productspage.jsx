import '../pages_css/Productspage.css';
import React from "react";
import { API_URL, apiFetch, currency } from "../lib/config";
import DataTable from "../components/DataTable";
import FilterHeader from "../components/FilterHeader";
import KpiCard from "../components/KpiCard";
import ItemHistoryModal from "../components/ItemHistoryModal";
import usePaginatedResource from "../hooks/usePaginatedResource";

/* ============================================================
   CORETRACK — PRODUCTS PAGE
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
function generateSKU(type, brand, design, size, dot) {
  if (!brand && !design && !size) return "";
  const prefix = type === "TIRE" ? "TIRE" : "ITEM";
  const b = (brand || "").trim().substring(0, 5).toUpperCase();
  const d = (design || "").trim().substring(0, 4).toUpperCase();
  const s = (size || "").trim().replace(/[\/\-]/g, "");
  let sku = prefix + "-" + [b, d, s].filter(Boolean).join("-");
  if (dot && dot.trim()) {
    sku += "-DOT" + dot.trim().toUpperCase();
  }
  return sku;
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function Productspage({ shopId }) {
  const [catFilter, setCatFilter] = React.useState("ALL");
  const [suggestions, setSuggestions] = React.useState([]);

  const {
    data: items,
    setData: setItems,
    page, setPage,
    totalPages,
    loading,
    search, setSearch,
    refetch: refetchItems,
  } = usePaginatedResource({
    url: `${API_URL}/items/${shopId}`,
    perPage: PAGE_SIZE,
    enabled: !!shopId,
    extraParams: React.useMemo(() => ({
      category: catFilter === "ALL" ? undefined : catFilter,
      groupByDot: "true"
    }), [catFilter]),
    deps: [shopId, catFilter],
  });

  const [showArchived, setShowArchived] = React.useState(false);
  const {
    data: archivedItems,
    page: archPage, setPage: setArchPage,
    totalPages: archTotalPages,
    loading: archiveLoading,
    search: archSearch, setSearch: setArchSearch,
    refetch: refetchArchived,
  } = usePaginatedResource({
    url: `${API_URL}/items-archived/${shopId}`,
    perPage: PAGE_SIZE,
    enabled: !!shopId && showArchived,
    deps: [shopId, showArchived],
  });

  // Suppliers
  const [suppliers, setSuppliers] = React.useState([]);

  // Form state
  const [formOpen, setFormOpen] = React.useState(false);
  const [assignSupplierId, setAssignSupplierId] = React.useState("");
  const [assigningSupplier, setAssigningSupplier] = React.useState(false);

  // Detail editing state
  const [detailForm, setDetailForm] = React.useState({
    category: "",
    brand: "",
    design: "",
    size: ""
  });
  const [detailsSaving, setDetailsSaving] = React.useState(false);
  const [detailsVisible, setDetailsVisible] = React.useState(false);

  const [itemsToAdd, setItemsToAdd] = React.useState([
    {
      id: Date.now() + Math.random(),
      itemType: "TIRE",
      sku: "",
      item_name: "",
      category: "PCR",
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
    }
  ]);

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
  const [historyVariants, setHistoryVariants] = React.useState([]);
  const [activeHistVariantId, setActiveHistVariantId] = React.useState(null);

  function parseVariantInfo(variant_info) {
    if (!variant_info) return [];
    return variant_info.split(',').map(entry => {
      const parts = entry.split(':');
      return {
        item_id: parts[0],
        dot_number: parts[1] === 'NONE' ? null : (parts[1] || null),
        qty: parseInt(parts[2]) || 0,
        selling_price: parseFloat(parts[3]) || 0,
        unit_cost: parseFloat(parts[4]) || 0,
      };
    }).filter(v => v.item_id);
  }
  const [detailTab, setDetailTab] = React.useState("transactions");
  const [adjQty, setAdjQty] = React.useState("");

  const [adjSaving, setAdjSaving] = React.useState(false);
  const [kpi, setKpi] = React.useState(null);

  // Inline editing
  const [editCell, setEditCell] = React.useState(null); // { item_id, field }
  const [editVal, setEditVal] = React.useState("");

  // DB suggestions
  const [dbBrands, setDbBrands] = React.useState([]);
  const [dbDesigns, setDbDesigns] = React.useState([]);
  const [dbSizes, setDbSizes] = React.useState([]);
  const [activeSug, setActiveSug] = React.useState(null); // { idx, field } for multi-add OR { field: 'detail' }

  // Toast
  const [toasts, setToasts] = React.useState([]);
  const [liveCats, setLiveCats] = React.useState(["ALL"]);

  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    if (!document.documentElement.getAttribute("data-theme")) {
      document.documentElement.setAttribute(
        "data-theme",
        (() => {
          try {
            return localStorage.getItem("th-theme") || "light";
          } catch {
            return "light";
          }
        })(),
      );
    }
    const obs = new MutationObserver(() => forceUpdate());
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    fetchSuppliers();
    fetchKpi();
    fetchDbSuggestions();
    fetchLiveCats();
    return () => obs.disconnect();
  }, [shopId]);

  async function fetchLiveCats() {
    if (!shopId) return;
    try {
      const r = await apiFetch(`${API_URL}/item-categories/${shopId}`);
      const d = await r.json();
      if (Array.isArray(d)) setLiveCats(["ALL", ...d]);
    } catch { }
  }

  async function fetchDbSuggestions() {
    try {
      apiFetch(`${API_URL}/item-brands/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbBrands(d)).catch(() => { });
      apiFetch(`${API_URL}/item-designs/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbDesigns(d)).catch(() => { });
      apiFetch(`${API_URL}/item-sizes/any`).then(r => r.json()).then(d => Array.isArray(d) && setDbSizes(d)).catch(() => { });
    } catch { }
  }

  async function fetchKpi() {
    try {
      const r = await apiFetch(`${API_URL}/items-kpi/${shopId}`);
      const d = await r.json();
      if (d && !d.error) setKpi(d);
    } catch { }
  }

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

  async function archiveItem(item) {
    try {
      await apiFetch(`${API_URL}/items/${item.item_id}/archive`, {
        method: "PUT",
      });
      toast(`"${item.item_name}" archived`);
      refetchItems();
      fetchKpi();
      fetchLiveCats();
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
      refetchItems();
      refetchArchived();
      fetchKpi();
      fetchLiveCats();
    } catch {
      toast("Failed to restore item", "error");
    }
  }

  /* ── Derived ── */

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

  function addMoreItems() {
    setItemsToAdd(prev => [...prev, {
      id: Date.now() + Math.random(),
      itemType: "TIRE",
      sku: "",
      item_name: "",
      category: "PCR",
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
    }]);
  }

  function removeItemsToAdd(index) {
    if (itemsToAdd.length <= 1) return;
    setItemsToAdd(prev => prev.filter((_, i) => i !== index));
  }

  function updateItemToAdd(index, field, value) {
    setItemsToAdd(prev => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      // Auto-SKU for tires
      if (item.itemType === "TIRE") {
        if (!item.sku || item.sku === generateSKU("TIRE", next[index].brand, next[index].design, next[index].size, next[index].dot_number)) {
          item.sku = generateSKU("TIRE", item.brand, item.design, item.size, item.dot_number);
        }
      } else {
        // Auto-SKU for items
        const autoNameSku = generateSKU("ITEM", item.item_name, item.category, "", "");
        if (!item.sku || item.sku === generateSKU("ITEM", next[index].item_name, next[index].category, "", "")) {
          item.sku = autoNameSku;
        }
      }

      next[index] = item;
      return next;
    });
  }

  function switchItemType(index, t) {
    setItemsToAdd(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        itemType: t,
        category: t === "TIRE" ? "PCR" : "OTHER"
      };
      return next;
    });
  }

  function openAddModal() {
    setItemsToAdd([
      {
        id: Date.now() + Math.random(),
        itemType: "TIRE",
        sku: "",
        item_name: "",
        category: "PCR",
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
      }
    ]);
    setFormOpen(true);
  }


  async function handleAddItem() {
    const validatedItems = [];
    for (let i = 0; i < itemsToAdd.length; i++) {
      const item = itemsToAdd[i];
      const isTire = item.itemType === "TIRE";
      const autoItemName = isTire
        ? [item.brand, item.design, item.size].filter(Boolean).join(" ")
        : item.item_name;

      const label = `Item #${i + 1}`;

      if (isTire && (!item.brand || !item.design || !item.size)) {
        toast(`${label}: Brand, Design, and Size are required for tires.`, "error");
        return;
      }
      if (!isTire && !item.item_name) {
        toast(`${label}: Item name is required.`, "error");
        return;
      }
      if (!item.category) {
        toast(`${label}: Category is required.`, "error");
        return;
      }
      if (!item.unit_cost || !item.selling_price) {
        toast(`${label}: Cost and Price are required.`, "error");
        return;
      }
      if (isTire && !item.dot_number?.trim()) {
        toast(`${label}: DOT number is required for tires.`, "error");
        return;
      }

      const autoSku = isTire
        ? generateSKU("TIRE", item.brand, item.design, item.size, item.dot_number)
        : generateSKU("ITEM", item.item_name, item.category, "", "");

      const dup = items.find((x) => x.sku === (item.sku || autoSku));
      if (dup) {
        toast(`${label}: SKU "${item.sku || autoSku}" already exists.`, "error");
        return;
      }

      validatedItems.push({
        ...item,
        sku: item.sku || autoSku,
        item_name: autoItemName,
        rim_size: isTire ? extractRimSize(item.size) : (item.rim_size ? parseFloat(item.rim_size) : null),
        unit_cost: parseFloat(item.unit_cost),
        selling_price: parseFloat(item.selling_price),
        reorder_point: parseInt(item.reorder_point) || 5,
        dot_number: item.dot_number?.trim() || null,
      });
    }

    setPending(validatedItems);
  }

  async function confirmAddItem() {
    const payload = pending;
    setPending(null);
    setSaving(true);
    try {
      const res = await apiFetch(`${API_URL}/items-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, items: payload }),
      });
      const data = await res.json();

      if (data.error) {
        toast(data.error, "error");
      } else if (data.errors && data.errors.length > 0) {
        toast(`Completed with ${data.errors.length} errors.`, "warning");
        console.error("Bulk partial failures:", data.errors);
      } else {
        toast(`Successfully added ${payload.length} product(s)!`);
        setItemsToAdd([
          {
            id: Date.now(),
            itemType: "TIRE",
            sku: "",
            item_name: "",
            category: "PCR",
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
          }
        ]);
        setFormOpen(false);
        refetchItems();
        fetchKpi();
      }
    } catch {
      toast("Failed to save products.", "error");
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
        refetchItems();
        fetchKpi();
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
    const variants = parseVariantInfo(item.variant_info);
    const isGrouped = (item.variant_count || 0) > 1 && variants.length > 1;
    setSelected(item);
    setHistoryVariants(isGrouped ? variants : []);
    setActiveHistVariantId(null);
    setAdjQty("");
    setDetailTab("transactions");
    setHistLoading(true);
    setPriceHistLoading(true);
    setDetailsVisible(false);
    setDetailForm({
      category: item.category || "",
      brand: item.brand || "",
      design: item.design || "",
      size: item.size || ""
    });
    try {
      // For non-grouped tire items variant_info still holds the real item_id;
      // item.item_id is the synthetic group key (BRAND||DESIGN||SIZE) — use the real ID.
      const realIds = isGrouped
        ? variants.map(v => v.item_id)
        : variants.length === 1 ? [variants[0].item_id] : [item.item_id];
      const param = realIds.length > 1
        ? `item_ids=${encodeURIComponent(realIds.join(','))}`
        : `item_id=${encodeURIComponent(realIds[0])}`;
      const data = await apiFetch(
        `${API_URL}/inventory-ledger/${shopId}?${param}&page=1&perPage=100`,
      ).then((r) => r.json());
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setHistory(rows);
    } catch {
      setHistory([]);
    }
    setHistLoading(false);
    try {
      if (isGrouped) {
        const data = await apiFetch(
          `${API_URL}/item-price-history-multi?item_ids=${encodeURIComponent(variants.map(v => v.item_id).join(','))}`,
        ).then((r) => r.json());
        setPriceHistory(Array.isArray(data) ? data : []);
      } else {
        const realId = variants.length === 1 ? variants[0].item_id : item.item_id;
        const data = await apiFetch(
          `${API_URL}/item-price-history/${realId}`,
        ).then((r) => r.json());
        setPriceHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      setPriceHistory([]);
    }
    setPriceHistLoading(false);
  }

  async function handleUpdateDetails() {
    setDetailsSaving(true);
    // For grouped items use the active variant's real item_id; fall back to first variant
    const targetId = (() => {
      if ((selected?.variant_count || 0) <= 1) return selected?.item_id;
      const v = historyVariants.find(x => x.item_id === activeHistVariantId) || historyVariants[0];
      return v?.item_id || selected?.item_id;
    })();
    try {
      const res = await apiFetch(`${API_URL}/items/${targetId}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(detailForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update details");

      const updatedItem = {
        ...selected,
        category: data.category,
        brand: data.brand,
        design: data.design,
        size: data.size,
        item_name: data.item_name
      };
      setSelected(updatedItem);
      setItems(prev => prev.map(i => i.item_id === selected.item_id ? updatedItem : i));
      toast("Details updated successfully", "success");
      setDetailsVisible(false);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setDetailsSaving(false);
    }
  }

  async function handleAssignSupplier() {
    if (!assignSupplierId) {
      toast("Please select a supplier.", "error");
      return;
    }
    setAssigningSupplier(true);
    try {
      // For grouped items use active variant's real item_id; fall back to first variant
      const suppTargetId = (() => {
        if ((selected?.variant_count || 0) <= 1) return selected?.item_id;
        const v = historyVariants.find(x => x.item_id === activeHistVariantId) || historyVariants[0];
        return v?.item_id || selected?.item_id;
      })();
      const res = await apiFetch(`${API_URL}/items/${suppTargetId}/supplier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: assignSupplierId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign supplier");

      // Update local state
      const updatedSupplier = suppliers.find(s => s.supplier_id === assignSupplierId);
      const updatedItem = { ...selected, supplier_id: assignSupplierId, supplier_name: updatedSupplier ? updatedSupplier.supplier_name : "" };
      setSelected(updatedItem);

      setItems(prev => prev.map(i => i.item_id === selected.item_id ? updatedItem : i));

      toast("Supplier assigned successfully", "success");
      setAssignSupplierId(""); // reset
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setAssigningSupplier(false);
    }
  }

  function handleAdjust() {
    const qty = parseInt(adjQty);
    if (isNaN(qty) || qty === 0) {
      toast("Enter a non-zero quantity (+/-).", "error");
      return;
    }
    // For grouped items, require a specific variant to be selected
    const isGrouped = (selected?.variant_count || 0) > 1;
    if (isGrouped && !activeHistVariantId) {
      toast("Select a DOT variant tab first to adjust its stock.", "error");
      return;
    }
    const adjItem = isGrouped
      ? { ...selected, item_id: activeHistVariantId, dot_number: historyVariants.find(v => v.item_id === activeHistVariantId)?.dot_number }
      : selected;
    setPendingAdj({ qty, item: adjItem });
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
        refetchItems();
        fetchKpi();
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
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--th-text-heading)" }}>{item.brand || "—"}</span>
      ),
    },
    {
      key: "design",
      label: "Design",
      render: (item) => (
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--th-text-heading)" }}>{item.design || "—"}</span>
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
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--th-text-heading)" }}>{item.brand || "—"}</span>
      ),
    },
    {
      key: "design",
      label: "Design",
      render: (item) => (
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--th-text-heading)" }}>{item.design || "—"}</span>
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
      render: (item) => {
        if (item.variant_count > 1) {
          const dots = (item.variant_info || "").split(",").map(v => v.split(":")[1]).filter(d => d && d !== "NONE");
          const uniqueDots = Array.from(new Set(dots)).sort();
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
              <span
                style={{
                  background: "var(--th-amber-bg)",
                  color: "var(--th-amber)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: 4,
                  fontSize: "0.65rem",
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  border: "1px solid rgba(251,191,36,0.2)"
                }}
              >
                MULTIPLE ({item.variant_count})
              </span>
              {uniqueDots.length > 0 && (
                <div style={{ fontSize: "0.6rem", color: "var(--th-text-faint)", textAlign: "center", maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={uniqueDots.join(", ")}>
                  {uniqueDots.join(", ")}
                </div>
              )}
            </div>
          );
        }
        return item.dot_number ? (
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
          <span style={{ fontSize: "0.72rem", color: "var(--th-text-faint)", fontFamily: "'Barlow Condensed',sans-serif" }}>—</span>
        );
      }
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
        const isGroup = item.variant_count > 1;
        const isRange = isGroup && item.min_cost !== item.max_cost;
        const isEditCost = editCell?.item_id === item.item_id && editCell?.field === "unit_cost";
        return (
          <div className="prod-inline-edit" onClick={(e) => e.stopPropagation()}>
            {isEditCost ? (
              <input autoFocus className="prod-inline-input" type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item); if (e.key === "Escape") setEditCell(null); }}
              />
            ) : (
              <>
                <span style={{ fontSize: isRange ? "0.75rem" : "0.85rem", whiteSpace: "nowrap" }}>
                  {isRange ? `${prodCurrency(item.min_cost)} - ${prodCurrency(item.max_cost)}` : prodCurrency(item.unit_cost)}
                </span>
                {!isGroup && (
                  <button className="prod-pencil-btn" title="Edit cost" onClick={(e) => startEdit(e, item, "unit_cost")}>
                    {pencilIcon}
                  </button>
                )}
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
        const isGroup = item.variant_count > 1;
        const isRange = isGroup && item.min_price !== item.max_price;
        const isEditPrice = editCell?.item_id === item.item_id && editCell?.field === "selling_price";
        return (
          <div className="prod-inline-edit" onClick={(e) => e.stopPropagation()}>
            {isEditPrice ? (
              <input autoFocus className="prod-inline-input" type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(item); if (e.key === "Escape") setEditCell(null); }}
              />
            ) : (
              <>
                <span style={{ fontWeight: 600, color: "var(--th-emerald)", fontSize: isRange ? "0.75rem" : "0.85rem", whiteSpace: "nowrap" }}>
                  {isRange ? `${prodCurrency(item.min_price)} - ${prodCurrency(item.max_price)}` : prodCurrency(item.selling_price)}
                </span>
                {!isGroup && (
                  <button className="prod-pencil-btn" title="Edit price" onClick={(e) => startEdit(e, item, "selling_price")}>
                    {pencilIcon}
                  </button>
                )}
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
    <>
      <style>{`
        @media (max-width: 640px) {
          .prod-root {
            gap: .5rem;
          }
        }
      `}</style>
      <div className="prod-root">
        {/* Header */}
        <div className="prod-header">
          <div className="prod-title">
            Product <span>Management</span>
          </div>
          <button className="prod-btn-primary" onClick={openAddModal}>
            + Add Product
          </button>
        </div>

        {/* Add Product Modal */}
        {formOpen && (
          <div className="confirm-overlay" onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
            <div className="confirm-box" style={{ maxWidth: "1100px", width: "95vw", padding: "1.2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div class="pur-modal-title">
                  <h2>Add Product/s</h2>
                </div>
                <button className="pos-modal-close" onClick={() => setFormOpen(false)}>✕</button>
              </div>

              <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                {itemsToAdd.map((item, idx) => (
                  <div key={item.id} className="prod-bulk-card" style={{
                    background: "var(--th-bg-soft)",
                    borderRadius: 12,
                    padding: "1rem",
                    border: "1px solid var(--th-border-strong)",
                    marginBottom: ".5rem",
                    position: "relative"
                  }}>
                    {itemsToAdd.length > 1 && (
                      <button
                        onClick={() => removeItemsToAdd(idx)}
                        style={{
                          position: "absolute",
                          top: "0.8rem",
                          right: "0.8rem",
                          background: "var(--th-rose-bg)",
                          color: "var(--th-rose)",
                          border: "none",
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          fontSize: "0.9rem"
                        }}
                        title="Remove this item"
                      >
                        ✕
                      </button>
                    )}

                    <div style={{ display: "flex", gap: "0.8rem", marginBottom: ".5rem", alignItems: "center" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        background: "var(--th-orange)",
                        color: "#fff",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem"
                      }}>
                        {idx + 1}
                      </div>

                      <div className="prod-type-toggle" style={{ display: "flex", gap: "0.4rem", background: "var(--th-bg-dark)", padding: "0.3rem", borderRadius: 8 }}>
                        <button
                          onClick={() => switchItemType(idx, "TIRE")}
                          style={{
                            padding: "0.4rem 1rem",
                            borderRadius: 6,
                            border: "none",
                            background: item.itemType === "TIRE" ? "var(--th-orange)" : "transparent",
                            color: item.itemType === "TIRE" ? "#fff" : "var(--th-text-muted)",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          🛞 Tire
                        </button>
                        <button
                          onClick={() => switchItemType(idx, "OTHER")}
                          style={{
                            padding: "0.4rem 1rem",
                            borderRadius: 6,
                            border: "none",
                            background: item.itemType === "OTHER" ? "var(--th-orange)" : "transparent",
                            color: item.itemType === "OTHER" ? "#fff" : "var(--th-text-muted)",
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          📦 Other
                        </button>
                      </div>

                      <div style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.7, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        SKU: <span style={{ color: "var(--th-orange)", fontWeight: 700, letterSpacing: "0.03em" }}>{item.sku || "..."}</span>
                      </div>
                    </div>

                    {/* Fields Grid */}
                    <div style={{ display: "flex", gap: ".5rem", alignItems: "flex-start", flexWrap: "wrap", overflowX: "auto", paddingBottom: "0.5rem" }}>
                      {item.itemType === "TIRE" ? (
                        <>
                          <div style={{ position: 'relative', flex: "1.5", minWidth: "100px" }}>
                            <label className="prod-label">Brand *</label>
                            <input className="prod-input" placeholder="Bridgestone" value={item.brand}
                              onChange={e => updateItemToAdd(idx, "brand", e.target.value)}
                              onFocus={() => setActiveSug({ idx, field: 'brand' })}
                              onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                            />
                            {activeSug?.idx === idx && activeSug?.field === 'brand' && item.brand && (
                              <div className="prod-sug-drop">
                                {(() => {
                                  const q = item.brand.toLowerCase();
                                  const matches = [];
                                  const seen = new Set();
                                  dbBrands.forEach(b => {
                                    if (b.toLowerCase().includes(q)) {
                                      matches.push({ brand: b });
                                      seen.add(b.toUpperCase());
                                    }
                                  });
                                  dbDesigns.forEach(d => {
                                    if (d.design.toLowerCase().includes(q) && !seen.has(d.brand?.toUpperCase())) {
                                      matches.push({ brand: d.brand, fromDesign: d.design });
                                      seen.add(d.brand?.toUpperCase());
                                    }
                                  });
                                  return matches.slice(0, 8).map((s, si) => (
                                    <div key={si} className="prod-sug-item" onMouseDown={() => {
                                      updateItemToAdd(idx, "brand", s.brand);
                                      if (s.fromDesign) updateItemToAdd(idx, "design", s.fromDesign);
                                    }}>
                                      {s.brand}
                                      {s.fromDesign && <span style={{ fontSize: "0.7rem", color: "var(--th-orange)", marginLeft: "0.5rem" }}>({s.fromDesign})</span>}
                                    </div>
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative', flex: "1.2", minWidth: "90px" }}>
                            <label className="prod-label">Design *</label>
                            <input className="prod-input" placeholder="Turanza" value={item.design}
                              onChange={e => updateItemToAdd(idx, "design", e.target.value)}
                              onFocus={() => setActiveSug({ idx, field: 'design' })}
                              onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                            />
                            {activeSug?.idx === idx && activeSug?.field === 'design' && item.design && (
                              <div className="prod-sug-drop">
                                {dbDesigns.filter(d => {
                                  const m = d.design.toLowerCase().includes(item.design.toLowerCase());
                                  const b = item.brand ? d.brand?.toLowerCase() === item.brand.toLowerCase() : true;
                                  return m && b;
                                }).slice(0, 8).map((d, di) => (
                                  <div key={di} className="prod-sug-item" onMouseDown={() => {
                                    updateItemToAdd(idx, "design", d.design);
                                    if (d.brand) updateItemToAdd(idx, "brand", d.brand);
                                    if (d.category) updateItemToAdd(idx, "category", d.category);
                                  }}>
                                    {d.design}
                                    {!item.brand && d.brand && <span style={{ fontSize: "0.7rem", color: "var(--th-text-muted)", marginLeft: "0.5rem" }}>({d.brand})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ position: 'relative', flex: "1.2", minWidth: "90px" }}>
                            <label className="prod-label">Size *</label>
                            <input className="prod-input" placeholder="205/55R16" value={item.size}
                              onChange={e => updateItemToAdd(idx, "size", e.target.value)}
                              onFocus={() => setActiveSug({ idx, field: 'size' })}
                              onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                            />
                            {activeSug?.idx === idx && activeSug?.field === 'size' && item.size && (
                              <div className="prod-sug-drop">
                                {dbSizes.filter(s => s.toLowerCase().includes(item.size.toLowerCase())).slice(0, 8).map(s => (
                                  <div key={s} className="prod-sug-item" onMouseDown={() => updateItemToAdd(idx, "size", s)}>{s}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ flex: "0.8", minWidth: "90px" }}>
                            <label className="prod-label" style={{ color: "var(--th-amber)" }}>DOT / Year *</label>
                            <input className="prod-input" placeholder="2025" value={item.dot_number} onChange={e => updateItemToAdd(idx, "dot_number", e.target.value)} />
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: "2", minWidth: "150px" }}>
                          <label className="prod-label">Item Name *</label>
                          <input className="prod-input" placeholder="Battery 12V 70Ah" value={item.item_name} onChange={e => updateItemToAdd(idx, "item_name", e.target.value)} />
                        </div>
                      )}

                      <div style={{ flex: "1", minWidth: "100px" }}>
                        <label className="prod-label">Category *</label>
                        <select
                          className="prod-input"
                          value={item.category}
                          style={{ height: "38px" }}
                          onChange={(e) => {
                            if (e.target.value === "__ADD__") {
                              const name = window.prompt("Enter new category name:");
                              if (name && name.trim()) {
                                const trimmed = name.trim();
                                if (item.itemType === "TIRE") {
                                  const next = tireCats.includes(trimmed) ? tireCats : [...tireCats, trimmed];
                                  setTireCats(next); prodSaveCats(PROD_LS.tire, next);
                                } else {
                                  const next = otherCats.includes(trimmed) ? otherCats : [...otherCats, trimmed];
                                  setOtherCats(next); prodSaveCats(PROD_LS.other, next);
                                }
                                updateItemToAdd(idx, "category", trimmed);
                              }
                            } else {
                              updateItemToAdd(idx, "category", e.target.value);
                            }
                          }}
                        >
                          {(item.itemType === "TIRE" ? tireCats : otherCats).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                          <option value="__ADD__">+ Add category…</option>
                        </select>
                      </div>

                      <div style={{ flex: "0.8", minWidth: "80px" }}>
                        <label className="prod-label">Cost *</label>
                        <input className="prod-input" type="number" step="0.01" placeholder="0.00" value={item.unit_cost} onChange={e => updateItemToAdd(idx, "unit_cost", e.target.value)} />
                      </div>
                      <div style={{ flex: "0.8", minWidth: "80px" }}>
                        <label className="prod-label">Price *</label>
                        <input className="prod-input" type="number" step="0.01" placeholder="0.00" value={item.selling_price} onChange={e => updateItemToAdd(idx, "selling_price", e.target.value)} />
                      </div>

                      <div style={{ flex: "0.6", minWidth: "60px" }}>
                        <label className="prod-label">Qty</label>
                        <input className="prod-input" type="number" min="1" placeholder="4" value={item.quantity} onChange={e => updateItemToAdd(idx, "quantity", e.target.value)} />
                      </div>
                      <div style={{ flex: "0.6", minWidth: "90px" }}>
                        <label className="prod-label">Reorder Pt.</label>
                        <input className="prod-input" type="number" min="0" value={item.reorder_point} onChange={e => updateItemToAdd(idx, "reorder_point", e.target.value)} />
                      </div>
                      <div style={{ flex: "1", minWidth: "110px" }}>
                        <label className="prod-label">Supplier</label>
                        <select className="prod-input" style={{ height: "38px" }} value={item.supplier_id} onChange={e => updateItemToAdd(idx, "supplier_id", e.target.value)}>
                          <option value="">— None —</option>
                          {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                        </select>
                      </div>


                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={addMoreItems}
                  style={{
                    padding: "0.6rem 1.2rem",
                    borderRadius: 8,
                    background: "var(--th-bg-dark)",
                    color: "var(--th-orange)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    border: "1px dashed var(--th-orange)",
                    marginBottom: ".5rem",
                    cursor: "pointer"
                  }}
                >
                  +Item
                </button>

                <div style={{ display: "flex", gap: "0.8rem" }}>
                  <button
                    className="confirm-btn-cancel"
                    onClick={() => setFormOpen(false)}
                    style={{ padding: "0.6rem 1.5rem" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={saving}
                    style={{
                      padding: "0.6rem 2rem",
                      borderRadius: 8,
                      background: "var(--th-orange)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      border: "none",
                      cursor: saving ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(255, 107, 0, 0.2)"
                    }}
                  >
                    {saving ? "Adding…" : `✓ Add ${itemsToAdd.length} Product${itemsToAdd.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {(() => {
          let totalItems, tireItems, otherItems, avgMargin;

          if (kpi) {
            totalItems = kpi.totalItems;
            tireItems = kpi.tireItems;
            otherItems = kpi.otherItems;
            avgMargin = kpi.avgMargin;
          } else {
            // Fallback to current page data if KPI not loaded
            const tires = items.filter(
              (i) => i.item_type === "TIRE" || (i.sku || "").startsWith("TIRE"),
            );
            const others = items.filter(
              (i) => i.item_type !== "TIRE" && !(i.sku || "").startsWith("TIRE"),
            );
            const margins = items.filter(
              (i) => i.unit_cost > 0 && i.selling_price > 0,
            );
            totalItems = items.length;
            tireItems = tires.length;
            otherItems = others.length;
            avgMargin = margins.length
              ? margins.reduce(
                (s, i) =>
                  s + ((i.selling_price - i.unit_cost) / i.selling_price) * 100,
                0,
              ) / margins.length
              : 0;
          }

          const cards = [
            {
              label: "Total Products",
              value: totalItems,
              accent: "sky",
              sub: "active SKUs",
            },
            {
              label: "Tire Items",
              value: tireItems,
              accent: "violet",
              sub: "tire SKUs",
            },
            {
              label: "Other Items",
              value: otherItems,
              accent: "amber",
              sub: "non-tire SKUs",
            },
            {
              label: "Avg Margin",
              value: (Number(avgMargin) || 0).toFixed(1) + "%",
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
        <FilterHeader
          leftComponent={
            <div style={{
              display: "inline-flex",
              border: !showArchived
                ? "1.5px solid var(--th-orange)"
                : "1.5px solid var(--th-amber)",
              borderRadius: 9,
              overflow: "hidden",
              flexShrink: 0,
              transition: "border-color 0.2s",
              boxShadow: !showArchived
                ? "0 0 0 3px rgba(255,107,0,0.12)"
                : "0 0 0 3px rgba(251,191,36,0.12)",
            }}>
              <button
                onClick={() => setShowArchived(false)}
                style={{
                  padding: "0.38rem 1.05rem",
                  border: "none",
                  borderRight: !showArchived
                    ? "1.5px solid var(--th-orange)"
                    : "1.5px solid var(--th-amber)",
                  cursor: "pointer",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  transition: "all 0.18s",
                  background: !showArchived ? "var(--th-orange)" : "transparent",
                  color: !showArchived ? "#fff" : "var(--th-text-faint)",
                  opacity: !showArchived ? 1 : 0.5,
                }}
              >
                Active
              </button>
              <button
                onClick={() => { setShowArchived(true); refetchArchived(); }}
                style={{
                  padding: "0.38rem 1.05rem",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  transition: "all 0.18s",
                  background: showArchived ? "var(--th-amber)" : "transparent",
                  color: showArchived ? "#fff" : "var(--th-text-faint)",
                  opacity: showArchived ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                Archived
                {archivedItems.length > 0 && (
                  <span style={{
                    background: showArchived ? "rgba(255,255,255,0.22)" : "var(--th-amber-bg)",
                    color: showArchived ? "#fff" : "var(--th-amber)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontSize: "0.7rem",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    lineHeight: 1.4,
                  }}>
                    {archivedItems.length}
                  </span>
                )}
              </button>
            </div>
          }
          searchProps={{
            value: search,
            onChange: (val) => { setSearch(val); setPage(1); },
            placeholder: "Search by name, SKU, brand, size…",
            suggestions,
            onSuggestionSelect: (s) => { setSearch(s.text); setPage(1); },
          }}
          filters={liveCats.map(c => ({
            label: c,
            value: c,
            active: catFilter === c,
          }))}
          twoRow
          onFilterChange={(c) => { setCatFilter(c); setPage(1); }}
          accentColor="var(--th-orange)"
        />

        {/* Mobile-only add button above table */}
        <div className="prod-mobile-add-wrap">
          <button className="prod-btn-primary" onClick={openAddModal}>
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
              emptyMessage={archSearch ? "No archived items match your search." : "No archived items."}
              minWidth={800}
              currentPage={archPage}
              totalPages={archTotalPages}
              onPageChange={setArchPage}
              style={{ flex: 1, minWidth: 0 }}
            />
          ) : (
            <DataTable
              columns={prodColumns}
              rows={items}
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
              totalPages={totalPages}
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
            onClose={() => { setSelected(null); setHistoryVariants([]); setActiveHistVariantId(null); }}
            currency={prodCurrency}
            variants={historyVariants.length > 1 ? historyVariants : undefined}
            activeVariantId={activeHistVariantId}
            onVariantChange={setActiveHistVariantId}
            historyContent={
              histLoading || priceHistLoading ? (
                <div className="inv-hist-loading">
                  <div className="inv-hist-spinner" /> Loading…
                </div>
              ) : (
                (() => {
                  // Filter by active variant when one is selected
                  const filteredHistory = activeHistVariantId
                    ? history.filter(h => h.item_id === activeHistVariantId)
                    : history;
                  const filteredPriceHistory = activeHistVariantId
                    ? priceHistory.filter(p => p.item_id === activeHistVariantId)
                    : priceHistory;
                  const showItemName = !activeHistVariantId && historyVariants.length > 1;

                  const txEntries = filteredHistory.map((h) => ({
                    _key: h.inventory_ledger_id,
                    _ts: new Date(h.created_at).getTime(),
                    _kind: "tx",
                    ...h,
                  }));
                  const phEntries = filteredPriceHistory.map((p) => ({
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
                          {showItemName && tx.item_name && (
                            <div className="inv-hist-ref" style={{ opacity: 0.65, fontSize: '0.72rem' }}>{tx.item_name}</div>
                          )}
                        </div>
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
            {(() => {
              const isGrouped = historyVariants.length > 1;
              if (isGrouped) {
                // For grouped rows: only show archive when a specific variant tab is selected and its qty is 0
                if (!activeHistVariantId) return null;
                const activeVar = historyVariants.find(v => v.item_id === activeHistVariantId);
                if (!activeVar || activeVar.qty > 0) return null;
                const variantItem = {
                  item_id: activeVar.item_id,
                  item_name: `${selected.item_name} [DOT ${activeVar.dot_number || '?'}]`,
                };
                return (
                  <div style={{ padding: "0.65rem 1.2rem", borderBottom: "1px solid var(--th-border)" }}>
                    <button
                      className="prod-btn-archive"
                      style={{ width: "100%", padding: "0.5rem", fontSize: "0.82rem" }}
                      onClick={async () => {
                        await archiveItem(variantItem);
                        setSelected(null);
                        setHistoryVariants([]);
                        setActiveHistVariantId(null);
                      }}
                    >
                      Archive DOT {activeVar.dot_number} (stock is 0)
                    </button>
                  </div>
                );
              }
              // Non-grouped: original behaviour
              if ((selected.current_quantity ?? 0) > 0) return null;
              return (
                <div style={{ padding: "0.65rem 1.2rem", borderBottom: "1px solid var(--th-border)" }}>
                  <button
                    className="prod-btn-archive"
                    style={{ width: "100%", padding: "0.5rem", fontSize: "0.82rem" }}
                    onClick={() => archiveItem(selected)}
                  >
                    Archive this item (stock is 0)
                  </button>
                </div>
              );
            })()}

            {/* Edit Details Section */}
            <div className="prod-adj-wrap" style={{ borderBottom: "1px solid var(--th-border)" }}>
              <div
                className="th-section-label"
                style={{ color: "var(--th-sky)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => setDetailsVisible(!detailsVisible)}
              >
                Edit Item Details
                <span>{detailsVisible ? "▲" : "▼"}</span>
              </div>

              {detailsVisible && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div>
                      <label style={{ fontSize: "0.7rem", opacity: 0.7, display: "block", marginBottom: "0.2rem" }}>Category</label>
                      <select
                        className="prod-adj-input"
                        value={detailForm.category}
                        onChange={e => setDetailForm({ ...detailForm, category: e.target.value })}
                        style={{ width: "100%" }}
                      >
                        {[...DEFAULT_TIRE_CATS, ...DEFAULT_OTHER_CATS].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: "0.7rem", opacity: 0.7, display: "block", marginBottom: "0.2rem" }}>Size</label>
                      <input
                        className="prod-adj-input"
                        type="text"
                        placeholder="Size"
                        value={detailForm.size}
                        onChange={e => setDetailForm({ ...detailForm, size: e.target.value })}
                        style={{ width: "100%" }}
                        onFocus={() => setActiveSug({ idx: -1, field: 'size' })}
                        onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                      />
                      {activeSug?.idx === -1 && activeSug?.field === 'size' && detailForm.size && (
                        <div className="prod-sug-drop" style={{ width: '100%' }}>
                          {dbSizes.filter(s => s.toLowerCase().includes(detailForm.size.toLowerCase())).slice(0, 8).map(s => (
                            <div key={s} className="prod-sug-item" onMouseDown={() => setDetailForm({ ...detailForm, size: s })}>{s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: "0.7rem", opacity: 0.7, display: "block", marginBottom: "0.2rem" }}>Brand</label>
                    <input
                      className="prod-adj-input"
                      type="text"
                      placeholder="Brand"
                      value={detailForm.brand}
                      onChange={e => setDetailForm({ ...detailForm, brand: e.target.value.toUpperCase() })}
                      style={{ width: "100%" }}
                      onFocus={() => setActiveSug({ idx: -1, field: 'brand' })}
                      onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                    />
                    {activeSug?.idx === -1 && activeSug?.field === 'brand' && detailForm.brand && (
                      <div className="prod-sug-drop" style={{ width: '100%' }}>
                        {dbBrands.filter(b => b.toLowerCase().includes(detailForm.brand.toLowerCase())).slice(0, 8).map(b => (
                          <div key={b} className="prod-sug-item" onMouseDown={() => setDetailForm({ ...detailForm, brand: b })}>{b}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: "0.7rem", opacity: 0.7, display: "block", marginBottom: "0.2rem" }}>Design</label>
                    <input
                      className="prod-adj-input"
                      type="text"
                      placeholder="Design"
                      value={detailForm.design}
                      onChange={e => setDetailForm({ ...detailForm, design: e.target.value.toUpperCase() })}
                      style={{ width: "100%" }}
                      onFocus={() => setActiveSug({ idx: -1, field: 'design' })}
                      onBlur={() => setTimeout(() => setActiveSug(null), 200)}
                    />
                    {activeSug?.idx === -1 && activeSug?.field === 'design' && detailForm.design && (
                      <div className="prod-sug-drop" style={{ width: '100%' }}>
                        {dbDesigns.filter(d => {
                          const m = d.design.toLowerCase().includes(detailForm.design.toLowerCase());
                          const b = detailForm.brand ? d.brand?.toLowerCase() === detailForm.brand.toLowerCase() : true;
                          return m && b;
                        }).slice(0, 8).map(d => (
                          <div key={d.design} className="prod-sug-item" onMouseDown={() => setDetailForm({ ...detailForm, design: d.design })}>{d.design}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="prod-btn-primary"
                    style={{ fontSize: "0.82rem", padding: "0.5rem", background: "var(--th-sky)" }}
                    onClick={handleUpdateDetails}
                    disabled={detailsSaving}
                  >
                    {detailsSaving ? "Saving..." : "Update Details"}
                  </button>
                </div>
              )}
            </div>

            {!selected.supplier_id && (
              <div className="prod-adj-wrap" style={{ borderBottom: "1px solid var(--th-border)" }}>
                <div className="th-section-label" style={{ color: "var(--th-orange)" }}>Assign Supplier</div>
                <div className="prod-adj-row">
                  <select
                    className="prod-adj-input"
                    value={assignSupplierId}
                    onChange={(e) => setAssignSupplierId(e.target.value)}
                  >
                    <option value="">— Select Supplier —</option>
                    {(() => {
                      const filtered = suppliers.filter(s => {
                        if (!s.supplier_brands || s.supplier_brands.length === 0) return false;
                        return s.supplier_brands.some(b => {
                          const bName = b.brand_name.toUpperCase();
                          const matchesBrandProp = selected.brand && selected.brand.toUpperCase() === bName;
                          const matchesItemName = selected.item_name && selected.item_name.toUpperCase().includes(bName);
                          return matchesBrandProp || matchesItemName;
                        });
                      });

                      const brandDisplay = selected.brand || (selected.item_name ? selected.item_name.split(' ')[0] : 'this item');

                      if (filtered.length === 0) {
                        return <option value="" disabled>No supplier carries {brandDisplay}</option>;
                      }
                      return filtered.map(s => (
                        <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>
                      ));
                    })()}
                  </select>
                  <button
                    className="prod-btn-primary"
                    style={{ fontSize: "0.82rem", padding: "0.45rem 0.85rem", whiteSpace: "nowrap" }}
                    onClick={handleAssignSupplier}
                    disabled={assigningSupplier || !assignSupplierId}
                  >
                    {assigningSupplier ? "…" : "Assign"}
                  </button>
                </div>
              </div>
            )}
            <div className="prod-adj-wrap">
              <div className="th-section-label">Stock Adjustment</div>
              {(selected?.variant_count || 0) > 1 && !activeHistVariantId && (
                <div style={{ fontSize: '0.75rem', color: 'var(--th-amber,#fbbf24)', marginBottom: '0.4rem', opacity: 0.85 }}>
                  Select a DOT variant tab above to adjust its stock.
                </div>
              )}
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
        {pending && Array.isArray(pending) && (
          <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && setPending(null)}>
            <div className="confirm-box" style={{ maxWidth: "600px", width: "90vw" }}>
              <div className="confirm-title" style={{ color: "var(--th-orange)" }}>Confirm Bulk Add</div>
              <div className="confirm-details" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <p style={{ marginBottom: ".5rem", fontSize: "0.9rem" }}>You are about to add the following <b>{pending.length}</b> product(s):</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {pending.map((p, i) => (
                    <div key={i} style={{
                      background: "var(--th-bg-dark)",
                      padding: "0.8rem",
                      borderRadius: 8,
                      borderLeft: "4px solid var(--th-orange)"
                    }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--th-text-heading)" }}>{p.item_name}</div>
                      <div style={{ display: "flex", gap: ".5rem", fontSize: "0.75rem", opacity: 0.8, marginTop: "0.2rem" }}>
                        <span>SKU: {p.sku}</span>
                        <span>Cat: {p.category}</span>
                        {p.dot_number && <span style={{ color: "var(--th-amber)" }}>DOT: {p.dot_number}</span>}
                      </div>
                      <div style={{ display: "flex", gap: ".5rem", fontSize: "0.75rem", opacity: 0.8, marginTop: "0.1rem" }}>
                        <span>Cost: ₱{Number(p.unit_cost).toLocaleString()}</span>
                        <span>Price: ₱{Number(p.selling_price).toLocaleString()}</span>
                        {p.quantity > 0 && <span style={{ fontWeight: 700, color: "var(--th-emerald)" }}>Init Qty: {p.quantity}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="confirm-actions" style={{ marginTop: "1.5rem" }}>
                <button
                  className="confirm-btn-cancel"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </button>
                <button className="confirm-btn-ok" style={{ background: "var(--th-orange)" }} onClick={confirmAddItem}>
                  Confirm Save
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
    </>
  );
}

export default Productspage;
