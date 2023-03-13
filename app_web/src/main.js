
import axios from 'axios';
import { GltfView } from 'gltf-viewer-source';

import { UIModel } from './logic/uimodel.js';
import { app } from './ui/ui.js';
import { Observable, Subject, from, merge } from 'rxjs';
import { mergeMap, filter, map, multicast } from 'rxjs/operators';
import { gltfModelPathProvider, fillEnvironmentWithPaths } from './model_path_provider.js';

async function main()
{
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("webgl2", { alpha: false, antialias: true });
    const ui = document.getElementById("app");
    const view = new GltfView(context);
    const resourceLoader = view.createResourceLoader();
    const state = view.createState();
    state.renderingParameters.useDirectionalLightsWithDisabledIBL = true;

    const pathProvider = new gltfModelPathProvider('assets/models/2.0/model-index.json');
    await pathProvider.initialize();
    const environmentPaths = fillEnvironmentWithPaths({
        "footprint_court": "Footprint Court",
        "pisa": "Pisa",
        "doge2": "Doge's palace",
        "ennis": "Dining room",
        "field": "Field",
        "helipad": "Helipad Goldenhour",
        "papermill": "Papermill Ruins",
        "neutral": "Studio Neutral",
        "Cannon_Exterior": "Cannon Exterior",
        "Colorful_Studio": "Colorful Studio",
        "Wide_Street" : "Wide Street",
    }, "assets/environments/");

    const uiModel = new UIModel(app, pathProvider, environmentPaths);

    // whenever a new model is selected, load it and when complete pass the loaded gltf
    // into a stream back into the UI
    const gltfLoadedSubject = new Subject();
    const gltfLoadedMulticast = uiModel.model.pipe(
        mergeMap( (model) =>
        {
        	uiModel.goToLoadingState();

            // Workaround for errors in ktx lib after loading an asset with ktx2 files for the second time:
            resourceLoader.initKtxLib();

            return from(resourceLoader.loadGltf(model.mainFile, model.additionalFiles).then( (gltf) => {
                state.gltf = gltf;
                const defaultScene = state.gltf.scene;
                state.sceneIndex = defaultScene === undefined ? 0 : defaultScene;
                state.cameraIndex = undefined;
                if (state.gltf.scenes.length != 0)
                {
                    if(state.sceneIndex > state.gltf.scenes.length - 1)
                    {
                        state.sceneIndex = 0;
                    }
                    const scene = state.gltf.scenes[state.sceneIndex];
                    scene.applyTransformHierarchy(state.gltf);
                    state.userCamera.aspectRatio = canvas.width / canvas.height;
                    state.userCamera.fitViewToScene(state.gltf, state.sceneIndex);

                    // Try to start as many animations as possible without generating conficts.
                    state.animationIndices = [];
                    for (let i = 0; i < gltf.animations.length; i++)
                    {
                        if (!gltf.nonDisjointAnimations(state.animationIndices).includes(i))
                        {
                            state.animationIndices.push(i);
                        }
                    }
                    state.animationTimer.start();
                }

                uiModel.exitLoadingState();

                return state;
            })
            );
        }),
        // transform gltf loaded observable to multicast observable to avoid multiple execution with multiple subscriptions
        multicast(gltfLoadedSubject)
    );

    uiModel.disabledAnimations(uiModel.activeAnimations.pipe(map(animationIndices => {
        // Disable all animations which are not disjoint to the current selection of animations.
        return state.gltf.nonDisjointAnimations(animationIndices);
    })));

    const sceneChangedSubject = new Subject();
    const sceneChangedObservable = uiModel.scene.pipe(map( newSceneIndex => {
        state.sceneIndex = newSceneIndex;
        state.cameraIndex = undefined;
        const scene = state.gltf.scenes[state.sceneIndex];
        if (scene !== undefined)
        {
            scene.applyTransformHierarchy(state.gltf);
            state.userCamera.fitViewToScene(state.gltf, state.sceneIndex);
        }
    }),
    multicast(sceneChangedSubject)
    );

    const statisticsUpdateObservableTemp = merge(
        gltfLoadedMulticast,
        sceneChangedObservable
    );

    const statisticsUpdateObservable = statisticsUpdateObservableTemp.pipe(
        map( (_) => view.gatherStatistics(state) )
    );

    const cameraExportChangedObservable = uiModel.cameraValuesExport.pipe( map(_ => {
        let camera = state.userCamera;
        if(state.cameraIndex !== undefined)
        {
            camera = state.gltf.cameras[state.cameraIndex];
        }
        const cameraDesc = camera.getDescription(state.gltf);
        return cameraDesc;
    }));

    const downloadDataURL = (filename, dataURL) => {
        var element = document.createElement('a');
        element.setAttribute('href', dataURL);
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    };

    cameraExportChangedObservable.subscribe( cameraDesc => {
        const gltf = JSON.stringify(cameraDesc, undefined, 4);
        const dataURL = 'data:text/plain;charset=utf-8,' +  encodeURIComponent(gltf);
        downloadDataURL("camera.gltf", dataURL);
    });

    uiModel.captureCanvas.subscribe( () => {
        view.renderFrame(state, canvas.width, canvas.height);
        const dataURL = canvas.toDataURL();
        downloadDataURL("capture.png", dataURL);
    });

    uiModel.runRender.subscribe( () => {
        let camera = state.userCamera;
        if(state.cameraIndex !== undefined)
        {
            camera = state.gltf.cameras[state.cameraIndex];
        }
        let cam_pos = camera.getPosition();
        let cam_rot = camera.getRotation();
	var job_data = {
  "tasks": [
    {
      "cameraAngle": 0.48869219422340393,
      "cameraPos.x": cam_pos[0] / 100.0,
      "cameraPos.y": cam_pos[1] / 100.0,
      "cameraPos.z": cam_pos[2] / 100.0,
      "cameraRot.w": cam_rot[3],
      "cameraRot.x": cam_rot[0],
      "cameraRot.y": cam_rot[1],
      "cameraRot.z": cam_rot[2],
      "downloadResults": true,
      "engineModeGpu": false,
      "fbx": "C:/Users/AndrePereira/AppData/Local/Browzwear/StylezoneConnect/tasks-data/605cb79c/1/object.fbx",
      "hdri_background": false,
      "ibl exp": 1,
      "ibl path": "C:/Users/AndrePereira/AppData/Local/Browzwear/VStitcher/Ibl/Studio Soft/Studio Soft_equi.hdr",
      "ibl rot": 0.37877047061920166,
      "id": "6d60b3a8-55f0-11ed-aa39-f8633f631090",
      "iterations": 10,
      "outFormat": "PNG",
      "outPath": "C:/Users/AndrePereira/Downloads/0000 mario block test 2_Colorway 1.png",
      "size.x": 650,
      "size.y": 650,
      "solid_background_color": 4294967295,
      "taskGroup": null,
      "transparent_background": true,
      "type": "render",
      "colorway_number": 0
    }
  ],
  "username": "andre@stitch3d.com",
  "job_name": "0000 mario block test 2"
}

      var json_data = JSON.stringify(job_data);
      const blob = new Blob([json_data], {type : 'application/json'});
      var formData = new FormData();
      formData.append('file', blob, 'example.json');
      formData.append('data', '{"colorway": 0}');
      formData.append('type', 'json-file');

      axios.get('https://id.staging.stitch.fashion/auth/whoami/', {headers: {'Accept': 'application/json'}, withCredentials: true}).then(function(response) {
        var email = response.data.email;
        axios.post('https://renders-api.staging.stitch.fashion/jobs/', {"name": "Hackathon", "type": "dh-blend-file-task", "data": {"total-frames": 1,"colorways-number": 1,"browzwear_version": "8_1"}, "owner": email}, {headers: {"X-Stitch-Client": "3d-viewer"}, withCredentials: true}).then(function(response) {
          var job_id = response.data.id;
  
          axios.post(`https://renders-api.staging.stitch.fashion/jobs/${job_id}/files/?hackathon=1`, {"type": "blend-file", "data": {"colorway":0}}, {headers: {"X-Stitch-Client": "3d-viewer"}, withCredentials: true}).then(function(response) {
          /*axios.get('https://renders-api.staging.stitch.fashion/jobs/33455/', {headers: {'Accept': 'application/json', "X-Stitch-Client": "3d-viewer"}, withCredentials: true}).then(function(response) {
          var old_file_id = response.data.files["json-file"][0].id;
          var old_file_url = `https://renders-api.staging.stitch.fashion/jobs/33455/files/${old_file_id}/`;
          axios.delete(old_file_url, {headers: {"X-Stitch-Client": "3d-viewer"}, withCredentials: true}).then(function(response) {*/
  
            axios.post(`https://renders-api.staging.stitch.fashion/jobs/${job_id}/files/`, formData, {headers: {'Content-Type': 'multipart/form-data', "X-Stitch-Client": "3d-viewer"}, withCredentials: true})
            .then(function (response) {
              axios.post(`https://renders-api.staging.stitch.fashion/jobs/${job_id}/submit/`, {}, {headers: { "X-Stitch-Client": "3d-viewer"}, withCredentials: true}).then(function(req) {
                window.open("https://hub.staging.stitch.fashion/jobs", "_blank");
              });
            })
            .catch(function (error) {
              console.log(error);
            });
          });
        });
      });
    });

    // Only redraw glTF view upon user inputs, or when an animation is playing.
    let redraw = false;
    const listenForRedraw = stream => stream.subscribe(() => redraw = true);
    
    uiModel.scene.pipe(filter(scene => scene === -1)).subscribe( () => {
        state.sceneIndex = undefined;
    });
    uiModel.scene.pipe(filter(scene => scene !== -1)).subscribe( scene => {
        state.sceneIndex = scene;
    });
    listenForRedraw(uiModel.scene);

    uiModel.camera.pipe(filter(camera => camera === -1)).subscribe( () => {
        state.cameraIndex = undefined;
    });
    uiModel.camera.pipe(filter(camera => camera !== -1)).subscribe( camera => {
        state.cameraIndex = camera;
    });
    listenForRedraw(uiModel.camera);

    uiModel.variant.subscribe( variant => {
        state.variant = variant;
    });
    listenForRedraw(uiModel.variant);

    uiModel.tonemap.subscribe( tonemap => {
        state.renderingParameters.toneMap = tonemap;
    });
    listenForRedraw(uiModel.tonemap);

    uiModel.debugchannel.subscribe( debugchannel => {
        state.renderingParameters.debugOutput = debugchannel;
    });
    listenForRedraw(uiModel.debugchannel);

    uiModel.skinningEnabled.subscribe( skinningEnabled => {
        state.renderingParameters.skinning = skinningEnabled;
    });
    listenForRedraw(uiModel.skinningEnabled);

    uiModel.exposure.subscribe( exposure => {
        state.renderingParameters.exposure = (1.0 / Math.pow(2.0, exposure));
    });
    listenForRedraw(uiModel.exposure);

    uiModel.morphingEnabled.subscribe( morphingEnabled => {
        state.renderingParameters.morphing = morphingEnabled;
    });
    listenForRedraw(uiModel.morphingEnabled);

    uiModel.clearcoatEnabled.subscribe( clearcoatEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_clearcoat = clearcoatEnabled;
    });
    uiModel.sheenEnabled.subscribe( sheenEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_sheen = sheenEnabled;
    });
    uiModel.transmissionEnabled.subscribe( transmissionEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_transmission = transmissionEnabled;
    });
    uiModel.volumeEnabled.subscribe( volumeEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_volume = volumeEnabled;
    });
    uiModel.iorEnabled.subscribe( iorEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_ior = iorEnabled;
    });
    uiModel.iridescenceEnabled.subscribe( iridescenceEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_iridescence = iridescenceEnabled;
    });
    uiModel.specularEnabled.subscribe( specularEnabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_specular = specularEnabled;
    });
    uiModel.emissiveStrengthEnabled.subscribe( enabled => {
        state.renderingParameters.enabledExtensions.KHR_materials_emissive_strength = enabled;
    });
    listenForRedraw(uiModel.clearcoatEnabled);
    listenForRedraw(uiModel.sheenEnabled);
    listenForRedraw(uiModel.transmissionEnabled);
    listenForRedraw(uiModel.volumeEnabled);
    listenForRedraw(uiModel.iorEnabled);
    listenForRedraw(uiModel.specularEnabled);
    listenForRedraw(uiModel.iridescenceEnabled);
    listenForRedraw(uiModel.emissiveStrengthEnabled);

    uiModel.iblEnabled.subscribe( iblEnabled => {
        state.renderingParameters.useIBL = iblEnabled;
    });
    listenForRedraw(uiModel.iblEnabled);

    uiModel.iblIntensity.subscribe( iblIntensity => {
        state.renderingParameters.iblIntensity = Math.pow(10, iblIntensity);
    });
    listenForRedraw(uiModel.iblIntensity);

    uiModel.renderEnvEnabled.subscribe( renderEnvEnabled => {
        state.renderingParameters.renderEnvironmentMap = renderEnvEnabled;
    });
    uiModel.blurEnvEnabled.subscribe( blurEnvEnabled => {
        state.renderingParameters.blurEnvironmentMap = blurEnvEnabled;
    });
    listenForRedraw(uiModel.renderEnvEnabled);
    listenForRedraw(uiModel.blurEnvEnabled);

    uiModel.punctualLightsEnabled.subscribe( punctualLightsEnabled => {
        state.renderingParameters.usePunctual = punctualLightsEnabled;
    });
    listenForRedraw(uiModel.punctualLightsEnabled);

    uiModel.environmentRotation.subscribe( environmentRotation => {
        switch (environmentRotation)
        {
        case "+Z":
            state.renderingParameters.environmentRotation = 90.0;
            break;
        case "-X":
            state.renderingParameters.environmentRotation = 180.0;
            break;
        case "-Z":
            state.renderingParameters.environmentRotation = 270.0;
            break;
        case "+X":
            state.renderingParameters.environmentRotation = 0.0;
            break;
        }
    });
    listenForRedraw(uiModel.environmentRotation);


    uiModel.clearColor.subscribe( clearColor => {
        state.renderingParameters.clearColor = clearColor;
    });
    listenForRedraw(uiModel.clearColor);

    uiModel.animationPlay.subscribe( animationPlay => {
        if(animationPlay)
        {
            state.animationTimer.unpause();
        }
        else
        {
            state.animationTimer.pause();
        }
    });

    uiModel.activeAnimations.subscribe( animations => {
        state.animationIndices = animations;
    });
    listenForRedraw(uiModel.activeAnimations);

    uiModel.hdr.subscribe( hdrFile => {
        resourceLoader.loadEnvironment(hdrFile).then( (environment) => {
            state.environment = environment;
            //We neeed to wait until the environment is loaded to redraw
            redraw = true
        });
    });

    uiModel.attachGltfLoaded(gltfLoadedMulticast);
    uiModel.updateStatistics(statisticsUpdateObservable);
    const sceneChangedStateObservable = uiModel.scene.pipe(map( newSceneIndex => state));
    uiModel.attachCameraChangeObservable(sceneChangedStateObservable);
    gltfLoadedMulticast.connect();

    uiModel.orbit.subscribe( orbit => {
        if (state.cameraIndex === undefined)
        {
            state.userCamera.orbit(orbit.deltaPhi, orbit.deltaTheta);
        }
    });
    listenForRedraw(uiModel.orbit);

    uiModel.pan.subscribe( pan => {
        if (state.cameraIndex === undefined)
        {
            state.userCamera.pan(pan.deltaX, -pan.deltaY);
        }
    });
    listenForRedraw(uiModel.pan);

    uiModel.zoom.subscribe( zoom => {
        if (state.cameraIndex === undefined)
        {
            state.userCamera.zoomBy(zoom.deltaZoom);
        }
    });
    listenForRedraw(uiModel.zoom);

    // configure the animation loop
    const past = {};
    const update = () =>
    {
        const devicePixelRatio = window.devicePixelRatio || 1;

        // set the size of the drawingBuffer based on the size it's displayed.
        canvas.width = Math.floor(canvas.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(canvas.clientHeight * devicePixelRatio);
        redraw |= !state.animationTimer.paused && state.animationIndices.length > 0;
        redraw |= past.width != canvas.width || past.height != canvas.height;
        past.width = canvas.width;
        past.height = canvas.height;
        
        if (redraw) {
            view.renderFrame(state, canvas.width, canvas.height);
            redraw = false;
        }

        window.requestAnimationFrame(update);
    };

    // After this start executing animation loop.
    window.requestAnimationFrame(update);
}

export { main };
