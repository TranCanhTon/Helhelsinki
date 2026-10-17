// Overview: the city's textured buildings as they are, no legend.
export const overview = {
  uses: [],
  show({layers}) {
    layers.buildings?.setColoring(null);
  },
};
