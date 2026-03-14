// Unit tests for receipt parser
// Run: node js/parser.test.js

// Load parser — eval with Function() so 'const' declarations become accessible
const parserCode = require('fs').readFileSync(__dirname + '/parser.js', 'utf8');
// Replace 'const Parser' with a global assignment
eval(parserCode.replace('const Parser =', 'globalThis.Parser ='));

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', message);
  }
}

function assertEq(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${message}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

// --- Test: Trader Joe's real OCR output ---

const traderJoesOCR = `TRADER JOE'S
CHEESE TOMATO PIZZA FAMI
$6.49
R-SALAD POWER TO THE GRE
$2.
49
EGG BITES SPINACH KALE F
$3
79
WHOLE WHEAT LAVASH
$2
99
YOGURT GREEK PLAIN 32 OZ
6
THREE CHEESE POMODORO
$3
BLACK BEANS
$0
COTTAGE CHEESE PINT LF
25
EGG WHITE PRODUCT LIQUID

A-PLUMS LEMON 2 LB
$6
VEG SOY CHORIZO
$2.
99
PASTA RAVIOLINI ITALIAN
$3
49
VEG TEMPEH ORG 3 GRAIN
$2.
49
BAG FEE.
2 @ $0.05
$0.10
22-43 Jackson Ave
Long Island City,
NY 11101
Store #0565 - 718-472-2672
OPEN 8:00AM TO 9:00PM DAILY
SALE TRANSACTION
Items in Transaction: 15
Balance to pay
MasterCard
PAYMENT CARD PURCHASE TRANSACTION
CUSTOMER COPY
$48.77
$48.77
MASTERCARD
Type: CONTACTLESS
TOTAL PURCHASE
Cardholder PIN Verified
************2233
Auth Code:
08882Z
TID:
****6695
$48.77
Please retain for your records
N, Mary
STORE
0565
TILL
10
TRANS.
DATE
3117
02-15-2026 16:06
THANK YOU FOR SHOPPING AT
TRADER JOE'S`;

const result = Parser.parse(traderJoesOCR);

// Store name
assertEq(result.storeName, "TRADER JOE'S", 'store name should be TRADER JOE\'S');

// Date
assertEq(result.date, '2026-02-15', 'date should be parsed as 2026-02-15');

// Should find at least 10 items from the OCR text
assert(result.items.length >= 10, `should find at least 10 items, found ${result.items.length}`);

// Check specific items that should be parsed correctly
const itemMap = {};
result.items.forEach(item => { itemMap[item.receiptName] = item.price; });

assertEq(itemMap['CHEESE TOMATO PIZZA FAMI'], 6.49, 'pizza should be $6.49');
assertEq(itemMap['R-SALAD POWER TO THE GRE'], 2.49, 'salad should be $2.49 (split $2. / 49)');
assertEq(itemMap['EGG BITES SPINACH KALE F'], 3.79, 'egg bites should be $3.79 (split $3 / 79)');
assertEq(itemMap['WHOLE WHEAT LAVASH'], 2.99, 'lavash should be $2.99 (split $2 / 99)');
assertEq(itemMap['VEG SOY CHORIZO'], 2.99, 'chorizo should be $2.99 (split $2. / 99)');
assertEq(itemMap['PASTA RAVIOLINI ITALIAN'], 3.49, 'raviolini should be $3.49 (split $3 / 49)');
assertEq(itemMap['VEG TEMPEH ORG 3 GRAIN'], 2.49, 'tempeh should be $2.49 (split $2. / 49)');

// Items where OCR dropped cents — should still be captured with $X.00
assert('THREE CHEESE POMODORO' in itemMap, 'three cheese pomodoro should be captured (cents dropped by OCR)');
assert('BLACK BEANS' in itemMap, 'black beans should be captured (cents dropped by OCR)');
assert('A-PLUMS LEMON 2 LB' in itemMap, 'plums should be captured (cents dropped by OCR)');

// Should NOT include junk lines
const allNames = result.items.map(i => i.receiptName.toLowerCase());
assert(!allNames.some(n => n.includes('total')), 'should not include total lines');
assert(!allNames.some(n => n.includes('mastercard')), 'should not include payment card lines');
assert(!allNames.some(n => n.includes('balance')), 'should not include balance lines');
assert(!allNames.some(n => n.includes('bag fee')), 'should not include bag fee');
assert(!allNames.some(n => n.includes('****')), 'should not include masked card numbers');
assert(!allNames.some(n => n.includes('jackson')), 'should not include address lines');
assert(!allNames.some(n => /^\d+\s*@/.test(n)), 'should not include quantity lines like "2 @"');

// All items should have IDs
result.items.forEach(item => {
  assert(item.id && item.id.length > 0, `item "${item.receiptName}" should have an id`);
  assert(item.realName === '', `item "${item.receiptName}" realName should default to empty`);
});

// --- Test: empty input ---

const emptyResult = Parser.parse('');
assertEq(emptyResult.storeName, '', 'empty input: store name should be empty');
assertEq(emptyResult.items.length, 0, 'empty input: should have no items');
assertEq(emptyResult.date, '', 'empty input: date should be empty');

// --- Test: simple single-line format ---

const simpleText = `COSTCO
ROTISSERIE CHICKEN $4.99
KIRKLAND WATER 40PK $3.99
ORGANIC BANANAS $1.49
SUBTOTAL $10.47
TAX $0.00
TOTAL $10.47`;

const simpleResult = Parser.parse(simpleText);
assertEq(simpleResult.storeName, 'COSTCO', 'simple: store name');
assertEq(simpleResult.items.length, 3, 'simple: should find 3 items (skip subtotal/tax/total)');
assertEq(simpleResult.items[0].receiptName, 'ROTISSERIE CHICKEN', 'simple: first item name');
assertEq(simpleResult.items[0].price, 4.99, 'simple: first item price');

// --- Test: date extraction formats ---

const dateText1 = `STORE\n03/22/2026 10:30`;
const dateResult1 = Parser.parse(dateText1);
assertEq(dateResult1.date, '2026-03-22', 'should parse MM/DD/YYYY date');

const dateText2 = `STORE\n12-25-2025 14:00`;
const dateResult2 = Parser.parse(dateText2);
assertEq(dateResult2.date, '2025-12-25', 'should parse MM-DD-YYYY date');

// --- Summary ---

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
