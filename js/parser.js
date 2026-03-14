// Parse OCR text from receipts into structured data

const Parser = {
  SKIP_KEYWORDS: [
    'total', 'subtotal', 'sub total', 'tax', 'change', 'cash',
    'credit', 'visa', 'mastercard', 'debit', 'balance', 'tender',
    'payment', 'amount due', 'amount paid', 'savings',
  ],

  PRICE_PATTERN: /^(.+?)\s+\$?(\d+\.\d{2})\s*[A-Z]?\s*$/,

  parse(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      return { storeName: '', items: [] };
    }

    // Store name: first non-empty line
    const storeName = lines[0];

    // Parse line items
    const items = [];
    for (const line of lines) {
      const match = line.match(this.PRICE_PATTERN);
      if (!match) continue;

      const name = match[1].trim();
      const price = parseFloat(match[2]);

      // Skip totals, tax, payment lines
      const lower = name.toLowerCase();
      if (this.SKIP_KEYWORDS.some(kw => lower.includes(kw))) continue;

      items.push({
        id: crypto.randomUUID(),
        receiptName: name,
        realName: '',
        price: price,
      });
    }

    return { storeName, items };
  },
};
