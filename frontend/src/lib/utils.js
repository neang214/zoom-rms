import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs) { return twMerge(clsx(inputs)) }

const rawApiUrl = import.meta.env.VITE_API_URL || ""
const cleanApiUrl = rawApiUrl.replace(/\/api\/?$/, "")

// When running locally or when VITE_API_URL is unset, return empty string so images
// use relative URLs (e.g. /uploads/...) and are fetched through Vite's dev proxy.
// This prevents mobile devices on LAN from trying to load from mobile's own localhost:8080.
const getImgOrigin = () => {
  if (!cleanApiUrl) return ""
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanApiUrl)
  ) {
    return ""
  }
  return cleanApiUrl
}

export function imageUrl(src, fallback = null) {
  if (!src) return fallback

  let cleanSrc = typeof src === "string" ? src.trim() : ""
  if (!cleanSrc) return fallback

  // Strip localhost/127.0.0.1 origin if it was saved into the DB, converting it to relative
  cleanSrc = cleanSrc.replace(/^https?:\/\/(localhost|127\.0\.0\.1):8080\/?/, "/")

  // External URLs (e.g. Unsplash), data URLs, blob URLs stay as-is
  if (/^(https?:|blob:|data:)/.test(cleanSrc)) return cleanSrc

  const origin = getImgOrigin()
  const path = cleanSrc.startsWith("/") ? cleanSrc : `/${cleanSrc}`
  return `${origin}${path}`
}

/*
 * Resolves a menu item's display name for the given language. Falls back
 * to the English name if there's no Khmer translation set (or the item is
 * missing entirely). Used everywhere a menu item name is shown, so it
 * follows whichever language the viewer (guest or staff) has selected.
 */
export function menuItemName(item, lang) {
  if (!item) return ""
  if (lang === "km" && item.item_name_km) return item.item_name_km
  return item.item_name
}

export const CATEGORY_MAP_KM = {
  "all": "ទាំងអស់",
  "all categories": "គ្រប់ប្រភេទទាំងអស់",
  "main course": "ម្ហូបចម្បង",
  "appetizers": "ម្ហូបបើកឆាក",
  "snacks": "អាហារសម្រន់",
  "desserts": "បង្អែម",
  "dessert": "បង្អែម",
  "coffee & tea": "កាហ្វេ និងតែ",
  "soft drinks": "ភេសជ្ជៈ",
  "wine": "ស្រា",
  "food": "ម្ហូប",
  "drink": "ភេសជ្ជៈ",
  "drinks": "ភេសជ្ជៈ",
  "beverage": "ភេសជ្ជៈ",
  "beverages": "ភេសជ្ជៈ",
}

export function categoryDisplayName(categoryOrName, lang) {
  const name = typeof categoryOrName === "object" ? categoryOrName?.category_name : categoryOrName
  if (!name) return ""
  if (lang === "km") {
    const key = name.toLowerCase().trim()
    if (CATEGORY_MAP_KM[key]) return CATEGORY_MAP_KM[key]
  }
  return name
}

export function normalizeSearchText(str) {
  if (!str) return ""
  return String(str)
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
}

export function menuItemMatchesSearch(item, search, catName = null) {
  const q = normalizeSearchText(search)
  if (!q) return true

  const en = normalizeSearchText(item?.item_name)
  const km = normalizeSearchText(item?.item_name_km)
  if (en.includes(q) || km.includes(q)) return true

  const category = catName || item?.category?.category_name
  if (category) {
    const cEn = normalizeSearchText(category)
    const cKm = normalizeSearchText(categoryDisplayName(category, "km"))
    if (cEn.includes(q) || cKm.includes(q)) return true
  }

  return false
}

const DELETE_ERROR_KEYS = {
  TABLE_HAS_ORDERS: "errors.tableHasOrders",
  TABLE_HAS_ACTIVE_ORDER: "errors.tableHasActiveOrder",
  USER_HAS_RECORDS: "errors.userHasRecords",
  ITEM_HAS_ORDERS: "errors.itemHasOrders",
  CATEGORY_HAS_ITEMS: "errors.categoryHasItems",
  SUPPLIER_HAS_RECORDS: "errors.supplierHasRecords",
  UNIT_HAS_STOCK: "errors.unitHasStock",
}

export function deleteErrorMessage(err, t) {
  const code = err?.response?.data?.code
  const key = code && DELETE_ERROR_KEYS[code]
  if (key) return t(key)
  return err?.response?.data?.message || t("errors.deleteFailed")
}

