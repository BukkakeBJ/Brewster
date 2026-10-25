import {describe,it,expect} from 'vitest';
import {catalog as c} from '../src/catalog';
describe('reviewable seed data',()=>{
 it('contains broad coverage and provenance',()=>{
  expect(c.malts.length).toBeGreaterThanOrEqual(40);expect(c.hops.length).toBeGreaterThanOrEqual(50);expect(c.yeasts.length).toBeGreaterThanOrEqual(30);
  const all=[...c.malts,...c.hops,...c.yeasts];expect(new Set(all.map(i=>i.id)).size).toBe(all.length);
  all.forEach(i=>expect(i.source.url).toMatch(/^https:/));
 });
 it('keeps descriptors separate with valid references',()=>{
  const ids=new Set([...c.malts,...c.hops,...c.yeasts].map(i=>i.id));const vocab=new Set(c.vocabulary.map(v=>v.id));
  c.descriptors.forEach(d=>{expect(ids.has(d.ingredientId)).toBe(true);expect(vocab.has(d.descriptor)).toBe(true);expect(d.intensity).toBeGreaterThanOrEqual(0);expect(d.intensity).toBeLessThanOrEqual(5)});
 });
});
