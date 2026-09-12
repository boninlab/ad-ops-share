const statusText = document.querySelector('#statusText');
const recordingText = document.querySelector('#recordingText');
const pageTitle = document.querySelector('#pageTitle');

const DEFAULT_DAILY_BUDGET = 150000;
const DEFAULT_BID_PRICE = 340;
const DEFAULT_POWERLINK_BID_PRICE = 340;
const MIN_POWERLINK_BID_PRICE = 70;
const MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH = 25;
const DEFAULT_POWERLINK_KEYWORD = '버뮤다팬츠';
const DEFAULT_POWERLINK_HEADLINE = '트렌디한 {keyword:니트반팔} 여기!';
const DEFAULT_POWERLINK_SUB_LINK_URL = 'https://smartstore.naver.com/sample';
const DEFAULT_POWERLINK_EXTENSIONS = {
  subLinks: ['상의', '하의', '1+1', '당일출고'].map((name) => ({ name, final: DEFAULT_POWERLINK_SUB_LINK_URL })),
  promotionText: '회원가입 2천원 할인',
  headlines: ['365일 무료배송', '오늘출발'],
  extraDescription: '편하고 깔끔한 남성 출근룩을 만나보세요'
};
const DEFAULT_POWERLINK_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/sa/campaigns/cmp-a001-01-000000000000001';
const MOVED_BRAND_REPLACEMENTS = [
  [/cmp-a001-01-000000000000002/g, 'cmp-a001-01-000000000000001'],
  [/sample/gi, 'sample'],
  [/\bsample\b/gi, 'sample']
];
const POWERLINK_TEXT_LIMITS = {
  headline: 15,
  description: 45
};
const LEGACY_DISPLAY_NATIVE_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/1000002';
const LEGACY_DISPLAY_NATIVE_CAMPAIGN_ID = '1000002';
const DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/1000001';
const DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID = '1000001';
const LEGACY_SHOPPING_PROMOTION_CAMPAIGN_ID = '1000003';
const LEGACY_SHOPPING_PROMOTION_CAMPAIGN_URL =
  `https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/${LEGACY_SHOPPING_PROMOTION_CAMPAIGN_ID}`;
const DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/1000004';
const DEFAULT_DISPLAY_NATIVE_DAILY_BUDGET = 10000;
const DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE = 450;
const DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE = 400;
const SHOPPING_PROMOTION_AD_TEXT_LIMIT = 57;
const SHOPPING_PROMOTION_IMAGE_REQUIREMENT = { label: '쇼핑 프로모션 이미지', width: 750, height: 500 };
const DEFAULT_SHOPPING_PROMOTION_AD_TEXT = '고급소재 니트 카라 반팔, 3만원대. 무조건 무료배송!';
const DISPLAY_NATIVE_AGES = ['14-18', '19-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'];
const DEFAULT_DISPLAY_NATIVE_AGES = ['19-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59'];
const DISPLAY_NATIVE_DESCRIPTION_LIMITS = {
  adText: 20,
  short1: 12,
  short2: 12,
  short3: 12,
  long1: 28,
  long2: 28
};
const DEFAULT_DISPLAY_NATIVE_AD_TEXT = '편안한 코튼팬츠, 2만원대';
const DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS = {
  short1: '365일 무료배송!',
  short2: '코튼 100% 팬츠',
  short3: '매일 입기 좋아요',
  long1: '매일 입기 좋은 코튼 100% 팬츠',
  long2: '편안한 코튼팬츠, 2만원대'
};
const DISPLAY_NATIVE_IMAGE_REQUIREMENTS = {
  profile: { label: '프로필 이미지', width: 300, height: 300, minBytes: 1, maxBytes: 200 * 1024 - 1 },
  square: { label: '광고 이미지 1200x1200', width: 1200, height: 1200, minBytes: 80 * 1024, maxBytes: 800 * 1024 },
  wide: { label: '광고 이미지 1200x628', width: 1200, height: 628, minBytes: 50 * 1024, maxBytes: 500 * 1024 },
  tall: { label: '광고 이미지 1200x1800', width: 1200, height: 1800, minBytes: 100 * 1024, maxBytes: 1200 * 1024 },
  banner: { label: '광고 이미지 342x228', width: 342, height: 228, minBytes: 10 * 1024, maxBytes: 130 * 1024 }
};
const DISPLAY_NATIVE_AD_IMAGE_SLOTS = ['square', 'wide', 'tall', 'banner'];
const DEFAULT_DISPLAY_NATIVE_PROFILE_IMAGE_ASSET = {
  fileName: 'sample-profile.jpg',
  path: 'data/display-native-assets/sample-profile.jpg',
  mimeType: 'image/jpeg',
  size: 24655,
  uploadedAt: '2026-01-01T00:00:00.000Z'
};
const FORM_DRAFT_STORAGE_KEY = 'ad-ops-share-sample-form-v1';
const SHOPPING_GENERATED_NAME_LIMIT = 30;
const DISPLAY_GENERATED_NAME_LIMIT = 50;

const fields = {
  shoppingUseTalkTalk: document.querySelector('#shoppingUseTalkTalk'),
  shoppingTalkTalkUrl: document.querySelector('#shoppingTalkTalkUrl'),
  shoppingPromotionText1: document.querySelector('#shoppingPromotionText1'),
  shoppingPromotionText2: document.querySelector('#shoppingPromotionText2'),
  commonVendorName: document.querySelector('#commonVendorName'),
  commonProductName: document.querySelector('#commonProductName'),
  commonEndRoas: document.querySelector('#commonEndRoas'),
  commonGeneratedName: document.querySelector('#commonGeneratedName'),
  commonGeneratedNameCount: document.querySelector('#commonGeneratedNameCount'),
  commonProductUrl: document.querySelector('#commonProductUrl'),
  vendorName: document.querySelector('#commonVendorName'),
  productName: document.querySelector('#commonProductName'),
  endRoas: document.querySelector('#commonEndRoas'),
  productId: document.querySelector('#productId'),
  exposureProductName: document.querySelector('#exposureProductName'),
  generatedName: document.querySelector('#generatedName'),
  generatedNameCount: document.querySelector('#generatedNameCount'),
  browserMode: document.querySelector('#browserMode'),
  browserCdpUrl: document.querySelector('#browserCdpUrl'),
  campaignDailyBudget: document.querySelector('#campaignDailyBudget'),
  adGroupDailyBudget: document.querySelector('#adGroupDailyBudget'),
  defaultBidPrice: document.querySelector('#defaultBidPrice'),
  useAutoTracking: document.querySelector('#useAutoTracking'),
  useBudgetDistribution: document.querySelector('#useBudgetDistribution'),
  powerlinkCampaignUrl: document.querySelector('#powerlinkCampaignUrl'),
  powerlinkVendorName: document.querySelector('#commonVendorName'),
  powerlinkProductName: document.querySelector('#commonProductName'),
  powerlinkEndRoas: document.querySelector('#commonEndRoas'),
  powerlinkKeyword: document.querySelector('#powerlinkKeyword'),
  powerlinkKeywordList: document.querySelector('#powerlinkKeywordList'),
  powerlinkKeywordCount: document.querySelector('#powerlinkKeywordCount'),
  powerlinkGeneratedName: document.querySelector('#powerlinkGeneratedName'),
  powerlinkGeneratedNameCount: document.querySelector('#powerlinkGeneratedNameCount'),
  powerlinkHeadline: document.querySelector('#powerlinkHeadline'),
  powerlinkDescription: document.querySelector('#powerlinkDescription'),
  powerlinkHeadlineCount: document.querySelector('#powerlinkHeadlineCount'),
  powerlinkDescriptionCount: document.querySelector('#powerlinkDescriptionCount'),
  powerlinkSubLinks: document.querySelector('#powerlinkSubLinks'),
  powerlinkSubLinksCount: document.querySelector('#powerlinkSubLinksCount'),
  powerlinkPromotionText: document.querySelector('#powerlinkPromotionText'),
  powerlinkPromotionTextCount: document.querySelector('#powerlinkPromotionTextCount'),
  powerlinkExtensionHeadlines: document.querySelector('#powerlinkExtensionHeadlines'),
  powerlinkExtensionHeadlinesCount: document.querySelector('#powerlinkExtensionHeadlinesCount'),
  powerlinkExtraDescription: document.querySelector('#powerlinkExtraDescription'),
  powerlinkExtraDescriptionCount: document.querySelector('#powerlinkExtraDescriptionCount'),
  powerlinkProductLink: document.querySelector('#commonProductUrl'),
  powerlinkImages: document.querySelector('#powerlinkImages'),
  powerlinkSavedImages: document.querySelector('#powerlinkSavedImages'),
  powerlinkAdGroupDailyBudget: document.querySelector('#powerlinkAdGroupDailyBudget'),
  powerlinkDefaultBidPrice: document.querySelector('#powerlinkDefaultBidPrice'),
  displayNativeCampaignUrl: document.querySelector('#displayNativeCampaignUrl'),
  displayNativeVendorName: document.querySelector('#commonVendorName'),
  displayNativeProductName: document.querySelector('#commonProductName'),
  displayNativeEndRoas: document.querySelector('#commonEndRoas'),
  displayNativeGeneratedName: document.querySelector('#displayNativeGeneratedName'),
  displayNativeGeneratedNameCount: document.querySelector('#displayNativeGeneratedNameCount'),
  displayNativeDailyBudget: document.querySelector('#displayNativeDailyBudget'),
  displayNativeBidStrategyValue: document.querySelector('#displayNativeBidStrategyValue'),
  displayNativeStartAt: document.querySelector('#displayNativeStartAt'),
  displayNativeLandingUrl: document.querySelector('#commonProductUrl'),
  displayGenderFemale: document.querySelector('#displayGenderFemale'),
  displayGenderMale: document.querySelector('#displayGenderMale'),
  displayGenderUnknown: document.querySelector('#displayGenderUnknown'),
  displayAgeModeAll: document.querySelector('#displayAgeModeAll'),
  displayAgeModeManual: document.querySelector('#displayAgeModeManual'),
  displayAgeSelectAll: document.querySelector('#displayAgeSelectAll'),
  displayAgeUnknown: document.querySelector('#displayAgeUnknown'),
  displayProfileImage: document.querySelector('#displayProfileImage'),
  displayAdImages: document.querySelector('#displayAdImages'),
  displayAdImageDropzone: document.querySelector('#displayAdImageDropzone'),
  displayAdImageBatchStatus: document.querySelector('#displayAdImageBatchStatus'),
  displaySquareImage: document.querySelector('#displaySquareImage'),
  displayWideImage: document.querySelector('#displayWideImage'),
  displayTallImage: document.querySelector('#displayTallImage'),
  displayBannerImage: document.querySelector('#displayBannerImage'),
  displayProfilePreview: document.querySelector('#displayProfilePreview'),
  displaySquarePreview: document.querySelector('#displaySquarePreview'),
  displayWidePreview: document.querySelector('#displayWidePreview'),
  displayTallPreview: document.querySelector('#displayTallPreview'),
  displayBannerPreview: document.querySelector('#displayBannerPreview'),
  displaySavedProfileImage: document.querySelector('#displaySavedProfileImage'),
  displaySavedSquareImage: document.querySelector('#displaySavedSquareImage'),
  displaySavedWideImage: document.querySelector('#displaySavedWideImage'),
  displaySavedTallImage: document.querySelector('#displaySavedTallImage'),
  displaySavedBannerImage: document.querySelector('#displaySavedBannerImage'),
  displayAdText: document.querySelector('#displayAdText'),
  displayShortDescription1: document.querySelector('#displayShortDescription1'),
  displayShortDescription2: document.querySelector('#displayShortDescription2'),
  displayShortDescription3: document.querySelector('#displayShortDescription3'),
  displayLongDescription1: document.querySelector('#displayLongDescription1'),
  displayLongDescription2: document.querySelector('#displayLongDescription2'),
  displayAdTextCount: document.querySelector('#displayAdTextCount'),
  displayShortDescription1Count: document.querySelector('#displayShortDescription1Count'),
  displayShortDescription2Count: document.querySelector('#displayShortDescription2Count'),
  displayShortDescription3Count: document.querySelector('#displayShortDescription3Count'),
  displayLongDescription1Count: document.querySelector('#displayLongDescription1Count'),
  displayLongDescription2Count: document.querySelector('#displayLongDescription2Count'),
  shoppingPromotionCampaignUrl: document.querySelector('#shoppingPromotionCampaignUrl'),
  shoppingPromotionVendorName: document.querySelector('#commonVendorName'),
  shoppingPromotionProductName: document.querySelector('#commonProductName'),
  shoppingPromotionEndRoas: document.querySelector('#commonEndRoas'),
  shoppingPromotionGeneratedName: document.querySelector('#shoppingPromotionGeneratedName'),
  shoppingPromotionGeneratedNameCount: document.querySelector('#shoppingPromotionGeneratedNameCount'),
  shoppingPromotionDailyBudget: document.querySelector('#shoppingPromotionDailyBudget'),
  shoppingPromotionBidStrategyValue: document.querySelector('#shoppingPromotionBidStrategyValue'),
  shoppingPromotionStartAt: document.querySelector('#shoppingPromotionStartAt'),
  shoppingPromotionLandingUrl: document.querySelector('#commonProductUrl'),
  shoppingPromotionGenderFemale: document.querySelector('#shoppingPromotionGenderFemale'),
  shoppingPromotionGenderMale: document.querySelector('#shoppingPromotionGenderMale'),
  shoppingPromotionGenderUnknown: document.querySelector('#shoppingPromotionGenderUnknown'),
  shoppingPromotionAgeModeAll: document.querySelector('#shoppingPromotionAgeModeAll'),
  shoppingPromotionAgeModeManual: document.querySelector('#shoppingPromotionAgeModeManual'),
  shoppingPromotionAgeSelectAll: document.querySelector('#shoppingPromotionAgeSelectAll'),
  shoppingPromotionAgeUnknown: document.querySelector('#shoppingPromotionAgeUnknown'),
  shoppingPromotionImage: document.querySelector('#shoppingPromotionImage'),
  shoppingPromotionImagePreview: document.querySelector('#shoppingPromotionImagePreview'),
  shoppingPromotionSavedImage: document.querySelector('#shoppingPromotionSavedImage'),
  shoppingPromotionAdText: document.querySelector('#shoppingPromotionAdText'),
  shoppingPromotionAdTextCount: document.querySelector('#shoppingPromotionAdTextCount')
};

const displayAgeCheckboxes = Array.from(document.querySelectorAll('input[name="displayAge"]'));
const shoppingPromotionAgeCheckboxes = Array.from(document.querySelectorAll('input[name="shoppingPromotionAge"]'));
const displayDescriptionFields = {
  adText: { input: fields.displayAdText, counter: fields.displayAdTextCount },
  short1: { input: fields.displayShortDescription1, counter: fields.displayShortDescription1Count },
  short2: { input: fields.displayShortDescription2, counter: fields.displayShortDescription2Count },
  short3: { input: fields.displayShortDescription3, counter: fields.displayShortDescription3Count },
  long1: { input: fields.displayLongDescription1, counter: fields.displayLongDescription1Count },
  long2: { input: fields.displayLongDescription2, counter: fields.displayLongDescription2Count }
};
const powerlinkTextFields = {
  headline: { input: fields.powerlinkHeadline, counter: fields.powerlinkHeadlineCount },
  description: { input: fields.powerlinkDescription, counter: fields.powerlinkDescriptionCount }
};
const displayImageFields = {
  profile: { input: fields.displayProfileImage, note: fields.displaySavedProfileImage, preview: fields.displayProfilePreview },
  square: { input: fields.displaySquareImage, note: fields.displaySavedSquareImage, preview: fields.displaySquarePreview },
  wide: { input: fields.displayWideImage, note: fields.displaySavedWideImage, preview: fields.displayWidePreview },
  tall: { input: fields.displayTallImage, note: fields.displaySavedTallImage, preview: fields.displayTallPreview },
  banner: { input: fields.displayBannerImage, note: fields.displaySavedBannerImage, preview: fields.displayBannerPreview }
};

let currentConfig;
let activeTab = parseTabFromHash();
let lastAutoExposureProductName = '';
let lastAutoPowerlinkHeadline = DEFAULT_POWERLINK_HEADLINE;
let lastAutoPowerlinkDescription = buildPowerlinkDescription(DEFAULT_POWERLINK_KEYWORD);
let localStatusHoldUntil = 0;
let lastStatusFetchError = '';
let pendingDisplayNativeAdImages = {};
const displayNativePreviewObjectUrls = {};
let shoppingPromotionPreviewObjectUrl = '';
let formReadyForAutosave = false;
let autosaveTimer;
let autosaveInFlight = false;
let autosaveQueued = false;
let lastAutoProductId = '';

// Normalize before field listeners run, without interrupting Korean IME composition.
for (const eventName of ['input', 'compositionend']) {
  document.addEventListener(eventName, (event) => {
    const control = event.target;
    if (event.isComposing || !control.matches?.('input[type="text"], input:not([type]), textarea')) return;
    const normalized = normalizeText(control.value);
    if (normalized === control.value) return;
    const start = control.selectionStart;
    const end = control.selectionEnd;
    const nextStart = start === null ? null : normalizeText(control.value.slice(0, start)).length;
    const nextEnd = end === null ? null : normalizeText(control.value.slice(0, end)).length;
    control.value = normalized;
    if (nextStart !== null && nextEnd !== null) control.setSelectionRange(nextStart, nextEnd);
  }, true);
}

function migrateShoppingBidPrice(value) {
  let migrated = false;
  try { migrated = localStorage.getItem('shopping-bid-default-340') === 'done'; } catch {}
  return value == null || value === '' || (!migrated && Number(value) === 250) ? DEFAULT_BID_PRICE : value;
}

document.querySelector('#saveButton').addEventListener('click', () => saveConfig().catch(showError));
document.querySelector('#loginButton').addEventListener('click', () => openLogin().catch(showError));
document.querySelector('#runButton').addEventListener('click', () => runHttpAutomation().catch(showError));
document.querySelector('#closeButton').addEventListener('click', () => postAction('/api/browser/close').catch(showError));
document.querySelector('#recordStartButton').addEventListener('click', () => startNetworkRecording().catch(showError));
document.querySelector('#recordStopButton').addEventListener('click', () => stopNetworkRecording().catch(showError));

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
}

for (const input of [fields.shoppingPromotionText1, fields.shoppingPromotionText2]) {
  input.addEventListener('input', renderShoppingExtensionCounters);
}

fields.commonVendorName.addEventListener('input', syncCommonSettings);
fields.commonProductName.addEventListener('input', syncCommonSettings);
fields.commonEndRoas.addEventListener('input', syncCommonSettings);
fields.commonProductUrl.addEventListener('input', syncCommonProductUrl);
fields.powerlinkKeyword.addEventListener('input', syncPowerlinkMaterialDefaults);
fields.powerlinkKeywordList.addEventListener('input', renderPowerlinkKeywordCount);
for (const input of [
  fields.powerlinkSubLinks,
  fields.powerlinkPromotionText,
  fields.powerlinkExtensionHeadlines,
  fields.powerlinkExtraDescription
]) {
  input.addEventListener('input', renderPowerlinkExtensionCounters);
}
for (const { input } of Object.values(powerlinkTextFields)) {
  input.addEventListener('input', renderPowerlinkTextCounters);
}
fields.displayAgeModeAll.addEventListener('change', updateDisplayAgeControls);
fields.displayAgeModeManual.addEventListener('change', updateDisplayAgeControls);
fields.displayAgeSelectAll.addEventListener('change', syncDisplayAgeSelectAll);
for (const checkbox of displayAgeCheckboxes) {
  checkbox.addEventListener('change', updateDisplayAgeSelectAll);
}
for (const { input } of Object.values(displayDescriptionFields)) {
  input.addEventListener('input', renderDisplayDescriptionCounters);
}
fields.shoppingPromotionAgeModeAll.addEventListener('change', updateShoppingPromotionAgeControls);
fields.shoppingPromotionAgeModeManual.addEventListener('change', updateShoppingPromotionAgeControls);
fields.shoppingPromotionAgeSelectAll.addEventListener('change', syncShoppingPromotionAgeSelectAll);
for (const checkbox of shoppingPromotionAgeCheckboxes) {
  checkbox.addEventListener('change', updateShoppingPromotionAgeSelectAll);
}
fields.shoppingPromotionAdText.addEventListener('input', renderShoppingPromotionAdTextCounter);
document.querySelector('#validateDisplayImagesButton').addEventListener('click', () => {
  validateDisplayNativeImagesBeforeRun()
    .then(() => setStatus('이미지 5개 크기·용량 검증 완료'))
    .catch(showError);
});
fields.displayAdImages.addEventListener('change', () => {
  stageDisplayNativeAdImages(fields.displayAdImages.files)
    .then(() => scheduleAutosave())
    .catch(showError);
});
for (const slot of Object.keys(displayImageFields)) {
  displayImageFields[slot].input.addEventListener('change', async () => {
    const file = displayImageFields[slot].input.files?.[0];
    if (file) {
      try {
        await validateDisplayNativeImage(file, slot);
      } catch (error) {
        displayImageFields[slot].note.textContent = error.message;
        displayImageFields[slot].note.classList.add('limit-exceeded');
        showError(error);
        return;
      }
      displayImageFields[slot].note.classList.remove('limit-exceeded');
      delete pendingDisplayNativeAdImages[slot];
      renderDisplayNativeSelectedImage(slot, file);
      renderDisplayNativeBatchStatus();
      scheduleAutosave();
    }
  });
}
for (const eventName of ['dragenter', 'dragover']) {
  fields.displayAdImageDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    fields.displayAdImageDropzone.classList.add('drag-over');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  fields.displayAdImageDropzone.addEventListener(eventName, () => {
    fields.displayAdImageDropzone.classList.remove('drag-over');
  });
}
fields.displayAdImageDropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  stageDisplayNativeAdImages(event.dataTransfer?.files)
    .then(() => scheduleAutosave())
    .catch(showError);
});
fields.shoppingPromotionImage.addEventListener('change', async () => {
  const file = fields.shoppingPromotionImage.files?.[0];
  if (!file) {
    renderShoppingPromotionSavedImage(currentConfig?.shoppingPromotion?.imageAsset);
    return;
  }

  try {
    await validateShoppingPromotionImage(file);
    renderShoppingPromotionSelectedImage(file);
    scheduleAutosave();
  } catch (error) {
    fields.shoppingPromotionImage.value = '';
    renderShoppingPromotionSavedImage(currentConfig?.shoppingPromotion?.imageAsset);
    showError(error);
  }
});

await loadConfig();

restoreFormDraft();
persistFormDraft();
try { localStorage.setItem('shopping-bid-default-340', 'done'); } catch {}
if (!currentConfig.shoppingPromotion) {
  copyDisplayNativeInputsToShoppingPromotion();
}
syncFormDerivedState();
renderShoppingExtensionCounters();
setActiveTab(activeTab);
bindAutosave();
formReadyForAutosave = true;
await refreshStatus();
window.setInterval(refreshStatus, 2000);

async function loadConfig() {
  currentConfig = await requestJson('/api/config');

  const powerlink = normalizePowerlinkConfig(currentConfig.powerlink);
  const displayNative = normalizeDisplayNativeConfig(currentConfig.displayNative);
  const shoppingPromotion = normalizeShoppingPromotionConfig(currentConfig.shoppingPromotion, displayNative);
  const commonTemplate = commonTemplateFromConfig(currentConfig, powerlink, displayNative, shoppingPromotion);

  fields.commonVendorName.value = normalizeText(commonTemplate.vendorName);
  fields.commonProductName.value = normalizeText(commonTemplate.productName);
  fields.commonEndRoas.value = normalizeText(commonTemplate.endRoas);
  fields.commonProductUrl.value = shoppingPromotion.material.landingUrl || displayNative.material.landingUrl || powerlink.material.productLink || '';
  fields.productId.value =
    currentConfig.template?.productId ||
    (currentConfig.products?.[0]?.searchType === 'productId' ? currentConfig.products[0].query : '') ||
    extractProductIdFromUrl(fields.commonProductUrl.value);
  lastAutoProductId = extractProductIdFromUrl(fields.commonProductUrl.value);

  const autoExposureProductName = buildExposureProductName(
    fields.commonVendorName.value.trim(),
    fields.commonProductName.value.trim(),
    fields.commonEndRoas.value.trim()
  );
  fields.exposureProductName.value = limitTextLength(
    currentConfig.template?.exposureProductName || currentConfig.material?.exposureProductName || autoExposureProductName,
    MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH
  );
  lastAutoExposureProductName = autoExposureProductName;

  fields.powerlinkCampaignUrl.value = powerlink.campaignUrl;
  fields.powerlinkKeyword.value = powerlink.template.keyword;
  fields.powerlinkKeywordList.value = powerlink.keywords.join('\n');
  fields.powerlinkHeadline.value = powerlink.material.headline;
  fields.powerlinkDescription.value = powerlink.material.description;
  fields.powerlinkSubLinks.value = powerlink.extensions.subLinks
    .map((item) => `${item.name} | ${item.final}`)
    .join('\n');
  fields.powerlinkPromotionText.value = powerlink.extensions.promotionText;
  fields.powerlinkExtensionHeadlines.value = powerlink.extensions.headlines.join('\n');
  fields.powerlinkExtraDescription.value = powerlink.extensions.extraDescription;
  fields.powerlinkAdGroupDailyBudget.value = powerlink.adGroup.dailyBudget;
  fields.powerlinkDefaultBidPrice.value = powerlink.adGroup.defaultBidPrice;
  lastAutoPowerlinkHeadline = powerlink.material.headline;
  lastAutoPowerlinkDescription = buildPowerlinkDescription(powerlink.template.keyword);
  renderPowerlinkKeywordCount();
  renderPowerlinkTextCounters();
  renderPowerlinkExtensionCounters();
  renderPowerlinkSavedImages(powerlink.imageAssets);

  fields.displayNativeCampaignUrl.value = displayNative.campaignUrl;
  fields.displayNativeDailyBudget.value = displayNative.adGroup.dailyBudget;
  fields.displayNativeBidStrategyValue.value = displayNative.adGroup.bidStrategyValue;
  fields.displayNativeStartAt.value = ensureDisplayNativeStartAt(displayNative.adGroup.startAt);
  fields.displayGenderFemale.checked = displayNative.demographics.genders.includes('female');
  fields.displayGenderMale.checked = displayNative.demographics.genders.includes('male');
  fields.displayGenderUnknown.checked = displayNative.demographics.includeUnknownGender;
  fields.displayAgeModeAll.checked = displayNative.demographics.ageMode === 'all';
  fields.displayAgeModeManual.checked = displayNative.demographics.ageMode !== 'all';
  fields.displayAgeUnknown.checked = displayNative.demographics.includeUnknownAge;
  for (const checkbox of displayAgeCheckboxes) {
    checkbox.checked = displayNative.demographics.ages.includes(checkbox.value);
  }
  fields.displayAdText.value = displayNative.material.adText;
  fields.displayShortDescription1.value = displayNative.material.descriptions.short1;
  fields.displayShortDescription2.value = displayNative.material.descriptions.short2;
  fields.displayShortDescription3.value = displayNative.material.descriptions.short3;
  fields.displayLongDescription1.value = displayNative.material.descriptions.long1;
  fields.displayLongDescription2.value = displayNative.material.descriptions.long2;
  updateDisplayAgeControls();
  renderDisplayDescriptionCounters();
  renderDisplayNativeSavedImages(displayNative.imageAssets);

  fields.shoppingPromotionCampaignUrl.value = shoppingPromotion.campaignUrl;
  fields.shoppingPromotionDailyBudget.value = shoppingPromotion.adGroup.dailyBudget;
  fields.shoppingPromotionBidStrategyValue.value = shoppingPromotion.adGroup.bidStrategyValue;
  fields.shoppingPromotionStartAt.value = ensureDisplayNativeStartAt(shoppingPromotion.adGroup.startAt);
  fields.shoppingPromotionGenderFemale.checked = shoppingPromotion.demographics.genders.includes('female');
  fields.shoppingPromotionGenderMale.checked = shoppingPromotion.demographics.genders.includes('male');
  fields.shoppingPromotionGenderUnknown.checked = shoppingPromotion.demographics.includeUnknownGender;
  fields.shoppingPromotionAgeModeAll.checked = shoppingPromotion.demographics.ageMode === 'all';
  fields.shoppingPromotionAgeModeManual.checked = shoppingPromotion.demographics.ageMode !== 'all';
  fields.shoppingPromotionAgeUnknown.checked = shoppingPromotion.demographics.includeUnknownAge;
  for (const checkbox of shoppingPromotionAgeCheckboxes) {
    checkbox.checked = shoppingPromotion.demographics.ages.includes(checkbox.value);
  }
  fields.shoppingPromotionAdText.value = shoppingPromotion.material.adText;
  updateShoppingPromotionAgeControls();
  renderShoppingPromotionAdTextCounter();
  renderShoppingPromotionSavedImage(shoppingPromotion.imageAsset);

  fields.shoppingUseTalkTalk.checked = currentConfig.extensions?.useTalkTalk !== false;
  fields.shoppingTalkTalkUrl.value = currentConfig.extensions?.talkTalkUrl ?? 'http://talk.naver.com/sample';
  fields.shoppingPromotionText1.value = normalizeText(currentConfig.extensions?.promotionText1);
  fields.shoppingPromotionText2.value = normalizeText(currentConfig.extensions?.promotionText2);
  renderShoppingExtensionCounters();
  fields.browserMode.value = currentConfig.browserMode ?? 'profile';
  fields.browserCdpUrl.value = currentConfig.browserCdpUrl ?? 'http://127.0.0.1:9222';
  fields.campaignDailyBudget.value = currentConfig.campaign?.dailyBudget ?? DEFAULT_DAILY_BUDGET;
  fields.adGroupDailyBudget.value = currentConfig.adGroup?.dailyBudget ?? DEFAULT_DAILY_BUDGET;
  fields.defaultBidPrice.value = migrateShoppingBidPrice(currentConfig.adGroup?.defaultBidPrice);
  fields.useAutoTracking.checked = currentConfig.campaign.useAutoTracking !== false;
  fields.useBudgetDistribution.checked = Boolean(currentConfig.campaign.useBudgetDistribution);
}

async function saveConfig(options = {}) {
  const strict = options.strict ?? true;
  const uploadedPowerlinkAssets = await uploadPowerlinkImagesIfNeeded();
  const uploadedDisplayNativeAssets = await uploadDisplayNativeImagesIfNeeded();
  const uploadedShoppingPromotionAsset = await uploadShoppingPromotionImagesIfNeeded();
  const config = readConfigFromForm({
    strict,
    powerlinkImageAssets: uploadedPowerlinkAssets,
    displayNativeImageAssets: uploadedDisplayNativeAssets,
    shoppingPromotionImageAsset: uploadedShoppingPromotionAsset
  });

  currentConfig = await requestJson('/api/config', {
    method: 'POST',
    body: JSON.stringify(config)
  });
  persistFormDraft();
  renderPowerlinkSavedImages(currentConfig.powerlink?.imageAssets ?? []);
  renderDisplayNativeSavedImages(currentConfig.displayNative?.imageAssets ?? {});
  renderShoppingPromotionSavedImage(currentConfig.shoppingPromotion?.imageAsset);

  if (!options.silent) {
    setStatus('저장 완료');
  }

  return currentConfig;
}

function bindAutosave() {
  for (const control of document.querySelectorAll('input, textarea, select')) {
    if (!control.id || control.type === 'file' || control.readOnly) {
      continue;
    }

    const eventName = control.matches('select, input[type="checkbox"], input[type="radio"]') ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      persistFormDraft();
      scheduleAutosave();
    });
  }

  fields.powerlinkImages.addEventListener('change', () => scheduleAutosave());
  window.addEventListener('beforeunload', persistFormDraft);
}

function persistFormDraft() {
  const draft = {};

  for (const control of document.querySelectorAll('input, textarea, select')) {
    if (!control.id || control.type === 'file' || control.readOnly) {
      continue;
    }

    draft[control.id] = control.matches('input[type="checkbox"], input[type="radio"]') ? control.checked : control.value;
  }

  try {
    localStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // 서버 저장은 계속 유지하고, 브라우저 임시 저장만 건너뜁니다.
  }
}

function restoreFormDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(FORM_DRAFT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }

  if (!draft || typeof draft !== 'object') {
    return {};
  }

  for (const control of document.querySelectorAll('input, textarea, select')) {
    if (!control.id || control.type === 'file' || control.readOnly || !(control.id in draft)) {
      continue;
    }

    if (control.matches('input[type="checkbox"], input[type="radio"]')) {
      control.checked = Boolean(draft[control.id]);
    } else {
      let value = normalizeText(migrateMovedBrandValue(String(draft[control.id] ?? '')));
      if (control.id === 'defaultBidPrice') {
        value = migrateShoppingBidPrice(value);
      } else if (control.id === 'exposureProductName') {
        value = limitTextLength(value, MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH);
      } else if (
        control.id === 'shoppingPromotionCampaignUrl' &&
        (value === DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL || value === LEGACY_DISPLAY_NATIVE_CAMPAIGN_URL || value === LEGACY_SHOPPING_PROMOTION_CAMPAIGN_URL)
      ) {
        value = DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL;
      }
      control.value = value;
    }
  }

  return draft;
}

function migrateMovedBrandValue(value) {
  return MOVED_BRAND_REPLACEMENTS.reduce((nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement), value);
}

function copyDisplayNativeInputsToShoppingPromotion() {
  fields.shoppingPromotionCampaignUrl.value = DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL;
  fields.shoppingPromotionDailyBudget.value = fields.displayNativeDailyBudget.value;
  fields.shoppingPromotionBidStrategyValue.value = DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE;
  fields.shoppingPromotionStartAt.value = fields.displayNativeStartAt.value;
  fields.shoppingPromotionGenderFemale.checked = fields.displayGenderFemale.checked;
  fields.shoppingPromotionGenderMale.checked = fields.displayGenderMale.checked;
  fields.shoppingPromotionGenderUnknown.checked = fields.displayGenderUnknown.checked;
  fields.shoppingPromotionAgeModeAll.checked = fields.displayAgeModeAll.checked;
  fields.shoppingPromotionAgeModeManual.checked = fields.displayAgeModeManual.checked;
  fields.shoppingPromotionAgeUnknown.checked = fields.displayAgeUnknown.checked;
  for (const checkbox of shoppingPromotionAgeCheckboxes) {
    const displayCheckbox = displayAgeCheckboxes.find((item) => item.value === checkbox.value);
    checkbox.checked = Boolean(displayCheckbox?.checked);
  }
  fields.shoppingPromotionAdText.value = DEFAULT_SHOPPING_PROMOTION_AD_TEXT;
  updateShoppingPromotionAgeControls();
  renderShoppingPromotionAdTextCounter();
}

function syncFormDerivedState() {
  syncCommonSettings();
  syncCommonProductUrl();
  renderPowerlinkKeywordCount();
  renderPowerlinkTextCounters();
  renderPowerlinkExtensionCounters();
  updateDisplayAgeControls();
  fields.displayNativeStartAt.value = ensureDisplayNativeStartAt(fields.displayNativeStartAt.value);
  renderDisplayDescriptionCounters();
  updateShoppingPromotionAgeControls();
  fields.shoppingPromotionStartAt.value = ensureDisplayNativeStartAt(fields.shoppingPromotionStartAt.value);
  if (!fields.shoppingPromotionBidStrategyValue.value.trim()) {
    fields.shoppingPromotionBidStrategyValue.value = DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE;
  }
  renderShoppingPromotionAdTextCounter();
}

function scheduleAutosave() {
  if (!formReadyForAutosave || !currentConfig) {
    return;
  }

  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    runAutosave().catch((error) => console.warn('autosave failed', error));
  }, 700);
}

async function runAutosave() {
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }

  autosaveInFlight = true;
  try {
    await saveConfig({ strict: false, silent: true });
  } catch (error) {
    console.warn('autosave failed', error);
  } finally {
    autosaveInFlight = false;
  }

  if (autosaveQueued) {
    autosaveQueued = false;
    scheduleAutosave();
  }
}

async function openLogin() {
  await saveConfig({ strict: false, silent: true });
  await postAction('/api/login/open', { adProduct: activeTab });
}

async function runHttpAutomation() {
  if (activeTab === 'displayNative') {
    await validateDisplayNativeImagesBeforeRun();
  }
  const message =
    activeTab === 'powerlink'
      ? '네이버 광고 API 호출로 파워링크 광고그룹/키워드/소재를 실제 등록합니다. 계속할까요?'
      : activeTab === 'displayNative'
        ? '네이버 광고 API 호출로 디스플레이 광고그룹/네이티브 이미지 소재를 실제 등록합니다. 계속할까요?'
      : activeTab === 'shoppingPromotion'
        ? '네이버 광고 API 호출로 쇼핑 프로모션 광고그룹/이미지 소재를 실제 등록합니다. 계속할까요?'
        : '네이버 광고 API 호출로 캠페인/광고그룹/상품광고/노출용 상품명까지 실제 등록합니다. 계속할까요?';
  const confirmed = window.confirm(message);
  if (!confirmed) {
    return;
  }

  await saveConfig();
  await postAction('/api/http-run', { adProduct: activeTab });
}

async function postAction(url, body = {}) {
  const result = await requestJson(url, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  renderStatus(result);
  return result;
}

async function refreshStatus() {
  let result;
  try {
    result = await requestJson('/api/status');
    lastStatusFetchError = '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastStatusFetchError) {
      lastStatusFetchError = message;
      setStatus(`서버 상태 확인 실패: ${message}`);
    }
    return;
  }

  if (Date.now() < localStatusHoldUntil) {
    renderRecording(result.networkRecording);
    return;
  }

  renderStatus(result);
}

async function startNetworkRecording() {
  const isDisplayLikeTab = activeTab === 'displayNative' || activeTab === 'shoppingPromotion';
  await saveConfig({ strict: !isDisplayLikeTab, silent: isDisplayLikeTab });
  const result = await postAction('/api/network-recording/start', { adProduct: activeTab });
  renderRecording(result.networkRecording);
}

async function stopNetworkRecording() {
  const result = await postAction('/api/network-recording/stop');
  renderRecording(result.networkRecording);
}

function readConfigFromForm({ strict, powerlinkImageAssets, displayNativeImageAssets, shoppingPromotionImageAsset }) {
  const vendorName = readTextField(fields.vendorName);
  const productName = readTextField(fields.productName);
  const endRoas = readTextField(fields.endRoas);
  const productId = readTextField(fields.productId) || extractProductIdFromUrl(fields.commonProductUrl.value);
  if (productId && !readTextField(fields.productId)) {
    fields.productId.value = productId;
  }
  const exposureProductName = limitTextLength(
    readTextField(fields.exposureProductName) || buildExposureProductName(vendorName, productName, endRoas),
    MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH
  );
  if (readTextField(fields.exposureProductName) !== exposureProductName) {
    fields.exposureProductName.value = exposureProductName;
  }
  const generatedName = buildGeneratedName(vendorName, productName, endRoas);
  const campaignDailyBudget = readPositiveInteger(fields.campaignDailyBudget.value, '캠페인 하루 예산');
  const adGroupDailyBudget = readPositiveInteger(fields.adGroupDailyBudget.value, '광고그룹 하루 예산');
  const defaultBidPrice = readPositiveInteger(fields.defaultBidPrice.value, '기본 입찰가');
  const extensions = {
    useTalkTalk: fields.shoppingUseTalkTalk.checked,
    talkTalkUrl: readTextField(fields.shoppingTalkTalkUrl) || 'http://talk.naver.com/sample',
    promotionText1: readTextField(fields.shoppingPromotionText1),
    promotionText2: readTextField(fields.shoppingPromotionText2)
  };
  if (countTextLength(extensions.promotionText1) > 10 || countTextLength(extensions.promotionText2) > 30) {
    throw new Error('추가홍보문구는 문구 1 최대 10자, 문구 2 최대 30자로 입력하세요.');
  }
  if (extensions.promotionText2 && !extensions.promotionText1) {
    throw new Error('추가홍보문구 1을 입력하세요.');
  }
  const validateShopping = strict && activeTab === 'shopping';

  if (validateShopping) {
    if (!vendorName) {
      throw new Error('거래처를 입력하세요.');
    }

    if (!productName) {
      throw new Error('제품명을 입력하세요.');
    }

    if (!endRoas) {
      throw new Error('ENDROAS를 입력하세요.');
    }

    if (!productId) {
      throw new Error('쇼핑몰 상품 ID를 입력하세요.');
    }

    if (!exposureProductName) {
      throw new Error('노출용 상품명을 입력하세요.');
    }

    if (countTextLength(exposureProductName) > MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH) {
      throw new Error('노출용 상품명은 25자 이하여야 합니다.');
    }

    const generatedNameLength = countTextLength(generatedName);
    if (generatedNameLength > SHOPPING_GENERATED_NAME_LIMIT) {
      throw new Error(
        `캠페인명/광고그룹명은 ${SHOPPING_GENERATED_NAME_LIMIT}자 이하여야 합니다. 현재 ${generatedNameLength}자입니다. 제품명을 줄여주세요.`
      );
    }
  }

  const safeGeneratedName = generatedName || currentConfig.campaign?.name || '쇼핑검색광고그룹';
  const safeProductId = productId || currentConfig.products?.[0]?.query || '상품ID';

  return {
    ...currentConfig,
    extensions,
    template: {
      vendorName,
      productName,
      endRoas,
      productId: safeProductId,
      exposureProductName
    },
    browserMode: fields.browserMode.value,
    browserCdpUrl: fields.browserCdpUrl.value.trim() || 'http://127.0.0.1:9222',
    campaign: {
      name: safeGeneratedName,
      dailyBudget: campaignDailyBudget,
      useAutoTracking: fields.useAutoTracking.checked,
      useBudgetDistribution: fields.useBudgetDistribution.checked
    },
    adGroup: {
      name: safeGeneratedName,
      mallName: '',
      shoppingPartnerCenterId: '',
      defaultBidPrice,
      dailyBudget: adGroupDailyBudget
    },
    material: {
      exposureProductName
    },
    products: [
      {
        searchType: 'productId',
        query: safeProductId,
        expectedName: ''
      }
    ],
    powerlink: readPowerlinkConfig({ strict, uploadedAssets: powerlinkImageAssets }),
    displayNative: readDisplayNativeConfig({ strict, uploadedAssets: displayNativeImageAssets }),
    shoppingPromotion: readShoppingPromotionConfig({ strict, uploadedAsset: shoppingPromotionImageAsset })
  };
}

function readPowerlinkConfig({ strict, uploadedAssets }) {
  const existing = normalizePowerlinkConfig(currentConfig.powerlink);
  const campaignUrl = fields.powerlinkCampaignUrl.value.trim() || DEFAULT_POWERLINK_CAMPAIGN_URL;
  const campaignId = extractCampaignId(campaignUrl) || existing.campaignId;
  const vendorName = readTextField(fields.powerlinkVendorName);
  const productName = readTextField(fields.powerlinkProductName);
  const endRoas = readTextField(fields.powerlinkEndRoas);
  const keyword = readTextField(fields.powerlinkKeyword) || DEFAULT_POWERLINK_KEYWORD;
  const adGroupName = buildGeneratedName(vendorName, productName, endRoas) || existing.adGroup.name;
  const headline = readTextField(fields.powerlinkHeadline);
  const description = readTextField(fields.powerlinkDescription);
  const productLink = fields.powerlinkProductLink.value.trim();
  const defaultBidPrice = readPositiveInteger(fields.powerlinkDefaultBidPrice.value, '파워링크 기본 입찰가');
  const dailyBudget = readPositiveInteger(fields.powerlinkAdGroupDailyBudget.value, '파워링크 광고그룹 하루 예산');
  const keywords = parsePowerlinkKeywords(fields.powerlinkKeywordList.value);
  const imageAssets = uploadedAssets ?? existing.imageAssets;
  const extensions = {
    subLinks: parsePowerlinkSubLinks(fields.powerlinkSubLinks.value, productLink),
    promotionText: readTextField(fields.powerlinkPromotionText),
    headlines: parsePowerlinkExtensionHeadlines(fields.powerlinkExtensionHeadlines.value),
    extraDescription: readTextField(fields.powerlinkExtraDescription)
  };
  const validatePowerlink = strict && activeTab === 'powerlink';

  if (validatePowerlink) {
    if (!campaignId) {
      throw new Error('대상 캠페인 URL에서 캠페인 ID를 찾지 못했습니다.');
    }

    if (!vendorName) {
      throw new Error('파워링크 거래처를 입력하세요.');
    }

    if (!productName) {
      throw new Error('파워링크 제품명을 입력하세요.');
    }

    if (!endRoas) {
      throw new Error('파워링크 ENDROAS를 입력하세요.');
    }

    const adGroupNameLength = countTextLength(adGroupName);
    if (adGroupNameLength > SHOPPING_GENERATED_NAME_LIMIT) {
      throw new Error(
        `파워링크 광고그룹명은 ${SHOPPING_GENERATED_NAME_LIMIT}자 이하여야 합니다. 현재 ${adGroupNameLength}자입니다. 제품명을 줄여주세요.`
      );
    }

    if (!headline) {
      throw new Error('파워링크 제목 문구를 입력하세요.');
    }

    validatePowerlinkTextLimit('제목 문구', headline, POWERLINK_TEXT_LIMITS.headline);

    if (!description) {
      throw new Error('파워링크 설명 문구를 입력하세요.');
    }

    validatePowerlinkTextLimit('설명 문구', description, POWERLINK_TEXT_LIMITS.description, 20);

    if (!productLink) {
      throw new Error('파워링크 제품 링크를 입력하세요.');
    }

    if (!isHttpUrl(productLink)) {
      throw new Error('파워링크 제품 링크는 http 또는 https URL로 입력하세요.');
    }

    if (keywords.length === 0) {
      throw new Error('파워링크 키워드 목록을 1개 이상 입력하세요.');
    }

    if (keywords.length > 1000) {
      throw new Error('파워링크 키워드는 최대 1000개까지 입력할 수 있습니다.');
    }

    const longKeyword = keywords.find((item) => countTextLength(item) > 25);
    if (longKeyword) {
      throw new Error(`파워링크 키워드는 25자 이하여야 합니다: ${longKeyword}`);
    }

    if (defaultBidPrice < MIN_POWERLINK_BID_PRICE) {
      throw new Error('파워링크 기본 입찰가는 70원 이상으로 입력하세요.');
    }

    if (imageAssets.length === 0) {
      throw new Error('파워링크 확장 소재 이미지를 1개 이상 업로드하세요.');
    }

    if (extensions.subLinks.length !== 0 && (extensions.subLinks.length < 3 || extensions.subLinks.length > 4)) {
      throw new Error('파워링크 서브링크는 사용하지 않거나 3~4개를 입력하세요.');
    }
    for (const subLink of extensions.subLinks) {
      if (countTextLength(subLink.name) > 6) {
        throw new Error(`파워링크 서브링크 문구는 6자 이하여야 합니다: ${subLink.name}`);
      }
      if (!isHttpUrl(subLink.final)) {
        throw new Error(`파워링크 서브링크 연결 URL을 확인하세요: ${subLink.name}`);
      }
    }
    validatePowerlinkExtensionText('홍보문구', extensions.promotionText, 14);
    if (extensions.headlines.length > 15) {
      throw new Error('파워링크 추가제목은 최대 15개까지 입력할 수 있습니다.');
    }
    for (const headlineItem of extensions.headlines) {
      validatePowerlinkExtensionText('추가제목', headlineItem, 15);
    }
    validatePowerlinkExtensionText('추가설명', extensions.extraDescription, 45);
  }

  return {
    campaignUrl,
    campaignId,
    template: {
      vendorName,
      productName,
      endRoas,
      keyword
    },
    adGroup: {
      name: adGroupName,
      defaultBidPrice,
      dailyBudget,
      userLock: existing.adGroup.userLock
    },
    material: {
      headline,
      description,
      productLink
    },
    keywords,
    imageAssets,
    extensions
  };
}

function readDisplayNativeConfig({ strict, uploadedAssets }) {
  const existing = normalizeDisplayNativeConfig(currentConfig.displayNative);
  const campaignUrl = fields.displayNativeCampaignUrl.value.trim() || DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL;
  const campaignId = extractDisplayCampaignId(campaignUrl) || existing.campaignId;
  const vendorName = readTextField(fields.displayNativeVendorName);
  const productName = readTextField(fields.displayNativeProductName);
  const endRoas = readTextField(fields.displayNativeEndRoas);
  const adGroupName = buildGeneratedName(vendorName, productName, endRoas) || existing.adGroup.name;
  const dailyBudget = readPositiveInteger(fields.displayNativeDailyBudget.value, '디스플레이 하루 예산');
  const bidStrategyValue = readPositiveInteger(fields.displayNativeBidStrategyValue.value, '디스플레이 입찰가 한도');
  const startAt = ensureDisplayNativeStartAt(fields.displayNativeStartAt.value.trim());
  fields.displayNativeStartAt.value = startAt;
  const landingUrl = fields.displayNativeLandingUrl.value.trim();
  const adText = readTextField(fields.displayAdText);
  const genders = [];
  if (fields.displayGenderFemale.checked) {
    genders.push('female');
  }
  if (fields.displayGenderMale.checked) {
    genders.push('male');
  }

  const ageMode = fields.displayAgeModeAll.checked ? 'all' : 'manual';
  const ages = displayAgeCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
  const descriptions = {
    short1: readTextField(fields.displayShortDescription1),
    short2: readTextField(fields.displayShortDescription2),
    short3: readTextField(fields.displayShortDescription3),
    long1: readTextField(fields.displayLongDescription1),
    long2: readTextField(fields.displayLongDescription2)
  };
  const imageAssets = {
    ...existing.imageAssets,
    ...(uploadedAssets ?? {})
  };
  const validateDisplayNative = strict && activeTab === 'displayNative';

  if (validateDisplayNative) {
    if (!campaignId) {
      throw new Error('기본 캠페인 URL에서 캠페인 ID를 찾지 못했습니다.');
    }

    if (!isHttpUrl(campaignUrl)) {
      throw new Error('기본 캠페인 URL은 http 또는 https URL로 입력하세요.');
    }

    if (!vendorName) {
      throw new Error('디스플레이 거래처를 입력하세요.');
    }

    if (!productName) {
      throw new Error('디스플레이 제품명을 입력하세요.');
    }

    if (!endRoas) {
      throw new Error('디스플레이 ENDROAS를 입력하세요.');
    }

    const adGroupNameLength = countTextLength(adGroupName);
    if (adGroupNameLength > DISPLAY_GENERATED_NAME_LIMIT) {
      throw new Error(
        `디스플레이 광고그룹명은 ${DISPLAY_GENERATED_NAME_LIMIT}자 이하여야 합니다. 현재 ${adGroupNameLength}자입니다. 제품명을 줄여주세요.`
      );
    }

    if (!startAt) {
      throw new Error('시작일시를 입력하세요.');
    }

    if (!landingUrl) {
      throw new Error('랜딩 URL을 입력하세요.');
    }

    if (!isHttpUrl(landingUrl)) {
      throw new Error('랜딩 URL은 http 또는 https URL로 입력하세요.');
    }

    if (genders.length === 0 && !fields.displayGenderUnknown.checked) {
      throw new Error('성별을 1개 이상 선택하세요.');
    }

    if (ageMode === 'manual' && ages.length === 0) {
      throw new Error('연령을 1개 이상 선택하세요.');
    }

    if (!adText) {
      throw new Error('광고 문구를 입력하세요.');
    }

    if (countTextLength(adText) > DISPLAY_NATIVE_DESCRIPTION_LIMITS.adText) {
      throw new Error('광고 문구는 20자 이하여야 합니다.');
    }

    for (const [key, value] of Object.entries(descriptions)) {
      const limit = DISPLAY_NATIVE_DESCRIPTION_LIMITS[key];
      if (!value) {
        throw new Error(displayDescriptionLabel(key) + '를 입력하세요.');
      }

      if (countTextLength(value) > limit) {
        throw new Error(`${displayDescriptionLabel(key)}는 ${limit}자 이하여야 합니다.`);
      }
    }

    for (const [slot, requirement] of Object.entries(DISPLAY_NATIVE_IMAGE_REQUIREMENTS)) {
      if (!imageAssets[slot]) {
        throw new Error(`${requirement.label}를 업로드하세요.`);
      }
    }
  }

  return {
    campaignUrl,
    campaignId,
    template: {
      vendorName,
      productName,
      endRoas
    },
    adGroup: {
      name: adGroupName,
      dailyBudget,
      bidStrategyValue,
      startAt
    },
    demographics: {
      genders,
      includeUnknownGender: fields.displayGenderUnknown.checked,
      ageMode,
      ages,
      includeUnknownAge: fields.displayAgeUnknown.checked
    },
    material: {
      landingUrl,
      adText,
      descriptions
    },
    imageAssets
  };
}

function readShoppingPromotionConfig({ strict, uploadedAsset }) {
  const displayNative = normalizeDisplayNativeConfig(currentConfig.displayNative);
  const existing = normalizeShoppingPromotionConfig(currentConfig.shoppingPromotion, displayNative);
  const campaignUrl = fields.shoppingPromotionCampaignUrl.value.trim() || existing.campaignUrl;
  const campaignId = extractDisplayCampaignId(campaignUrl) || existing.campaignId;
  const vendorName = readTextField(fields.shoppingPromotionVendorName);
  const productName = readTextField(fields.shoppingPromotionProductName);
  const endRoas = readTextField(fields.shoppingPromotionEndRoas);
  const adGroupName = buildGeneratedName(vendorName, productName, endRoas) || existing.adGroup.name;
  const dailyBudget = readPositiveInteger(fields.shoppingPromotionDailyBudget.value, '쇼핑 프로모션 하루 예산');
  const bidStrategyValue = readPositiveInteger(fields.shoppingPromotionBidStrategyValue.value, '쇼핑 프로모션 입찰가 한도');
  const startAt = ensureDisplayNativeStartAt(fields.shoppingPromotionStartAt.value.trim());
  fields.shoppingPromotionStartAt.value = startAt;
  const landingUrl = fields.shoppingPromotionLandingUrl.value.trim();
  const adText = limitTextLength(readTextField(fields.shoppingPromotionAdText), SHOPPING_PROMOTION_AD_TEXT_LIMIT);
  if (readTextField(fields.shoppingPromotionAdText) !== adText) {
    fields.shoppingPromotionAdText.value = adText;
    renderShoppingPromotionAdTextCounter();
  }
  const genders = [];
  if (fields.shoppingPromotionGenderFemale.checked) {
    genders.push('female');
  }
  if (fields.shoppingPromotionGenderMale.checked) {
    genders.push('male');
  }

  const ageMode = fields.shoppingPromotionAgeModeAll.checked ? 'all' : 'manual';
  const ages = shoppingPromotionAgeCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
  const imageAsset = uploadedAsset ?? existing.imageAsset;
  const validateShoppingPromotion = strict && activeTab === 'shoppingPromotion';

  if (validateShoppingPromotion) {
    if (!campaignId) {
      throw new Error('쇼핑 프로모션 기본 캠페인 URL에서 캠페인 ID를 찾지 못했습니다.');
    }

    if (!isHttpUrl(campaignUrl)) {
      throw new Error('쇼핑 프로모션 기본 캠페인 URL은 http 또는 https URL로 입력하세요.');
    }

    if (!vendorName) {
      throw new Error('쇼핑 프로모션 거래처를 입력하세요.');
    }

    if (!productName) {
      throw new Error('쇼핑 프로모션 제품명을 입력하세요.');
    }

    if (!endRoas) {
      throw new Error('쇼핑 프로모션 ENDROAS를 입력하세요.');
    }

    const adGroupNameLength = countTextLength(adGroupName);
    if (adGroupNameLength > DISPLAY_GENERATED_NAME_LIMIT) {
      throw new Error(
        `쇼핑 프로모션 광고그룹명은 ${DISPLAY_GENERATED_NAME_LIMIT}자 이하여야 합니다. 현재 ${adGroupNameLength}자입니다. 제품명을 줄여주세요.`
      );
    }

    if (!startAt) {
      throw new Error('쇼핑 프로모션 시작일시를 입력하세요.');
    }

    if (!landingUrl) {
      throw new Error('쇼핑 프로모션 랜딩 URL을 입력하세요.');
    }

    if (!isHttpUrl(landingUrl)) {
      throw new Error('쇼핑 프로모션 랜딩 URL은 http 또는 https URL로 입력하세요.');
    }

    if (genders.length === 0 && !fields.shoppingPromotionGenderUnknown.checked) {
      throw new Error('쇼핑 프로모션 성별을 1개 이상 선택하세요.');
    }

    if (ageMode === 'manual' && ages.length === 0) {
      throw new Error('쇼핑 프로모션 연령을 1개 이상 선택하세요.');
    }

    if (!adText) {
      throw new Error('쇼핑 프로모션 광고 문구를 입력하세요.');
    }

    if (countTextLength(adText) > SHOPPING_PROMOTION_AD_TEXT_LIMIT) {
      throw new Error(`쇼핑 프로모션 광고 문구는 ${SHOPPING_PROMOTION_AD_TEXT_LIMIT}자 이하여야 합니다.`);
    }

    if (!imageAsset) {
      throw new Error('쇼핑 프로모션 750x500 이미지를 업로드하세요.');
    }
  }

  return {
    campaignUrl,
    campaignId,
    template: {
      vendorName,
      productName,
      endRoas
    },
    adGroup: {
      name: adGroupName,
      dailyBudget,
      bidStrategyValue,
      startAt
    },
    demographics: {
      genders,
      includeUnknownGender: fields.shoppingPromotionGenderUnknown.checked,
      ageMode,
      ages,
      includeUnknownAge: fields.shoppingPromotionAgeUnknown.checked
    },
    material: {
      landingUrl,
      adText
    },
    imageAsset
  };
}

function syncCommonSettings() {
  syncGeneratedFields();
  updatePowerlinkGeneratedNamePreview();
  updateDisplayNativeGeneratedNamePreview();
  updateShoppingPromotionGeneratedNamePreview();
  updateCommonGeneratedNamePreview();
}

function syncCommonProductUrl() {
  const productId = extractProductIdFromUrl(fields.commonProductUrl.value);
  if (productId && (!readTextField(fields.productId) || readTextField(fields.productId) === lastAutoProductId)) {
    fields.productId.value = productId;
  }
  lastAutoProductId = productId;
}

function syncGeneratedFields() {
  const vendorName = readTextField(fields.commonVendorName);
  const productName = readTextField(fields.commonProductName);
  const endRoas = readTextField(fields.commonEndRoas);
  const nextAutoExposureProductName = buildExposureProductName(vendorName, productName, endRoas);

  if (!readTextField(fields.exposureProductName) || readTextField(fields.exposureProductName) === lastAutoExposureProductName) {
    fields.exposureProductName.value = nextAutoExposureProductName;
  }

  lastAutoExposureProductName = nextAutoExposureProductName;
  updateGeneratedNamePreview();
}

function syncPowerlinkGeneratedFields() {
  updatePowerlinkGeneratedNamePreview();
}

function syncDisplayNativeGeneratedFields() {
  updateDisplayNativeGeneratedNamePreview();
}

function syncShoppingPromotionGeneratedFields() {
  updateShoppingPromotionGeneratedNamePreview();
}

function syncPowerlinkMaterialDefaults() {
  const keyword = readTextField(fields.powerlinkKeyword) || DEFAULT_POWERLINK_KEYWORD;
  const nextHeadline = buildPowerlinkHeadline(keyword);
  const nextDescription = buildPowerlinkDescription(keyword);

  if (!readTextField(fields.powerlinkHeadline) || readTextField(fields.powerlinkHeadline) === lastAutoPowerlinkHeadline) {
    fields.powerlinkHeadline.value = nextHeadline;
  }

  if (!readTextField(fields.powerlinkDescription) || readTextField(fields.powerlinkDescription) === lastAutoPowerlinkDescription) {
    fields.powerlinkDescription.value = nextDescription;
  }

  lastAutoPowerlinkHeadline = nextHeadline;
  lastAutoPowerlinkDescription = nextDescription;
  renderPowerlinkTextCounters();
}

function updateGeneratedNamePreview() {
  fields.generatedName.value = currentCommonGeneratedName();
  renderGeneratedNameCounter(fields.generatedName, fields.generatedNameCount, SHOPPING_GENERATED_NAME_LIMIT);
}

function updatePowerlinkGeneratedNamePreview() {
  fields.powerlinkGeneratedName.value = currentCommonGeneratedName();
  renderGeneratedNameCounter(fields.powerlinkGeneratedName, fields.powerlinkGeneratedNameCount, SHOPPING_GENERATED_NAME_LIMIT);
}

function updateDisplayNativeGeneratedNamePreview() {
  fields.displayNativeGeneratedName.value = currentCommonGeneratedName();
  renderGeneratedNameCounter(fields.displayNativeGeneratedName, fields.displayNativeGeneratedNameCount, DISPLAY_GENERATED_NAME_LIMIT);
}

function updateShoppingPromotionGeneratedNamePreview() {
  fields.shoppingPromotionGeneratedName.value = currentCommonGeneratedName();
  renderGeneratedNameCounter(fields.shoppingPromotionGeneratedName, fields.shoppingPromotionGeneratedNameCount, DISPLAY_GENERATED_NAME_LIMIT);
}

function updateCommonGeneratedNamePreview() {
  fields.commonGeneratedName.value = currentCommonGeneratedName();
  renderGeneratedNameCounter(fields.commonGeneratedName, fields.commonGeneratedNameCount, SHOPPING_GENERATED_NAME_LIMIT);
}

function currentCommonGeneratedName() {
  return buildGeneratedName(readTextField(fields.commonVendorName), readTextField(fields.commonProductName), readTextField(fields.commonEndRoas));
}

function renderGeneratedNameCounter(input, counter, limit) {
  const count = countTextLength(input.value);
  const exceeded = count > limit;
  counter.textContent = `${count}/${limit}자`;
  counter.classList.toggle('limit-exceeded', exceeded);
  input.classList.toggle('limit-exceeded', exceeded);
}

function renderShoppingExtensionCounters() {
  for (const [field, limit] of [[fields.shoppingPromotionText1, 10], [fields.shoppingPromotionText2, 30]]) {
    const count = countTextLength(field.value);
    const counter = document.querySelector(`#${field.id}Count`);
    counter.textContent = `${count}/${limit}자`;
    counter.classList.toggle('limit-exceeded', count > limit);
    field.classList.toggle('limit-exceeded', count > limit);
  }
}

function buildProductSearchName(vendorName, productName) {
  const normalizedVendorName = normalizeText(vendorName).trim();
  const normalizedProductName = normalizeText(productName).trim();
  if (!normalizedVendorName && !normalizedProductName) {
    return '';
  }

  return `${normalizedVendorName})${normalizedProductName}`;
}

function buildGeneratedName(vendorName, productName, endRoas) {
  const searchName = buildProductSearchName(vendorName, productName);
  return normalizeText(`${searchName}${normalizeText(endRoas).trim()}`);
}

function buildExposureProductName(vendorName, productName, endRoas) {
  return limitTextLength(buildGeneratedName(vendorName, productName, endRoas), MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH);
}

function limitTextLength(value, maxLength) {
  return Array.from(normalizeText(value)).slice(0, maxLength).join('');
}

function countTextLength(value) {
  return Array.from(normalizeText(value)).length;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFC');
}

function readTextField(field) {
  return normalizeText(field.value).trim();
}

function buildPowerlinkHeadline(keyword) {
  return `트렌디한 {keyword:${keyword}} 여기!`;
}

function buildPowerlinkDescription(keyword) {
  return `비교불가 특가! 끝판왕 {keyword:${keyword}} 365일 무조건 무료배송!`;
}

function parsePowerlinkKeywords(value) {
  return normalizeText(value)
    .split(/[\r\n,]+/)
    .map((item) => normalizeText(item).trim())
    .filter(Boolean);
}

function parsePowerlinkSubLinks(value, fallbackUrl = '') {
  return normalizeText(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('|');
      if (separatorIndex < 0) {
        return { name: line, final: fallbackUrl };
      }
      return {
        name: line.slice(0, separatorIndex).trim(),
        final: line.slice(separatorIndex + 1).trim() || fallbackUrl
      };
    });
}

function parsePowerlinkExtensionHeadlines(value) {
  return normalizeText(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderPowerlinkKeywordCount() {
  const count = parsePowerlinkKeywords(fields.powerlinkKeywordList.value).length;
  fields.powerlinkKeywordCount.textContent = `키워드 ${count.toLocaleString('ko-KR')}개`;
}

function renderPowerlinkTextCounters() {
  for (const [key, item] of Object.entries(powerlinkTextFields)) {
    const limit = POWERLINK_TEXT_LIMITS[key];
    const count = countPowerlinkText(item.input.value);
    const minimum = key === 'description' ? 20 : 0;
    const exceeded = count > limit || count < minimum;
    item.counter.textContent = minimum ? `${count}/${minimum}~${limit}자` : `${count}/${limit}`;
    item.counter.classList.toggle('limit-exceeded', exceeded);
    item.input.classList.toggle('limit-exceeded', exceeded);
  }
}

function renderPowerlinkExtensionCounters() {
  const subLinks = parsePowerlinkSubLinks(fields.powerlinkSubLinks.value);
  const subLinksExceeded = subLinks.length !== 0 && (subLinks.length < 3 || subLinks.length > 4);
  fields.powerlinkSubLinksCount.textContent = `서브링크 ${subLinks.length}개/3~4개`;
  fields.powerlinkSubLinksCount.classList.toggle('limit-exceeded', subLinksExceeded);
  fields.powerlinkSubLinks.classList.toggle('limit-exceeded', subLinksExceeded);

  const promotionLength = countTextLength(fields.powerlinkPromotionText.value);
  fields.powerlinkPromotionTextCount.textContent = `${promotionLength}/14`;
  fields.powerlinkPromotionTextCount.classList.toggle('limit-exceeded', promotionLength > 14);
  fields.powerlinkPromotionText.classList.toggle('limit-exceeded', promotionLength > 14);

  const headlines = parsePowerlinkExtensionHeadlines(fields.powerlinkExtensionHeadlines.value);
  const headlineExceeded = headlines.length > 15 || headlines.some((item) => countTextLength(item) > 15);
  fields.powerlinkExtensionHeadlinesCount.textContent = `추가제목 ${headlines.length}개/최대 15개`;
  fields.powerlinkExtensionHeadlinesCount.classList.toggle('limit-exceeded', headlineExceeded);
  fields.powerlinkExtensionHeadlines.classList.toggle('limit-exceeded', headlineExceeded);

  const extraDescriptionLength = countTextLength(fields.powerlinkExtraDescription.value);
  fields.powerlinkExtraDescriptionCount.textContent = `${extraDescriptionLength}/45`;
  fields.powerlinkExtraDescriptionCount.classList.toggle('limit-exceeded', extraDescriptionLength > 45);
  fields.powerlinkExtraDescription.classList.toggle('limit-exceeded', extraDescriptionLength > 45);
}

function validatePowerlinkExtensionText(label, value, limit) {
  if (countTextLength(value) > limit) {
    throw new Error(`파워링크 ${label}은 ${limit}자 이하여야 합니다.`);
  }
}

function validatePowerlinkTextLimit(label, value, limit, minimum = 0) {
  const count = countPowerlinkText(value);
  if (count < minimum) {
    throw new Error(`파워링크 ${label}는 ${minimum}자 이상이어야 합니다. 현재 ${count}자입니다. 키워드 삽입은 기본 문구로 계산합니다.`);
  }
  if (count > limit) {
    throw new Error(`파워링크 ${label}는 ${limit}자 이하여야 합니다. 현재 ${count}자입니다.`);
  }
}

function countPowerlinkText(value) {
  return Array.from(powerlinkTextForCounting(value)).length;
}

function powerlinkTextForCounting(value) {
  return normalizeText(value).replace(/\{(?:keyword|키워드):([^{}]*)\}/gi, '$1').replace(/\{(?:keyword|키워드)\}/gi, '');
}

function updateDisplayAgeControls() {
  const manual = fields.displayAgeModeManual.checked;
  for (const checkbox of displayAgeCheckboxes) {
    checkbox.disabled = !manual;
  }
  fields.displayAgeSelectAll.disabled = !manual;
  updateDisplayAgeSelectAll();
}

function syncDisplayAgeSelectAll() {
  for (const checkbox of displayAgeCheckboxes) {
    checkbox.checked = fields.displayAgeSelectAll.checked;
  }
  fields.displayAgeModeManual.checked = true;
  updateDisplayAgeControls();
}

function updateDisplayAgeSelectAll() {
  const checkedCount = displayAgeCheckboxes.filter((checkbox) => checkbox.checked).length;
  fields.displayAgeSelectAll.checked = checkedCount === displayAgeCheckboxes.length;
  fields.displayAgeSelectAll.indeterminate = checkedCount > 0 && checkedCount < displayAgeCheckboxes.length;
}

function renderDisplayDescriptionCounters() {
  for (const [key, item] of Object.entries(displayDescriptionFields)) {
    const limit = DISPLAY_NATIVE_DESCRIPTION_LIMITS[key];
    const count = countTextLength(item.input.value);
    const exceeded = count > limit;
    item.counter.textContent = `${count}/${limit}`;
    item.counter.classList.toggle('limit-exceeded', exceeded);
    item.input.classList.toggle('limit-exceeded', exceeded);
  }
}

function updateShoppingPromotionAgeControls() {
  const manual = fields.shoppingPromotionAgeModeManual.checked;
  for (const checkbox of shoppingPromotionAgeCheckboxes) {
    checkbox.disabled = !manual;
  }
  fields.shoppingPromotionAgeSelectAll.disabled = !manual;
  updateShoppingPromotionAgeSelectAll();
}

function syncShoppingPromotionAgeSelectAll() {
  for (const checkbox of shoppingPromotionAgeCheckboxes) {
    checkbox.checked = fields.shoppingPromotionAgeSelectAll.checked;
  }
  fields.shoppingPromotionAgeModeManual.checked = true;
  updateShoppingPromotionAgeControls();
}

function updateShoppingPromotionAgeSelectAll() {
  const checkedCount = shoppingPromotionAgeCheckboxes.filter((checkbox) => checkbox.checked).length;
  fields.shoppingPromotionAgeSelectAll.checked = checkedCount === shoppingPromotionAgeCheckboxes.length;
  fields.shoppingPromotionAgeSelectAll.indeterminate = checkedCount > 0 && checkedCount < shoppingPromotionAgeCheckboxes.length;
}

function renderShoppingPromotionAdTextCounter() {
  const count = countTextLength(fields.shoppingPromotionAdText.value);
  const exceeded = count > SHOPPING_PROMOTION_AD_TEXT_LIMIT;
  fields.shoppingPromotionAdTextCount.textContent = `${count}/${SHOPPING_PROMOTION_AD_TEXT_LIMIT}`;
  fields.shoppingPromotionAdTextCount.classList.toggle('limit-exceeded', exceeded);
  fields.shoppingPromotionAdText.classList.toggle('limit-exceeded', exceeded);
}

function displayDescriptionLabel(key) {
  return (
    {
      adText: '광고 문구',
      short1: '설명 문구1',
      short2: '설명 문구2',
      short3: '설명 문구3',
      long1: 'PC 배너형 긴 설명문구 1',
      long2: 'PC 배너형 긴 설명문구 2'
    }[key] ?? '설명 문구'
  );
}

function readPositiveInteger(value, label) {
  const normalized = String(value).replace(/,/g, '').trim();
  const numberValue = Number(normalized);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${label}은 1 이상의 숫자로 입력하세요.`);
  }

  return numberValue;
}

async function uploadPowerlinkImagesIfNeeded() {
  const files = Array.from(fields.powerlinkImages.files ?? []);

  if (files.length === 0) {
    return undefined;
  }

  if (files.length > 2) {
    throw new Error('파워링크 확장 소재 이미지는 최대 2개까지 업로드할 수 있습니다.');
  }

  const payloadFiles = [];
  for (const file of files) {
    payloadFiles.push({
      fileName: file.name,
      mimeType: file.type,
      dataUrl: await readFileAsDataUrl(file)
    });
  }

  const result = await requestJson('/api/powerlink-images', {
    method: 'POST',
    body: JSON.stringify({ files: payloadFiles })
  });
  fields.powerlinkImages.value = '';
  return result.assets;
}

async function uploadDisplayNativeImagesIfNeeded() {
  const payloadFiles = [];

  for (const [slot, item] of Object.entries(displayImageFields)) {
    const file = item.input.files?.[0] ?? pendingDisplayNativeAdImages[slot];
    if (!file) {
      continue;
    }

    await validateDisplayNativeImage(file, slot);

    payloadFiles.push({
      slot,
      fileName: file.name,
      mimeType: file.type,
      dataUrl: await readFileAsDataUrl(file)
    });
  }

  if (payloadFiles.length === 0) {
    return undefined;
  }

  const result = await requestJson('/api/display-native-images', {
    method: 'POST',
    body: JSON.stringify({ files: payloadFiles })
  });

  for (const item of Object.values(displayImageFields)) {
    item.input.value = '';
  }
  fields.displayAdImages.value = '';
  pendingDisplayNativeAdImages = {};
  renderDisplayNativeBatchStatus();

  return result.assets;
}

async function uploadShoppingPromotionImagesIfNeeded() {
  const file = fields.shoppingPromotionImage.files?.[0];
  if (!file) {
    return undefined;
  }

  await validateShoppingPromotionImage(file);

  const result = await requestJson('/api/shopping-promotion-images', {
    method: 'POST',
    body: JSON.stringify({
      files: [
        {
          fileName: file.name,
          mimeType: file.type,
          dataUrl: await readFileAsDataUrl(file)
        }
      ]
    })
  });

  fields.shoppingPromotionImage.value = '';
  return result.asset;
}

function formatImageBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function validateDisplayNativeImage(file, slot) {
  const requirement = DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot];
  const size = await readImageSize(file);
  const problems = [];
  if (!['image/jpeg', 'image/png'].includes(file.type)) problems.push('JPG 또는 PNG 형식 필요');
  if (size.width !== requirement.width || size.height !== requirement.height) {
    problems.push(`${requirement.width}x${requirement.height}px 필요`);
  }
  if (file.size < requirement.minBytes || file.size > requirement.maxBytes) {
    problems.push(slot === 'profile' ? '200KB 미만 필요' : `${formatImageBytes(requirement.minBytes)}~${formatImageBytes(requirement.maxBytes)} 필요`);
  }
  if (problems.length) {
    throw new Error(`${file.name}: ${size.width}x${size.height}px · ${formatImageBytes(file.size)} — ${problems.join(', ')}`);
  }
  return size;
}

async function validateDisplayNativeImagesBeforeRun() {
  if (fields.displayAdImages.files?.length) {
    await stageDisplayNativeAdImages(fields.displayAdImages.files);
  }
  const errors = [];
  for (const [slot, item] of Object.entries(displayImageFields)) {
    try {
      let file = item.input.files?.[0] ?? pendingDisplayNativeAdImages[slot];
      if (!file) {
        const asset = currentConfig.displayNative?.imageAssets?.[slot];
        if (!asset) throw new Error(`${DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot].label}: 이미지가 없습니다.`);
        const response = await fetch(encodeURI(`/${asset.path}`));
        if (!response.ok) throw new Error(`${asset.fileName}: 저장된 이미지를 읽지 못했습니다.`);
        file = new File([await response.blob()], asset.fileName, { type: asset.mimeType });
      }
      const size = await validateDisplayNativeImage(file, slot);
      item.note.textContent = `검증 완료 · ${size.width}x${size.height}px · ${formatImageBytes(file.size)} · ${file.name}`;
      item.note.classList.remove('limit-exceeded');
    } catch (error) {
      item.note.textContent = error.message;
      item.note.classList.add('limit-exceeded');
      errors.push(error.message);
    }
  }
  if (errors.length) throw new Error(`이미지 사전 검증 실패. 이미지를 교체한 뒤 등록하세요.\n${errors.join('\n')}`);
}

async function validateShoppingPromotionImage(file) {
  const size = await readImageSize(file);
  const requirement = SHOPPING_PROMOTION_IMAGE_REQUIREMENT;
  if (size.width !== requirement.width || size.height !== requirement.height) {
    throw new Error(
      `${requirement.label} 크기는 ${requirement.width}x${requirement.height}px이어야 합니다. 현재 ${size.width}x${size.height}px입니다.`
    );
  }
}

async function stageDisplayNativeAdImages(fileList) {
  const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'));

  if (files.length === 0) {
    throw new Error('광고 이미지 파일을 선택하세요.');
  }

  const nextImages = {};
  const ignoredNames = [];
  const replacedSlots = [];

  for (const file of files) {
    const slot = displayNativeAdImageSlotFromFileName(file.name);

    if (!slot) {
      ignoredNames.push(file.name);
      continue;
    }

    const requirement = DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot];
    await validateDisplayNativeImage(file, slot);

    if (nextImages[slot]) {
      replacedSlots.push(requirement.label);
    }

    nextImages[slot] = file;
  }

  const mappedSlots = Object.keys(nextImages);
  if (mappedSlots.length === 0) {
    throw new Error('파일명에서 1200x1200, 1200x628, 1200x1800, 342x228 규격을 찾지 못했습니다.');
  }

  pendingDisplayNativeAdImages = {
    ...pendingDisplayNativeAdImages,
    ...nextImages
  };

  for (const slot of mappedSlots) {
    displayImageFields[slot].input.value = '';
  }

  renderDisplayNativePendingImages();
  renderDisplayNativeBatchStatus({ ignoredNames, replacedSlots });
  fields.displayAdImages.value = '';
}

function displayNativeAdImageSlotFromFileName(fileName) {
  const normalized = String(fileName).toLowerCase().replace(/[×＊]/g, 'x').replace(/\s+/g, '');
  const dimensions = {
    '1200x1200': 'square',
    '1200x628': 'wide',
    '1200x1800': 'tall',
    '342x228': 'banner'
  };

  for (const [dimension, slot] of Object.entries(dimensions)) {
    if (normalized.includes(dimension)) {
      return slot;
    }
  }

  return '';
}

function readImageSize(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error(`이미지 파일만 업로드할 수 있습니다: ${file.name}`));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`이미지 크기를 읽지 못했습니다: ${file.name}`));
    });
    image.src = objectUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('이미지 파일을 읽지 못했습니다.')));
    reader.readAsDataURL(file);
  });
}

function renderPowerlinkSavedImages(assets) {
  if (!assets?.length) {
    fields.powerlinkSavedImages.textContent = '저장된 이미지 없음';
    fields.powerlinkSavedImages.title = '';
    return;
  }

  const text = `저장된 이미지 ${assets.length}개 · ${assets.map((asset) => asset.fileName).join(', ')}`;
  fields.powerlinkSavedImages.textContent = text;
  fields.powerlinkSavedImages.title = text;
}

function renderDisplayNativeSavedImages(assets) {
  for (const [slot, item] of Object.entries(displayImageFields)) {
    const asset = assets?.[slot];
    if (!asset) {
      item.note.textContent = '저장된 이미지 없음';
      item.note.title = '';
      clearDisplayNativePreview(slot);
      continue;
    }

    const requirement = DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot];
    const text = `저장됨 · ${requirement.width}x${requirement.height} · ${formatImageBytes(asset.size)} · ${asset.fileName}`;
    item.note.textContent = text;
    item.note.title = text;
    renderDisplayNativeAssetPreview(slot, asset);
  }
  renderDisplayNativePendingImages();
  renderDisplayNativeBatchStatus();
}

function renderDisplayNativePendingImages() {
  for (const [slot, file] of Object.entries(pendingDisplayNativeAdImages)) {
    renderDisplayNativeSelectedImage(slot, file);
  }
}

function renderDisplayNativeSelectedImage(slot, file) {
  const item = displayImageFields[slot];
  const requirement = DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot];
  const text = `검증 완료 · ${requirement.width}x${requirement.height} · ${formatImageBytes(file.size)} · ${file.name}`;
  item.note.textContent = text;
  item.note.title = text;
  renderDisplayNativeFilePreview(slot, file);
}

function renderDisplayNativeAssetPreview(slot, asset) {
  const item = displayImageFields[slot];
  if (!item?.preview) {
    return;
  }

  revokeDisplayNativePreviewObjectUrl(slot);
  item.preview.src = encodeURI(`/${asset.path}`);
  item.preview.alt = `${DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot].label} 미리보기`;
  item.preview.hidden = false;
}

function renderDisplayNativeFilePreview(slot, file) {
  const item = displayImageFields[slot];
  if (!item?.preview) {
    return;
  }

  revokeDisplayNativePreviewObjectUrl(slot);
  const objectUrl = URL.createObjectURL(file);
  displayNativePreviewObjectUrls[slot] = objectUrl;
  item.preview.src = objectUrl;
  item.preview.alt = `${DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot].label} 미리보기`;
  item.preview.hidden = false;
}

function clearDisplayNativePreview(slot) {
  const item = displayImageFields[slot];
  if (!item?.preview) {
    return;
  }

  revokeDisplayNativePreviewObjectUrl(slot);
  item.preview.hidden = true;
  item.preview.removeAttribute('src');
  item.preview.alt = '';
}

function revokeDisplayNativePreviewObjectUrl(slot) {
  const objectUrl = displayNativePreviewObjectUrls[slot];
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    delete displayNativePreviewObjectUrls[slot];
  }
}

function renderDisplayNativeBatchStatus(details = {}) {
  const entries = Object.entries(pendingDisplayNativeAdImages);

  if (entries.length === 0) {
    fields.displayAdImageBatchStatus.textContent = '일괄 선택된 광고 이미지 없음';
    fields.displayAdImageBatchStatus.title = '';
    return;
  }

  const mappedText = entries
    .map(([slot, file]) => `${DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot].width}x${DISPLAY_NATIVE_IMAGE_REQUIREMENTS[slot].height}: ${file.name}`)
    .join(', ');
  const ignoredText = details.ignoredNames?.length ? ` · 제외: ${details.ignoredNames.join(', ')}` : '';
  const replacedText = details.replacedSlots?.length ? ` · 중복 교체: ${details.replacedSlots.join(', ')}` : '';
  const text = `일괄 선택 ${entries.length}개 · ${mappedText}${ignoredText}${replacedText}`;
  fields.displayAdImageBatchStatus.textContent = text;
  fields.displayAdImageBatchStatus.title = text;
}

function renderShoppingPromotionSavedImage(asset) {
  if (!asset) {
    fields.shoppingPromotionSavedImage.textContent = '저장된 이미지 없음';
    fields.shoppingPromotionSavedImage.title = '';
    clearShoppingPromotionPreview();
    return;
  }

  const requirement = SHOPPING_PROMOTION_IMAGE_REQUIREMENT;
  const text = `저장됨 · ${requirement.width}x${requirement.height} · ${formatImageBytes(asset.size)} · ${asset.fileName}`;
  fields.shoppingPromotionSavedImage.textContent = text;
  fields.shoppingPromotionSavedImage.title = text;
  renderShoppingPromotionAssetPreview(asset);
}

function renderShoppingPromotionSelectedImage(file) {
  const requirement = SHOPPING_PROMOTION_IMAGE_REQUIREMENT;
  const text = `검증 완료 · ${requirement.width}x${requirement.height} · ${formatImageBytes(file.size)} · ${file.name}`;
  fields.shoppingPromotionSavedImage.textContent = text;
  fields.shoppingPromotionSavedImage.title = text;
  renderShoppingPromotionFilePreview(file);
}

function renderShoppingPromotionAssetPreview(asset) {
  revokeShoppingPromotionPreviewObjectUrl();
  fields.shoppingPromotionImagePreview.src = encodeURI(`/${asset.path}`);
  fields.shoppingPromotionImagePreview.alt = `${SHOPPING_PROMOTION_IMAGE_REQUIREMENT.label} 미리보기`;
  fields.shoppingPromotionImagePreview.hidden = false;
}

function renderShoppingPromotionFilePreview(file) {
  revokeShoppingPromotionPreviewObjectUrl();
  shoppingPromotionPreviewObjectUrl = URL.createObjectURL(file);
  fields.shoppingPromotionImagePreview.src = shoppingPromotionPreviewObjectUrl;
  fields.shoppingPromotionImagePreview.alt = `${SHOPPING_PROMOTION_IMAGE_REQUIREMENT.label} 미리보기`;
  fields.shoppingPromotionImagePreview.hidden = false;
}

function clearShoppingPromotionPreview() {
  revokeShoppingPromotionPreviewObjectUrl();
  fields.shoppingPromotionImagePreview.hidden = true;
  fields.shoppingPromotionImagePreview.removeAttribute('src');
  fields.shoppingPromotionImagePreview.alt = '';
}

function revokeShoppingPromotionPreviewObjectUrl() {
  if (shoppingPromotionPreviewObjectUrl) {
    URL.revokeObjectURL(shoppingPromotionPreviewObjectUrl);
    shoppingPromotionPreviewObjectUrl = '';
  }
}

function commonTemplateFromConfig(config, powerlink, displayNative, shoppingPromotion) {
  return {
    vendorName: normalizeText(
      config.template?.vendorName || powerlink.template.vendorName || displayNative.template.vendorName || shoppingPromotion.template.vendorName || ''
    ),
    productName: normalizeText(
      config.template?.productName || powerlink.template.productName || displayNative.template.productName || shoppingPromotion.template.productName || ''
    ),
    endRoas: normalizeText(config.template?.endRoas || powerlink.template.endRoas || displayNative.template.endRoas || shoppingPromotion.template.endRoas || '')
  };
}

function normalizePowerlinkConfig(value) {
  const keyword = value?.template?.keyword || DEFAULT_POWERLINK_KEYWORD;
  const extensionValue = value?.extensions;

  return {
    campaignUrl: value?.campaignUrl || DEFAULT_POWERLINK_CAMPAIGN_URL,
    campaignId: value?.campaignId || extractCampaignId(value?.campaignUrl || DEFAULT_POWERLINK_CAMPAIGN_URL),
    template: {
      vendorName: normalizeText(value?.template?.vendorName ?? ''),
      productName: normalizeText(value?.template?.productName ?? ''),
      endRoas: normalizeText(value?.template?.endRoas ?? ''),
      keyword: normalizeText(keyword)
    },
    adGroup: {
      name: normalizeText(value?.adGroup?.name || '파워링크광고그룹'),
      defaultBidPrice: value?.adGroup?.defaultBidPrice ?? DEFAULT_POWERLINK_BID_PRICE,
      dailyBudget: value?.adGroup?.dailyBudget ?? DEFAULT_DAILY_BUDGET,
      userLock: value?.adGroup?.userLock === true
    },
    material: {
      headline: normalizeText(value?.material?.headline || DEFAULT_POWERLINK_HEADLINE),
      description: normalizeText(value?.material?.description || buildPowerlinkDescription(keyword)),
      productLink: value?.material?.productLink ?? ''
    },
    keywords: Array.isArray(value?.keywords) ? value.keywords.map((item) => normalizeText(item)) : [],
    imageAssets: Array.isArray(value?.imageAssets) ? value.imageAssets : [],
    extensions: {
      subLinks: Array.isArray(extensionValue?.subLinks) ? extensionValue.subLinks : DEFAULT_POWERLINK_EXTENSIONS.subLinks,
      promotionText: normalizeText(extensionValue?.promotionText ?? DEFAULT_POWERLINK_EXTENSIONS.promotionText),
      headlines: Array.isArray(extensionValue?.headlines)
        ? extensionValue.headlines.map((item) => normalizeText(item))
        : DEFAULT_POWERLINK_EXTENSIONS.headlines,
      extraDescription: normalizeText(extensionValue?.extraDescription ?? DEFAULT_POWERLINK_EXTENSIONS.extraDescription)
    }
  };
}

function normalizeDisplayNativeConfig(value) {
  const descriptions = value?.material?.descriptions ?? {};
  const ages = Array.isArray(value?.demographics?.ages) ? value.demographics.ages : DEFAULT_DISPLAY_NATIVE_AGES;
  const genders = Array.isArray(value?.demographics?.genders) ? value.demographics.genders : ['male'];
  const campaignUrl = value?.campaignUrl || DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL;
  const imageAssets = value?.imageAssets && typeof value.imageAssets === 'object' ? value.imageAssets : {};

  return {
    campaignUrl,
    campaignId: value?.campaignId || extractDisplayCampaignId(campaignUrl) || DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID,
    template: {
      vendorName: normalizeText(value?.template?.vendorName ?? ''),
      productName: normalizeText(value?.template?.productName ?? ''),
      endRoas: normalizeText(value?.template?.endRoas ?? '')
    },
    adGroup: {
      name: normalizeText(value?.adGroup?.name || '디스플레이광고그룹'),
      dailyBudget: value?.adGroup?.dailyBudget ?? DEFAULT_DISPLAY_NATIVE_DAILY_BUDGET,
      bidStrategyValue: value?.adGroup?.bidStrategyValue ?? DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE,
      startAt: value?.adGroup?.startAt || ''
    },
    demographics: {
      genders,
      includeUnknownGender: Boolean(value?.demographics?.includeUnknownGender),
      ageMode: value?.demographics?.ageMode === 'all' ? 'all' : 'manual',
      ages: ages.filter((age) => DISPLAY_NATIVE_AGES.includes(age)),
      includeUnknownAge: value?.demographics?.includeUnknownAge !== false
    },
    material: {
      landingUrl: value?.material?.landingUrl ?? '',
      adText: normalizeText(value?.material?.adText ?? DEFAULT_DISPLAY_NATIVE_AD_TEXT),
      descriptions: {
        short1: normalizeText(descriptions.short1 ?? DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short1),
        short2: normalizeText(descriptions.short2 ?? DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short2),
        short3: normalizeText(descriptions.short3 ?? DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short3),
        long1: normalizeText(descriptions.long1 ?? DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.long1),
        long2: normalizeText(descriptions.long2 ?? DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.long2)
      }
    },
    imageAssets: {
      profile: DEFAULT_DISPLAY_NATIVE_PROFILE_IMAGE_ASSET,
      ...imageAssets
    }
  };
}

function normalizeShoppingPromotionConfig(value, displayNativeFallback = normalizeDisplayNativeConfig()) {
  const fallback = displayNativeFallback ?? normalizeDisplayNativeConfig();
  const ages = Array.isArray(value?.demographics?.ages) ? value.demographics.ages : fallback.demographics.ages;
  const genders = Array.isArray(value?.demographics?.genders) ? value.demographics.genders : fallback.demographics.genders;
  const savedCampaignUrl = value?.campaignUrl || '';
  const campaignUrl =
    savedCampaignUrl && savedCampaignUrl !== DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL && savedCampaignUrl !== LEGACY_SHOPPING_PROMOTION_CAMPAIGN_URL ? savedCampaignUrl : DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL;
  const savedCampaignId = value?.campaignId || '';

  return {
    campaignUrl,
    campaignId:
      savedCampaignId &&
      savedCampaignId !== DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID &&
      savedCampaignId !== LEGACY_DISPLAY_NATIVE_CAMPAIGN_ID &&
      savedCampaignId !== LEGACY_SHOPPING_PROMOTION_CAMPAIGN_ID
        ? savedCampaignId
        : extractDisplayCampaignId(campaignUrl) || '1000004',
    template: {
      vendorName: normalizeText(value?.template?.vendorName ?? fallback.template.vendorName ?? ''),
      productName: normalizeText(value?.template?.productName ?? fallback.template.productName ?? ''),
      endRoas: normalizeText(value?.template?.endRoas ?? fallback.template.endRoas ?? '')
    },
    adGroup: {
      name: normalizeText(value?.adGroup?.name || fallback.adGroup.name || '쇼핑프로모션광고그룹'),
      dailyBudget: value?.adGroup?.dailyBudget ?? fallback.adGroup.dailyBudget ?? DEFAULT_DISPLAY_NATIVE_DAILY_BUDGET,
      bidStrategyValue:
        value?.adGroup?.bidStrategyValue ?? fallback.adGroup?.bidStrategyValue ?? DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE,
      startAt: value?.adGroup?.startAt || fallback.adGroup.startAt || ''
    },
    demographics: {
      genders,
      includeUnknownGender: value?.demographics?.includeUnknownGender ?? fallback.demographics.includeUnknownGender ?? false,
      ageMode: value?.demographics?.ageMode === 'all' ? 'all' : fallback.demographics.ageMode === 'all' ? 'all' : 'manual',
      ages: ages.filter((age) => DISPLAY_NATIVE_AGES.includes(age)),
      includeUnknownAge: value?.demographics?.includeUnknownAge ?? fallback.demographics.includeUnknownAge ?? true
    },
    material: {
      landingUrl: value?.material?.landingUrl ?? fallback.material.landingUrl ?? '',
      adText: normalizeText(value?.material?.adText ?? DEFAULT_SHOPPING_PROMOTION_AD_TEXT)
    },
    imageAsset: value?.imageAsset
  };
}

function extractCampaignId(url) {
  const match = String(url ?? '').match(/\/campaigns\/([^/?#]+)/);
  return match?.[1] ?? '';
}

function extractDisplayCampaignId(url) {
  const match = String(url ?? '').match(/\/campaign\/([^/?#]+)/);
  return match?.[1] ?? '';
}

function extractProductIdFromUrl(url) {
  const match = String(url ?? '').match(/\/products\/([0-9]+)/);
  return match?.[1] ?? '';
}

function ensureDisplayNativeStartAt(value) {
  const startAt = String(value ?? '').trim();
  if (isDisplayNativeStartAtAvailable(startAt)) {
    return startAt.slice(0, 16);
  }

  return defaultDisplayNativeStartAt();
}

function isDisplayNativeStartAtAvailable(value) {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() >= Date.now() + 30 * 60 * 1000;
}

function defaultDisplayNativeStartAt() {
  const date = new Date(Date.now() + 40 * 60 * 1000);
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseTabFromHash() {
  if (window.location.hash === '#powerlink') {
    return 'powerlink';
  }

  if (window.location.hash === '#display-native' || window.location.hash === '#displayNative') {
    return 'displayNative';
  }

  if (window.location.hash === '#shopping-promotion' || window.location.hash === '#shoppingPromotion') {
    return 'shoppingPromotion';
  }

  return 'shopping';
}

function setActiveTab(nextTab) {
  activeTab = nextTab === 'powerlink' || nextTab === 'displayNative' || nextTab === 'shoppingPromotion' ? nextTab : 'shopping';

  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === activeTab);
  }

  for (const page of document.querySelectorAll('.tab-page')) {
    const active = page.dataset.page === activeTab;
    page.hidden = !active;
    page.classList.toggle('active', active);
  }

  pageTitle.textContent =
    {
      shopping: '쇼핑검색광고 등록',
      powerlink: '파워링크광고 등록',
      displayNative: '디스플레이 네이티브 이미지 소재',
      shoppingPromotion: '쇼핑 프로모션 광고'
    }[activeTab] ?? '쇼핑검색광고 등록';
  const hash =
    {
      displayNative: '#display-native',
      shoppingPromotion: '#shopping-promotion'
    }[activeTab] ?? `#${activeTab}`;
  window.history.replaceState(null, '', hash);
}

function renderStatus(result) {
  if (result.error) {
    setStatus(result.error, { holdMs: 10000 });
    return;
  }

  const suffix = result.runDir ? ` · ${result.runDir}` : '';
  setStatus(`${result.message}${suffix}`);
  renderRecording(result.networkRecording);
}

function renderRecording(recording) {
  if (!recordingText || !recording) {
    return;
  }

  if (recording.active) {
    recordingText.textContent = `기록 중: ${recording.count}건 · ${recording.runDir ?? ''}`;
    recordingText.title = recordingText.textContent;
    return;
  }

  if (recording.lastFile) {
    recordingText.textContent = `기록 종료: ${recording.count}건 · ${recording.lastFile}`;
    recordingText.title = recordingText.textContent;
    return;
  }

  recordingText.textContent = `기록 대기 중: ${recording.count ?? 0}건`;
  recordingText.title = recordingText.textContent;
}

function setStatus(message, options = {}) {
  const text = String(message);
  statusText.textContent = text;
  statusText.title = text;

  if (options.holdMs) {
    localStatusHoldUntil = Date.now() + options.holdMs;
  }
}

function showError(error) {
  setStatus(error instanceof Error ? error.message : String(error), { holdMs: 10000 });
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return body;
}
