/**
 * Haptic Feedback Utility
 * Uses the navigator.vibrate API to provide tactile feedback on mobile devices.
 */
export const haptics = {
  // A subtle tick for buttons and small interactions
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10)
    }
  },
  
  // A standard pulse for successful actions
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20)
    }
  },
  
  // A stronger double-pulse for important confirmations
  heavy: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 50, 30])
    }
  },
  
  // An error vibration pattern
  error: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([50, 100, 50, 100, 50])
    }
  }
}
