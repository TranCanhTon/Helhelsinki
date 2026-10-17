import {PRICE_COLORS} from '../map/prices.js';
import {legendGradient} from '../ui/legend.js';
import {t, num} from '../ui/i18n.js';

// Price: sale price per m² by postal area, drawn on the ground; the buildings keep
// their photos (Ton, 14 Oct 2026).
export const price = {
  uses: ['prices'],
  show({layers, legend}) {
    layers.buildings?.setColoring(null);
    const prices = layers.prices;
    legend.hidden = false;
    if (!prices) {
      legend.textContent = t('Prices are still loading or unavailable.');
      return;
    }
    prices.setMetric('sale');
    const [lo, hi] = prices.range('sale'),
      fmt = v => num(Math.round(v));
    legendGradient(legend, {colors: PRICE_COLORS, title: t('Sale price · €/m²'), start: fmt(lo), end: fmt(hi)});
  },
  hide({layers}) {
    layers.prices?.setMetric(null);
  },
};
