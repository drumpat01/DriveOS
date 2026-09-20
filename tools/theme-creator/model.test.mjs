import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, roles, rgb, fromRgb, toHsv, fromHsv, normalizeHex, validatePalette } from './model.js';
test('full RGB gamut, including black/white, round trips through picker HSV',()=>{for(const r of [0,1,63,127,191,254,255])for(const g of [0,1,63,127,191,254,255])for(const b of [0,1,63,127,191,254,255]){const hex=fromRgb([r,g,b]);assert.equal(fromHsv(...toHsv(hex)),hex);assert.deepEqual(rgb(hex),[r,g,b]);}});
test('palette import validates all ten roles and excludes unrelated content',()=>{assert.equal(roles.length,10);assert.deepEqual(validatePalette({...defaults,base:'#fff',extra:'<script>'}),{...defaults,base:'#ffffff'});assert.throws(()=>validatePalette({base:'#fff'}));assert.throws(()=>validatePalette({...defaults,text:'red; background:url(evil)'}));assert.equal(normalizeHex(' aBc '),'#aabbcc');assert.equal(normalizeHex('#12345g'),null);});
