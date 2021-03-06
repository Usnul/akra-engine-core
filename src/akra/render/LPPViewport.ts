﻿/// <reference path="../idl/ILPPViewport.ts" />
/// <reference path="ShadedViewport.ts" />
/// <reference path="../scene/Scene3d.ts" />
/// <reference path="LightingUniforms.ts" />
/// <reference path="ViewportWithTransparencyMode.ts" />

module akra.render {
	import Vec2 = math.Vec2;
	import Vec3 = math.Vec3;
	import Vec4 = math.Vec4;
	import Mat4 = math.Mat4;

	import Color = color.Color;

	var pDepthPixel: IPixelBox = new pixelUtil.PixelBox(new geometry.Box(0, 0, 1, 1), EPixelFormats.FLOAT32_DEPTH, new Uint8Array(4 * 1));
	var pFloatColorPixel: IPixelBox = new pixelUtil.PixelBox(new geometry.Box(0, 0, 1, 1), EPixelFormats.FLOAT32_RGBA, new Uint8Array(4 * 4));
	var pColor: IColor = new Color(0);

	export class LPPViewport extends ShadedViewport implements ILPPViewport {
		addedSkybox: ISignal<{ (pViewport: IViewport, pSkyTexture: ITexture): void; }>;

		/** Buffer with normal, shininess and objectID */
		private _pNormalBufferTexture: ITexture = null;

		/** 
		* 0 - Diffuse and specular 
		* 1 - Ambient and shadow
		*/
		private _pLightBufferTextures: ITexture[] = null;
		/** Resyult of LPP with out posteffects */
		private _pResultLPPTexture: ITexture = null;

		private _pViewScreen: IRenderableObject = null;
		private _v2fTextureRatio: IVec2 = null;
		private _v2fScreenSize: IVec2 = null;

		private _pHighlightedObject: IRIDPair = { object: null, renderable: null };
		private _pSkyboxTexture: ITexture = null;
		private _eFogType: EFogType = EFogType.NONE;
		
		
		constructor(pCamera: ICamera, fLeft: float = 0., fTop: float = 0., fWidth: float = 1., fHeight: float = 1., iZIndex: int = 0) {
			super(pCamera, null, fLeft, fTop, fWidth, fHeight, iZIndex);
		}

		protected setupSignals(): void {
			this.addedSkybox = this.addedSkybox || new Signal(this);

			super.setupSignals();
		}

		setBackgroundColor(cColor: IColor): void {
			super.setBackgroundColor(cColor);
			this._pResultLPPTexture.getBuffer().getRenderTarget().getViewport(0).setBackgroundColor(cColor);
		}

		getType(): EViewportTypes {
			return EViewportTypes.LPPVIEWPORT;
		} 

		getView(): IRenderableObject {
			return this._pViewScreen;
		}
		
		getEffect(): IEffect {
			return this.getView().getRenderMethodDefault().getEffect();
		}

		getSkybox(): ITexture {
			return this._pSkyboxTexture;
		}

		getTextureWithObjectID(): ITexture {
			return this._pNormalBufferTexture;
		}

		setShadingModel(eModel: EShadingModel) {
			super.setShadingModel(eModel);

			if (eModel === EShadingModel.PBS_SIMPLE) {
				this._pViewScreen.getRenderMethodByName("passA").setForeign("PREPARE_ONLY_POSITION", false);
			}

			if (isDefAndNotNull(this._pTextureForTransparentObjects)) {
				(<IShadedViewport>this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0)).setShadingModel(eModel);
			}
		}


		setDefaultEnvironmentMap(pEnvMap: ITexture): void {
			super.setDefaultEnvironmentMap(pEnvMap);

			if (isDefAndNotNull(this._pTextureForTransparentObjects)) {
				(<IShadedViewport>this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0)).setDefaultEnvironmentMap(pEnvMap);
			}
		}

		setTransparencySupported(bEnable: boolean): void {
			super.setTransparencySupported(bEnable);

			if (isDefAndNotNull(this._pNormalBufferTexture)) {
				(<ViewportWithTransparencyMode>this._pNormalBufferTexture.getBuffer().getRenderTarget().getViewport(0)).setTransparencyMode(!bEnable);
				(<ViewportWithTransparencyMode>this._pResultLPPTexture.getBuffer().getRenderTarget().getViewport(0)).setTransparencyMode(!bEnable);
			}

			if (bEnable && isNull(this._pTextureForTransparentObjects)) {
				this.initTextureForTransparentObjects();
			}

			(<IViewportFogged>this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0)).setFog(this._eFogType);

			if (bEnable) {
				this.getEffect().addComponent("akra.system.applyTransparency", 3, 0);
			}
			else {
				this.getEffect().addComponent("akra.system.applyTransparency", 3, 0);
			}

		}

		_getTransparencyViewport(): IShadedViewport {
			return this.isTransparencySupported() ? <IShadedViewport>this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0) : null;
		}

		_setTarget(pTarget: IRenderTarget): void {
			super._setTarget(pTarget);

			//common api access
			var pEngine: IEngine = pTarget.getRenderer().getEngine();
			var pResMgr: IResourcePoolManager = pEngine.getResourceManager();

			//renderable for displaying result from deferred textures
			this._pViewScreen = new Screen(pEngine.getRenderer());

			//unique idetifier for creation dependent resources
			var iGuid: int = this.guid;

			//Float point texture must be power of two.
			var iWidth: uint = math.ceilingPowerOfTwo(this.getActualWidth());
			var iHeight: uint = math.ceilingPowerOfTwo(this.getActualHeight());

			//detect max texture resolution correctly
			if (config.WEBGL) {
				iWidth = math.min(iWidth, webgl.maxTextureSize);
				iHeight = math.min(iHeight, webgl.maxTextureSize);
			}

			this.createNormalBufferRenderTarget(iWidth, iHeight);
			this.createLightBuffersRenderTargets(iWidth, iHeight);
			this.createResultLPPRenderTarget(iWidth, iHeight);

			this._v2fTextureRatio = new math.Vec2(this.getActualWidth() / this._pNormalBufferTexture.getWidth(), this.getActualHeight() / this._pNormalBufferTexture.getHeight());
			this._v2fScreenSize = new Vec2(this.getActualWidth(), this.getActualHeight());

			this.prepareRenderMethods();

			this.setClearEveryFrame(false);
			this.setBackgroundColor(color.ZERO);
			this.setDepthParams(false, false, 0);

			this.setFXAA(true);

			this.setTransparencySupported(this.isTransparencySupported());
		}

		setCamera(pCamera: ICamera): boolean {
			var isOk = super.setCamera(pCamera);
			this._pNormalBufferTexture.getBuffer().getRenderTarget().getViewport(0).setCamera(pCamera);
			this._pLightBufferTextures[0].getBuffer().getRenderTarget().getViewport(0).setCamera(pCamera);
			this._pLightBufferTextures[1].getBuffer().getRenderTarget().getViewport(0).setCamera(pCamera);
			this._pResultLPPTexture.getBuffer().getRenderTarget().getViewport(0).setCamera(pCamera);
			return isOk;
		}

		_getRenderId(x: int, y: int): int {
			logger.assert(x < this.getActualWidth() && y < this.getActualHeight(),
				"invalid pixel: {" + x + "(" + this.getActualWidth() + ")" + ", " + y + "(" + this.getActualHeight() + ")" + "}");

			var pColorTexture: ITexture = this._pNormalBufferTexture;

			//depth texture has POT sized, but viewport not;
			//depth texture attached to left bottom angle of viewport
			y = pColorTexture.getHeight() - y - 1;
			pFloatColorPixel.left = x;
			pFloatColorPixel.top = y;
			pFloatColorPixel.right = x + 1;
			pFloatColorPixel.bottom = y + 1;

			pColorTexture.getBuffer(0, 0).readPixels(pFloatColorPixel);

			return pFloatColorPixel.getColorAt(pColor, 0, 0).a;
		}

		_updateDimensions(bEmitEvent: boolean = true): void {
			super._updateDimensions(false);

			if (isDefAndNotNull(this._pNormalBufferTexture)) {
				this.updateRenderTextureDimensions(this._pNormalBufferTexture);
				this.updateRenderTextureDimensions(this._pLightBufferTextures[0]);
				this.updateRenderTextureDimensions(this._pLightBufferTextures[1]);
				this.updateRenderTextureDimensions(this._pResultLPPTexture);

				this.getDepthTexture().reset(math.ceilingPowerOfTwo(this.getActualWidth()), math.ceilingPowerOfTwo(this.getActualHeight()));

				this._v2fTextureRatio.set(this.getActualWidth() / this._pNormalBufferTexture.getWidth(), this.getActualHeight() / this._pNormalBufferTexture.getHeight());
				this._v2fScreenSize.set(this.getActualWidth(), this.getActualHeight());
			}

			if (isDefAndNotNull(this._pTextureForTransparentObjects)) {
				//this._pTextureForTransparentObjects.reset(math.ceilingPowerOfTwo(this.getActualWidth()), math.ceilingPowerOfTwo(this.getActualHeight()));

				//this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0)
				//	.setDimensions(0., 0., this.getActualWidth() / this._pTextureForTransparentObjects.getWidth(), this.getActualHeight() / this._pTextureForTransparentObjects.getHeight());
				this.updateRenderTextureDimensions(this._pTextureForTransparentObjects);
			}

			if (bEmitEvent) {
				this.viewportDimensionsChanged.emit();
			}
		}

		_updateImpl(): void {
			var pRenderer: IRenderer = this.getTarget().getRenderer();

			this.prepareForLPPShading();
			//prepare normal buffer texture
			this._pNormalBufferTexture.getBuffer().getRenderTarget().update();

			//camera last viewport changed, because camera used in normal buffer textures updating
			this._pCamera._keepLastViewport(this);

			//render light map
			var pLights: IObjectArray<ILightPoint> = <IObjectArray<any>>this.getCamera().display(scene.Scene3d.DL_LIGHTING);

			if (this.isShadowEnabled() && !this._isManualUpdateForLightUniforms()) {
				for (var i: int = 0; i < pLights.getLength(); i++) {
					pLights.value(i)._calculateShadows();
				}
			}

			this._pLightPoints = pLights;
			this.createLightingUniforms(this.getCamera(), this._pLightPoints, this._pLightingUnifoms);

			//render deferred
			this._pViewScreen.render(this._pLightBufferTextures[0].getBuffer().getRenderTarget().getViewport(0), "passA");
			//pRenderer.executeQueue(false);
			if (this.getShadingModel() === EShadingModel.PHONG || this.getShadingModel() === EShadingModel.PBS_SIMPLE) {
				this._pViewScreen.render(this._pLightBufferTextures[1].getBuffer().getRenderTarget().getViewport(0), "passB");
			}

			pRenderer.executeQueue(false);

			//var pRenderViewport: IViewport = this._pResultLPPTexture.getBuffer().getRenderTarget().getViewport(0);
			//var pState: IViewportState = this._getViewportState();

			if(this.isTransparencySupported()) {
				this._pTextureForTransparentObjects.getBuffer().getRenderTarget().update();
			}

			this._pResultLPPTexture.getBuffer().getRenderTarget().update();

			this._pViewScreen.render(this);
			this._pCamera._keepLastViewport(this);
			pRenderer.executeQueue(false);
			//this.renderAsNormal("apply_lpp_shading", this.getCamera());
		}

		setSkybox(pSkyTexture: ITexture): boolean {
			if (pSkyTexture.getTextureType() !== ETextureTypes.TEXTURE_CUBE_MAP) {
				return null;
			}

			var pEffect: IEffect = this.getEffect();

			if (pSkyTexture) {
				pEffect.addComponent("akra.system.skybox", 1, 0);
			}
			else {
				pEffect.delComponent("akra.system.skybox", 1, 0);
			}

			this._pSkyboxTexture = pSkyTexture;

			this.addedSkybox.emit(pSkyTexture);

			return true;
		}

		setFXAA(bValue: boolean = true): void {
			var pEffect: IEffect = this.getEffect();

			if (bValue) {
				pEffect.addComponent("akra.system.fxaa", 4, 0);
			}
			else {
				pEffect.delComponent("akra.system.fxaa", 4, 0);
			}
		}

		isFXAA(): boolean {
			return this.getEffect().hasComponent("akra.system.fxaa");
		}

		setAntialiasing(bEnabled: boolean = true): void {
			this.setFXAA(bEnabled);
		}

		isAntialiased(): boolean {
			return this.isFXAA();
		}

		setFog(eFogType: EFogType = EFogType.LINEAR): void {
			this._eFogType = eFogType;

			if (this.isTransparencySupported()) {
				(<IViewportFogged>this._pTextureForTransparentObjects.getBuffer().getRenderTarget().getViewport(0)).setFog(eFogType);
			}
		}

		isFogged(): boolean {
			return this._eFogType !== EFogType.NONE;
		}

		highlight(iRid: int): void;
		highlight(pObject: ISceneObject, pRenderable?: IRenderableObject): void;
		highlight(pPair: IRIDPair): void;
		highlight(a): void {
			var pComposer: IAFXComposer = this.getTarget().getRenderer().getEngine().getComposer();
			var pEffect: IEffect = this.getEffect();
			var iRid: int = 0;
			var p: IRIDPair = this._pHighlightedObject;
			var pObjectPrev: ISceneObject = p.object;

			if (isNull(arguments[0])) {
				p.object = null;
				p.renderable = null;
			}
			else if (isInt(arguments[0])) {
				iRid = a;
				p.object = pComposer._getObjectByRid(iRid);
				p.renderable = pComposer._getRenderableByRid(iRid);
			}
			else if (arguments[0] instanceof akra.scene.SceneObject) {
				p.object = arguments[0];
				p.renderable = arguments[1];
			}
			else {
				p.object = arguments[0].object;
				p.renderable = arguments[0].renderable;
			}

			if (p.object && isNull(pObjectPrev)) {
				pEffect.addComponent("akra.system.outline", 1, 0);
			}
			else if (isNull(p.object) && pObjectPrev) {
				pEffect.delComponent("akra.system.outline", 1, 0);

				//FIX ME: Need do understood how to know that skybox added like single effect, and not as imported component
				if (!isNull(this._pSkyboxTexture)) {
					pEffect.addComponent("akra.system.skybox", 1, 0);
				}
			}
		}

		_onNormalBufferRender(pViewport: IViewport, pTechnique: IRenderTechnique, iPass: uint, pRenderable: IRenderableObject, pSceneObject: ISceneObject): void {
			var pPass: IRenderPass = pTechnique.getPass(iPass);

			pPass.setForeign("OPTIMIZE_FOR_LPP_PREPARE", true);
		}

		_onLightMapRender(pViewport: IViewport, pTechnique: IRenderTechnique, iPass: uint, pRenderable: IRenderableObject, pSceneObject: ISceneObject): void {
			var pPass: IRenderPass = pTechnique.getPass(iPass);

			var pLightUniforms: UniformMap = this._pLightingUnifoms;
			var pLightPoints: IObjectArray<ILightPoint> = this._pLightPoints;
			var pCamera: ICamera = this.getCamera();

			pPass.setForeign("NUM_OMNI", pLightUniforms.omni.length);
			pPass.setForeign("NUM_OMNI_SHADOWS", pLightUniforms.omniShadows.length);
			pPass.setForeign("NUM_PROJECT", pLightUniforms.project.length);
			pPass.setForeign("NUM_PROJECT_SHADOWS", pLightUniforms.projectShadows.length);
			pPass.setForeign("NUM_SUN", pLightUniforms.sun.length);
			pPass.setForeign("NUM_SUN_SHADOWS", pLightUniforms.sunShadows.length);

			pPass.setForeign("NUM_OMNI_RESTRICTED", pLightUniforms.omniRestricted.length);

			pPass.setStruct("points_omni", pLightUniforms.omni);
			pPass.setStruct("points_project", pLightUniforms.project);
			pPass.setStruct("points_omni_shadows", pLightUniforms.omniShadows);
			pPass.setStruct("points_project_shadows", pLightUniforms.projectShadows);
			pPass.setStruct("points_sun", pLightUniforms.sun);
			pPass.setStruct("points_sun_shadows", pLightUniforms.sunShadows);

			pPass.setStruct("points_omni_restricted", pLightUniforms.omniRestricted);

			//for (var i: int = 0; i < pLightUniforms.textures.length; i++) {
			//	pPass.setTexture("TEXTURE" + i, pLightUniforms.textures[i]);
			//}

			pPass.setUniform("PROJECT_SHADOW_SAMPLER", pLightUniforms.samplersProject);
			pPass.setUniform("OMNI_SHADOW_SAMPLER", pLightUniforms.samplersOmni);
			pPass.setUniform("SUN_SHADOW_SAMPLER", pLightUniforms.samplersSun);

			pPass.setUniform("MIN_SHADOW_VALUE", 0.5);
			pPass.setUniform("SHADOW_CONSTANT", 5.e+2);

			pPass.setTexture("LPP_DEPTH_BUFFER_TEXTURE", this.getDepthTexture());
			pPass.setTexture("LPP_NORMAL_BUFFER_TEXTURE", this._pNormalBufferTexture);
			pPass.setUniform("SCREEN_TEXTURE_RATIO", this._v2fTextureRatio);

			pPass.setForeign("IS_USED_PNONG", this.getShadingModel() === EShadingModel.PHONG);
			pPass.setForeign("IS_USED_BLINN_PNONG", this.getShadingModel() === EShadingModel.BLINNPHONG);
			pPass.setForeign("IS_USED_PBS_SIMPLE", this.getShadingModel() === EShadingModel.PBS_SIMPLE);

			pPass.setUniform("NUM_LIGHTS_WITH_PBS", pLightUniforms.omni.length +
				pLightUniforms.omniShadows.length +
				pLightUniforms.project.length +
				pLightUniforms.projectShadows.length +
				pLightUniforms.sun.length +
				pLightUniforms.sunShadows.length);
		}

		_onObjectsRender(pViewport: IViewport, pTechnique: IRenderTechnique, iPass: uint, pRenderable: IRenderableObject, pSceneObject: ISceneObject): void {
			var pPass: IRenderPass = pTechnique.getPass(iPass);

			pPass.setUniform("SCREEN_TEXTURE_RATIO", this._v2fTextureRatio);
			pPass.setTexture("LPP_LIGHT_BUFFER_A", this._pLightBufferTextures[0]);
			pPass.setTexture("LPP_LIGHT_BUFFER_B", this._pLightBufferTextures[1]);
			pPass.setTexture("LPP_NORMAL_BUFFER_TEXTURE", this._pNormalBufferTexture);

			pPass.setUniform("SCREEN_SIZE", this._v2fScreenSize);
			pPass.setForeign("OPTIMIZE_FOR_LPP_APPLY", true);

			pPass.setForeign("IS_USED_PNONG", this.getShadingModel() === EShadingModel.PHONG);
			pPass.setForeign("IS_USED_BLINN_PNONG", this.getShadingModel() === EShadingModel.BLINNPHONG);
			pPass.setForeign("IS_USED_PBS_SIMPLE", this.getShadingModel() === EShadingModel.PBS_SIMPLE);

			if (isDefAndNotNull(this.getDefaultEnvironmentMap())) {
				pPass.setForeign("IS_USED_PBS_REFLECTIONS", true);
				pPass.setForeign("IS_USED_SKYBOX_LIGHTING", true);
				pPass.setTexture("ENVMAP", this.getDefaultEnvironmentMap());
			}
			else {
				pPass.setForeign("IS_USED_PBS_REFLECTIONS", false);
				pPass.setForeign("IS_USED_SKYBOX_LIGHTING", false);
			}
		}

		_onRender(pTechnique: IRenderTechnique, iPass: uint, pRenderable: IRenderableObject, pSceneObject: ISceneObject): void {
			var pPass: IRenderPass = pTechnique.getPass(iPass);

			switch (iPass) {
				case 0:
					pPass.setUniform("VIEWPORT", math.Vec4.temp(0., 0., this._v2fTextureRatio.x, this._v2fTextureRatio.y));
					pPass.setTexture("TEXTURE_FOR_SCREEN", this._pResultLPPTexture);
					pPass.setForeign("SAVE_ALPHA", true);
					break;
				case 1:
				case 2:
				case 3:
					//fog
					pPass.setTexture("DEPTH_TEXTURE", this.getDepthTexture());
					pPass.setForeign("FOG_TYPE", this._eFogType);
					//transparency
					pPass.setTexture("TRANSPARENT_TEXTURE", this._pTextureForTransparentObjects);
					//skybox
					pPass.setTexture("OBJECT_ID_TEXTURE", this._pNormalBufferTexture);
					pPass.setTexture("SKYBOX_TEXTURE", this._pSkyboxTexture);
					//outline
					var p: IRIDPair = this._pHighlightedObject;

					if (!isNull(p.object)) {
						var iRid: int = this.getTarget().getRenderer().getEngine().getComposer()._calcRenderID(p.object, p.renderable);

						pPass.setUniform("OUTLINE_TARGET", iRid);
						pPass.setUniform("OUTLINE_SOID", (iRid - 1) >>> 10);
						pPass.setUniform("OUTLINE_REID", (iRid - 1) & 1023);
					}

					pPass.setUniform("SCREEN_TEXTURE_RATIO", this._v2fTextureRatio);
					break;
			}

			super._onRender(pTechnique, iPass, pRenderable, pSceneObject);
		}

		endFrame(): void {
			this.getTarget().getRenderer().executeQueue(false);
		}


		getDepth(x: int, y: int): float {
			logger.assert(x < this.getActualWidth() && y < this.getActualHeight(), "invalid pixel: {" + x + ", " + y + "}");

			var pDepthTexture: ITexture = this.getDepthTexture();

			y = pDepthTexture.getHeight() - y - 1;
			pDepthPixel.left = x;
			pDepthPixel.top = y;
			pDepthPixel.right = x + 1;
			pDepthPixel.bottom = y + 1;

			pDepthTexture.getBuffer(0, 0).readPixels(pDepthPixel);

			return pDepthPixel.getColorAt(pColor, 0, 0).r;
		}
		
		private createNormalBufferRenderTarget(iWidth: uint, iHeight: uint): void {
			var pEngine: IEngine = this._pTarget.getRenderer().getEngine();
			var pResMgr: IResourcePoolManager = pEngine.getResourceManager();

			var pNormalBufferTexture: ITexture = pResMgr.createTexture("lpp-normal-buffer-" + this.guid);
			var pRenderTarget: IRenderTarget = null;
			var pViewport: IViewport = null;

			pNormalBufferTexture.create(iWidth, iHeight, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
				ETextureTypes.TEXTURE_2D, EPixelFormats.FLOAT32_RGBA);
			pRenderTarget = pNormalBufferTexture.getBuffer().getRenderTarget();
			pRenderTarget.setAutoUpdated(false);
			pViewport = pRenderTarget.addViewport(new ViewportWithTransparencyMode(this.getCamera(), this._csDefaultRenderMethod + "lpp_normal_pass",
				0, 0, this.getActualWidth() / pNormalBufferTexture.getWidth(), this.getActualHeight() / pNormalBufferTexture.getHeight()));

			var pDepthTexture = pResMgr.createTexture(".lpp-depth-buffer-" + this.guid);
			pDepthTexture.create(iWidth, iHeight, 1, null, 0, 0, 0, ETextureTypes.TEXTURE_2D, EPixelFormats.DEPTH32);
			pDepthTexture.setFilter(ETextureParameters.MAG_FILTER, ETextureFilters.LINEAR);
			pDepthTexture.setFilter(ETextureParameters.MIN_FILTER, ETextureFilters.LINEAR);

			pRenderTarget.attachDepthTexture(pDepthTexture);

			pViewport.render.connect(this._onNormalBufferRender);
			this._pNormalBufferTexture = pNormalBufferTexture;
			this.setDepthTexture(pDepthTexture);
		}

		private createLightBuffersRenderTargets(iWidth: uint, iHeight: uint): void {
			var pEngine: IEngine = this._pTarget.getRenderer().getEngine();
			var pResMgr: IResourcePoolManager = pEngine.getResourceManager();

			var pRenderTarget: IRenderTarget = null;
			var pViewport: IViewport = null;
			var pLightMapTexture: ITexture = null;

			this._pLightBufferTextures = new Array(2);

			for (var i: uint = 0; i < 2; i++) {
				pLightMapTexture = pResMgr.createTexture("lpp-light-buffer-" + i + "-" + this.guid);
				pLightMapTexture.create(iWidth, iHeight, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
					ETextureTypes.TEXTURE_2D, EPixelFormats.FLOAT32_RGBA);
				pRenderTarget = pLightMapTexture.getBuffer().getRenderTarget();
				pRenderTarget.setAutoUpdated(false);
				pViewport = pRenderTarget.addViewport(new Viewport(this.getCamera(), null,
					0, 0, this.getActualWidth() / pLightMapTexture.getWidth(), this.getActualHeight() / pLightMapTexture.getHeight()));

				pViewport.render.connect(this, this._onLightMapRender);
				this._pLightBufferTextures[i] = pLightMapTexture;
			}
		}

		private createResultLPPRenderTarget(iWidth: uint, iHeight: uint): void {
			var pEngine: IEngine = this._pTarget.getRenderer().getEngine();
			var pResMgr: IResourcePoolManager = pEngine.getResourceManager();

			var pRenderTarget: IRenderTarget = null;
			var pViewport: IViewport = null;

			this._pResultLPPTexture = pResMgr.createTexture("resultr-lpp-texture-" + this.guid);
			this._pResultLPPTexture.create(iWidth, iHeight, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
				ETextureTypes.TEXTURE_2D, EPixelFormats.R8G8B8A8);
			pRenderTarget = this._pResultLPPTexture.getBuffer().getRenderTarget();
			pRenderTarget.setAutoUpdated(false);
			pRenderTarget.attachDepthTexture(this.getDepthTexture());
			pViewport = pRenderTarget.addViewport(new ViewportWithTransparencyMode(this.getCamera(), this._csDefaultRenderMethod + "apply_lpp_shading",
				0, 0, this.getActualWidth() / this._pResultLPPTexture.getWidth(), this.getActualHeight() / this._pResultLPPTexture.getHeight()));
			pViewport.setClearEveryFrame(true, EFrameBufferTypes.COLOR);
			pViewport.setDepthParams(true, false, ECompareFunction.EQUAL);

			pViewport.render.connect(this, this._onObjectsRender);
		}

		private prepareRenderMethods(): void {
			this._pViewScreen.switchRenderMethod(null);
			this._pViewScreen.getEffect().addComponent("akra.system.texture_to_screen");
			this._pViewScreen.getEffect().addComponent("akra.system.fog", 2, 0);
			//this._pViewScreen.getEffect().addComponent("akra.system.applyTransparency", 2, 0);

			for (var i: uint = 0; i < 2; i++) {
				var sRenderMethod: string = i === 0 ? ".prepare_diffuse_specular" : ".prepare_ambient";
				var sName: string = i === 0 ? "passA" : "passB";

				if (this._pViewScreen.addRenderMethod(sRenderMethod, sName)) {
					var pLPPMethod: IRenderMethod = this._pViewScreen.getRenderMethodByName(sName);
					var pLPPEffect: IEffect = pLPPMethod.getEffect();

					pLPPEffect.addComponent("akra.system.prepare_lpp_lights_base");
					pLPPEffect.addComponent("akra.system.omniLighting");
					pLPPEffect.addComponent("akra.system.omniLightingRestricted");
					pLPPEffect.addComponent("akra.system.projectLighting");
					pLPPEffect.addComponent("akra.system.omniShadowsLighting");
					pLPPEffect.addComponent("akra.system.projectShadowsLighting");
					pLPPEffect.addComponent("akra.system.sunLighting");
					pLPPEffect.addComponent("akra.system.sunShadowsLighting");

					pLPPMethod.setForeign("PREPARE_ONLY_POSITION", this.getShadingModel() !== EShadingModel.PBS_SIMPLE && i === 1);
					pLPPMethod.setForeign("IS_FOR_LPP_PASS0", i === 0);
					pLPPMethod.setForeign("IS_FOR_LPP_PASS1", i === 1);
					pLPPMethod.setForeign("IS_FOR_REAL_SHADING", false);
					pLPPMethod.setForeign("SKIP_ALPHA", false);
					pLPPMethod.setSurfaceMaterial(null);
				}
				else {
					logger.critical("Cannot initialize LPPViewport(problem with '" + sRenderMethod + "' pass)");
				}
			}
		}

		private updateRenderTextureDimensions(pTexture: ITexture) {
			pTexture.reset(math.ceilingPowerOfTwo(this.getActualWidth()), math.ceilingPowerOfTwo(this.getActualHeight()));
			pTexture.getBuffer().getRenderTarget().getViewport(0).setDimensions(0., 0., this.getActualWidth() / pTexture.getWidth(), this.getActualHeight() / pTexture.getHeight());
		}

		private prepareForLPPShading(): void {
			var pNodeList: IObjectArray<ISceneObject> = this.getCamera().display();

			for (var i: int = 0; i < pNodeList.getLength(); ++i) {
				var pSceneObject: ISceneObject = pNodeList.value(i);

				for (var k: int = 0; k < pSceneObject.getTotalRenderable(); k++) {
					var pRenderable: IRenderableObject = pSceneObject.getRenderable(k);
					var pTechCurr: IRenderTechnique = pRenderable.getTechnique(this._csDefaultRenderMethod);

					var sMethod: string = this._csDefaultRenderMethod + "lpp_normal_pass";
					var pTechnique: IRenderTechnique = null;

					if (isNull(pRenderable.getTechnique(sMethod))) {
						if (!pRenderable.addRenderMethod(pRenderable.getRenderMethodByName(this._csDefaultRenderMethod), sMethod)) {
							logger.critical("cannot create render method for first pass of LPP");
						}

						pTechnique = pRenderable.getTechnique(sMethod);
						pTechnique.render._syncSignal(pTechCurr.render);
						pTechnique.copyTechniqueOwnComponentBlend(pTechCurr);
						pTechnique.getMethod().setSurfaceMaterial(pTechCurr.getMethod().getSurfaceMaterial());
						pTechnique.addComponent("akra.system.prepare_lpp_geometry");
					}

					sMethod = this._csDefaultRenderMethod + "apply_lpp_shading";

					if (isNull(pRenderable.getTechnique(sMethod))) {
						if (!pRenderable.addRenderMethod(pRenderable.getRenderMethodByName(this._csDefaultRenderMethod), sMethod)) {
							logger.critical("cannot create render method for first pass of LPP");
						}

						pTechnique = pRenderable.getTechnique(sMethod);
						pTechnique.render._syncSignal(pTechCurr.render);
						pTechnique.copyTechniqueOwnComponentBlend(pTechCurr);
						pTechnique.getMethod().setSurfaceMaterial(pTechCurr.getMethod().getSurfaceMaterial());
						pTechnique.addComponent("akra.system.apply_lpp_shading");
						pTechnique.addComponent("akra.system.pbsSkyboxLighting");
						pTechnique.addComponent("akra.system.pbsReflection");
					}
				}
			}
		}
	}
}