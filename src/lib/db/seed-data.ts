import type { OrderStatus } from "@/lib/orders";

// Everything here is made up. Emails use example.com on purpose.

export const products = [
  { sku: "GAYO-WN-200", name: "Gayo Wine Process", origin: "Aceh Tengah", roast: "medium", process: "wine", tastingNotes: "anggur merah, cokelat hitam, rempah", weightGrams: 200, priceIdr: 135_000, stock: 18 },
  { sku: "TORAJA-SP-200", name: "Toraja Sapan", origin: "Toraja, Sulawesi Selatan", roast: "medium-dark", process: "full wash", tastingNotes: "gula aren, kayu manis, body tebal", weightGrams: 200, priceIdr: 120_000, stock: 3 },
  { sku: "KINTAMANI-NT-200", name: "Kintamani Natural", origin: "Bangli, Bali", roast: "light", process: "natural", tastingNotes: "jeruk, stroberi, madu", weightGrams: 200, priceIdr: 125_000, stock: 0 },
  { sku: "BAJAWA-HN-200", name: "Flores Bajawa Honey", origin: "Ngada, NTT", roast: "medium", process: "honey", tastingNotes: "karamel, kacang, apel merah", weightGrams: 200, priceIdr: 115_000, stock: 24 },
  { sku: "PREANGER-FW-200", name: "Java Preanger", origin: "Pangalengan, Jawa Barat", roast: "medium", process: "full wash", tastingNotes: "teh hitam, lemon, gula merah", weightGrams: 200, priceIdr: 110_000, stock: 30 },
  { sku: "WAMENA-FW-200", name: "Papua Wamena", origin: "Jayawijaya, Papua Pegunungan", roast: "medium", process: "full wash", tastingNotes: "cokelat, kacang mete, earthy", weightGrams: 200, priceIdr: 140_000, stock: 7 },
  { sku: "MANDHELING-GB-200", name: "Mandheling", origin: "Tapanuli, Sumatera Utara", roast: "dark", process: "giling basah", tastingNotes: "dark chocolate, herbal, earthy", weightGrams: 200, priceIdr: 105_000, stock: 40 },
  { sku: "IJEN-NT-200", name: "Ijen Raung Natural", origin: "Bondowoso, Jawa Timur", roast: "light-medium", process: "natural", tastingNotes: "nangka, cokelat susu", weightGrams: 200, priceIdr: 118_000, stock: 0 },
  { sku: "HOUSE-BL-1000", name: "Nusantara House Blend 1 kg", origin: "Gayo + Mandheling", roast: "medium-dark", process: "blend", tastingNotes: "cokelat, karamel, cocok untuk susu", weightGrams: 1000, priceIdr: 380_000, stock: 12 },
  { sku: "DRIP-SAMPLER-10", name: "Drip Bag Sampler isi 10", origin: "campuran 5 origin", roast: "medium", process: "campuran", tastingNotes: "2 sachet per origin", weightGrams: 120, priceIdr: 95_000, stock: 50 },
];

export const customers = [
  { name: "Rina Wulandari", email: "rina.wulandari@example.com", phone: "0812-0000-1101" },
  { name: "Bagus Pratama", email: "bagus.pratama@example.com", phone: "0813-0000-2202" },
  { name: "Maya Kusuma", email: "maya.kusuma@example.com", phone: "0857-0000-3303" },
  { name: "Andi Saputra", email: "andi.saputra@example.com", phone: "0821-0000-4404" },
  { name: "Yoga Firmansyah", email: "yoga.firmansyah@example.com", phone: "0878-0000-5505" },
  { name: "Laras Anindya", email: "laras.anindya@example.com", phone: "0811-0000-6606" },
];

type SeedOrder = {
  number: string;
  customerEmail: string;
  status: OrderStatus;
  shippingCity: string;
  shippingFeeIdr: number;
  courier?: string;
  trackingNumber?: string;
  placedDaysAgo: number;
  shippedDaysAgo?: number;
  deliveredDaysAgo?: number;
  items: { sku: string; quantity: number }[];
};

export const orders: SeedOrder[] = [
  { number: "KN-10231", customerEmail: "rina.wulandari@example.com", status: "delivered", shippingCity: "Bandung", shippingFeeIdr: 18_000, courier: "JNE REG", trackingNumber: "1250 0231 7810 4402", placedDaysAgo: 21, shippedDaysAgo: 19, deliveredDaysAgo: 17, items: [{ sku: "PREANGER-FW-200", quantity: 2 }] },
  { number: "KN-10232", customerEmail: "maya.kusuma@example.com", status: "delivered", shippingCity: "Yogyakarta", shippingFeeIdr: 20_000, courier: "SiCepat REG", trackingNumber: "0044 0232 0091", placedDaysAgo: 16, shippedDaysAgo: 14, deliveredDaysAgo: 12, items: [{ sku: "GAYO-WN-200", quantity: 1 }, { sku: "DRIP-SAMPLER-10", quantity: 1 }] },
  { number: "KN-10233", customerEmail: "andi.saputra@example.com", status: "delivered", shippingCity: "Medan", shippingFeeIdr: 32_000, courier: "JNE REG", trackingNumber: "1250 0233 5521 8820", placedDaysAgo: 12, shippedDaysAgo: 10, deliveredDaysAgo: 6, items: [{ sku: "MANDHELING-GB-200", quantity: 3 }] },
  { number: "KN-10234", customerEmail: "bagus.pratama@example.com", status: "shipped", shippingCity: "Surabaya", shippingFeeIdr: 22_000, courier: "SiCepat REG", trackingNumber: "0044 0234 1187", placedDaysAgo: 4, shippedDaysAgo: 2, items: [{ sku: "TORAJA-SP-200", quantity: 1 }, { sku: "BAJAWA-HN-200", quantity: 1 }] },
  { number: "KN-10235", customerEmail: "maya.kusuma@example.com", status: "processing", shippingCity: "Yogyakarta", shippingFeeIdr: 20_000, placedDaysAgo: 1, items: [{ sku: "WAMENA-FW-200", quantity: 2 }] },
  { number: "KN-10236", customerEmail: "andi.saputra@example.com", status: "pending_payment", shippingCity: "Medan", shippingFeeIdr: 32_000, placedDaysAgo: 0, items: [{ sku: "HOUSE-BL-1000", quantity: 1 }] },
  { number: "KN-10237", customerEmail: "rina.wulandari@example.com", status: "shipped", shippingCity: "Denpasar", shippingFeeIdr: 35_000, courier: "JNE REG", trackingNumber: "1250 0237 9034 1176", placedDaysAgo: 8, shippedDaysAgo: 6, items: [{ sku: "GAYO-WN-200", quantity: 2 }, { sku: "PREANGER-FW-200", quantity: 1 }] },
  { number: "KN-10238", customerEmail: "yoga.firmansyah@example.com", status: "cancelled", shippingCity: "Makassar", shippingFeeIdr: 40_000, placedDaysAgo: 9, items: [{ sku: "KINTAMANI-NT-200", quantity: 2 }] },
  { number: "KN-10239", customerEmail: "laras.anindya@example.com", status: "delivered", shippingCity: "Jakarta Selatan", shippingFeeIdr: 15_000, courier: "GoSend Same Day", trackingNumber: "GK-3V9QX2", placedDaysAgo: 3, shippedDaysAgo: 3, deliveredDaysAgo: 3, items: [{ sku: "DRIP-SAMPLER-10", quantity: 2 }] },
  { number: "KN-10240", customerEmail: "bagus.pratama@example.com", status: "paid", shippingCity: "Surabaya", shippingFeeIdr: 22_000, placedDaysAgo: 0, items: [{ sku: "MANDHELING-GB-200", quantity: 1 }] },
];
