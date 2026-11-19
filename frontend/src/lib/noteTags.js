export const NOTE_TAGS = [
  { id: "no_ice", labelKey: "noteTag.noIce" },
  { id: "less_sugar", labelKey: "noteTag.lessSugar" },
  { id: "no_onion", labelKey: "noteTag.noOnion" },
  { id: "extra_spicy", labelKey: "noteTag.extraSpicy" },
  { id: "less_spicy", labelKey: "noteTag.lessSpicy" },
  { id: "allergy", labelKey: "noteTag.allergy", allergy: true },
]

export function isAllergyNote(note) {
  if (!note) return false
  return /allerg|អាលែកហ្ស៊ី/i.test(note)
}
