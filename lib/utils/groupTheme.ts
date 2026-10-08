import { 
  // Geometric & Abstract Insignias (Rarely used in functional UI)
  Hexagon, Pentagon, Octagon, Diamond, Shapes, Triangle,
  Sparkle, Asterisk, Disc, CircleDot,
  
  // Emblems, Seals & Crests (Very distinct on monochrome print)
  Gem, Award, Trophy, Medal, Crown, Landmark,
  ShieldHalf, ShieldCheck, Flame, Compass,
  
  // Tangible Unique Artifacts (Instantly recognisable silhouettes)
  Anchor, Feather, KeyRound, PocketKnife, Hourglass,
  FlaskConical, Telescope, Compass as NauticalCompass,
  Scroll, Stamp, BookmarkCheck,
  
  // Celestial & Mythic
  SunMedium, Orbit, Mountain, Trees, Waves, Wind,
  
  // Distinctive Financial / Symbolic Marks (Non-standard)
  Boxes, Package2, ShieldAlert,
  type LucideIcon
} from 'lucide-react'

export interface GroupTheme {
  icon: LucideIcon
  label: string
  shortCode: string
  color: string
  bg: string
  border: string
}

/**
 * Curated collection of EXCLUSIVE, NON-GENERIC icons reserved ONLY for Chit Groups.
 * 
 * Specifically filtered to EXCLUDE standard application UI icons:
 * - NO navigation icons (Users, LayoutDashboard, Gavel, Settings, Trash, Edit, Phone, MapPin, etc.)
 * - NO common action icons (Check, Plus, Alert, Search, Arrow, Download, Eye, etc.)
 * - NO generic financial icons (Wallet, Dollar, CreditCard, Banknote, Receipt, etc.)
 * 
 * Every icon here is a distinctive heraldic, geometric, or unique artifact symbol
 * that produces an unmistakable silhouette in both color screens and black-and-white printing.
 */
export const DISTINCT_ICONS: Array<{ icon: LucideIcon; label: string }> = [
  // Tier 1: Emblems & Seals
  { icon: Gem,             label: 'Gem' },
  { icon: Award,           label: 'Award' },
  { icon: Medal,           label: 'Medal' },
  { icon: Crown,           label: 'Crown' },
  { icon: Trophy,          label: 'Trophy' },
  { icon: Stamp,           label: 'Seal Stamp' },
  { icon: Landmark,        label: 'Monolith' },
  { icon: ShieldHalf,      label: 'Crest' },
  { icon: BookmarkCheck,   label: 'Insignia' },

  // Tier 2: Distinct Physical Artifacts (Sharp, identifiable B&W lines)
  { icon: Anchor,          label: 'Anchor' },
  { icon: Feather,         label: 'Feather Quill' },
  { icon: KeyRound,        label: 'Ancient Key' },
  { icon: Hourglass,       label: 'Hourglass' },
  { icon: PocketKnife,     label: 'Artifact' },
  { icon: Compass,         label: 'Mariner Compass' },
  { icon: FlaskConical,    label: 'Flask' },
  { icon: Telescope,       label: 'Telescope' },
  { icon: Scroll,          label: 'Charter Scroll' },

  // Tier 3: Geometric & Heraldic Polygons
  { icon: Hexagon,         label: 'Hexagon' },
  { icon: Pentagon,        label: 'Pentagon' },
  { icon: Octagon,         label: 'Octagon' },
  { icon: Diamond,         label: 'Diamond' },
  { icon: Shapes,          label: 'Shapes' },
  { icon: CircleDot,       label: 'Bullseye' },
  { icon: Disc,            label: 'Disc' },
  { icon: Asterisk,        label: 'Star Asterisk' },
  { icon: Sparkle,         label: 'Sparkle' },

  // Tier 4: Natural & Elemental Silhouettes
  { icon: Flame,           label: 'Eternal Flame' },
  { icon: Mountain,        label: 'Mountain Peak' },
  { icon: Trees,           label: 'Grove' },
  { icon: Waves,           label: 'Ocean Waves' },
  { icon: Wind,            label: 'Zephyr' },
  { icon: SunMedium,       label: 'Radiant Sun' },
  { icon: Orbit,           label: 'Celestial Orbit' },
  { icon: Boxes,           label: 'Vault Boxes' },
  { icon: Package2,        label: 'Coffer' },
]

export const TOTAL_UNIQUE_THEMES = DISTINCT_ICONS.length

/**
 * Extracts a compact 2-4 character badge code from group name.
 * Examples:
 *   "25/30LAKHS/26-27" -> "30L"
 *   "05/6LAKHS"        -> "6L"
 *   "08/2.25LAKHS"     -> "2.25L"
 *   "GOLD SCHEME A"    -> "GS"
 */
export function getGroupShortCode(groupName?: string): string {
  if (!groupName) return 'GP'
  
  const lakhMatch = groupName.match(/(\d+(?:\.\d+)?)\s*(?:LAKHS?|L)/i)
  if (lakhMatch) return `${lakhMatch[1]}L`

  const slashMatch = groupName.match(/\/(\d+(?:\.\d+)?)/)
  if (slashMatch) return `${slashMatch[1]}L`

  const words = groupName.trim().split(/[\s\-_/]+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return groupName.slice(0, 3).toUpperCase()
}

/**
 * Deterministically returns the unique group icon based on its ID or Name.
 * Style is clean, professional monochrome/neutral that looks identical
 * and pin-sharp on screen and black-and-white print.
 */
export function getGroupTheme(index: number = 0, groupId?: number | string, groupName?: string): GroupTheme {
  let hash = Math.abs(index)
  if (typeof groupId === 'number') {
    hash = Math.abs(groupId)
  } else if (typeof groupId === 'string') {
    hash = groupId.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0)
  } else if (groupName) {
    hash = groupName.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0)
  }

  const iconIdx = hash % DISTINCT_ICONS.length
  const selected = DISTINCT_ICONS[iconIdx]
  const shortCode = getGroupShortCode(groupName)

  return {
    icon: selected.icon,
    label: selected.label,
    shortCode,
    color: 'var(--text)',
    bg: 'var(--surface2)',
    border: 'var(--border)'
  }
}

// Backwards-compatible legacy array export for existing imports
export const GROUP_PALETTE: GroupTheme[] = DISTINCT_ICONS.map((item, i) => ({
  icon: item.icon,
  label: item.label,
  shortCode: `G${i + 1}`,
  color: 'var(--text)',
  bg: 'var(--surface2)',
  border: 'var(--border)'
}))
