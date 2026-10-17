import {t} from '../ui/i18n.js';

// Ads (Ton, 16 Oct 2026): every building with a current ad in one bright amber, the rest
// darker than in the other coloured views and the photos covered more, so the ad
// buildings stand out from far away. No filters and no legend (Ton, 17 Oct 2026); a line
// only when the ads did not load. The tab itself is hidden until they do (main.js).
const AD_COLOR = '#ffc247';

export const ads = {
  uses: ['listings'],
  show({layers, legend}) {
    const {buildings, listings} = layers;
    if (!listings) {
      buildings?.setColoring(null);
      legend.hidden = false;
      legend.textContent = t('Rental ads are still loading or unavailable.');
      return;
    }
    buildings?.setColoring(id => (listings.byBuilding.has(id) ? AD_COLOR : null), '#ffffff', {
      mix: 0.85,
      rest: '#2b312e',
    });
  },
};
