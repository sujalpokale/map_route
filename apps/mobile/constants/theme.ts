export const THEME = {
  colors: {
    // Google Maps Dark/Light Surface & Backgrounds
    background: '#202124',
    backgroundSecondary: '#1F2023',
    card: '#303134',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
    cardHover: '#3C4043',
    cardElevated: '#303134',
    
    // Core Google Maps Accents
    primary: '#1A73E8', // Google Blue
    primaryLight: '#8AB4F8', // Google Blue Light / Dark Mode Accent
    primaryDark: '#174EA6', // Google Blue Dark
    primaryGlow: 'rgba(26, 115, 232, 0.22)',
    
    secondary: '#8AB4F8', // Google Secondary
    secondaryGlow: 'rgba(138, 180, 248, 0.2)',

    // Google Semantic Colors
    googleBlue: '#1A73E8',
    googleGreen: '#34A853',
    googleRed: '#EA4335',
    googleYellow: '#FBBC04',

    // Status Colors
    success: '#34A853', // Google Green
    successGlow: 'rgba(52, 168, 83, 0.25)',
    warning: '#FBBC04', // Google Yellow
    warningGlow: 'rgba(251, 188, 4, 0.25)',
    danger: '#EA4335', // Google Red
    dangerGlow: 'rgba(234, 67, 53, 0.25)',
    info: '#1A73E8', // Google Blue

    // Google Maps Typography
    text: '#E8EAED',
    textSecondary: '#BDC1C6',
    textMuted: '#9AA0A6',
    textInverse: '#202124',

    // Route Traffic Severity
    trafficLow: '#34A853',
    trafficModerate: '#FBBC04',
    trafficHigh: '#EA4335',
    trafficSevere: '#B31412',

    // Map Overlays
    routePrimary: '#1A73E8',
    routeAlternative: '#70757A',
    routeCongested: '#EA4335',
    currentLocationPuck: '#1A73E8',
    markerOrigin: '#34A853',
    markerDestination: '#EA4335',
    markerWaypoint: '#1A73E8',
    markerLocked: '#FBBC04',
  },

  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    sizes: {
      xs: 11,
      sm: 13,
      md: 15,
      base: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      display: 32,
      hero: 40,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    }
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    screen: 16,
  },

  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    glowCyan: {
      shadowColor: '#06B6D4',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};

export const getScoreColor = (score: number): string => {
  if (score >= 88) return THEME.colors.success;
  if (score >= 75) return THEME.colors.primary;
  if (score >= 60) return THEME.colors.warning;
  return THEME.colors.danger;
};

export const getTrafficColor = (level: string): string => {
  switch (level?.toLowerCase()) {
    case 'low':
      return THEME.colors.trafficLow;
    case 'moderate':
      return THEME.colors.trafficModerate;
    case 'high':
      return THEME.colors.trafficHigh;
    case 'severe':
      return THEME.colors.trafficSevere;
    default:
      return THEME.colors.trafficModerate;
  }
};
