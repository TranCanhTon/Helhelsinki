// Sun: shadows and the sun's light only while this tab is open, with the time slider
// below and the compass dial on the left.
export const sun = {
  uses: [],
  show({layers, $}) {
    layers.buildings?.setColoring(null);
    if (!layers.sun) return;
    layers.sun.setOn(true);
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
