/** @type {import('expo/fingerprint').Config} */
const config = {
  // SDK 58's @expo/fingerprint default. Pin it so CI and local CLI stay aligned
  // if a later toolchain changes the implicit default.
  preset: 'balanced',
};

module.exports = config;
