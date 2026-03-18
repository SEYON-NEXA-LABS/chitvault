import { createContext, useContext } from 'react'
import { applyBranding as applyBrandingFunc } from './BrandingProvider'

export const AVAILABLE_FONTS = [
  { label: 'DM Sans', value: 'DM Sans' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Montserrat', value: 'Montserrat' },
]

export const PRESET_COLORS = [
    { label: 'ChitVault Gold', value: '#c9a84c' },
    { label: 'Crimson Red', value: '#dc143c' },
    { label: 'Forest Green', value: '#228b22' },
    { label: 'Royal Blue', value: '#4169e1' },
    { label: 'Purple Plum', value: '#dda0dd' },
    { label: 'Orange Peel', value: '#ffa500' },
]

const BrandingContext = createContext({ applyBranding: applyBrandingFunc });

export function useBranding() {
  return useContext(BrandingContext);
}
