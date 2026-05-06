import React from "react";
import { API_URL, apiFetch } from "../lib/config";

const TIRE_CATEGORY_SET = new Set([
  "PCR", "SUV", "TBR", "LT", "MOTORCYCLE", "TUBE", "RECAP", "FLAP", "RECAPPING",
]);

const TIRE_CATS_BASE = ["PCR", "SUV", "TBR", "LT", "MOTORCYCLE", "TUBE", "RECAP", "FLAP", "RECAPPING"];
const OTHER_CATS_BASE = ["VALVE", "WHEEL WEIGHT", "WHEEL BALANCING", "ACCESSORIES", "OTHER"];

const LS_KEY = "th-user-cats";

function loadUserCats() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{"tire":[],"other":[]}');
  } catch {
    return { tire: [], other: [] };
  }
}

export default function useItemCategories(shopId) {
  const [tireCategories, setTireCategories] = React.useState(TIRE_CATS_BASE);
  const [otherCategories, setOtherCategories] = React.useState(OTHER_CATS_BASE);

  React.useEffect(() => {
    const userAdded = loadUserCats();
    // Merge base + user-added immediately so UI is ready before DB responds
    setTireCategories([...new Set([...TIRE_CATS_BASE, ...(userAdded.tire || [])])]);
    setOtherCategories([...new Set([...OTHER_CATS_BASE, ...(userAdded.other || [])])]);

    if (!shopId && shopId !== 0) return;

    apiFetch(`${API_URL}/item-categories/any`)
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d)) return;
        const dbTire = d.filter((c) => TIRE_CATEGORY_SET.has(c.toUpperCase()));
        const dbOther = d.filter((c) => !TIRE_CATEGORY_SET.has(c.toUpperCase()));
        setTireCategories([
          ...new Set([...TIRE_CATS_BASE, ...dbTire, ...(userAdded.tire || [])]),
        ]);
        setOtherCategories([
          ...new Set([...OTHER_CATS_BASE, ...dbOther, ...(userAdded.other || [])]),
        ]);
      })
      .catch(() => {});
  }, [shopId]);

  function addCategory(name, type) {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return;
    const userAdded = loadUserCats();
    if (type === "tire") {
      userAdded.tire = [...new Set([...(userAdded.tire || []), trimmed])];
      setTireCategories((prev) => [...new Set([...prev, trimmed])]);
    } else {
      userAdded.other = [...new Set([...(userAdded.other || []), trimmed])];
      setOtherCategories((prev) => [...new Set([...prev, trimmed])]);
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(userAdded));
    } catch {}
  }

  const allCategories = [...new Set([...tireCategories, ...otherCategories])];

  return { tireCategories, otherCategories, allCategories, addCategory };
}
