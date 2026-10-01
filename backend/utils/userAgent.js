// FEATURE 2 (analytics) - a small, dependency-free User-Agent parser. It doesn't aim to be as
// exhaustive as a full library like ua-parser-js, but covers the common device/browser/OS
// combinations well enough for analytics reporting, without adding another package.
function parseUserAgent(ua = "") {
  const s = ua || "";

  let device = "desktop";
  if (/Tablet|iPad/i.test(s)) device = "tablet";
  else if (/Mobi|Android(?!.*Tablet)|iPhone/i.test(s)) device = "mobile";
  if (!s) device = "unknown";

  let browser = "Unknown";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/SamsungBrowser/i.test(s)) browser = "Samsung Internet";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/CriOS/i.test(s)) browser = "Chrome (iOS)";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s) && /Version\//i.test(s)) browser = "Safari";
  else if (s) browser = "Other";

  let os = "Unknown";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X/i.test(s) && !/iPhone|iPad/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";

  return { device, browser, os };
}

module.exports = { parseUserAgent };
