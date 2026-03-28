// Theme definitions shared across client and server

export interface Theme {
  id: string;
  name: string;
  primary: string;
  accent: string;
  bg: string;
}

export const THEMES: Theme[] = [
  { 
    id: 'theme1', 
    name: 'Royal Eggplant', 
    primary: '#4A8BDF', // Royal Blue
    accent: '#A0006D',  // Eggplant
    bg: '#EFFAFD'      // Pale Blue
  },
  { 
    id: 'theme2', 
    name: 'Lime White', 
    primary: '#00DD00', // Lime
    accent: '#008800',  // Darker Lime for contrast
    bg: '#FFFFFF' 
  },
  { 
    id: 'theme3', 
    name: 'Bright Sky', 
    primary: '#00ABE4', // Bright Blue
    accent: '#007AA3',  // Deep Sky Blue
    bg: '#E9F1FA'      // Light Blue
  },
  { 
    id: 'theme4', 
    name: 'Neon Grey', 
    primary: '#BAFF39', // Yellow-green
    accent: '#6E6E6E',  // Dim grey
    bg: '#FFFFFF' 
  },
  { 
    id: 'theme5', 
    name: 'Green Ivory', 
    primary: '#009B4D', // Green
    accent: '#FFCC00',  // Tangerine Yellow
    bg: '#FAF5E9'      // Ivory
  },
  { 
    id: 'theme6', 
    name: 'Forest Red', 
    primary: '#205A28', // Green
    accent: '#C72B32',  // Red
    bg: '#FFFFFF' 
  },
]

export const DEFAULT_THEME = THEMES[0]

export function getTheme(id?: string | null): Theme {
  return THEMES.find(t => t.id === id) || DEFAULT_THEME
}
