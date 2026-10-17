import {noiseLegend, noiseSwitch} from '../ui/noiseCard.js';
import {constructionLegend} from '../ui/constructionCard.js';
import {t} from '../ui/i18n.js';

// Noise: apartment buildings coloured by their loudest modelled band, with a switch on
// the left for the source. Construction sits in that switch but is not a noise source:
// it draws the work areas and leaves the buildings plain.
export const noise = {
  uses: ['noise', 'construction'],
  show(ctx) {
    const {state, layers, legend, $} = ctx;
    const work = state.noiseMode === 'construction',
      {buildings} = layers;
    // Selected building: white, since copper and red are on the noise scale.
    buildings?.setColoring(
      layers.noise && !work ? id => layers.noise.colorOf(buildings.records.get(id)) : null,
      '#ffffff',
    );
    layers.construction?.setVisible(work);
    $('#noise-switch').hidden = false;
    noiseSwitch($('#noise-switch'), state.noiseMode, mode => {
      if (mode !== state.noiseMode) ctx.fade(() => setNoiseMode(ctx, mode));
    });
    legend.hidden = false;
    if (work) {
      if (layers.construction) constructionLegend(legend, layers.construction);
      else legend.textContent = t('Construction data is still loading or unavailable.');
    } else if (layers.noise) noiseLegend(legend, layers.noise);
    else legend.textContent = t('Noise data is still loading or unavailable.');
  },
  hide({layers, $}) {
    layers.construction?.setVisible(false);
    $('#noise-switch').hidden = true;
  },
};

function setNoiseMode(ctx, mode) {
  const {state, layers} = ctx;
  if (mode === 'construction') state.noiseMode = mode;
  else {
    layers.noise?.setMode(mode);
    state.noiseMode = layers.noise?.mode ?? 'all';
  }
  ctx.setView('noise');
}
