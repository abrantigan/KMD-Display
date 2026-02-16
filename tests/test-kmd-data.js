/**
 * KMD Piano Data Viewer — Unit & Regression Tests
 *
 * Run with:  node tests/test-kmd-data.js
 *
 * Tests the core logic extracted from kmd-display.html:
 *   - Note name mapping (key number → note)
 *   - Black key detection
 *   - Number formatting
 *   - Data validation
 *   - Curve splitting (downstroke / upstroke)
 *   - Accurate metric values against the example JSON
 */

const fs = require('fs');
const path = require('path');

// ── Extracted functions (mirrors kmd-display.html logic) ──

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const BLACK_KEY_OFFSETS = new Set([1, 4, 6, 9, 11]);

function getNoteName(keyNumber) {
    const noteIndex = (keyNumber - 1) % 12;
    const octave = Math.floor((keyNumber - 1 + 9) / 12);
    return NOTE_NAMES[noteIndex] + octave;
}

function isBlackKey(keyNumber) {
    return BLACK_KEY_OFFSETS.has((keyNumber - 1) % 12);
}

function fmt(val, decimals) {
    if (val == null || isNaN(val)) return '--';
    return val.toFixed(decimals !== undefined ? decimals : 1);
}

function validateData(data) {
    const required = ['pianoname', 'keynumber_data', 'xyvalues_data',
        'downweight_data', 'upweight_data', 'balanceweight_data',
        'friction_data', 'keydip_data'];
    for (const key of required) {
        if (!(key in data)) throw new Error('Missing required field: ' + key);
    }
    if (!Array.isArray(data.keynumber_data) || data.keynumber_data.length < 2) {
        throw new Error('keynumber_data must be an array with at least one key');
    }
}

function splitCurves(xyData) {
    if (!xyData || xyData.length === 0) return { down: [], up: [] };
    let maxXIdx = 0;
    let maxX = -Infinity;
    for (let i = 0; i < xyData.length; i++) {
        if (xyData[i].x > maxX) { maxX = xyData[i].x; maxXIdx = i; }
    }
    const down = xyData.slice(0, maxXIdx + 1).map(p => ({ x: p.x, y: p.y }));
    const up = xyData.slice(maxXIdx).map(p => ({ x: p.x, y: p.y }));
    return { down, up };
}

function buildValidIndices(data) {
    const indices = [];
    for (let i = 0; i < data.keynumber_data.length; i++) {
        if (data.keynumber_data[i] != null && data.xyvalues_data[i] != null) {
            indices.push(i);
        }
    }
    return indices;
}

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log('  FAIL: ' + message);
    }
}

function assertClose(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    if (diff <= tolerance) {
        passed++;
    } else {
        failed++;
        const detail = message + ' (expected ' + expected + ', got ' + actual + ', diff ' + diff.toFixed(6) + ')';
        failures.push(detail);
        console.log('  FAIL: ' + detail);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        passed++;
    } else {
        failed++;
        const detail = message + ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')';
        failures.push(detail);
        console.log('  FAIL: ' + detail);
    }
}

function section(name) {
    console.log('\n' + name);
}

// ── Load test data ──

const jsonPath = path.join(__dirname, '..', 'Example Files', 'example-key-data.json');
let exampleData;
try {
    exampleData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (e) {
    console.error('Could not load example JSON at: ' + jsonPath);
    console.error(e.message);
    process.exit(1);
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

section('Note name mapping');
assertEqual(getNoteName(1), 'A0', 'Key 1 = A0');
assertEqual(getNoteName(2), 'A#0', 'Key 2 = A#0');
assertEqual(getNoteName(3), 'B0', 'Key 3 = B0');
assertEqual(getNoteName(4), 'C1', 'Key 4 = C1');
assertEqual(getNoteName(35), 'G3', 'Key 35 = G3 (matches KMD screenshot)');
assertEqual(getNoteName(40), 'C4', 'Key 40 = C4 (middle C)');
assertEqual(getNoteName(49), 'A4', 'Key 49 = A4 (concert pitch)');
assertEqual(getNoteName(88), 'C8', 'Key 88 = C8 (highest key)');

section('Black key detection');
assert(!isBlackKey(1), 'Key 1 (A0) is white');
assert(isBlackKey(2), 'Key 2 (A#0) is black');
assert(!isBlackKey(3), 'Key 3 (B0) is white');
assert(!isBlackKey(4), 'Key 4 (C1) is white');
assert(isBlackKey(5), 'Key 5 (C#1) is black');
assert(!isBlackKey(6), 'Key 6 (D1) is white');
assert(isBlackKey(7), 'Key 7 (D#1) is black');
assert(!isBlackKey(8), 'Key 8 (E1) is white');
assert(!isBlackKey(9), 'Key 9 (F1) is white');
assert(isBlackKey(10), 'Key 10 (F#1) is black');
assert(!isBlackKey(11), 'Key 11 (G1) is white');
assert(isBlackKey(12), 'Key 12 (G#1) is black');
assert(!isBlackKey(40), 'Key 40 (C4 - middle C) is white');
assert(!isBlackKey(88), 'Key 88 (C8) is white');

section('Number formatting');
assertEqual(fmt(37.554), '37.6', 'fmt rounds to 1 decimal by default');
assertEqual(fmt(10.31392, 2), '10.31', 'fmt with 2 decimals');
assertEqual(fmt(null), '--', 'fmt null returns --');
assertEqual(fmt(undefined), '--', 'fmt undefined returns --');
assertEqual(fmt(NaN), '--', 'fmt NaN returns --');
assertEqual(fmt(0), '0.0', 'fmt zero');
assertEqual(fmt(100, 0), '100', 'fmt with 0 decimals');

section('Data validation');
(function() {
    // Valid data should not throw
    let threw = false;
    try { validateData(exampleData); } catch (e) { threw = true; }
    assert(!threw, 'Example data passes validation');

    // Missing field should throw
    threw = false;
    try { validateData({ pianoname: 'test' }); } catch (e) { threw = true; }
    assert(threw, 'Missing fields throws error');

    // Empty keynumber_data should throw
    threw = false;
    try {
        validateData({
            pianoname: 'x', keynumber_data: [null], xyvalues_data: [],
            downweight_data: [], upweight_data: [], balanceweight_data: [],
            friction_data: [], keydip_data: []
        });
    } catch (e) { threw = true; }
    assert(threw, 'keynumber_data with only null throws (length < 2)');
})();

section('Valid indices from example data');
const validIndices = buildValidIndices(exampleData);
assertEqual(validIndices.length, 75, 'Example data has 75 valid keys');
assertEqual(validIndices[0], 1, 'First valid index is 1 (index 0 is null)');
assertEqual(validIndices[validIndices.length - 1], 75, 'Last valid index is 75');
assertEqual(exampleData.keynumber_data[validIndices[0]], 1, 'First valid key number is 1');
assertEqual(exampleData.keynumber_data[validIndices[validIndices.length - 1]], 75, 'Last valid key number is 75');

section('Curve splitting');
(function() {
    const xy = exampleData.xyvalues_data[1]; // Key 1
    assertEqual(xy.length, 100, 'Key 1 has 100 data points');

    const { down, up } = splitCurves(xy);
    assertEqual(down.length, 51, 'Key 1 downstroke has 51 points (0..50 inclusive)');
    assertEqual(up.length, 50, 'Key 1 upstroke has 50 points (50..99 inclusive)');

    // Downstroke starts at origin
    assertClose(down[0].x, 0, 0.001, 'Downstroke starts at x=0');
    assertClose(down[0].y, 0, 0.001, 'Downstroke starts at y=0');

    // Turnaround point is the max x in the downstroke
    const turnaroundX = down[down.length - 1].x;
    assertClose(turnaroundX, 10.2886076, 0.001, 'Key 1 turnaround at x~10.29mm');

    // Upstroke shares the turnaround point and ends at origin
    assertClose(up[0].x, turnaroundX, 0.001, 'Upstroke starts at turnaround point');
    assertClose(up[up.length - 1].x, 0, 0.001, 'Upstroke returns to x=0');

    // Empty/null input
    const empty = splitCurves(null);
    assertEqual(empty.down.length, 0, 'Null input returns empty down array');
    assertEqual(empty.up.length, 0, 'Null input returns empty up array');

    const emptyArr = splitCurves([]);
    assertEqual(emptyArr.down.length, 0, 'Empty array returns empty down array');
    assertEqual(emptyArr.up.length, 0, 'Empty array returns empty up array');
})();

section('Metric accuracy — Key 1 (A0)');
(function() {
    const idx = 1;
    assertClose(exampleData.downweight_data[idx], 37.554, 0.001, 'Key 1 down weight ~37.554g');
    assertClose(exampleData.upweight_data[idx], 18.062, 0.001, 'Key 1 up weight ~18.062g');
    assertClose(exampleData.balanceweight_data[idx], 27.808, 0.001, 'Key 1 balance ~27.808g');
    assertClose(exampleData.friction_data[idx], 9.746, 0.001, 'Key 1 friction ~9.746g');
    assertClose(exampleData.keydip_data[idx], 10.314, 0.001, 'Key 1 key-dip ~10.314mm');

    // Verify balance = (DW + UW) / 2
    const calcBalance = (exampleData.downweight_data[idx] + exampleData.upweight_data[idx]) / 2;
    assertClose(calcBalance, exampleData.balanceweight_data[idx], 0.01, 'Key 1 balance = (DW+UW)/2');

    // Verify friction = (DW - UW) / 2
    const calcFriction = (exampleData.downweight_data[idx] - exampleData.upweight_data[idx]) / 2;
    assertClose(calcFriction, exampleData.friction_data[idx], 0.01, 'Key 1 friction = (DW-UW)/2');
})();

section('Metric accuracy — Key 35 (G3, matches KMD screenshot)');
(function() {
    const idx = 35;
    assertEqual(exampleData.keynumber_data[idx], 35, 'Index 35 maps to key number 35');
    assertClose(exampleData.downweight_data[idx], 44.605, 0.001, 'Key 35 down weight ~44.605g');
    assertClose(exampleData.upweight_data[idx], 22.448, 0.001, 'Key 35 up weight ~22.448g');
    assertClose(exampleData.balanceweight_data[idx], 33.527, 0.001, 'Key 35 balance ~33.527g');
    assertClose(exampleData.friction_data[idx], 11.078, 0.001, 'Key 35 friction ~11.078g');
    assertClose(exampleData.keydip_data[idx], 10.235, 0.001, 'Key 35 key-dip ~10.235mm');

    const calcBalance = (exampleData.downweight_data[idx] + exampleData.upweight_data[idx]) / 2;
    assertClose(calcBalance, exampleData.balanceweight_data[idx], 0.01, 'Key 35 balance = (DW+UW)/2');
    const calcFriction = (exampleData.downweight_data[idx] - exampleData.upweight_data[idx]) / 2;
    assertClose(calcFriction, exampleData.friction_data[idx], 0.01, 'Key 35 friction = (DW-UW)/2');
})();

section('Metric accuracy — Key 75 (last measured key)');
(function() {
    const idx = 75;
    assertEqual(exampleData.keynumber_data[idx], 75, 'Index 75 maps to key number 75');
    assertClose(exampleData.downweight_data[idx], 48.558, 0.001, 'Key 75 down weight ~48.558g');
    assertClose(exampleData.upweight_data[idx], 27.245, 0.001, 'Key 75 up weight ~27.245g');
    assertClose(exampleData.balanceweight_data[idx], 37.901, 0.001, 'Key 75 balance ~37.901g');
    assertClose(exampleData.friction_data[idx], 10.656, 0.001, 'Key 75 friction ~10.656g');
    assertClose(exampleData.keydip_data[idx], 11.046, 0.001, 'Key 75 key-dip ~11.046mm');

    const calcBalance = (exampleData.downweight_data[idx] + exampleData.upweight_data[idx]) / 2;
    assertClose(calcBalance, exampleData.balanceweight_data[idx], 0.01, 'Key 75 balance = (DW+UW)/2');
    const calcFriction = (exampleData.downweight_data[idx] - exampleData.upweight_data[idx]) / 2;
    assertClose(calcFriction, exampleData.friction_data[idx], 0.01, 'Key 75 friction = (DW-UW)/2');
})();

section('Balance/Friction formula holds for ALL keys');
(function() {
    let allBalanceOk = true;
    let allFrictionOk = true;
    for (const idx of validIndices) {
        const dw = exampleData.downweight_data[idx];
        const uw = exampleData.upweight_data[idx];
        const bal = exampleData.balanceweight_data[idx];
        const fri = exampleData.friction_data[idx];
        if (Math.abs((dw + uw) / 2 - bal) > 0.01) allBalanceOk = false;
        if (Math.abs((dw - uw) / 2 - fri) > 0.01) allFrictionOk = false;
    }
    assert(allBalanceOk, 'Balance = (DW+UW)/2 holds for all 75 keys');
    assert(allFrictionOk, 'Friction = (DW-UW)/2 holds for all 75 keys');
})();

section('Touchweight analysis window');
(function() {
    const tw1 = exampleData.twwindow_data[1];
    assertEqual(tw1.length, 2, 'Key 1 has 2 touchweight window points');
    assertClose(tw1[0].x, 2.0, 0.001, 'Key 1 TW window left boundary = 2.0mm');
    assertClose(tw1[1].x, 4.5, 0.001, 'Key 1 TW window right boundary = 4.5mm');

    // Check that all keys have the same window (true for this dataset)
    let allSame = true;
    for (const idx of validIndices) {
        const tw = exampleData.twwindow_data[idx];
        if (!tw || tw.length !== 2 || tw[0].x !== 2 || tw[1].x !== 4.5) {
            allSame = false;
            break;
        }
    }
    assert(allSame, 'All keys share the same 2.0–4.5mm analysis window');
})();

section('Displayed values match fmt() output');
(function() {
    // Verify what the user actually sees matches expectations from the screenshot
    const idx = 35;
    assertEqual(fmt(exampleData.downweight_data[idx]), '44.6', 'Key 35 displays DW as 44.6');
    assertEqual(fmt(exampleData.upweight_data[idx]), '22.4', 'Key 35 displays UW as 22.4');
    assertEqual(fmt(exampleData.balanceweight_data[idx]), '33.5', 'Key 35 displays Balance as 33.5');
    assertEqual(fmt(exampleData.friction_data[idx]), '11.1', 'Key 35 displays Friction as 11.1');
    assertEqual(fmt(exampleData.keydip_data[idx]), '10.2', 'Key 35 displays Key-dip as 10.2');
})();

section('Piano metadata');
assertEqual(exampleData.pianoname, 'Tom-Mason', 'Piano name is Tom-Mason');
assertEqual(exampleData.numkeys, '88', 'numkeys field is "88"');
assertEqual(exampleData.startingnoteindex, 0, 'startingnoteindex is 0');
assert(exampleData.keynumber_data[0] === null, 'Index 0 of keynumber_data is null');
assert(exampleData.xyvalues_data[0] === null, 'Index 0 of xyvalues_data is null');
assertEqual(exampleData.keynumber_data.length, 76, 'keynumber_data has 76 entries (null + 75 keys)');

// ── Summary ──

console.log('\n══════════════════════════════════');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
} else {
    console.log('All tests passed.');
}
