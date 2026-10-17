import {parkingLegend} from '../ui/parkingCard.js';
import {t} from '../ui/i18n.js';

// Parking: free, paid and resident permit zones as thin strips along the kerb.
export const parking = {
  uses: ['parking'],
  show({layers, legend}) {
    layers.buildings?.setColoring(null);
    layers.parking?.setVisible(true);
    legend.hidden = false;
    if (layers.parking) parkingLegend(legend, layers.parking);
    else legend.textContent = t('Parking data is still loading or unavailable.');
  },
  hide({layers}) {
    layers.parking?.setVisible(false);
  },
};
