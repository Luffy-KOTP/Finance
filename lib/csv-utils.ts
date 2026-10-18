// A dictionary of common Nigerian transaction keywords mapped to generic categories
const CATEGORY_RULES = [
  { category: "Airtime & Data", keywords: ["airtime", "mtn", "airtel", "glo", "9mobile", "recharge", "data"] },
  { category: "Bank Charges", keywords: ["fee", "charge", "stamp duty", "sms", "vat", "maintenance", "fgn"] },
  { category: "Transportation", keywords: ["uber", "bolt", "indrive", "lagride", "transport"] },
  { category: "Food & Dining", keywords: ["food", "restaurant", "chow", "bukka", "eatery", "kfc", "dominos"] },
  { category: "Subscriptions", keywords: ["netflix", "spotify", "dstv", "gotv", "showmax", "apple"] },
  { category: "Cash Withdrawal", keywords: ["pos", "withdrawal", "atm", "cash"] },
  { category: "Bank Transfer", keywords: ["transfer", "trf", "nip", "ussd"] },
];

function guessCategory(narration: string): string {
  const lowerNarration = narration.toLowerCase();
  
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => lowerNarration.includes(keyword))) {
      return rule.category;
    }
  }
  
  return "Uncategorized"; // Default if no match is found
}

export function normalizeNigerianBankCSV(data: any[]) {
  return data.map((row) => {
    // 1. Handle Debit/Credit splits
    const debit = row["Debit"] || row["Withdrawal"] || row["DR"] || 0;
    const credit = row["Credit"] || row["Deposit"] || row["CR"] || 0;
    
    const parsedDebit = parseFloat(String(debit).replace(/,/g, "")) || 0;
    const parsedCredit = parseFloat(String(credit).replace(/,/g, "")) || 0;
    const amount = parsedCredit > 0 ? parsedCredit : -Math.abs(parsedDebit);

    // 2. Standardize Payee / Narration
    const payee = row["Narration"] || row["Remarks"] || row["Description"] || row["Payee"] || "Unknown";

    // 3. Guess the Category
    const category = guessCategory(payee);

    // 4. Standardize Date
    const date = row["Transaction Date"] || row["Value Date"] || row["Date"] || "";

    return {
      ...row,
      Amount: amount !== 0 ? amount.toString() : "",
      Payee: payee,
      Category: category, // Add the guessed category to the parsed data
      Date: date,
    };
  });
}