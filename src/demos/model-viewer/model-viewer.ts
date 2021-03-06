/// <reference path="../../../built/Lib/akra.d.ts" />
/// <reference path="../../../built/Lib/base3dObjects.addon.d.ts" />
/// <reference path="../../../built/Lib/progress.addon.d.ts" />
/// <reference path="../../../built/Lib/compatibility.addon.d.ts" />

/// <reference path="../std/std.ts" />

/// <reference path="../idl/3d-party/dat.gui.d.ts" />

declare var AE_RESOURCES: akra.IDep;
declare var AE_MODELS: any;

module akra {
	addons.compatibility.requireWebGLExtension(webgl.WEBGL_DEPTH_TEXTURE);
	addons.compatibility.requireWebGLExtension(webgl.OES_ELEMENT_INDEX_UINT);
	addons.compatibility.requireWebGLExtension(webgl.OES_TEXTURE_FLOAT);
	addons.compatibility.requireWebGLExtension(webgl.WEBGL_COMPRESSED_TEXTURE_S3TC);
	addons.compatibility.requireWebGLExtension(webgl.OES_STANDARD_DERIVATIVES);
	addons.compatibility.verify("non-compatible");

	export var modelsPath = path.parse((AE_MODELS.content).split(';')[0]).getDirName() + '/';

	var pProgress = new addons.Progress(document.getElementById("progress"));

	var pRenderOpts: IRendererOptions = {
		premultipliedAlpha: false,
		preserveDrawingBuffer: true,
		depth: true,
		antialias: true
	};

	var pOptions: IEngineOptions = {
		renderer: pRenderOpts,
		progress: pProgress.getListener(),
		deps: { files: [AE_RESOURCES], root: "./" }
	};

	export var pEngine = akra.createEngine(pOptions);

	export var pScene = pEngine.getScene();

	export var pCanvas: ICanvas3d = pEngine.getRenderer().getDefaultCanvas();
	export var pCamera: ICamera = null;
	export var pDefaultCamera: ICamera = null;
	export var pViewport: IViewport = null;
	export var pReflectionCamera: ICamera = null;
	export var pReflectionViewport: IViewport = null;
	export var pReflectionTexture: ITexture = null;
	export var pMirror: INode = null;
	export var pRmgr: IResourcePoolManager = pEngine.getResourceManager();
	export var pSky: model.Sky = null;
	export var pPBSData = null;
	export var pSkyboxTexture: ITexture = null;
	export var pSkyboxTextures: IMap<ITexture> = null;
	export var pEnvTexture = null;
	export var pDepthViewport = null;
	export var pEffectData = null;
	export var pModelsFiles = null;
	export var pFireTexture: ITexture = null;
	export var applyAlphaTest = null;
	export var bFPSCameraControls: boolean = false;

	var pState = {
		animate: true,
		lightShafts: true,
		lensFlare: true
	};

	export var animateTimeOfDay = () => {
		pSky.setTime(new Date().getTime() % 24000 / 500 - 24);
		requestAnimationFrame(animateTimeOfDay);
	}

	export var pCameraParams = {
		current: {
			orbitRadius: 4.2,
			rotation: new math.Vec2(0., 0.)
		},
		target: {
			orbitRadius: 4.2,
			rotation: new math.Vec2(0., 0.)
		}
	}
	export var pCameraFPSParams = {
		current: {
			position: new math.Vec3(),
			rotation: new math.Vec2(0., 0.)
		},
		target: {
			position: new math.Vec3(),
			rotation: new math.Vec2(0., 0.)
		}
	}

	export var pModelTable = null;
	export var pModels = null;
	export var pCurrentModel = null;
	export var pPodiumModel = null;
	export var pOmniLights = null;
	export var pKeymap = null;
	export var pSkyboxTexturesKeys = null;
	export var pCurrentSkybox = null;

	function createCamera(pRoot: ISceneNode = pScene.getRootNode()): ICamera {
		var pCamera: ICamera = pScene.createCamera();

		pCamera.attachToParent(pRoot);
		pCamera.setPosition(Vec3.temp(0., 0., 4.2));
		pCamera.update();

		return pCamera;
	}

	function animateCameras(): void {
		pScene.beforeUpdate.connect(() => {
			pCamera.update();
			pReflectionCamera.update();

			if (pCamera === pDefaultCamera) {
				if (bFPSCameraControls) {
					var newRot: IVec2 = math.Vec2.temp(pCameraFPSParams.current.rotation).add(math.Vec2.temp(pCameraFPSParams.target.rotation).subtract(pCameraFPSParams.current.rotation).scale(0.15));
					var newPos: IVec3 = math.Vec3.temp(pCameraFPSParams.current.position).add(math.Vec3.temp(pCameraFPSParams.target.position).subtract(pCameraFPSParams.current.position).scale(0.03));

					pCameraFPSParams.current.rotation.set(newRot);
					pCameraFPSParams.current.position.set(newPos);
					pCamera.setPosition(newPos);
					pCamera.setRotationByEulerAngles(-newRot.x, -newRot.y, 0.);
				}
				else {
					var newRot: IVec2 = math.Vec2.temp(pCameraParams.current.rotation).add(math.Vec2.temp(pCameraParams.target.rotation).subtract(pCameraParams.current.rotation).scale(0.15));
					var newRad = pCameraParams.current.orbitRadius * (1. + (pCameraParams.target.orbitRadius - pCameraParams.current.orbitRadius) * 0.03);

					pCameraParams.current.rotation.set(newRot);
					pCameraParams.current.orbitRadius = newRad;
					pCamera.setPosition(
						newRad * -math.sin(newRot.x) * math.cos(newRot.y),
						newRad * math.sin(newRot.y),
						newRad * math.cos(newRot.x) * math.cos(newRot.y));
					pCamera.lookAt(math.Vec3.temp(0, 0, 0));
				}
				pCamera.update();
			}

			var dist = math.Vec3.temp(pCamera.getWorldPosition()).subtract(pMirror.getWorldPosition());
			var up = pMirror.getTempVectorUp();

			pReflectionCamera.setPosition(math.Vec3.temp(pCamera.getWorldPosition()).add(math.Vec3.temp(up).scale(-2. * (up.dot(dist)))));
			pReflectionCamera.setRotationByForwardUp(
				pCamera.getTempVectorForward().add(math.Vec3.temp(up).scale(-2. * up.dot(pCamera.getTempVectorForward()))),
				pCamera.getTempVectorUp().add(math.Vec3.temp(up).scale(-2. * up.dot(pCamera.getTempVectorUp()))));
			pReflectionCamera.setAspect(pCamera.getAspect());

			pReflectionCamera.update();
		});
	}

	function createKeymap(pCamera: ICamera): void {
		pKeymap = control.createKeymap();
		pKeymap.captureMouse((<any>pCanvas).getElement());
		pKeymap.captureKeyboard(document);

		pKeymap.bind("T", () => {
			if (pGUI) {
				for (var i = 0; i < pGUI.__controllers.length; i++) {
					if (pGUI.__controllers[i].property === "fps_camera") {
						pGUI.__controllers[i].__checkbox.click();
						break;
					}
				}
			}
		});

		pKeymap.bind("N", () => {
			var keyInd = pSkyboxTexturesKeys.indexOf(pCurrentSkybox.Skybox);
			keyInd = (keyInd+1) % pSkyboxTexturesKeys.length;
			pCurrentSkybox.Skybox = pSkyboxTexturesKeys[keyInd];

			(<ILPPViewport>pViewport).setSkybox(pSkyboxTextures[pSkyboxTexturesKeys[keyInd]]);
			(<ITexture>pEnvTexture).unwrapCubeTexture(pSkyboxTextures[pSkyboxTexturesKeys[keyInd]]);
		});

		pScene.beforeUpdate.connect(() => {
			if (pKeymap.isMousePress()) {
				if (pKeymap.isMouseMoved()) {
					var v2fMouseShift: IOffset = pKeymap.getMouseShift();

					if(bFPSCameraControls) {
						pCameraFPSParams.target.rotation.y = math.clamp(pCameraFPSParams.target.rotation.y + v2fMouseShift.y / pViewport.getActualHeight() * 4., -1.2, 1.2);
						pCameraFPSParams.target.rotation.x += v2fMouseShift.x / pViewport.getActualHeight() * 4.;
					}
					else {
						pCameraParams.target.rotation.y = math.clamp(pCameraParams.target.rotation.y + v2fMouseShift.y / pViewport.getActualHeight() * 2., -0.7, 1.2);
						pCameraParams.target.rotation.x += v2fMouseShift.x / pViewport.getActualHeight() * 2.;
					}
					pKeymap.update();
				}

			}
			var fSpeed: float = 0.1 * 3;
			if (pKeymap.isKeyPress(EKeyCodes.W)) {
				// pCamera.addRelPosition(0, 0, -fSpeed);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorForward().scale(-fSpeed));
				}
			}
			if (pKeymap.isKeyPress(EKeyCodes.B)) {
				pEffectData.FIRE_THRESHOLD = Math.min(pEffectData.FIRE_THRESHOLD + 0.01, 1.);
			}
			if (pKeymap.isKeyPress(EKeyCodes.V)) {
				pEffectData.FIRE_THRESHOLD = Math.max(pEffectData.FIRE_THRESHOLD - 0.01, 0.);
			}
			if (pKeymap.isKeyPress(EKeyCodes.S)) {
				// pCamera.addRelPosition(0, 0, fSpeed);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorForward().scale(fSpeed));
				}
			}
			if (pKeymap.isKeyPress(EKeyCodes.A) || pKeymap.isKeyPress(EKeyCodes.LEFT)) {
				// pCamera.addRelPosition(-fSpeed, 0, 0);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorRight().scale(fSpeed));
				}
			}
			if (pKeymap.isKeyPress(EKeyCodes.D) || pKeymap.isKeyPress(EKeyCodes.RIGHT)) {
				// pCamera.addRelPosition(fSpeed, 0, 0);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorRight().scale(-fSpeed));
				}
			}
			if (pKeymap.isKeyPress(EKeyCodes.UP)) {
				// pCamera.addRelPosition(0, fSpeed, 0);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorUp().scale(fSpeed));
				}
			}
			if (pKeymap.isKeyPress(EKeyCodes.DOWN)) {
				// pCamera.addRelPosition(0, -fSpeed, 0);
				if(bFPSCameraControls) {
					pCameraFPSParams.target.position.add(pCamera.getTempVectorUp().scale(-fSpeed));
				}
			}
		});
		(<ILPPViewport>pViewport).enableSupportForUserEvent(EUserEvents.MOUSEWHEEL);
		pViewport.mousewheel.connect((pViewport, x: float, y: float, fDelta: float) => {
			//console.log("mousewheel moved: ",x,y,fDelta);
			if(bFPSCameraControls) {
				pCameraFPSParams.target.position.add(pCamera.getTempVectorForward().scale( -fDelta / pViewport.getActualHeight() ));
			}
			else {
				pCameraParams.target.orbitRadius = math.clamp(pCameraParams.target.orbitRadius - fDelta / pViewport.getActualHeight() * 2., 2., 15.);
			}
		});
	}

	var pGUI;
	function createViewport(): IViewport3D {

		var pViewport: ILPPViewport = new render.LPPViewport(pCamera, 0., 0., 1., 1., 11);

		pCanvas.addViewport(pViewport);
		pCanvas.resize(window.innerWidth, window.innerHeight);

		window.onresize = function (event) {
			pCanvas.resize(window.innerWidth, window.innerHeight);
		};

		(<render.LPPViewport>pViewport).setFXAA(true);
		var counter = 0;

		window["pGUI"] = pGUI = new dat.GUI();

		pSkyboxTexturesKeys = [
			'desert',
			'nature',
			'colosseum',
			'beach',
			'plains',
			'church',
			'basilica',
			'sunset'
		];
		pSkyboxTextures = {};
		for (var i = 0; i < pSkyboxTexturesKeys.length; i++) {

			var pTexture: ITexture = pSkyboxTextures[pSkyboxTexturesKeys[i]] = pRmgr.createTexture(".sky-box-texture-" + pSkyboxTexturesKeys[i]);

			pTexture.setFlags(ETextureFlags.AUTOMIPMAP);
			pTexture.loadResource("SKYBOX_" + pSkyboxTexturesKeys[i].toUpperCase());
			pTexture.setFilter(ETextureParameters.MAG_FILTER, ETextureFilters.LINEAR);
			pTexture.setFilter(ETextureParameters.MIN_FILTER, ETextureFilters.LINEAR);
		};

		pGUI.add({ fps_camera: bFPSCameraControls }, "fps_camera").onChange((bNewValue) => {
			if(!bFPSCameraControls) {
				pCameraFPSParams.current.rotation.set(pCameraParams.current.rotation);
				pCameraFPSParams.target.rotation.set(pCameraFPSParams.current.rotation);
				pCameraFPSParams.current.position.set(pCamera.getWorldPosition());
				pCameraFPSParams.target.position.set(pCameraFPSParams.current.position);
			}
			bFPSCameraControls = bNewValue;
		})

		var bAdvancedSkybox: boolean = true;
		var fSkyboxSharpness: float = .72;
		pGUI.add({ skybox_sharpness: fSkyboxSharpness }, "skybox_sharpness", 0., 1., 0.01).onChange((fValue) => {
			fSkyboxSharpness = fValue;
		})

		pGUI.add({ skybox_blur: bAdvancedSkybox }, "skybox_blur").onChange((bValue) => {
			bAdvancedSkybox = bValue;
		});

		var pMaterialPresets = {
			Gold: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(1.00, 0.86, 0.57),
			},
			Copper: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(0.98, 0.82, 0.76),
			},
			Plastic: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(0.21, 0.21, 0.21),
			},
			Iron: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(0.77, 0.78, 0.78),
			},
			Aluminium: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(0.96, 0.96, 0.97),
			},
			Silver: {
				_F0: new math.Vec3(1., 1., 1.),
				_Diffuse: new math.Vec3(0.98, 0.97, 0.95),
			},
			Water: {
				_F0: new math.Vec3(0.15, 0.15, 0.15),
				_Diffuse: new math.Vec3(0.98, 0.97, 0.95),
			},
			Glass: {
				_F0: new math.Vec3(0.21, 0.21, 0.21),
				_Diffuse: new math.Vec3(0.98, 0.97, 0.95),
			}
		};

		pPBSData = {
			isUsePBS: true,
			_Material: pMaterialPresets.Aluminium,
			_Gloss: 0,
		}



		pEffectData = { BLUR_RADIUS: 0.01, FIRE_THRESHOLD: 0.01, IS_USE_ALPHATEST: true };
		var pEffetsFolder = pGUI.addFolder("effects");
		(<dat.NumberControllerSlider>pEffetsFolder.add(pEffectData, 'BLUR_RADIUS')).min(0.).max(250.).name("Blur radius");
		(<dat.NumberControllerSlider>pEffetsFolder.add(pEffectData, 'IS_USE_ALPHATEST')).name("Use alphatest");
		(<dat.NumberControllerSlider>pEffetsFolder.add(pEffectData, 'FIRE_THRESHOLD')).min(0.).max(1.).step(0.01).name("Fire gate").__precision = 2;


		var pPBSFolder = pGUI.addFolder("pbs");
		pCurrentSkybox = { Skybox: "desert" };
		(<dat.OptionController>pPBSFolder.add(pCurrentSkybox, 'Skybox', pSkyboxTexturesKeys)).name("Skybox").onChange((sKey) => {
			// if (pViewport.getType() === EViewportTypes.LPPVIEWPORT) {
			(<ILPPViewport>pViewport).setSkybox(pSkyboxTextures[sKey]);
			// }
			(<ITexture>pEnvTexture).unwrapCubeTexture(pSkyboxTextures[sKey]);
		});


		(<ILPPViewport>pViewport).setShadingModel(EShadingModel.PBS_SIMPLE);

		var pEffect = pViewport.getEffect();
		pEffect.addComponent("akra.system.blur");

		var bAdvancedSkybox: boolean = true;
		var fSkyboxSharpness: float = .72;
		if (config.DEBUG) {
			pGUI.add({ skybox_sharpness: fSkyboxSharpness }, "skybox_sharpness", 0., 1., 0.01).onChange((fValue) => {
				fSkyboxSharpness = fValue;
			})

			pGUI.add({ skybox_blur: bAdvancedSkybox }, "skybox_blur").onChange((bValue) => {
				bAdvancedSkybox = bValue;
			});
		}


		pViewport.render.connect((pViewport: IViewport, pTechnique: IRenderTechnique,
			iPass: uint, pRenderable: IRenderableObject, pSceneObject: ISceneObject) => {
			var pPass: IRenderPass = pTechnique.getPass(iPass);
			var pDepthTexture: ITexture = (<ILPPViewport>pViewport).getDepthTexture();

			// pPass.setTexture('CUBETEXTURE0', pSkyboxTexture);
			pPass.setTexture('DEPTH_TEXTURE', pDepthTexture);
			pPass.setUniform("SCREEN_ASPECT_RATIO",
				math.Vec2.temp(pViewport.getActualWidth() / pViewport.getActualHeight(), 1.));
			pPass.setUniform("BLUR_RADIUS", pEffectData.BLUR_RADIUS);
			pPass.setUniform("SKYBOX_ADVANCED_SHARPNESS", fSkyboxSharpness);
			pPass.setTexture("SKYBOX_UNWRAPED_TEXTURE", pEnvTexture);
			pPass.setForeign("IS_USED_ADVANCED_SKYBOX", bAdvancedSkybox);
		});

		return pViewport;
	}

	function createMirror(): INode {
		var pNode: INode = pScene.createNode().setPosition(0., -1.5, 0.);
		pNode.setInheritance(ENodeInheritance.ROTPOSITION);
		pReflectionCamera = createMirrorCamera(pNode);
		pReflectionViewport = createMirrorViewport(pNode);

		return pNode;
	}

	function createMirrorCamera(pReflNode: INode): ICamera {
		var pReflectionCamera: ICamera = pScene.createCamera("reflection_camera_01");

		pReflectionCamera.attachToParent(pScene.getRootNode());
		pReflectionCamera.setInheritance(pCamera.getInheritance());

		return pReflectionCamera;
	}

	function createMirrorViewport(pReflNode: INode): IViewport {

		pReflectionTexture = pRmgr.createTexture(".reflection_texture");
		pReflectionTexture.create(1024, 1024, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
			ETextureTypes.TEXTURE_2D, EPixelFormats.R8G8B8);

		var pRenderTarget = pReflectionTexture.getBuffer().getRenderTarget();
		pRenderTarget.setAutoUpdated(false);


		var pDepthTexture = pRmgr.createTexture(".mirror - depth");
		pDepthTexture.create(1024, 1024, 1, null, 0, 0, 0, ETextureTypes.TEXTURE_2D, EPixelFormats.DEPTH32);
		pRenderTarget.attachDepthTexture(pDepthTexture);

		var pTexViewport: IMirrorViewport = <IMirrorViewport>pRenderTarget.addViewport(new render.MirrorViewport(pReflectionCamera, 0., 0., 1., 1., 0));
		var pEffect = (<render.LPPViewport>pTexViewport.getInternalViewport()).getEffect();
		return pTexViewport;
	}

	var lightPos1: math.Vec3 = new math.Vec3(1, 2, 2);
	var lightPos2: math.Vec3 = new math.Vec3(-1, -2, 2);

	function createLighting(): void {
		pOmniLights = pScene.createNode('lights-root');
		pOmniLights.attachToParent(pCamera);
		pOmniLights.setInheritance(ENodeInheritance.ALL);

		var pOmniLight: IOmniLight;
		var pOmniLightSphere;

		pOmniLight = <IOmniLight>pScene.createLightPoint(ELightTypes.OMNI, true, 2048, "test-omni-0");

		pOmniLight.attachToParent(pOmniLights);
		pOmniLight.setEnabled(true);
		pOmniLight.getParams().ambient.set(0.1);
		pOmniLight.getParams().diffuse.set(1.0, 1.0, 1.0);
		pOmniLight.getParams().specular.set(1.0, 1.0, 1.0, 1.0);
		pOmniLight.getParams().attenuation.set(1, 0, 0.3);
		pOmniLight.setShadowCaster(false);
		pOmniLight.setInheritance(ENodeInheritance.ALL);
		pOmniLightSphere = loadModel(modelsPath + "/Sphere.DAE",
			(model) => {
				model.explore(function (node) {
					if (scene.SceneModel.isModel(node)) {
						node.getMesh().getSubset(0).getMaterial().emissive = new Color(1., 1., 1.);
					}
				})
				}, "test-omni-0-model", pOmniLight).scale(0.15);
		pOmniLightSphere.setPosition(0., 0., 0.);
		pOmniLight.setPosition(lightPos1);

		pOmniLight = <IOmniLight>pScene.createLightPoint(ELightTypes.OMNI, true, 512, "test-omni-0");

		pOmniLight.attachToParent(pOmniLights);
		pOmniLight.setEnabled(true);
		pOmniLight.getParams().ambient.set(0.1);
		pOmniLight.getParams().diffuse.set(1.0, 1.0, 1.0);
		pOmniLight.getParams().specular.set(1.0, 1.0, 1.0, 1.0);
		pOmniLight.getParams().attenuation.set(1, 0, 0.3);
		pOmniLight.setShadowCaster(false);
		pOmniLight.setInheritance(ENodeInheritance.ALL);
		pOmniLightSphere = loadModel(modelsPath + "/Sphere.DAE",
			(model) => {
				model.explore(function (node) {
					if (scene.SceneModel.isModel(node)) {
						node.getMesh().getSubset(0).getMaterial().emissive = new Color(1., 1., 1.);
					}
				})
				}, "test-omni-0-model", pOmniLight).scale(0.15);
		pOmniLightSphere.setPosition(0., 0., 0.);
		pOmniLight.setPosition(lightPos2);
	}

	function createSky(): void {
		pSky = new model.Sky(pEngine, 32, 32, 1000.0);
		pSky.setTime(15.);

		pSky.sun.setShadowCaster(false);

		var pSceneModel: ISceneModel = pSky.skyDome;
		pSceneModel.attachToParent(pScene.getRootNode());
	}

	function createSkyBox(): void {
		pSkyboxTexture = pSkyboxTextures['desert'];

		if (pViewport.getType() === EViewportTypes.FORWARDVIEWPORT) {
			var pModel = addons.cube(pScene);
			(<IForwardViewport>pViewport).setSkyboxModel(pModel.getRenderable(0));
		}
		//if (pViewport.getType() === EViewportTypes.LPPVIEWPORT || pViewport.getType() === EViewportTypes.DSVIEWPORT) {
		(<ILPPViewport>pViewport).setSkybox(pSkyboxTexture);
		//}

		pEnvTexture = pRmgr.createTexture(".env-map-texture-01");
		pEnvTexture.create(1024, 512, 1, null, 0, 0, 0,
			ETextureTypes.TEXTURE_2D, EPixelFormats.R8G8B8);
		pEnvTexture.unwrapCubeTexture(pSkyboxTexture);

		(<ILPPViewport>pViewport).setDefaultEnvironmentMap(pEnvTexture);
	}

	function loadModel(sPath, fnCallback?: Function, name?: String, pRoot?: ISceneNode): ISceneNode {
		var pModelRoot: ISceneNode = pScene.createNode();
		var pModel: ICollada = <ICollada>pEngine.getResourceManager().loadModel(sPath);

		pModelRoot.setName(name || sPath.match(/[^\/]+$/)[0] || 'unnamed_model');
		if (pRoot != null) {
			pModelRoot.attachToParent(pRoot);
		}
		pModelRoot.setInheritance(ENodeInheritance.ROTPOSITION);

		function fnLoadModel(pModel: ICollada): void {
			pModel.attachToScene(pModelRoot);

			if (pModel.isAnimationLoaded()) {
				var pController: IAnimationController = pEngine.createAnimationController();
				var pContainer: IAnimationContainer = animation.createContainer();
				var pAnimation: IAnimation = pModel.extractAnimation(0);

				pController.attach(pModelRoot);

				pContainer.setAnimation(pAnimation);
				pContainer.useLoop(true);
				pController.addAnimation(pContainer);
			}

			pScene.beforeUpdate.connect(() => {
				pModelRoot.addRelRotationByXYZAxis(0, 0, 0);
				// pController.update();
			});

			if (isFunction(fnCallback)) {
				fnCallback(pModelRoot);
			}
		}

		if (pModel.isResourceLoaded()) {
			fnLoadModel(pModel);
		}
		else {
			pModel.loaded.connect(fnLoadModel);
		}

		return pModelRoot;
	}

	function createStatsDIV() {
		var pStatsDiv = document.createElement("div");

		document.body.appendChild(pStatsDiv);
		pStatsDiv.setAttribute("style",
			"position: fixed;" +
			"max-height: 40px;" +
			"max-width: 120px;" +
			"color: green;" +
			"font-family: Arial;" +
			"margin: 5px;");

		return pStatsDiv;
	}

	function main(pEngine: IEngine) {
		std.setup(pCanvas);

		pDefaultCamera = pCamera = createCamera();
		pViewport = createViewport();
		pMirror = createMirror();
		pViewport.setBackgroundColor(color.GRAY);
		pViewport.setClearEveryFrame(true);

		var pStatsDiv = createStatsDIV();

		// pCanvas.postUpdate.connect((pCanvas: ICanvas3d) => {
		// 	pStatsDiv.innerHTML = pCanvas.getAverageFPS().toFixed(2) + " fps";
		// });

		createKeymap(pCamera);

		animateCameras();

		window.onresize = () => {
			pCanvas.resize(window.innerWidth, window.innerHeight);
		};

		//createSky();
		createLighting();

		createSkyBox();

		// PLASTIC PARAMS:
		var plasticColorSpecular: color.Color = new Color(0.05, 0.05, 0.05, 1.0);
		// var plasticColorDiffuse: color.Color = silverColorDiffuse;
		var plasticColorDiffuse: color.Color = new Color(0.35, 0.35, 0.35, 1.0);
		var plasticDarkColorDiffuse: color.Color = new Color(0.08, 0.08, 0.08, 1.0);

		console.log("-------------");
		console.log("-------------");
		console.log("-------------");
		console.log("-------------");
		console.log("-------------");
		console.log("-------------");
		console.log("------------- Start preloading models");
		console.log("------------- + Models table");

		pFireTexture = pRmgr.createTexture(".fire-degrade-texture");
		pFireTexture.loadResource("FIRE_TEXTURE");

		applyAlphaTest = function (pTech: IRenderTechnique, iPass, pRenderable, pSceneObject, pLocalViewport) {
			pTech.getPass(iPass).setForeign('IS_USE_ALPHATEST', pEffectData.IS_USE_ALPHATEST);
			pTech.getPass(iPass).setTexture('ALPHATEST_TEXTURE', pFireTexture);
			pTech.getPass(iPass).setUniform("ALPHATEST_THRESHOLD", pEffectData.FIRE_THRESHOLD);
		};

		var fRadius = 3.;
		pModelTable = addons.trifan(pScene, fRadius, 96);
		pModelTable.attachToParent(pScene.getRootNode());
		pModelTable.setPosition(0., -1.25, 0.);
		pModelTable.explore(function (node) {
			if (scene.SceneModel.isModel(node)) {
				node.getMesh().getSubset(0).getMaterial().shininess = 0.7;
				node.getMesh().getSubset(0).getMaterial().specular = plasticColorSpecular;
				node.getMesh().getSubset(0).getMaterial().diffuse = plasticColorDiffuse;
				//node.getMesh().getSubset(0).getTechnique().render.connect(applyAlphaTest);
				node.getMesh().getSubset(0).getTechnique().render.connect((pTech: IRenderTechnique, iPass, pRenderable, pSceneObject, pLocalViewport) => {
					pTech.getPass(iPass).setTexture("MIRROR_TEXTURE", pReflectionTexture);
					pTech.getPass(iPass).setForeign("IS_USED_MIRROR_REFLECTION", true);
				});
			}
		});

		var pModelsKeys = [
		//'mercedes',
			'miner',
			'character',
			'head',
			'sponza',
			'teapot',
			'donut',
			'sphere',
			'rock',
			'windspot',
			'can',
			'building01',
			'building02',
			'prop01',
			'prop04',
			'dress01',
			// 'box',
			// 'barrel',
		];
		pModelsFiles = {
			//mercedes: {
			//	path: modelsPath + "/../../../mercedes/models/mercedes.DAE",
			//	init: () => { }
			//},
			miner: {
				path: modelsPath + "/miner/miner.DAE",
				init: function (model) {
					model.explore(function (node) {
						if (scene.SceneModel.isModel(node)) {
							node.getRenderable().getTechnique().render.connect(applyAlphaTest);
						}
					});


					var pController: IAnimationController = pEngine.createAnimationController();

					function anim2controller(pController: IAnimationController, sAnim: string): IAnimationContainer {
						var pAnimModel: ICollada = <ICollada>pRmgr.getColladaPool().findResource(sAnim);
						if (isNull(pAnimModel)) {
							console.log("SKIP ANIMATION " + sAnim);
							return;
						}
						var pIdleAnim: IAnimation = pAnimModel.extractAnimation(0);
						var pCont: IAnimationContainer = animation.createContainer(pIdleAnim, sAnim);
						//pCont.useLoop(true);
						pController.addAnimation(pCont);

						return pCont;
					}

					anim2controller(pController, "ANIM_MINER_IDLE0");
					anim2controller(pController, "ANIM_MINER_IDLE1");
					anim2controller(pController, "ANIM_MINER_IDLE2").enterFrame.connect((pContainer: IAnimationContainer, fRealTime: float, fTime: float): void => {
						if (fTime > pContainer.getDuration()) {
							pController.play.emit("ANIM_MINER_WORK_HAMMER");
						}
					});
					anim2controller(pController, "ANIM_MINER_WALK1");
					anim2controller(pController, "ANIM_MINER_WALK2");
					anim2controller(pController, "ANIM_MINER_WALK3");
					anim2controller(pController, "ANIM_MINER_WORK_GUN");
					anim2controller(pController, "ANIM_MINER_WORK_HAMMER").enterFrame.connect((pContainer: IAnimationContainer, fRealTime: float, fTime: float): void => {
						if (fTime > pContainer.getDuration()) {
							pController.play.emit("ANIM_MINER_IDLE2");
						}
					});

					var pCamRoot = (<IScene3d>pScene).createNode();
					pCamRoot.attachToParent(pScene.getRootNode());
					//pCamRoot.setPosition(-2, 0, 0);

					var pCamCollada = <ICollada>pRmgr.getColladaPool().findResource("CAMERA_ANIM_DAE");
					var pCamColladaRoot = pCamCollada.extractFullScene();
					pCamColladaRoot.attachToParent(pCamRoot);

					var pCamController: IAnimationController = pEngine.createAnimationController();
					var pCamContainer = animation.createContainer(pCamCollada.extractAnimation(0));
					pCamContainer.useLoop(true);
					pCamController.addAnimation(pCamContainer);
					pCamColladaRoot.addController(pCamController);
					pCamController.play.emit(0);
					

					var pCamNode: ISceneNode = <ISceneNode>pCamColladaRoot.findEntity("node-CameraDummy");

					//var pTestCube = addons.cube(pScene);
					//pTestCube.setInheritance(ENodeInheritance.ALL);
					//pTestCube.attachToParent(pCamNode);

					var pAnimCamera = (<IScene3d>pScene).createCamera();
					pAnimCamera.setInheritance(ENodeInheritance.ALL);
					pAnimCamera.attachToParent(pCamNode);

					pAnimCamera.addRelRotationByXYZAxis(0, Math.PI, 0);

					akra["pAnimCamera"] = pAnimCamera;

					pGUI.add({ activeCamera: 'default' }, 'activeCamera', [
						'default',
						'anim'
					]).onChange((sName: string) => {
						if (sName === 'anim') {
							pCamera = pAnimCamera;
							//pCamera.attachToParent(pCamNode);
							//pCamera.setPosition(0., -1, 0.);
							//pCamera.setRotationByXYZAxis(0., Math.PI, 0.);
						}
						else {
							pCamera = pDefaultCamera;
							//pCamera.attachToParent(pScene.getRootNode());
						}

						pViewport.setCamera(pCamera);
					});



					//(<IAnimation>pCont.getAnimation()).extend(<IAnimation>anim2controller(pController, "ANIM_MINER_WORK_HAMMER").getAnimation());


					pGUI.add({ animation: null }, 'animation', [
						'ANIM_MINER_IDLE0',
						'ANIM_MINER_IDLE1',
						'ANIM_MINER_IDLE2',
						'ANIM_MINER_WALK1',
						'ANIM_MINER_WALK2',
						'ANIM_MINER_WALK3',
						'ANIM_MINER_WORK_GUN',
						'ANIM_MINER_WORK_HAMMER'
					]).onChange((sName: string) => {
							if (bMinerModel) {
								pController.play.emit(sName);
							}
						});

					if (bMinerModel) {
						model.addController(pController);
						pController.play.emit("ANIM_MINER_IDLE2");
					}

				},
			},
			character: {
				path: modelsPath + "/character/character.DAE",
				init: function (model) { model.scale(1.5); },
			},
			head: {
				path: modelsPath + "/head/head.DAE",
				init: function (model) {
					model.scale(0.7);
					model.explore(function (node) {
						if (scene.SceneModel.isModel(node)) {
							node.getRenderable().getTechnique().render.connect(applyAlphaTest);
						}
					});
				},
			},
			sponza: {
				path: modelsPath + "/sponza/sponza.DAE",
				init: function (model) { model.scale(1.5); },
			},
			teapot: {
				path: modelsPath + "/teapot.DAE",
				init: function (model) { },
			},
			donut: {
				path: modelsPath + "/Donut.DAE",
				init: function (model) { },
			},
			sphere: {
				path: modelsPath + "/Sphere.DAE",
				init: function (model) { },
			},
			rock: {
				path: modelsPath + "/rock/rock-1-low-p.DAE",
				init: function (model) { model.addPosition(0, 0.8, 0); },
			},
			windspot: {
				path: modelsPath + "/windspot/WINDSPOT.DAE",
				init: function (model) { },
			},
			can: {
				path: modelsPath + "/can/can.DAE",
				init: function (model) { model.addPosition(0, 0.3, 0); },
			},
			building01: {
				path: modelsPath + "/building01/building01.DAE",
				init: function (model) { },
			},
			building02: {
				path: modelsPath + "/building02/building02.DAE",
				init: function (model) { },
			},
			prop01: {
				path: modelsPath + "/prop01/prop01.DAE",
				init: function (model) { model.addPosition(0, 0, 0); },
			},
			prop04: {
				path: modelsPath + "/prop04/prop04.DAE",
				init: function (model) { model.addPosition(0, 0, 0); },
			},
			dress01: {
				path: modelsPath + "/dress01/dress01.DAE",
				init: function (model) { model.addPosition(0, 0, 0); },
			},
		};
		pModels = {};

		var sFirstModelKey = "miner";
		var bMinerModel = true;
		pModels[sFirstModelKey] = loadModel(pModelsFiles[sFirstModelKey].path, pModelsFiles[sFirstModelKey].init, sFirstModelKey, pModelTable).setPosition(0., 0., 0.).addPosition(0., -1000., 0.);
		pCurrentModel = pModels[sFirstModelKey];
		pCurrentModel.addPosition(0., 1000., 0.);

		var pModelsFolder = pGUI.addFolder("models");

		(<dat.OptionController>pModelsFolder.add({ Model: sFirstModelKey }, 'Model', pModelsKeys)).name("Model").onChange((sKey) => {
			pCurrentModel.addPosition(0., -1000., 0.);
			if (pModels[sKey] == null) {
				pModels[sKey] = loadModel(pModelsFiles[sKey].path, pModelsFiles[sKey].init, sKey, pModelTable).setPosition(0., 0., 0.).addPosition(0., -1000., 0.);
			}
			pCurrentModel = pModels[sKey];
			pCurrentModel.addPosition(0., 1000., 0.);

			bMinerModel = (sKey === "miner");
		});

		pCurrentModel.attachToParent(pModelTable);

		pMirror.attachToParent(pModelTable);
		pMirror.setPosition(0., 0., 0.);

		var fCylinderHeight = 0.1;
		var pCylinder = addons.cylinder(pScene, fRadius, fRadius, fCylinderHeight, 96);
		//pCylinder.getRenderable().getTechnique().render.connect(applyAlphaTest);
		pCylinder.attachToParent(pModelTable);
		pCylinder.getRenderable().getMaterial().diffuse = plasticColorDiffuse;
		pCylinder.getRenderable().getMaterial().specular = plasticColorSpecular;
		pCylinder.getRenderable().getMaterial().shininess = 0.7;
		pCylinder.setPosition(0., -fCylinderHeight / 2., 0.);

		//var pQuad = addons.createQuad(pScene, 100);
		//pQuad.attachToParent(pModelTable);
		//pQuad.getRenderable().getMaterial().diffuse = plasticColorDiffuse;
		//pQuad.getRenderable().getMaterial().specular = plasticColorSpecular;
		//pQuad.setPosition(0., -fCylinderHeight, 0.);

		pCanvas.viewportPreUpdate.connect((pTarget: IRenderTarget, pViewport: IViewport) => {
			if (pViewport === akra.pViewport) {
				var normal = pMirror.getTempVectorUp();
				var dist = pMirror.getWorldPosition().dot(normal);
				(<IMirrorViewport>pReflectionViewport).getReflectionPlane().set(normal, dist);
				//if (pMirror.getTempVectorUp().dot(math.Vec3.temp(pCamera.getWorldPosition()).subtract(pMirror.getWorldPosition())) > 0.) {
					pReflectionTexture.getBuffer().getRenderTarget().update();
				//}
			}
		});

		pProgress.destroy();
		pEngine.exec();


		//var pController: IAnimationController = pEngine.createAnimationController();

		//function anim2controller(pController: IAnimationController, sAnim: string): IAnimationContainer {
		//	var pAnimModel: ICollada = <ICollada>pRmgr.getColladaPool().findResource(sAnim);
		//	if (isNull(pAnimModel)) {
		//		console.log("SKIP ANIMATION " + sAnim);
		//		return;
		//	}
		//	var pIdleAnim: IAnimation = pAnimModel.extractAnimation(0);
		//	var pCont: IAnimationContainer = animation.createContainer(pIdleAnim, sAnim);
		//	pCont.useLoop(true);
		//	pController.addAnimation(pCont);

		//	return pCont;
		//}

		//anim2controller(pController, "ANIM_MINER_IDLE0");
		//anim2controller(pController, "ANIM_MINER_IDLE1");
		//anim2controller(pController, "ANIM_MINER_IDLE2");
		//anim2controller(pController, "ANIM_MINER_WALK1");
		//anim2controller(pController, "ANIM_MINER_WALK2");
		//anim2controller(pController, "ANIM_MINER_WALK3");
		//anim2controller(pController, "ANIM_MINER_WORK_GUN");
		//anim2controller(pController, "ANIM_MINER_WORK_HAMMER");

		//pGUI.add({ animation: null }, 'animation', [
		//	'ANIM_MINER_IDLE0',
		//	'ANIM_MINER_IDLE1',
		//	'ANIM_MINER_IDLE2',
		//	'ANIM_MINER_WALK1',
		//	'ANIM_MINER_WALK2',
		//	'ANIM_MINER_WALK3',
		//	'ANIM_MINER_WORK_GUN',
		//	'ANIM_MINER_WORK_HAMMER'
		//]).onChange((sName: string) => {
		//	if (bMinerModel) {
		//		pController.play.emit(sName);
		//	}
		//});

		//if (bMinerModel) {
		//	pCurrentModel.addController(pController);
		//	pController.play.emit(0);			
		//}
	}

	pEngine.depsLoaded.connect(main);
}
