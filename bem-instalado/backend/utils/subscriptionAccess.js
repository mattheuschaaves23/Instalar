function isLaunchAccessEnabled() {
  const configured = String(process.env.SUBSCRIPTION_LAUNCH_ACCESS || '').trim().toLowerCase();

  if (configured) {
    return ['1', 'true', 'yes', 'on'].includes(configured);
  }

  return process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
}

module.exports = {
  isLaunchAccessEnabled,
};
