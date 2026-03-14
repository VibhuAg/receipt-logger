// Parse OCR text from receipts into structured data

const Parser = {
  SKIP_KEYWORDS: [
    'total', 'subtotal', 'sub total', 'tax', 'change', 'cash',
    'credit', 'visa', 'mastercard', 'debit', 'balance', 'tender',
    'payment', 'amount due', 'amount paid', 'savings', 'items in transaction',
    'bag fee', 'sale transaction', 'thank you', 'store #', 'open ',
    'auth code', 'cardholder', 'customer copy', 'retain for',
    'trans.', 'till',
  ],

  parse(text) {
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (rawLines.length === 0) {
      return { storeName: '', items: [], date: '' };
    }

    // Step 1: Reassemble lines — OCR splits item names and prices across lines
    const lines = this._reassembleLines(rawLines);

    // Step 2: Store name — first non-empty line
    const storeName = lines[0];

    // Step 3: Try to find a date
    const date = this._extractDate(rawLines);

    // Step 4: Parse line items
    const items = [];
    const sameLinePattern = /^(.+?)\s+\$?(\d+\.\d{2})\s*[A-Z]?\s*$/;

    for (const line of lines) {
      const match = line.match(sameLinePattern);
      if (!match) continue;

      const name = match[1].trim();
      const price = parseFloat(match[2]);

      const lower = name.toLowerCase();
      if (this.SKIP_KEYWORDS.some(kw => lower.includes(kw))) continue;
      if (name.length < 2) continue;
      if (/^\d+\s*@/.test(name)) continue;
      // Skip lines with masked card numbers
      if (/\*{2,}/.test(name)) continue;

      items.push({
        id: crypto.randomUUID(),
        receiptName: name,
        realName: '',
        price: price,
      });
    }

    return { storeName, items, date };
  },

  _reassembleLines(rawLines) {
    // Strategy: walk through lines. When we see a text line (item name) followed
    // by price fragments, join them. Price fragments can be:
    //   "$6.49"           — complete price on one line
    //   "$2." + "49"      — dollar+dot on one line, cents on next
    //   "$3" + "79"       — dollar on one line, cents on next (no dot)
    //   "6"               — bare number (ambiguous, but if it follows an item name, treat as price start)

    const lines = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];

      // Try to look ahead and assemble an item+price line
      const result = this._tryAssemble(rawLines, i);
      if (result) {
        lines.push(result.assembled);
        i = result.nextIndex;
      } else {
        lines.push(line);
        i += 1;
      }
    }

    return lines;
  },

  _tryAssemble(rawLines, i) {
    const line = rawLines[i];

    // Don't try to assemble lines that already have a price
    if (/\$?\d+\.\d{2}\s*$/.test(line)) return null;

    // Current line should look like an item name (has letters)
    if (!/[a-zA-Z]/.test(line)) return null;

    // Look ahead for price fragments
    if (i + 1 >= rawLines.length) return null;

    const next1 = rawLines[i + 1];
    const next2 = i + 2 < rawLines.length ? rawLines[i + 2] : null;

    // Case 1: next line is a complete price "$6.49" or "6.49"
    if (/^\$?\d+\.\d{2}\s*$/.test(next1)) {
      return { assembled: line + ' ' + next1, nextIndex: i + 2 };
    }

    // Case 2: next line is "$2." or "$3.", line after is "49" or "79"
    if (/^\$?\d+\.\s*$/.test(next1) && next2 && /^\d{2}\s*$/.test(next2)) {
      return { assembled: line + ' ' + next1 + next2, nextIndex: i + 3 };
    }

    // Case 3: next line is "$3" or "$0" (no dot), line after is "79" or "99" (cents)
    if (/^\$\d+$/.test(next1) && next2 && /^\d{2}\s*$/.test(next2)) {
      return { assembled: line + ' ' + next1 + '.' + next2, nextIndex: i + 3 };
    }

    // Case 4: next line is "$3" or "$0" with no cents line following (OCR dropped cents)
    // Capture as $X.00 so the user can correct the price
    if (/^\$\d+$/.test(next1)) {
      return { assembled: line + ' ' + next1 + '.00', nextIndex: i + 2 };
    }

    return null;
  },

  _looksLikePrice(line) {
    return /\$?\d+\.\d{2}\s*$/.test(line);
  },

  _extractDate(lines) {
    for (const line of lines) {
      const match = line.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
      if (match) {
        return `${match[3]}-${match[1]}-${match[2]}`;
      }
    }
    return '';
  },
};
