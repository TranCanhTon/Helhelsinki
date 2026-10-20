import {isPhone} from '../ui/phone.js';
// Sun: shadows and the sun's light only while this tab is open, with the time slider
// below and the compass dial on the left. Phones get the light without shadows
// (Ton, 20 Oct 2026).
export const sun = {
  uses: [],
  show({layers, $}) {
    layers.buildings?.setColoring(null);
    if (!layers.sun) return;
    layers.sun.setOn(true, !isPhone());
    $('#sun-panel').hidden = false;
    $('#sun-dial').hidden = false;
    layers.sunPanel?.show();
  },
  hide({layers, $}) {
    layers.sun?.setOn(false);
    $('#sun-panel').hidden = true;
    $('#sun-dial').hidden = true;
  },
};
