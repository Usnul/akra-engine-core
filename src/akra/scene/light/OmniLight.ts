/// <reference path="../../idl/ITexture.ts" />
/// <reference path="../../util/ObjectArray.ts" />
/// <reference path="../../geometry/Plane3d.ts" />
/// <reference path="../../geometry/classify/classify.ts" />
/// <reference path="ShadowCaster.ts" />
/// <reference path="CalculatePlanesForLighting.ts" />

module akra.scene.light {
	import Scene3d = scene.Scene3d;

	import Color = color.Color;

	import Vec3 = math.Vec3;
	import Mat4 = math.Mat4;

	export class OmniParameters implements IOmniParameters {
		ambient: IColor = new Color;
		diffuse: IColor = new Color;
		specular: IColor = new Color;
		attenuation: IVec3 = new Vec3;
	}


	export class OmniLight extends LightPoint implements IOmniLight {
		protected _pDepthTextureCube: ITexture[] = null;
		protected _pColorTextureCube: ITexture[] = null;
		protected _pLightParameters: IOmniParameters = new OmniParameters;
		protected _pShadowCasterCube: IShadowCaster[] = null;

		constructor(pScene: IScene3d) {
			super(pScene, ELightTypes.OMNI);

			this._pShadowCasterCube = new Array(6);

			for (var i: int = 0; i < 6; i++) {
				this._pShadowCasterCube[i] = pScene._createShadowCaster(this, i);
			}
		}

		getParams(): IOmniParameters {
			return this._pLightParameters;
		}

		isShadowCaster(): boolean {
			return this._isShadowCaster;
		}

		/**
		 * overridden setter isShadow caster,
		 * if depth textures don't created then create depth textures
		 */
		setShadowCaster(bValue: boolean): void {
			this._isShadowCaster = bValue;
			if (bValue && isNull(this._pDepthTextureCube)) {
				this.initializeTextures();
			}
		}

		getLightingDistance(): float {
			return this._pShadowCasterCube[0].getFarPlane();
		}

		setLightingDistance(fDistance): void {
			var pCube: IShadowCaster[] = this._pShadowCasterCube;
			for (var i: int = 0; i < 6; i++) {
				pCube[i].setFarPlane(fDistance);
			}
		}

		getDepthTextureCube(): ITexture[] {
			return this._pDepthTextureCube;
		}

		getRenderTarget(iFace: uint): IRenderTarget {
			// return this._pDepthTextureCube[iFace].getBuffer().getRenderTarget();
			return this._pColorTextureCube[iFace].getBuffer().getRenderTarget();
		}

		getShadowCaster(): IShadowCaster[] {
			return this._pShadowCasterCube;
		}

		create(isShadowCaster: boolean = true, iMaxShadowResolution: uint = 256): boolean {
			var isOk: boolean = super.create(isShadowCaster, iMaxShadowResolution);



			var pCasterCube: IShadowCaster[] = this._pShadowCasterCube;
			var pCaster: IShadowCaster;

			for (var i = 0; i < 6; i++) {
				pCaster = pCasterCube[i];
				pCaster.setInheritance(ENodeInheritance.ALL);
				pCaster.attachToParent(this);
				pCaster.setProjParams(math.PI / 2, 1, 0.01, 1000);
				pCaster.setParameter(ECameraParameters.CONST_ASPECT, true);
			}

			//POSITIVE_X
			pCasterCube[0].setLocalMatrix(Mat4.temp(
				[0, 0, 1, 0, /*first column, not row!*/
					0, 1, 0, 0,
					-1, 0, 0, 0,
					0, 0, 0, 1
				]));

			//NEGATIVE_X
			pCasterCube[1].setLocalMatrix(Mat4.temp(
				[0, 0, -1, 0, /*first column, not row!*/
					0, 1, 0, 0,
					1, 0, 0, 0,
					0, 0, 0, 1
				]));

			//POSITIVE_Y
			pCasterCube[2].setLocalMatrix(Mat4.temp(
				[1, 0, 0, 0, /*first column, not row!*/
					0, 0, 1, 0,
					0, -1, 0, 0,
					0, 0, 0, 1
				]));

			//NEGATIVE_Y
			pCasterCube[3].setLocalMatrix(Mat4.temp(
				[1, 0, 0, 0, /*first column, not row!*/
					0, 0, -1, 0,
					0, 1, 0, 0,
					0, 0, 0, 1
				]));

			//POSITIVE_Z
			pCasterCube[4].setLocalMatrix(Mat4.temp(
				[-1, 0, 0, 0, /*first column, not row!*/
					0, 1, 0, 0,
					0, 0, -1, 0,
					0, 0, 0, 1
				]));

			//NEGATIVE_Z
			pCasterCube[5].setLocalMatrix(Mat4.temp(
				[1, 0, 0, 0, /*first column, not row!*/
					0, 1, 0, 0,
					0, 0, 1, 0,
					0, 0, 0, 1
				]));

			if (this.isShadowCaster()) {
				this.initializeTextures();
			}

			return isOk;
		}

		private initializeTextures(): void {
			var pEngine: IEngine = this.getScene().getManager().getEngine();
			var pResMgr: IResourcePoolManager = pEngine.getResourceManager();
			var iSize: uint = this._iMaxShadowResolution;

			this._pDepthTextureCube = new Array(6);
			this._pColorTextureCube = new Array(6);

			for (var i: int = 0; i < 6; ++i) {

				// if (this._pDepthTextureCube[i]) {
				// 	this._pDepthTextureCube[i].destroyResource();
				// }

				var pDepthTexture: ITexture = this._pDepthTextureCube[i] =
					pResMgr.createTexture("depth_texture_" + i + "_" + this.guid);
				pDepthTexture.create(iSize, iSize, 1, null, 0,
					0, 0, ETextureTypes.TEXTURE_2D, EPixelFormats.DEPTH32);

				pDepthTexture.setWrapMode(ETextureParameters.WRAP_S, ETextureWrapModes.CLAMP_TO_EDGE);
				pDepthTexture.setWrapMode(ETextureParameters.WRAP_T, ETextureWrapModes.CLAMP_TO_EDGE);
				pDepthTexture.setFilter(ETextureParameters.MAG_FILTER, ETextureFilters.LINEAR);
				pDepthTexture.setFilter(ETextureParameters.MIN_FILTER, ETextureFilters.LINEAR);

				var eColorFormat: EPixelFormats = EPixelFormats.A4R4G4B4;

				var pColorTexture: ITexture = this._pColorTextureCube[i] =
					pResMgr.createTexture("light_color_texture_" + i + "_" + this.guid);
				pColorTexture.create(iSize, iSize, 1, null, ETextureFlags.RENDERTARGET,
					0, 0, ETextureTypes.TEXTURE_2D, eColorFormat);

				//TODO: Multiple render target
				this.getRenderTarget(i).attachDepthTexture(pDepthTexture);
				this.getRenderTarget(i).setAutoUpdated(false);
				this.getRenderTarget(i).addViewport(new render.ShadowViewport(this._pShadowCasterCube[i]));
			}
		}

		_calculateShadows(): void {
			if (this.isEnabled() && this.isShadowCaster()) {
				for (var i: uint = 0; i < 6; i++) {
					this.getRenderTarget(i).update();
				}
			}
		}

		_prepareForLighting(pCamera: ICamera): boolean {
			if (!this.isEnabled()) {
				return false;
			}
			else {

				/*************************************************************/
				//optimize camera frustum
				var pDepthRange: IDepthRange = pCamera.getDepthRange();

				var fFov: float = pCamera.getFOV();
				var fAspect: float = pCamera.getAspect();

				var m4fTmp: IMat4 = Mat4.perspective(fFov, fAspect, -pDepthRange.min, -pDepthRange.max, Mat4.temp());

				this.getOptimizedCameraFrustum().extractFromMatrix(m4fTmp, pCamera.getWorldMatrix());
				/*************************************************************/

				var haveInfluence: boolean = false;
				if (!this.isShadowCaster()) {
					for (var i = 0; i < 6; i++) {
						var pResult: IObjectArray<ISceneObject> = this._defineLightingInfluence(pCamera, i);
						if (pResult.getLength() !== 0) {
							haveInfluence = true;
						}
					}
					return haveInfluence;
				}
				else {
					for (var i = 0; i < 6; i++) {
						var pResult: IObjectArray<ISceneObject> = this._defineShadowInfluence(pCamera, i);
						if (pResult.getLength() !== 0) {
							haveInfluence = true;
						}
					}
					return haveInfluence;
				}
			}
		}

		protected _defineLightingInfluence(pCamera: ICamera, iFace: int): IObjectArray<ISceneObject> {
			var pShadowCaster: IShadowCaster = this._pShadowCasterCube[iFace];
			var pCameraFrustum: IFrustum = this.getOptimizedCameraFrustum();
			// var pCameraFrustum: IFrustum = pCamera.frustum;

			var pResult: IObjectArray<ISceneObject> = pShadowCaster.getAffectedObjects();
			pResult.clear();

			//fast test on frustum intersection
			if (!pCameraFrustum.testFrustum(pShadowCaster.getFrustum())) {
				//frustums don't intersecting
				return pResult;
			}

			var pRawResult: IObjectArray<ISceneObject> = pShadowCaster.display(scene.Scene3d.DL_DEFAULT);

			for (var i: int = 0; i < pRawResult.getLength(); i++) {
				var pObject: ISceneObject = pRawResult.value(i);

				if (pCameraFrustum.testRect(pObject.getWorldBounds())) {
					pResult.push(pObject);
				}
			}

			return pResult;
		}

		protected _defineShadowInfluence(pCamera: ICamera, iFace: int): IObjectArray<ISceneObject> {
			var pShadowCaster: IShadowCaster = this._pShadowCasterCube[iFace];
			var pCameraFrustum: IFrustum = this.getOptimizedCameraFrustum();

			var pResult: IObjectArray<ISceneObject> = pShadowCaster.getAffectedObjects();
			pResult.clear();

			//fast test on frustum intersection
			if (!pCameraFrustum.testFrustum(pShadowCaster.getFrustum())) {
				//frustums don't intersecting
				pShadowCaster._optimizeProjectionMatrix(pCameraFrustum);
				return pResult;
			}

			var pRawResult: IObjectArray<ISceneObject> = pShadowCaster.display(scene.Scene3d.DL_DEFAULT);

			var pTestArray: IPlane3d[] = OmniLight._pFrustumPlanes;
			var pFrustumPlanesKeys: string[] = geometry.Frustum.frustumPlanesKeys;

			calculatePlanesForFrustumLighting(
				pShadowCaster.getFrustum(), pShadowCaster.getWorldPosition(),
				pCameraFrustum, pTestArray);

			var v3fMidPoint: IVec3 = Vec3.temp();
			var v3fShadowDir: IVec3 = Vec3.temp();
			var v3fCameraDir: IVec3 = Vec3.temp();

			for (var i: int = 0; i < pRawResult.getLength(); i++) {
				var pObject: ISceneObject = pRawResult.value(i);
				var pWorldBounds: IRect3d = pObject.getWorldBounds();

				//have object shadows?
				if (pObject.getShadow()) {
					var j: int = 0;
					for (j = 0; j < 6; j++) {
						var pPlane: IPlane3d = pTestArray[j];

						if (geometry.classify.planeRect3d(pPlane, pWorldBounds)
							== EPlaneClassifications.PLANE_FRONT) {
							break;
						}
					}

					if (j == 6) {
						//discard shadow by distance?

						pWorldBounds.midPoint(v3fMidPoint);

						v3fMidPoint.subtract(pShadowCaster.getWorldPosition(), v3fShadowDir);
						v3fMidPoint.subtract(pCamera.getWorldPosition(), v3fCameraDir);

						if (v3fCameraDir.dot(v3fShadowDir) > 0 &&
							pWorldBounds.distanceToPoint(pCamera.getWorldPosition()) >= config.render.shadows.discardDistance) {
						}
						else {
							pResult.push(pObject);
						}
					}
				}
				else {
					if (pCameraFrustum.testRect(pWorldBounds)) {
						pResult.push(pObject);
					}
				}

			}

			pShadowCaster._optimizeProjectionMatrix(pCameraFrustum);

			return pResult;
		}

		//list of frustum planes with which additional testing must be done.
		//created just for prevent reallocation
		static _pFrustumPlanes: IPlane3d[] = new Array(6);/*new geometry.Plane3d[];*/
	}

	for (var i: int = 0; i < 6; i++) {
		OmniLight._pFrustumPlanes[i] = new geometry.Plane3d();
	}
}

