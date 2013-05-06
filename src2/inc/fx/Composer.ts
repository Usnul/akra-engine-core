#ifndef AFXCOMPOSER_TS
#define AFXCOMPOSER_TS

#include "IAFXComposer.ts"
#include "io/files.ts"
#include "IAFXEffect.ts"
#include "fx/Effect.ts"
#include "IEngine.ts"

#ifdef DEBUG

#include "util/EffectParser.ts"
#include "IResourcePool.ts"

#endif

#include "IAFXComponent.ts"
#include "fx/Blender.ts"

#include "IAFXMaker.ts"
#include "util/ObjectArray.ts"

#include "util/BufferMap.ts"
#include "fx/SamplerBlender.ts"
#include "IRenderer.ts"

module akra.fx {

	export interface IPreRenderState {
		isClear: bool;

		primType: EPrimitiveTypes;
		offset: uint;
		length: uint;
		index: IIndexData;
		//flows: IDataFlow[];
		flows: util.ObjectArray;
	}

	export class Composer implements IAFXComposer {
		private _pEngine: IEngine = null;

		private _pTechniqueToBlendMap: IAFXComponentBlendMap = null;
		private _pTechniqueToOwnBlendMap: IAFXComponentBlendMap = null;
		private _pTechniqueLastGlobalBlendMap: IAFXComponentBlendMap = null;
		private _pTechniqueNeedUpdateMap: BoolMap = null;

		private _pEffectResourceToComponentBlendMap: IAFXComponentBlendMap = null;
		private _pBlender: IAFXBlender = null;

		private _pGlobalEffectResorceIdStack: uint[] = null;
		// private _pGlobalEffectResorceShiftStack: int[] = null;
		private _pGlobalComponentBlendStack: IAFXComponentBlend[] = null;
		private _pGlobalComponentBlend: IAFXComponentBlend = null;

		//Data for render
		private _pCurrentSceneObject: ISceneObject = null;
		private _pCurrentViewport: IViewport = null;
		private _pCurrentRenderable: IRenderableObject = null;

		private _pCurrentBufferMap: IBufferMap = null;
		private _pCurrentSurfaceMaterial: ISurfaceMaterial = null;

		private _pComposerState: any = { mesh : { isSkinned : false, isOptimizedSkinned : false },
										 terrain : { isROAM : false } };

		/** Render targets for global-post effects */
		private _pRenderTargetA: IRenderTarget = null;
		private _pRenderTargetB: IRenderTarget = null;
		private _pLastRenderTarget: IRenderTarget = null;

		private _pPostEffectTextureA: ITexture = null;
		private _pPostEffectTextureB: ITexture = null;
		private _pPostEffectDepthBuffer: IPixelBuffer = null;

		//Temporary objects for fast work
		static pDefaultSamplerBlender: SamplerBlender = null;

		constructor(pEngine: IEngine){
			this._pEngine = pEngine;

			this._pBlender = new Blender(this);

			this._pTechniqueToBlendMap = <IAFXComponentBlendMap>{};
			this._pTechniqueToOwnBlendMap = <IAFXComponentBlendMap>{};
			this._pTechniqueLastGlobalBlendMap = <IAFXComponentBlendMap>{};
			this._pTechniqueNeedUpdateMap = <BoolMap>{};

			this._pEffectResourceToComponentBlendMap = <IAFXComponentBlendMap>{};

			this._pGlobalEffectResorceIdStack = [];
			this._pGlobalComponentBlendStack = [];
			this._pGlobalComponentBlend = null;

			this.initPostEffectTextures();


			if(isNull(Composer.pDefaultSamplerBlender)){
				Composer.pDefaultSamplerBlender = new SamplerBlender();
			}
		}

		getComponentByName(sComponentName: string): IAFXComponent {
			return <IAFXComponent>this._pEngine.getResourceManager().componentPool.findResource(sComponentName);
		}

		inline getEngine(): IEngine {
			return this._pEngine;
		}

		//-----------------------------------------------------------------------------//
		//-----------------------------API for Effect-resource-------------------------//
		//-----------------------------------------------------------------------------//
		
		getComponentCountForEffect(pEffectResource: IEffect): uint {
			var id: uint = pEffectResource.resourceHandle;

			if(isDef(this._pEffectResourceToComponentBlendMap[id])) {
				return this._pEffectResourceToComponentBlendMap[id].getComponentCount();
			}
			else {
				return 0;
			}
		}

		getTotalPassesForEffect(pEffectResource: IEffect): uint {
			var id: uint = pEffectResource.resourceHandle;
			
			if(isDef(this._pEffectResourceToComponentBlendMap[id])) {
				return this._pEffectResourceToComponentBlendMap[id].getTotalPasses();
			}
			else {
				return 0;
			}
		}

		addComponentToEffect(pEffectResource: IEffect, pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pEffectResource.resourceHandle;
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pEffectResourceToComponentBlendMap[id])){
				pCurrentBlend = this._pEffectResourceToComponentBlendMap[id];
			}
			
			var pNewBlend: IAFXComponentBlend = this._pBlender.addComponentToBlend(pCurrentBlend, pComponent, iShift, iPass);
			if(isNull(pNewBlend)){
				return false;
			}

			this._pEffectResourceToComponentBlendMap[id] = pNewBlend;
			return true;
		}

		removeComponentFromEffect(pEffectResource: IEffect, pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pEffectResource.resourceHandle;
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pEffectResourceToComponentBlendMap[id])){
				pCurrentBlend = this._pEffectResourceToComponentBlendMap[id];
			}
			
			var pNewBlend: IAFXComponentBlend = this._pBlender.removeComponentFromBlend(pCurrentBlend, pComponent, iShift, iPass);
			if(isNull(pNewBlend)){
				return false;
			}

			this._pEffectResourceToComponentBlendMap[id] = pNewBlend;
			return true;
		}

		hasComponentForEffect(pEffectResource:IEffect, 
							  pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pEffectResource.resourceHandle;
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pEffectResourceToComponentBlendMap[id])){
				pCurrentBlend = this._pEffectResourceToComponentBlendMap[id];
			}

			if(isNull(pCurrentBlend)){
				return false;
			}

			return pCurrentBlend.containComponent(pComponent, iShift, iPass);
		}

		activateEffectResource(pEffectResource: IEffect, iShift: int): bool {
			var id: uint = pEffectResource.resourceHandle;
			var pComponentBlend: IAFXComponentBlend = this._pEffectResourceToComponentBlendMap[id];

			if(!isDef(pComponentBlend)){
				return false
			}

			var pNewGlobalBlend: IAFXComponentBlend = null;

			if(isNull(this._pGlobalComponentBlend)){
				pNewGlobalBlend = pComponentBlend;
			}
			else {
				pNewGlobalBlend = this._pBlender.addBlendToBlend(this._pGlobalComponentBlend, pComponentBlend, iShift);
			}

			if(isNull(pNewGlobalBlend)){
				return false;
			}

			this._pGlobalEffectResorceIdStack.push(id);
			this._pGlobalComponentBlendStack.push(pNewGlobalBlend);

			this._pGlobalComponentBlend = pNewGlobalBlend;

			return true;
		}

		deactivateEffectResource(pEffectResource: IEffect): bool {
			var id: uint = pEffectResource.resourceHandle;
			var iStackLength: uint = this._pGlobalEffectResorceIdStack.length;
			
			if(iStackLength === 0){
				return false;
			}

			var iLastId: uint = this._pGlobalEffectResorceIdStack[iStackLength - 1];

			if(iLastId !== id){
				return false;
			}

			this._pGlobalEffectResorceIdStack.splice(iStackLength - 1, 1);
			this._pGlobalComponentBlendStack.splice(iStackLength - 1, 1);

			if(iStackLength > 1){
				this._pGlobalComponentBlend = this._pGlobalComponentBlendStack[iStackLength - 2];
			}
			else {
				this._pGlobalComponentBlend = null;
			}

			return true;
		}


		//-----------------------------------------------------------------------------//
		//----------------------------API for RenderTechnique--------------------------//
		//-----------------------------------------------------------------------------//

		getTotalPassesForTechnique(pRenderTechnique: IRenderTechnique): uint {
			this.prepareTechniqueBlend(pRenderTechnique);
			
			var id: uint = pRenderTechnique.getGuid();

			if(isDefAndNotNull(this._pTechniqueToBlendMap[id])) {
				return this._pTechniqueToBlendMap[id].getTotalPasses();
			}
			else {
				return 0;
			}
		}
		
		addOwnComponentToTechnique(pRenderTechnique: IRenderTechnique, 
								   pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pRenderTechnique.getGuid();
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pTechniqueToOwnBlendMap[id])){
				pCurrentBlend = this._pTechniqueToOwnBlendMap[id];
			}
			
			var pNewBlend: IAFXComponentBlend = this._pBlender.addComponentToBlend(pCurrentBlend, pComponent, iShift, iPass);
			
			if(isNull(pNewBlend)){
				return false;
			}

			this._pTechniqueToOwnBlendMap[id] = pNewBlend;
			this._pTechniqueNeedUpdateMap[id] = true;

			return true;
		}

		removeOwnComponentToTechnique(pRenderTechnique: IRenderTechnique, 
									  pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pRenderTechnique.getGuid();
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pTechniqueToOwnBlendMap[id])){
				pCurrentBlend = this._pTechniqueToOwnBlendMap[id];
			}
			
			var pNewBlend: IAFXComponentBlend = this._pBlender.removeComponentFromBlend(pCurrentBlend, pComponent, iShift, iPass);
			if(isNull(pNewBlend)){
				return false;
			}

			this._pTechniqueToOwnBlendMap[id] = pNewBlend;
			this._pTechniqueNeedUpdateMap[id] = true;
			return true;
		}

		hasOwnComponentInTechnique(pRenderTechnique: IRenderTechnique, 
								   pComponent: IAFXComponent, iShift: int, iPass: uint): bool {
			var id: uint = pRenderTechnique.getGuid();
			var pCurrentBlend: IAFXComponentBlend = null;

			if(isDef(this._pTechniqueToOwnBlendMap[id])){
				pCurrentBlend = this._pTechniqueToOwnBlendMap[id];
			}

			if(isNull(pCurrentBlend)){
				return false;
			}

			return pCurrentBlend.containComponent(pComponent, iShift, iPass);
		}

		prepareTechniqueBlend(pRenderTechnique: IRenderTechnique): bool {
			if(pRenderTechnique.isFreeze()){
				return true;
			}

			var id: uint = pRenderTechnique.getGuid();

			var isTechniqueUpdate: bool = !!(this._pTechniqueNeedUpdateMap[id]);
			var isUpdateGlobalBlend: bool = (this._pGlobalComponentBlend !== this._pTechniqueLastGlobalBlendMap[id]);
			var isNeedToUpdatePasses: bool = false;

			if(isTechniqueUpdate || isUpdateGlobalBlend){
				var iEffect: uint = pRenderTechnique.getMethod().effect.resourceHandle;
				var pEffectBlend: IAFXComponentBlend = this._pEffectResourceToComponentBlendMap[iEffect] || null;
				var pTechniqueBlend: IAFXComponentBlend = this._pTechniqueToOwnBlendMap[id] || null;

				var pNewBlend: IAFXComponentBlend = null;
				
				pNewBlend = this._pBlender.addBlendToBlend(this._pGlobalComponentBlend, pEffectBlend, 0);
				pNewBlend = this._pBlender.addBlendToBlend(pNewBlend, pTechniqueBlend, 0);

				if(this._pTechniqueToBlendMap[id] !== pNewBlend){
					isNeedToUpdatePasses = true;
				}

				this._pTechniqueToBlendMap[id] = pNewBlend;
				this._pTechniqueNeedUpdateMap[id] = false;
				this._pTechniqueLastGlobalBlendMap[id] = this._pGlobalComponentBlend;
			}

			var pBlend: IAFXComponentBlend = this._pTechniqueToBlendMap[id];

			if(isDefAndNotNull(pBlend)) {
				if(!pBlend.isReadyToUse()){
					isNeedToUpdatePasses = true;
				}

				if(!pBlend.finalizeBlend()){
					return false;
				}

				if(isNeedToUpdatePasses) {
					pRenderTechnique.updatePasses(isTechniqueUpdate);
				}
			}
			else {
				return false;
			}
		}

		markTechniqueAsNeedUpdate(pRenderTechnique: IRenderTechnique): void {
			this._pTechniqueNeedUpdateMap[pRenderTechnique.getGuid()] = true;
		}

		getPassInputBlend(pRenderTechnique: IRenderTechnique, iPass: uint): IAFXPassInputBlend {
			var id: uint = pRenderTechnique.getGuid();

			if(!isDef(this._pTechniqueToBlendMap[id])){
				return null;
			}

			return this._pTechniqueToBlendMap[id].getPassInputForPass(iPass);
		}


		//-----------------------------------------------------------------------------//
		//---------------------------------API for render------------------------------//
		//-----------------------------------------------------------------------------//

		applyBufferMap(pMap: IBufferMap): bool {
			this._pCurrentBufferMap = pMap;
			return true;
			// var pBufferMap: util.BufferMap = <util.BufferMap>pMap;

			// var pState: IPreRenderState = this._pPreRenderState;

			// if(pState.isClear){
			// 	pState.primType = pBufferMap.primType;
			// 	pState.offset = pBufferMap.offset;
			// 	pState.length = pBufferMap.length;
			// 	pState.index = pBufferMap.index;
			// }
			// else if(pState.primType !== pBufferMap.primType ||
			// 		pState.offset !== pBufferMap.offset ||
			// 		pState.length !== pBufferMap.length ||
			// 		pState.index !== pBufferMap.index) {

			// 	ERROR("Could not blend buffer maps");
			// 	return false;
			// }

			// var pFlows: IDataFlow[] = pBufferMap.flows;

			// for(var i: uint = 0; i < pFlows.length; i++){
			// 	pState.flows.push(pFlows[i]);
			// }

			// pState.isClear = false;
		}

		applySurfaceMaterial(pSurfaceMaterial: ISurfaceMaterial): bool {
			this._pCurrentSurfaceMaterial = pSurfaceMaterial;
			return true;
		}

		inline _setCurrentSceneObject(pSceneObject: ISceneObject): void {
			this._pCurrentSceneObject = pSceneObject;
		}

		inline _setCurrentViewport(pViewport: IViewport): void {
			this._pCurrentViewport = pViewport;
		}

		inline _setCurrentRenderableObject(pRenderable: IRenderableObject): void {
			this._pCurrentRenderable = pRenderable;
		}

		inline _getCurrentSceneObject(): ISceneObject {
			return this._pCurrentSceneObject;
		}

		inline _getCurrentViewport(): IViewport {
			return this._pCurrentViewport;
		}

		inline _getCurrentRenderableObject(): IRenderableObject {
			return this._pCurrentRenderable;
		}

		_setDefaultCurrentState(): void {
			this._setCurrentViewport(null);
			this._setCurrentRenderableObject(null);
			this._setCurrentSceneObject(null);
		}


		renderTechniquePass(pRenderTechnique: IRenderTechnique, iPass: uint): void {
			// if(true){
			// 	return;
			// }
			var pPass: IRenderPass = pRenderTechnique.getPass(iPass);
			var pPassInput: IAFXPassInputBlend = pPass.getPassInput();

			var pPassBlend: IAFXPassBlend = null;
			var pMaker: IAFXMaker = null;

			this.applySystemUnifoms(pPassInput);
			
			if(!pPassInput._isNeedToCalcShader()){
				//TODO: set pShader to shader program by id
			}
			else {
				if(!pPassInput._isNeedToCalcBlend()){
					pPassBlend = this._pBlender.getPassBlendById(pPassInput._getLastPassBlendId());
				}
				else {
					var id: uint = pRenderTechnique.getGuid();
					var pComponentBlend: IAFXComponentBlend = this._pTechniqueToBlendMap[id];
					var pPassInstructionList: IAFXPassInstruction[] = pComponentBlend.getPassListAtPass(iPass);

					this.prepareComposerState();

					pPassBlend = this._pBlender.generatePassBlend(pPassInstructionList, this._pComposerState, 
																  pPassInput.foreigns, pPassInput.uniforms);
				}

				if(isNull(pPassBlend)){
					ERROR("Could not render. Error with generation pass-blend.");
					return;
				}

				pMaker = pPassBlend.generateFXMaker(pPassInput, 
													this._pCurrentSurfaceMaterial, 
													this._pCurrentBufferMap);

				//TODO: generate additional shader params and get shader program
			}

			//TODO: generate input from PassInputBlend to correct unifoms and attributes list
			//TODO: generate RenderEntry
				
			//this.clearPreRenderState();
			var pInput: IShaderInput = pMaker._make(pPassInput, this._pCurrentBufferMap);
			var pRenderer: IRenderer = this._pEngine.getRenderer();
			var pEntry: IRenderEntry = pRenderer.createEntry();

			pEntry.maker = pMaker;
			pEntry.input = pInput;
			pEntry.viewport = this._pCurrentViewport;
			pEntry.bufferMap = this._pCurrentBufferMap;

			if(pRenderTechnique.hasGlobalPostEffect()){
				if(!pRenderTechnique.isFirstPass(iPass)){
					pRenderer._setDepthBufferParams(false, false, 0);
					
					pRenderer._setRenderTarget(this._pRenderTargetA);
					pRenderer.clearFrameBuffer(EFrameBufferTypes.COLOR | EFrameBufferTypes.DEPTH, Color.ZERO, 1., 0);

					if(pEntry.viewport.getClearEveryFrame()){
						var pViewportState: IViewportState = pEntry.viewport._getViewportState();
						pRenderer.clearFrameBuffer(pViewportState.clearBuffers, 
												   pViewportState.clearColor,
												   pViewportState.clearDepth, 0);

					}
					
				}

				if (pEntry.viewport.actualWidth > this._pRenderTargetA.width ||
					pEntry.viewport.actualHeight > this._pRenderTargetA.height)
				{
					this.resizePostEffectTextures(pEntry.viewport.actualWidth, pEntry.viewport.actualHeight);
				}

				if(!pRenderTechnique.isPostEffectPass(iPass)){
					this._pLastRenderTarget = this._pRenderTargetA;
					pEntry.renderTarget = this._pRenderTargetA;
				}
				else {
					if(pRenderTechnique.isLastPass(iPass)){
						this._pLastRenderTarget = null;
						// pEntry.renderTarget = null;
					}
					else {
						if(this._pLastRenderTarget === this._pRenderTargetA){
							pEntry.renderTarget = this._pRenderTargetB;
							this._pLastRenderTarget = this._pRenderTargetB;
						}
						else {
							pEntry.renderTarget = this._pRenderTargetA;
							this._pLastRenderTarget = this._pRenderTargetA;
						}
					}
				}
			}

			pRenderer.pushEntry(pEntry);
		}

		//-----------------------------------------------------------------------------//
		//-----------------------API for load components/AFXEffects--------------------//
		//-----------------------------------------------------------------------------//

#ifdef DEBUG
		_loadEffectFromSyntaxTree(pTree: IParseTree, sFileName: string): bool {
			var pEffect: IAFXEffect = new fx.Effect(this);
			// LOG(sFileName, pTree);
			pEffect.setAnalyzedFileName(sFileName);
			// LOG("\n\n\n-------------------------Try to analyze '" + sFileName + "'-------------");
			var isOk: bool = pEffect.analyze(pTree);

			if(isOk){
				// LOG("------ANALYZE IS GOOD '" + sFileName + "'.")
				var pTechniqueList: IAFXTechniqueInstruction[] = pEffect.getTechniqueList();

				for(var i: uint = 0; i < pTechniqueList.length; i++){
					isOk = this.initComponent(pTechniqueList[i]);
					if(!isOk){
						WARNING("Cannot initialize fx-component from technique '" + pTechniqueList[i].getName() + "'.");
						return false;
					}
				}
			}
			else {
				WARNING("Error are occured during analyze of effect file '" + sFileName + "'.");
				return false;
			}

			return true;
		}
#endif

		_loadEffectFromBinary(pData: Uint8Array, sFileName: string): bool {
			return false;
		}

		private initComponent(pTechnique: IAFXTechniqueInstruction): bool {
			var sTechniqueName: string = pTechnique.getName();
			var pComponentPool: IResourcePool = this._pEngine.getResourceManager().componentPool;

			if(!isNull(pComponentPool.findResource(sTechniqueName))){
				return false;
			}

			var pComponent: IAFXComponent = <IAFXComponent>pComponentPool.createResource(sTechniqueName);
			pComponent.create();
			pComponent.setTechnique(pTechnique);

			return true;
		}

		private clearPreRenderState(): void {
			// this._pPreRenderState.primType = 0;
			// this._pPreRenderState.offset = 0;
			// this._pPreRenderState.length = 0;
			// this._pPreRenderState.index = null;
			// this._pPreRenderState.flows.clear(false);

			// this._pPreRenderState.isClear = true;
		}

		protected bNormalFix: bool = true;
		protected bUseNormalMap: bool = true;
		protected bIsDebug: bool = false;
		protected bIsRealNormal: bool = false;
		protected bTerrainBlackSectors: bool = false;

		private applySystemUnifoms(pPassInput: IAFXPassInputBlend): void {
			var pSceneObject: ISceneObject = this._getCurrentSceneObject();
			var pViewport: IViewport = this._getCurrentViewport();
			var pRenderable: IRenderableObject = this._getCurrentRenderableObject();

			if(!isNull(pSceneObject)){
				pPassInput.setUniform("MODEL_MATRIX", pSceneObject.worldMatrix);
			}

			if(!isNull(pViewport)){

				pPassInput.setUniform("FRAMEBUFFER_SIZE", vec2(pViewport.width, pViewport.height));

				var pCamera: ICamera = pViewport.getCamera();
				if(!isNull(pCamera)) { 
					pPassInput.setUniform("VIEW_MATRIX", pCamera.viewMatrix);
					pPassInput.setUniform("PROJ_MATRIX", pCamera.projectionMatrix);
					pPassInput.setUniform("INV_VIEW_CAMERA_MAT", pCamera.worldMatrix);
					pPassInput.setUniform("CAMERA_POSITION", pCamera.worldPosition);

					if(pCamera.type === EEntityTypes.SHADOW_CASTER){
						pPassInput.setUniform("OPTIMIZED_PROJ_MATRIX", (<IShadowCaster>pCamera).optimizedProjection);
					}
				}
			}

			if(!isNull(pRenderable)){
				if(render.isMeshSubset(pRenderable) && (<IMeshSubset>pRenderable).isSkinned()){
					pPassInput.setUniform("BIND_SHAPE_MATRIX", (<IMeshSubset>pRenderable).skin.getBindMatrix());
				}

				pPassInput.setUniform("RENDER_OBJECT_ID", pRenderable.getGuid());
			}

			if(!isNull(this._pLastRenderTarget)){
				var pLastTexture: ITexture = this._pLastRenderTarget === this._pRenderTargetA ? 
												this._pPostEffectTextureA : this._pPostEffectTextureB;

				pPassInput.setTexture("INPUT_TEXTURE", pLastTexture);
				pPassInput.setSamplerTexture("INPUT_SAMPLER", pLastTexture);
				pPassInput.setUniform("INPUT_TEXTURE_SIZE", vec2(pLastTexture.width, pLastTexture.height));
				pPassInput.setUniform("INPUT_TEXTURE_RATIO", 
							vec2(this._pCurrentViewport.actualWidth / pLastTexture.width,
								 this._pCurrentViewport.actualHeight / pLastTexture.height));
			}

			pPassInput.setUniform("useNormal", this.bUseNormalMap);
			pPassInput.setUniform("isDebug", this.bIsDebug);
			pPassInput.setUniform("isRealNormal", this.bIsRealNormal);
			pPassInput.setUniform("normalFix", this.bNormalFix);
			pPassInput.setUniform("isWithBalckSectors", this.bTerrainBlackSectors);
		}

		private prepareComposerState(): void {
			if(!isNull(this._pCurrentRenderable)){
				if(render.isMeshSubset(this._pCurrentRenderable) && (<IMeshSubset>this._pCurrentRenderable).isSkinned()){
					this._pComposerState.mesh.isSkinned = true;
					if((<IMeshSubset>this._pCurrentRenderable).isOptimizedSkinned()){
						this._pComposerState.mesh.isOptimizedSkinned = true;
					}
					else{
						this._pComposerState.mesh.isOptimizedSkinned = false;	
					}
				}
				else {
					this._pComposerState.mesh.isSkinned = false;
					this._pComposerState.mesh.isOptimizedSkinned = false;
				}
			}

			if(!isNull(this._pCurrentSceneObject)){
				if(this._pCurrentSceneObject.type === EEntityTypes.TERRAIN_ROAM){
					this._pComposerState.terrain.isROAM = true;
				}
				else {
					this._pComposerState.terrain.isROAM = false;
				}
			}
		}

		private initPostEffectTextures(): void{
			var pRmgr: IResourcePoolManager = this._pEngine.getResourceManager();
			this._pPostEffectTextureA = pRmgr.createTexture(".global-post-effect-texture-A");
			this._pPostEffectTextureB = pRmgr.createTexture(".global-post-effect-texture-B");

			this._pPostEffectTextureA.create(512, 512, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
								   ETextureTypes.TEXTURE_2D, EPixelFormats.R8G8B8A8);

			this._pPostEffectTextureB.create(512, 512, 1, null, ETextureFlags.RENDERTARGET, 0, 0,
								   ETextureTypes.TEXTURE_2D, EPixelFormats.R8G8B8A8);

			this._pRenderTargetA = this._pPostEffectTextureA.getBuffer().getRenderTarget();
			this._pRenderTargetB = this._pPostEffectTextureB.getBuffer().getRenderTarget();

			this._pPostEffectDepthBuffer = <webgl.WebGLInternalRenderBuffer>pRmgr.renderBufferPool.createResource(".global-post-effect-depth");
			(<webgl.WebGLInternalRenderBuffer>this._pPostEffectDepthBuffer).create(GL_DEPTH_COMPONENT, 512, 512, false);

			this._pRenderTargetA.attachDepthPixelBuffer(this._pPostEffectDepthBuffer);
		}

		private resizePostEffectTextures(iWidth: uint, iHeight: uint): void {
			iWidth = math.ceilingPowerOfTwo(iWidth);
			iHeight = math.ceilingPowerOfTwo(iHeight);
			
			this._pPostEffectTextureA.reset(iWidth, iHeight);
			this._pPostEffectTextureB.reset(iWidth, iHeight);		
		}
	}
}

#endif