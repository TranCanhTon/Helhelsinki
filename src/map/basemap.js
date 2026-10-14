import * as Cesium from 'cesium';
import {loadJson} from '../data/load.js';
export async function loadBasemap(viewer) {
  const meta=await loadJson('/basemap/basemap.json');
  // The dark ground map only (Ton removed day mode, 14 Oct 2026).
  // Both providers reuse base imagery below z16; detail adds the central street view.
  {
    const theme='dusk';
    for(const level of Object.values(meta.levels).filter(Boolean)){
      const provider=new Cesium.UrlTemplateImageryProvider({
        url:'/basemap/'+theme+'/{z}/{x}/{y}.webp',tilingScheme:new Cesium.WebMercatorTilingScheme(),
        rectangle:Cesium.Rectangle.fromDegrees(...level.rectangle),minimumLevel:10,maximumLevel:level.max,
        customTags:{},credit:'City of Helsinki, CC BY 4.0'
      });
      // Our tiles start at zoom 10. Without minimumTerrainLevel Cesium tries to fit
      // them onto continent-sized globe tiles near the horizon, never finishes,
      // and keeps redrawing the scene. Those far tiles just get the plain colour.
      const layer=new Cesium.ImageryLayer(provider,{minimumTerrainLevel:8});
      viewer.imageryLayers.add(layer);
    }
  }
  viewer.scene.globe.baseColor=Cesium.Color.fromCssColorString('#101413');
  viewer.scene.backgroundColor=viewer.scene.globe.baseColor;
  viewer.scene.requestRender();
  return {meta};
}

