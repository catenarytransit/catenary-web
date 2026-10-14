import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const nameProperties = ['name', 'name_en', 'name_int', 'name:latin', 'name:nonlatin', 'name_de'];

function evaluate(expression, properties, geometryType = 'Point') {
  if (!Array.isArray(expression)) return expression;
  const [operation, ...args] = expression;
  const value = (index) => evaluate(args[index], properties, geometryType);

  switch (operation) {
    case 'get':
      return properties[args[0]];
    case 'coalesce':
      return args.map((arg) => evaluate(arg, properties, geometryType))
        .find((candidate) => candidate !== null && candidate !== undefined);
    case 'geometry-type':
      return geometryType;
    case 'match': {
      const compared = value(0);
      const possibilities = args[1];
      return evaluate(
        (Array.isArray(possibilities) ? possibilities.includes(compared) : possibilities === compared)
          ? args[2] : args[3],
        properties,
        geometryType
      );
    }
    case 'all':
      return args.every((arg) => evaluate(arg, properties, geometryType));
    case 'any':
      return args.some((arg) => evaluate(arg, properties, geometryType));
    case '==':
      return value(0) === value(1);
    case '!=':
      return value(0) !== value(1);
    case '>=':
      return value(0) >= value(1);
    case '<':
      return value(0) < value(1);
    default:
      throw new Error(`Unexpected filter expression: ${operation}`);
  }
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: labels every named POI at zoom 17+ regardless of class or rank`, () => {
    const style = JSON.parse(
      readFileSync(new URL(`../static/${theme}-style.json`, import.meta.url), 'utf8')
    );
    const layers = new Map(style.layers.map((layer) => [layer.id, layer]));
    const named = layers.get('poi_named');

    assert.equal(named.source, 'openmaptiles');
    assert.equal(named['source-layer'], 'poi');
    assert.equal(named.minzoom, 17);
    assert.equal(named.maxzoom, undefined);
    assert.equal(named.layout['text-allow-overlap'], true);
    assert.equal(named.layout['text-ignore-placement'], true);
    assert.equal(named.layout['icon-optional'], true);

    // OSM office with rank 17 from the regression report.
    const office = {
      name: 'Department of Chemical and Biomolecular Engineering',
      class: 'office', subclass: 'university', rank: 17
    };
    assert.equal(evaluate(named.filter, office), true);
    assert.equal(evaluate(named.layout['text-field'], office), office.name);

    for (const rank of [undefined, 0, 1, 2, 6, 7, 17, 19, 20, 50]) {
      for (const itemClass of ['office', 'shop', 'parking', 'information', 'bus', 'railway']) {
        const feature = { name: 'Named POI', class: itemClass, ...(rank === undefined ? {} : { rank }) };
        assert.equal(evaluate(named.filter, feature), true, `${itemClass}: rank ${rank}`);
      }
    }

    for (const key of nameProperties) {
      const feature = { [key]: 'Localized name', rank: 17, class: 'office' };
      assert.equal(evaluate(named.filter, feature), true, key);
      assert.equal(evaluate(named.layout['text-field'], feature), 'Localized name', key);
    }

    assert.equal(evaluate(named.filter, { rank: 17, class: 'office' }), false);
    assert.equal(evaluate(named.filter, { name: '', rank: 17 }), false);
    assert.equal(evaluate(named.filter, office, 'LineString'), false);

    // Existing rank-based labels remain available at lower zooms, but must not
    // double-label named POIs when the universal layer becomes active.
    const rankOne = layers.get('poi_r1');
    const rankTwoToNineteen = layers.get('poi_r7');
    const transit = layers.get('poi_transit');
    assert.equal(rankOne.maxzoom, 17);
    assert.equal(rankTwoToNineteen.minzoom, 16);
    assert.equal(rankTwoToNineteen.maxzoom, 17);
    assert.equal(transit.maxzoom, 17);
    assert.equal(evaluate(rankTwoToNineteen.filter, office), true);
    assert.equal(evaluate(rankTwoToNineteen.filter, { ...office, rank: 1 }), false);
    assert.equal(evaluate(rankTwoToNineteen.filter, { ...office, rank: 20 }), false);
    assert.notEqual(evaluate(rankTwoToNineteen.layout['text-field'], office), '');
  });
}
