// FEATURE 1 (ads) - integration point for the real Meta (Facebook/Instagram) Marketing API.
// Deliberately NOT implemented against the live API here - that requires a Meta Business
// account, an approved app, and access tokens the admin doesn't have configured yet. This file
// exists so that work is a drop-in later: everything that calls into this module already
// checks `isMetaConfigured` first and shows a clear "Connect Meta Business Account" state
// instead of pretending a campaign was posted or that impression numbers exist.
//
// To wire up the real thing later: set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in backend/.env,
// then implement createMetaCampaign/getCampaignInsights below using the Marketing API
// (https://developers.facebook.com/docs/marketing-apis) - nothing else in this codebase needs
// to change, since adController already calls these through this module.

const isMetaConfigured = () => !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);

// Would create/publish the campaign via the Marketing API. Throws until real credentials and
// an implementation are added - callers must check isMetaConfigured() first and never call this
// speculatively, so the admin is never told something was posted when it wasn't.
async function createMetaCampaign(/* campaign */) {
  throw new Error("Meta Marketing API is not connected yet. Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to enable posting.");
}

// Would fetch real impressions/reach from the Marketing API for a synced campaign.
async function getCampaignInsights(/* metaCampaignId */) {
  throw new Error("Meta Marketing API is not connected yet.");
}

module.exports = { isMetaConfigured, createMetaCampaign, getCampaignInsights };
