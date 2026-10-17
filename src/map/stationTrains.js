import * as Cesium from 'cesium';
import {RAILS, trainCars} from '../data/stationTrains.js';

// Two parked commuter trains at Helsinki Central Station (src/data/stationTrains.js says where).
// Places the cars once. The model is loaded once by Cesium and shared by every car.
export async function loadStationTrains(viewer) {
  const scene = viewer.scene,
    models = [];
  for (const rail of RAILS)
    for (const car of trainCars(rail)) {
      const frame = Cesium.Transforms.eastNorthUpToFixedFrame(
        Cesium.Cartesian3.fromDegrees(car.centre[0], car.centre[1], 0),
      );
      // The model's front (+X) along the bearing; a car with its cab at the back is turned round.
      const turn = Cesium.Matrix4.fromRotationTranslation(
        Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(90 - car.bearing + (car.cab === 'back' ? 180 : 0))),
      );
      const model = await Cesium.Model.fromGltfAsync({
        url: '/models/train.glb',
        upAxis: Cesium.Axis.Z,
        forwardAxis: Cesium.Axis.X,
        modelMatrix: Cesium.Matrix4.multiply(frame, turn, new Cesium.Matrix4()),
      });
      model.readyEvent.addEventListener(() => {
        model.getNode('cab').show = car.cab !== null;
        scene.requestRender();
      });
      models.push(scene.primitives.add(model));
    }
  scene.requestRender();
  return models;
}
