import { MappingSource, SpendCategory, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const merchants = [
  {
    slug: "whole-foods-market",
    displayName: "Whole Foods Market",
    normalized: "wholefoodsmarket",
    mcc: "5411",
    notes: "Default grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "trader-joes",
    displayName: "Trader Joe's",
    normalized: "traderjoes",
    mcc: "5411",
    notes: "Default grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "costco",
    displayName: "Costco",
    normalized: "costco",
    mcc: "5300",
    notes: "Default wholesale test merchant",
    categories: [SpendCategory.WHOLESALE],
  },
  {
    slug: "starbucks",
    displayName: "Starbucks",
    normalized: "starbucks",
    mcc: "5814",
    notes: "Default dining test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "uber",
    displayName: "Uber",
    normalized: "uber",
    mcc: "4121",
    notes: "Default travel test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "amazon",
    displayName: "Amazon",
    normalized: "amazon",
    mcc: "5942",
    notes: "Default online shopping test merchant",
    categories: [SpendCategory.ONLINE_SHOPPING],
  },
  {
    slug: "walmart",
    displayName: "Walmart",
    normalized: "walmart",
    mcc: "5310",
    notes: "Mass retail test merchant",
    categories: [SpendCategory.GROCERIES, SpendCategory.OTHER],
  },
  {
    slug: "target",
    displayName: "Target",
    normalized: "target",
    mcc: "5310",
    notes: "Mass retail test merchant",
    categories: [SpendCategory.GROCERIES, SpendCategory.OTHER],
  },
  {
    slug: "walgreens",
    displayName: "Walgreens",
    normalized: "walgreens",
    mcc: "5912",
    notes: "Drugstore test merchant",
    categories: [SpendCategory.DRUGSTORES],
  },
  {
    slug: "cvs-pharmacy",
    displayName: "CVS Pharmacy",
    normalized: "cvspharmacy",
    mcc: "5912",
    notes: "Drugstore test merchant",
    categories: [SpendCategory.DRUGSTORES],
  },
  {
    slug: "rite-aid",
    displayName: "Rite Aid",
    normalized: "riteaid",
    mcc: "5912",
    notes: "Drugstore test merchant",
    categories: [SpendCategory.DRUGSTORES],
  },
  {
    slug: "kroger",
    displayName: "Kroger",
    normalized: "kroger",
    mcc: "5411",
    notes: "Grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "safeway",
    displayName: "Safeway",
    normalized: "safeway",
    mcc: "5411",
    notes: "Grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "aldi",
    displayName: "ALDI",
    normalized: "aldi",
    mcc: "5411",
    notes: "Grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "publix",
    displayName: "Publix",
    normalized: "publix",
    mcc: "5411",
    notes: "Grocery test merchant",
    categories: [SpendCategory.GROCERIES],
  },
  {
    slug: "instacart",
    displayName: "Instacart",
    normalized: "instacart",
    mcc: "5499",
    notes: "Online groceries test merchant",
    categories: [SpendCategory.GROCERIES, SpendCategory.ONLINE_SHOPPING],
  },
  {
    slug: "doordash",
    displayName: "DoorDash",
    normalized: "doordash",
    mcc: "5812",
    notes: "Food delivery test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "ubereats",
    displayName: "Uber Eats",
    normalized: "ubereats",
    mcc: "5812",
    notes: "Food delivery test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "mcdonalds",
    displayName: "McDonald's",
    normalized: "mcdonalds",
    mcc: "5814",
    notes: "Fast food test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "chipotle",
    displayName: "Chipotle",
    normalized: "chipotle",
    mcc: "5812",
    notes: "Dining test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "subway",
    displayName: "Subway",
    normalized: "subway",
    mcc: "5814",
    notes: "Fast food test merchant",
    categories: [SpendCategory.DINING],
  },
  {
    slug: "shell",
    displayName: "Shell",
    normalized: "shell",
    mcc: "5541",
    notes: "Fuel test merchant",
    categories: [SpendCategory.GAS],
  },
  {
    slug: "exxon",
    displayName: "Exxon",
    normalized: "exxon",
    mcc: "5541",
    notes: "Fuel test merchant",
    categories: [SpendCategory.GAS],
  },
  {
    slug: "chevron",
    displayName: "Chevron",
    normalized: "chevron",
    mcc: "5541",
    notes: "Fuel test merchant",
    categories: [SpendCategory.GAS],
  },
  {
    slug: "bp",
    displayName: "BP",
    normalized: "bp",
    mcc: "5541",
    notes: "Fuel test merchant",
    categories: [SpendCategory.GAS],
  },
  {
    slug: "delta",
    displayName: "Delta Air Lines",
    normalized: "deltaairlines",
    mcc: "4511",
    notes: "Airline test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "united-airlines",
    displayName: "United Airlines",
    normalized: "unitedairlines",
    mcc: "4511",
    notes: "Airline test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "southwest",
    displayName: "Southwest Airlines",
    normalized: "southwestairlines",
    mcc: "4511",
    notes: "Airline test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "airbnb",
    displayName: "Airbnb",
    normalized: "airbnb",
    mcc: "7011",
    notes: "Lodging test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "marriott",
    displayName: "Marriott",
    normalized: "marriott",
    mcc: "7011",
    notes: "Hotel test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "hilton",
    displayName: "Hilton",
    normalized: "hilton",
    mcc: "7011",
    notes: "Hotel test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "booking-com",
    displayName: "Booking.com",
    normalized: "bookingcom",
    mcc: "4722",
    notes: "Travel agency test merchant",
    categories: [SpendCategory.TRAVEL],
  },
  {
    slug: "netflix",
    displayName: "Netflix",
    normalized: "netflix",
    mcc: "4899",
    notes: "Streaming test merchant",
    categories: [SpendCategory.ENTERTAINMENT],
  },
  {
    slug: "spotify",
    displayName: "Spotify",
    normalized: "spotify",
    mcc: "4899",
    notes: "Streaming test merchant",
    categories: [SpendCategory.ENTERTAINMENT],
  },
  {
    slug: "disney-plus",
    displayName: "Disney+",
    normalized: "disneyplus",
    mcc: "4899",
    notes: "Streaming test merchant",
    categories: [SpendCategory.ENTERTAINMENT],
  },
  {
    slug: "cinemark",
    displayName: "Cinemark",
    normalized: "cinemark",
    mcc: "7832",
    notes: "Cinema test merchant",
    categories: [SpendCategory.ENTERTAINMENT],
  },
  {
    slug: "best-buy",
    displayName: "Best Buy",
    normalized: "bestbuy",
    mcc: "5732",
    notes: "Electronics retail test merchant",
    categories: [SpendCategory.ONLINE_SHOPPING, SpendCategory.OTHER],
  },
  {
    slug: "ebay",
    displayName: "eBay",
    normalized: "ebay",
    mcc: "5942",
    notes: "Marketplace test merchant",
    categories: [SpendCategory.ONLINE_SHOPPING],
  },
  {
    slug: "etsy",
    displayName: "Etsy",
    normalized: "etsy",
    mcc: "5947",
    notes: "Marketplace test merchant",
    categories: [SpendCategory.ONLINE_SHOPPING],
  },
  {
    slug: "ikea",
    displayName: "IKEA",
    normalized: "ikea",
    mcc: "5712",
    notes: "Home retail test merchant",
    categories: [SpendCategory.OTHER],
  },
  {
    slug: "home-depot",
    displayName: "Home Depot",
    normalized: "homedepot",
    mcc: "5200",
    notes: "Home improvement test merchant",
    categories: [SpendCategory.OTHER],
  },
  {
    slug: "lowes",
    displayName: "Lowe's",
    normalized: "lowes",
    mcc: "5200",
    notes: "Home improvement test merchant",
    categories: [SpendCategory.OTHER],
  },
  {
    slug: "costco-gas",
    displayName: "Costco Gas",
    normalized: "costcogas",
    mcc: "5541",
    notes: "Fuel at wholesale club",
    categories: [SpendCategory.GAS, SpendCategory.WHOLESALE],
  },
];

const mccMap = [
  { mcc: "5411", category: SpendCategory.GROCERIES, label: "Grocery stores" },
  { mcc: "5300", category: SpendCategory.WHOLESALE, label: "Wholesale clubs" },
  { mcc: "5812", category: SpendCategory.DINING, label: "Restaurants" },
  { mcc: "5814", category: SpendCategory.DINING, label: "Fast food" },
  { mcc: "4121", category: SpendCategory.TRAVEL, label: "Taxicabs and rides" },
  {
    mcc: "5541",
    category: SpendCategory.GAS,
    label: "Service stations with fuel",
  },
  {
    mcc: "5942",
    category: SpendCategory.ONLINE_SHOPPING,
    label: "Book stores / online marketplaces",
  },
  {
    mcc: "5310",
    category: SpendCategory.GROCERIES,
    label: "Discount stores",
  },
  {
    mcc: "5912",
    category: SpendCategory.DRUGSTORES,
    label: "Drug stores and pharmacies",
  },
  {
    mcc: "4511",
    category: SpendCategory.TRAVEL,
    label: "Airlines",
  },
  {
    mcc: "7011",
    category: SpendCategory.TRAVEL,
    label: "Hotels and motels",
  },
  {
    mcc: "4722",
    category: SpendCategory.TRAVEL,
    label: "Travel agencies and tour operators",
  },
  {
    mcc: "4899",
    category: SpendCategory.ENTERTAINMENT,
    label: "Cable / streaming services",
  },
  {
    mcc: "7832",
    category: SpendCategory.ENTERTAINMENT,
    label: "Motion picture theaters",
  },
  {
    mcc: "5732",
    category: SpendCategory.ONLINE_SHOPPING,
    label: "Electronics stores",
  },
  {
    mcc: "5947",
    category: SpendCategory.ONLINE_SHOPPING,
    label: "Gift, card and novelty shops",
  },
  {
    mcc: "5200",
    category: SpendCategory.OTHER,
    label: "Home supply warehouse stores",
  },
  {
    mcc: "5499",
    category: SpendCategory.GROCERIES,
    label: "Specialty food stores",
  },
  {
    mcc: "5712",
    category: SpendCategory.OTHER,
    label: "Furniture and home accessories",
  },
];

async function upsertMerchants() {
  for (const merchant of merchants) {
    const { categories, ...merchantData } = merchant;
    const upserted = await prisma.merchant.upsert({
      where: { slug: merchant.slug },
      create: merchantData,
      update: merchantData,
    });

    for (const category of categories) {
      await prisma.merchantCategoryMapping.upsert({
        where: {
          merchantId_category: {
            merchantId: upserted.id,
            category,
          },
        },
        create: {
          merchantId: upserted.id,
          category,
          source: MappingSource.MANUAL,
        },
        update: {
          source: MappingSource.MANUAL,
        },
      });
    }
  }
}

async function upsertMccMap() {
  for (const row of mccMap) {
    await prisma.mccCategoryMap.upsert({
      where: { mcc: row.mcc },
      create: row,
      update: row,
    });
  }
}

async function main() {
  await upsertMerchants();
  await upsertMccMap();
  const merchantCount = await prisma.merchant.count();
  const mccCount = await prisma.mccCategoryMap.count();
  console.log(
    `Seed complete: ${merchantCount} merchants, ${mccCount} MCC mappings.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
