import { supabase } from './supabase';

// Session timeout in minutes
const SESSION_TIMEOUT = 60;
const ACTIVITY_TIMEOUT = 15;
let lastActivity = Date.now();

export const setupSessionTimeout = () => {
  let timeoutId: number;
  let activityCheckId: number;

  const checkInactivity = () => {
    const now = Date.now();
    if (now - lastActivity > ACTIVITY_TIMEOUT * 60 * 1000) {
      handleTimeout();
    }
  };

  const handleTimeout = async () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(activityCheckId);
    await supabase.auth.signOut();
    window.location.href = '/login?timeout=true';
  };

  const resetTimeout = () => {
    window.clearTimeout(timeoutId);
    lastActivity = Date.now();
    timeoutId = window.setTimeout(handleTimeout, SESSION_TIMEOUT * 60 * 1000);
  };

  // Reset timeout on user activity
  const handleActivity = () => {
    lastActivity = Date.now();
    resetTimeout();
  };

  // Add event listeners for user activity
  window.addEventListener('mousemove', handleActivity);
  window.addEventListener('keydown', handleActivity);
  window.addEventListener('click', handleActivity);
  window.addEventListener('scroll', handleActivity);
  window.addEventListener('touchstart', handleActivity);

  // Initial timeout setup
  resetTimeout();
  
  // Start activity check interval
  activityCheckId = window.setInterval(checkInactivity, 60 * 1000);

  // Cleanup function
  return () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(activityCheckId);
    window.removeEventListener('mousemove', handleActivity);
    window.removeEventListener('keydown', handleActivity);
    window.removeEventListener('click', handleActivity);
    window.removeEventListener('scroll', handleActivity);
    window.removeEventListener('touchstart', handleActivity);
  };
};

export const getSessionTimeRemaining = (): number => {
  return Math.max(0, SESSION_TIMEOUT - Math.floor((Date.now() - lastActivity) / (60 * 1000)));
};