// "Find listings" links: street and number from the card address, and the Oikotie
// search URLs in the format checked on the live site (20 Oct 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {listingLinks, streetAndNumber} from '../src/data/listingLinks.js';

test('streetAndNumber keeps the street and the first house number', () => {
  assert.equal(streetAndNumber('Fleminginkatu 20'), 'Fleminginkatu 20');
  assert.equal(streetAndNumber('Mäkelänkatu 16a'), 'Mäkelänkatu 16a');
  assert.equal(streetAndNumber('Kyläkirkontie 6-10'), 'Kyläkirkontie 6');
  assert.equal(streetAndNumber('Fleminginkatu 20 A'), 'Fleminginkatu 20');
  assert.equal(streetAndNumber('Pohjoinen Rautatiekatu 21'), 'Pohjoinen Rautatiekatu 21');
  assert.equal(streetAndNumber('Leppäluoto'), null);
  assert.equal(streetAndNumber('Lauttasaarentie'), null);
  assert.equal(streetAndNumber(''), null);
  assert.equal(streetAndNumber(null), null);
});

test('listingLinks builds the checked Oikotie URLs, Helsinki only', () => {
  assert.deepEqual(listingLinks('Fleminginkatu 20'), [
    {
      kind: 'sale',
      url: 'https://asunnot.oikotie.fi/myytavat-asunnot?locations=%5B%5B64%2C6%2C%22Helsinki%22%5D%5D&cardType=100&keywords%5B%5D=Fleminginkatu%2020',
    },
    {
      kind: 'rent',
      url: 'https://asunnot.oikotie.fi/vuokra-asunnot?locations=%5B%5B64%2C6%2C%22Helsinki%22%5D%5D&cardType=101&keywords%5B%5D=Fleminginkatu%2020',
    },
  ]);
  assert.match(listingLinks('Mäkelänkatu 16')[0].url, /keywords%5B%5D=M%C3%A4kel%C3%A4nkatu%2016$/);
  assert.deepEqual(listingLinks('Leppäluoto'), []);
  assert.deepEqual(listingLinks(undefined), []);
});
