import { z } from 'zod';

const normalizedText = (schema = z.string()) => z.string().transform((value) => value.normalize('NFC')).pipe(schema);
const nonEmptyString = normalizedText(z.string().trim().min(1));

const DEFAULT_POWERLINK_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/sa/campaigns/cmp-a001-01-000000000000001';
const DEFAULT_POWERLINK_CAMPAIGN_ID = 'cmp-a001-01-000000000000001';
const DEFAULT_POWERLINK_HEADLINE = '트렌디한 {keyword:니트반팔} 여기!';
const DEFAULT_POWERLINK_DESCRIPTION =
  '비교불가 특가! 끝판왕 {keyword:버뮤다팬츠} 365일 무조건 무료배송!';
const DEFAULT_POWERLINK_SUB_LINK_URL = 'https://smartstore.naver.com/sample';
const DEFAULT_POWERLINK_EXTENSIONS = {
  subLinks: ['상의', '하의', '1+1', '당일출고'].map((name) => ({ name, final: DEFAULT_POWERLINK_SUB_LINK_URL })),
  promotionText: '회원가입 2천원 할인',
  headlines: ['365일 무료배송', '오늘출발'],
  extraDescription: '편하고 깔끔한 남성 출근룩을 만나보세요'
};
const DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/1000001';
const DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID = '1000001';
const DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE = 450;
const DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL =
  'https://ads.naver.com/manage/ad-accounts/1000000/da/dashboard/campaign/1000004';
const DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_ID = '1000004';
const DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE = 400;
const DEFAULT_DISPLAY_NATIVE_PROFILE_IMAGE_ASSET = {
  fileName: 'sample-profile.jpg',
  path: 'data/display-native-assets/sample-profile.jpg',
  mimeType: 'image/jpeg',
  size: 24655,
  uploadedAt: '2026-01-01T00:00:00.000Z'
};
const DEFAULT_DISPLAY_NATIVE_AD_TEXT = '편안한 코튼팬츠, 2만원대';
const DEFAULT_SHOPPING_PROMOTION_AD_TEXT = '고급소재 니트 카라 반팔, 3만원대. 무조건 무료배송!';
const DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS = {
  short1: '365일 무료배송!',
  short2: '코튼 100% 팬츠',
  short3: '매일 입기 좋아요',
  long1: '매일 입기 좋은 코튼 100% 팬츠',
  long2: '편안한 코튼팬츠, 2만원대'
};
const MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH = 25;
const MAX_SHOPPING_PROMOTION_AD_TEXT_LENGTH = 57;

const DisplayNativeAgeSchema = z.enum([
  '14-18',
  '19-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50-54',
  '55-59',
  '60+'
]);

const defaultDisplayNativeAges = [
  '19-24',
  '25-29',
  '30-34',
  '35-39',
  '40-44',
  '45-49',
  '50-54',
  '55-59'
] as const;

export const ShoppingSearchAdGroupSchema = z.object({
  name: nonEmptyString,
  mallName: normalizedText().optional().default(''),
  shoppingPartnerCenterId: normalizedText().optional().default(''),
  defaultBidPrice: z.number().positive().default(340),
  dailyBudget: z.number().positive().optional()
});

export const ShoppingSearchProductSchema = z.object({
  searchType: z.enum(['productName', 'productId']).default('productName'),
  query: nonEmptyString,
  expectedName: normalizedText().optional().default('')
});

export const ShoppingSearchMaterialSchema = z.object({
  exposureProductName: normalizedText(z.string().trim().max(MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH)).optional().default('')
});

export const ShoppingSearchExtensionsSchema = z.object({
  useTalkTalk: z.boolean().default(true).transform(() => true),
  talkTalkUrl: normalizedText(z.string().trim()).default('http://talk.naver.com/sample')
    .refine((value) => /^https?:\/\/talk\.naver\.com\/[a-zA-Z0-9_-]+\/?$/.test(value), '네이버 톡톡 주소를 입력하세요.'),
  promotionText1: normalizedText(z.string().trim().max(10)).default(''),
  promotionText2: normalizedText(z.string().trim().max(30)).default('')
}).refine((value) => !value.promotionText2 || Boolean(value.promotionText1), {
  message: '추가홍보문구 2를 입력할 때는 문구 1도 입력하세요.', path: ['promotionText1']
});

const ImageAssetSchema = z.object({
  fileName: nonEmptyString,
  path: z.string().trim().min(1),
  mimeType: z.string().optional().default(''),
  size: z.number().nonnegative().optional().default(0),
  uploadedAt: z.string().optional().default('')
});

export const PowerlinkImageAssetSchema = ImageAssetSchema;

export const PowerlinkExtensionsSchema = z.object({
  subLinks: z
    .array(z.object({
      name: normalizedText(z.string().trim().min(1).max(6)),
      final: z.string().url()
    }))
    .max(4)
    .refine((items) => items.length === 0 || items.length >= 3, '서브링크는 사용하지 않거나 3~4개를 입력하세요.')
    .default(DEFAULT_POWERLINK_EXTENSIONS.subLinks),
  promotionText: normalizedText(z.string().trim().max(14)).default(DEFAULT_POWERLINK_EXTENSIONS.promotionText),
  headlines: z
    .array(normalizedText(z.string().trim().min(1).max(15)))
    .max(15)
    .default(DEFAULT_POWERLINK_EXTENSIONS.headlines),
  extraDescription: normalizedText(z.string().trim().max(45)).default(DEFAULT_POWERLINK_EXTENSIONS.extraDescription)
});

export const PowerlinkConfigSchema = z.object({
  campaignUrl: z.string().url().default(DEFAULT_POWERLINK_CAMPAIGN_URL),
  campaignId: nonEmptyString.default(DEFAULT_POWERLINK_CAMPAIGN_ID),
  template: z
    .object({
      vendorName: normalizedText().optional().default(''),
      productName: normalizedText().optional().default(''),
      endRoas: normalizedText().optional().default(''),
      keyword: normalizedText().optional().default('버뮤다팬츠')
    })
    .default({
      vendorName: '',
      productName: '',
      endRoas: '',
      keyword: '버뮤다팬츠'
    }),
  adGroup: z
    .object({
      name: nonEmptyString.default('파워링크광고그룹'),
      defaultBidPrice: z.number().positive().default(340),
      dailyBudget: z.number().positive().default(150000),
      userLock: z.boolean().default(false)
    })
    .default({
      name: '파워링크광고그룹',
      defaultBidPrice: 340,
      dailyBudget: 150000,
      userLock: false
    }),
  material: z
    .object({
      headline: nonEmptyString.default(DEFAULT_POWERLINK_HEADLINE),
      description: nonEmptyString.default(DEFAULT_POWERLINK_DESCRIPTION),
      productLink: z.string().trim().optional().default('')
    })
    .default({
      headline: DEFAULT_POWERLINK_HEADLINE,
      description: DEFAULT_POWERLINK_DESCRIPTION,
      productLink: ''
    }),
  keywords: z.array(nonEmptyString).max(1000).default([]),
  imageAssets: z.array(PowerlinkImageAssetSchema).max(2).default([]),
  extensions: PowerlinkExtensionsSchema.default(DEFAULT_POWERLINK_EXTENSIONS)
});

export const DisplayNativeImageAssetsSchema = z
  .object({
    profile: ImageAssetSchema.optional(),
    square: ImageAssetSchema.optional(),
    wide: ImageAssetSchema.optional(),
    tall: ImageAssetSchema.optional(),
    banner: ImageAssetSchema.optional()
  })
  .default({
    profile: DEFAULT_DISPLAY_NATIVE_PROFILE_IMAGE_ASSET
  });

export const DisplayNativeConfigSchema = z.object({
  campaignUrl: z.string().url().default(DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL),
  campaignId: nonEmptyString.default(DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID),
  template: z
    .object({
      vendorName: normalizedText().optional().default(''),
      productName: normalizedText().optional().default(''),
      endRoas: normalizedText().optional().default('')
    })
    .default({
      vendorName: '',
      productName: '',
      endRoas: ''
    }),
  adGroup: z
    .object({
      name: nonEmptyString.default('디스플레이광고그룹'),
      dailyBudget: z.number().positive().default(10000),
      bidStrategyValue: z.number().positive().default(DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE),
      startAt: z.string().optional().default('')
    })
    .default({
      name: '디스플레이광고그룹',
      dailyBudget: 10000,
      bidStrategyValue: DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE,
      startAt: ''
    }),
  demographics: z
    .object({
      genders: z.array(z.enum(['female', 'male'])).default(['male']),
      includeUnknownGender: z.boolean().default(false),
      ageMode: z.enum(['all', 'manual']).default('manual'),
      ages: z.array(DisplayNativeAgeSchema).default([...defaultDisplayNativeAges]),
      includeUnknownAge: z.boolean().default(true)
    })
    .default({
      genders: ['male'],
      includeUnknownGender: false,
      ageMode: 'manual',
      ages: [...defaultDisplayNativeAges],
      includeUnknownAge: true
    }),
  material: z
    .object({
      landingUrl: z.string().trim().optional().default(''),
      adText: normalizedText(z.string().trim().max(20)).optional().default(DEFAULT_DISPLAY_NATIVE_AD_TEXT),
      descriptions: z
        .object({
          short1: normalizedText(z.string().trim().max(12)).optional().default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short1),
          short2: normalizedText(z.string().trim().max(12)).optional().default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short2),
          short3: normalizedText(z.string().trim().max(12)).optional().default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.short3),
          long1: normalizedText(z.string().trim().max(28)).optional().default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.long1),
          long2: normalizedText(z.string().trim().max(28)).optional().default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS.long2)
        })
        .default(DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS)
    })
    .default({
      landingUrl: '',
      adText: DEFAULT_DISPLAY_NATIVE_AD_TEXT,
      descriptions: DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS
    }),
  imageAssets: DisplayNativeImageAssetsSchema
});

export const ShoppingPromotionConfigSchema = z.object({
  campaignUrl: z.string().url().default(DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL),
  campaignId: nonEmptyString.default(DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_ID),
  template: z
    .object({
      vendorName: normalizedText().optional().default(''),
      productName: normalizedText().optional().default(''),
      endRoas: normalizedText().optional().default('')
    })
    .default({
      vendorName: '',
      productName: '',
      endRoas: ''
    }),
  adGroup: z
    .object({
      name: nonEmptyString.default('쇼핑프로모션광고그룹'),
      dailyBudget: z.number().positive().default(10000),
      bidStrategyValue: z.number().positive().default(DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE),
      startAt: z.string().optional().default('')
    })
    .default({
      name: '쇼핑프로모션광고그룹',
      dailyBudget: 10000,
      bidStrategyValue: DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE,
      startAt: ''
    }),
  demographics: z
    .object({
      genders: z.array(z.enum(['female', 'male'])).default(['male']),
      includeUnknownGender: z.boolean().default(false),
      ageMode: z.enum(['all', 'manual']).default('manual'),
      ages: z.array(DisplayNativeAgeSchema).default([...defaultDisplayNativeAges]),
      includeUnknownAge: z.boolean().default(true)
    })
    .default({
      genders: ['male'],
      includeUnknownGender: false,
      ageMode: 'manual',
      ages: [...defaultDisplayNativeAges],
      includeUnknownAge: true
    }),
  material: z
    .object({
      landingUrl: z.string().trim().optional().default(''),
      adText: normalizedText(z.string().trim().max(MAX_SHOPPING_PROMOTION_AD_TEXT_LENGTH)).optional().default(DEFAULT_SHOPPING_PROMOTION_AD_TEXT)
    })
    .default({
      landingUrl: '',
      adText: DEFAULT_SHOPPING_PROMOTION_AD_TEXT
    }),
  imageAsset: ImageAssetSchema.optional()
});

const ShoppingPromotionConfigDefault = {
  campaignUrl: DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_URL,
  campaignId: DEFAULT_SHOPPING_PROMOTION_CAMPAIGN_ID,
  template: {
    vendorName: '',
    productName: '',
    endRoas: ''
  },
  adGroup: {
    name: '쇼핑프로모션광고그룹',
    dailyBudget: 10000,
    bidStrategyValue: DEFAULT_SHOPPING_PROMOTION_BID_STRATEGY_VALUE,
    startAt: ''
  },
  demographics: {
    genders: ['male' as const],
    includeUnknownGender: false,
    ageMode: 'manual' as const,
    ages: [...defaultDisplayNativeAges],
    includeUnknownAge: true
  },
  material: {
    landingUrl: '',
    adText: DEFAULT_SHOPPING_PROMOTION_AD_TEXT
  }
};

export const ShoppingSearchConfigSchema = z.object({
  naverAdsUrl: z.string().url().default('https://manage.searchad.naver.com'),
  naverAdAccountId: z.number().positive().optional(),
  naverCustomerId: z.number().positive().optional(),
  browserMode: z.enum(['profile', 'existingChrome']).default('profile'),
  browserCdpUrl: z.string().url().default('http://127.0.0.1:9222'),
  chromeProfileDir: z.string().default('.chrome-profile/naver-search-ads'),
  runOutputDir: z.string().default('runs'),
  submitMode: z.enum(['manual', 'auto']).default('manual'),
  template: z
    .object({
      vendorName: normalizedText().optional().default(''),
      productName: normalizedText().optional().default(''),
      endRoas: normalizedText().optional().default(''),
      productId: normalizedText().optional().default(''),
      exposureProductName: normalizedText(z.string().trim().max(MAX_SHOPPING_EXPOSURE_PRODUCT_NAME_LENGTH)).optional().default('')
    })
    .default({
      vendorName: '',
      productName: '',
      endRoas: '',
      productId: '',
      exposureProductName: ''
    }),
  campaign: z.object({
    name: nonEmptyString,
    dailyBudget: z.number().positive().optional(),
    useAutoTracking: z.boolean().default(true),
    useBudgetDistribution: z.boolean().default(false)
  }),
  adGroup: ShoppingSearchAdGroupSchema,
  material: ShoppingSearchMaterialSchema.default({ exposureProductName: '' }),
  products: z.array(ShoppingSearchProductSchema).min(1),
  extensions: ShoppingSearchExtensionsSchema.default({}),
  powerlink: PowerlinkConfigSchema.default({
    campaignUrl: DEFAULT_POWERLINK_CAMPAIGN_URL,
    campaignId: DEFAULT_POWERLINK_CAMPAIGN_ID,
    template: {
      vendorName: '',
      productName: '',
      endRoas: '',
      keyword: '버뮤다팬츠'
    },
    adGroup: {
      name: '파워링크광고그룹',
      defaultBidPrice: 340,
      dailyBudget: 150000,
      userLock: false
    },
    material: {
      headline: DEFAULT_POWERLINK_HEADLINE,
      description: DEFAULT_POWERLINK_DESCRIPTION,
      productLink: ''
    },
    keywords: [],
    imageAssets: [],
    extensions: DEFAULT_POWERLINK_EXTENSIONS
  }),
  displayNative: DisplayNativeConfigSchema.default({
    campaignUrl: DEFAULT_DISPLAY_NATIVE_CAMPAIGN_URL,
    campaignId: DEFAULT_DISPLAY_NATIVE_CAMPAIGN_ID,
    template: {
      vendorName: '',
      productName: '',
      endRoas: ''
    },
    adGroup: {
      name: '디스플레이광고그룹',
      dailyBudget: 10000,
      bidStrategyValue: DEFAULT_DISPLAY_NATIVE_BID_STRATEGY_VALUE,
      startAt: ''
    },
    demographics: {
      genders: ['male'],
      includeUnknownGender: false,
      ageMode: 'manual',
      ages: [...defaultDisplayNativeAges],
      includeUnknownAge: true
    },
    material: {
      landingUrl: '',
      adText: DEFAULT_DISPLAY_NATIVE_AD_TEXT,
      descriptions: DEFAULT_DISPLAY_NATIVE_DESCRIPTIONS
    },
    imageAssets: {
      profile: DEFAULT_DISPLAY_NATIVE_PROFILE_IMAGE_ASSET
    }
  }),
  shoppingPromotion: ShoppingPromotionConfigSchema.default(ShoppingPromotionConfigDefault)
});

export type ShoppingSearchConfig = z.infer<typeof ShoppingSearchConfigSchema>;
export type ShoppingSearchProductConfig = z.infer<typeof ShoppingSearchProductSchema>;
export type PowerlinkConfig = z.infer<typeof PowerlinkConfigSchema>;
export type PowerlinkImageAsset = z.infer<typeof PowerlinkImageAssetSchema>;
export type DisplayNativeConfig = z.infer<typeof DisplayNativeConfigSchema>;
export type DisplayNativeImageAssets = z.infer<typeof DisplayNativeImageAssetsSchema>;
export type ShoppingPromotionConfig = z.infer<typeof ShoppingPromotionConfigSchema>;

export const SelectorConfigSchema = z.object({
  buttons: z.record(z.array(z.string())),
  fields: z.record(z.array(z.string())),
  choices: z.record(z.array(z.string()))
});

export type SelectorConfig = z.infer<typeof SelectorConfigSchema>;
