import {groupOf, perM2} from '../data/listings.js';
import {t, num, locale, getLang} from './i18n.js';
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
// "€765" in English, "765 €" in Finnish.
const euro = s => (getLang() === 'fi' ? s + ' €' : '€' + s);
const euros = v => euro(num(Math.round(v)));
const when = iso => new Date(iso).toLocaleDateString(locale(), {day: 'numeric', month: 'short'});

// Ads in this exact building, each compared with similar ads in the same postal area.
export function adsSection(record, listings) {
  const ads = listings?.byBuilding.get(record.buildingId);
  if (!ads?.length) return null;
  const box = el('section', 'building-ads');
  box.append(
    el(
      'h3',
      null,
      ads.length === 1
        ? t('1 rental ad in this building now')
        : t('{n} rental ads in this building now', {n: ads.length}),
    ),
  );
  for (const ad of ads) {
    const a = el('a', 'building-ad');
    a.href = ad.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.append(
      el('strong', null, t('{v} / month', {v: euros(ad.rent)}) + (ad.sizeM2 ? ' · ' + num(ad.sizeM2) + ' m²' : '')),
    );
    const typical = listings.stats.get(ad.postcode)?.groups[groupOf(ad.rooms)];
    const own = perM2(ad);
    const compare = own != null && typical?.perM2 != null ? Math.round((own / typical.perM2 - 1) * 100) : null;
    a.append(
      el(
        'span',
        null,
        [
          ad.layout,
          ad.street,
          own != null ? euro(num(own, {minimumFractionDigits: 1, maximumFractionDigits: 1})) + '/m²' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    );
    if (compare != null)
      a.append(
        el(
          'span',
          compare > 0 ? 'ad-compare is-above' : 'ad-compare is-below',
          compare === 0
            ? t('Same as similar ads nearby per m²')
            : t(compare > 0 ? '{n}% above similar ads nearby per m²' : '{n}% below similar ads nearby per m²', {
                n: Math.abs(compare),
              }),
        ),
      );
    a.append(el('span', 'note', t('Ad updated {date} · open on Oikotie ↗', {date: when(ad.lastmod)})));
    box.append(a);
  }
  return box;
}
