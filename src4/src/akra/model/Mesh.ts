/// <reference path="../idl/IMesh.ts" />
/// <reference path="../idl/IReferenceCounter.ts" />
/// <reference path="../idl/ISkeleton.ts" />
/// <reference path="../idl/IRect3d.ts" />
/// <reference path="../idl/ISphere.ts" />
/// <reference path="../idl/IEngine.ts" />
/// <reference path="../idl/IMaterial.ts" />
/// <reference path="../idl/IVertexData.ts" />
/// <reference path="../idl/IMeshSubset.ts" />
/// <reference path="../idl/ISkin.ts" />
/// <reference path="../idl/IRenderDataCollection.ts" />
/// <reference path="../idl/ISceneNode.ts" />
/// <reference path="../idl/ISceneModel.ts" />

/// <reference path="Skin.ts" />
/// <reference path="MeshSubset.ts" />

/// <reference path="../material/materials.ts" />
/// <reference path="../util/ReferenceCounter.ts" />
/// <reference path="../events.ts" />

/// <reference path="../guid.ts" />

module akra.model {
	import VE = data.VertexElement;
	import DeclUsages = data.Usages;
	import Color = color.Color;

	class ShadowedSignal
		extends Signal<{
			(pMesh: IMesh, pSubset: IMeshSubset, bShadow: boolean): void;
		}, IMesh> {

		constructor(pViewport: IMesh) {
			super(pViewport, EEventTypes.UNICAST);
		}

		emit(pSubMesh?: IMeshSubset, bShadow?: boolean): void {

			var pMesh: Mesh = <Mesh>this.getSender();

			pMesh._setShadow(bShadow)

			if (!bShadow) {
				for (var i: int = 0; i < pMesh.getLength(); ++i) {
					if (pMesh.getSubset(i).getShadow()) {
						pMesh._setShadow(true);
						break;
					}
				}
			}

			super.emit(pSubMesh, bShadow);
		}
	}

	class Mesh extends util.ReferenceCounter implements IMesh  {
		guid: uint = guid();

		shadowed: ISignal<{(pMesh: IMesh, pSubset: IMeshSubset, bShadow: boolean): void;}>;

		private _sName: string;
		private _pBuffer: IRenderDataCollection = null;
		private _pEngine: IEngine;
		private _eOptions: int = 0;
		private _pSkeleton: ISkeleton = null;
		private _pBoundingBox: IRect3d = null;
		private _pBoundingSphere: ISphere = null;
		private _pSubMeshes: IMeshSubset[] = [];
		private _bShadow: boolean = true;
		private _pSkinList: ISkin[] = [];
		
		constructor(pEngine: IEngine, eOptions: int, sName: string, pDataBuffer: IRenderDataCollection) {
			super();
			this.setupSignals();

			this._sName = sName || null;
			this._pEngine = pEngine;
			this.setup(sName, eOptions, pDataBuffer);
		}

		protected setupSignals(): void {
			this.shadowed = this.shadowed || new ShadowedSignal(this);
		}

		getLength(): uint {
			return this._pSubMeshes.length;
		}

		getName(): string{
			return this._sName;
		}

		getData(): IRenderDataCollection {
			return this._pBuffer;
		}

		getBoundingBox(): IRect3d {
			if (isNull(this._pBoundingBox)) {
				if (!this.createBoundingBox()) {
					logger.warn("could not compute bounding box fo mesh");
				}
			}

			return this._pBoundingBox;
		}

		getBoundingSphere(): ISphere {
			if (isNull(this._pBoundingSphere)) {
				if (!this.createBoundingSphere()) {
					logger.warn("could not compute bounding sphere for mesh");
				}
			}

			return this._pBoundingSphere;
		}

		getSkeleton(): ISkeleton {
			return this._pSkeleton;
		}

		setSkeleton(pSkeleton: ISkeleton): void {
			this._pSkeleton = pSkeleton;
		}

		getShadow(): boolean {
			return this._bShadow;
		}

		setShadow(bValue: boolean): void {
			for (var i: int = 0; i < this._pSubMeshes.length; ++i) {
				this._pSubMeshes[i].setShadow(bValue);
			}
		}

		getOptions(): int {
			return this._eOptions;
		}

		getEngine(): IEngine {
			return this._pEngine;
		}

		_drawSubset(iSubset: int): void {
			this._pBuffer._draw(iSubset);
		}

		_draw(): void {
			for (var i: int = 0; i < this.getLength(); i++) {
				this._pSubMeshes[i]._draw();
			};
		}

		isReadyForRender(): boolean {
			for (var i: int = 0; i < this._pSubMeshes.length; ++ i) {
				if (this._pSubMeshes[i].isReadyForRender()) {
					return true;
				}
			}
			
			return false;
		}

		private setup(sName: string, eOptions: int, pDataCollection?: IRenderDataCollection): boolean {
			debug.assert(this._pBuffer === null, "mesh already setuped.");

			if (isNull(pDataCollection)) {
				this._pBuffer = this._pEngine.createRenderDataCollection(eOptions);
			}
			else {
				debug.assert (pDataCollection.getEngine() === this.getEngine(), 
					"you can not use a buffer with a different context");
				
				this._pBuffer = pDataCollection;
				eOptions |= pDataCollection.getOptions();
			}
			
			this._pBuffer.addRef();
			this._eOptions = eOptions || 0;
			this._sName = sName || config.unknown.name;

			return true;
		}

		createSubset(sName: string, ePrimType: EPrimitiveTypes, eOptions: int = 0): IMeshSubset {
			var pData: IRenderData;
			//TODO: modify options and create options for data dactory.
			pData = this._pBuffer.getEmptyRenderData(ePrimType/*EPrimitiveTypes.POINTLIST*/, eOptions);
			pData.addRef();

			if (isNull(pData)) {
				return null;
			}
			
			return this.appendSubset(sName, pData);
		}

		appendSubset(sName: string, pData: IRenderData): IMeshSubset {
			debug.assert(pData.getBuffer() === this._pBuffer, "invalid data used");

			var pSubMesh: IMeshSubset = new MeshSubset(this, pData, sName);
			this._pSubMeshes.push(pSubMesh);

			pSubMesh.skinAdded.connect(this, this._skinAdded);
			pSubMesh.shadowed.connect(this.shadowed);

			//this.connect(pSubMesh, SIGNAL(skinAdded), SLOT(_skinAdded));
			//this.connect(pSubMesh, SIGNAL(shadowed), SLOT(shadowed), EEventTypes.UNICAST);

			return pSubMesh;
		}

		_skinAdded(pSubMesh: IMeshSubset, pSkin: ISkin): void {
			if (this._pSkinList.indexOf(pSkin) != -1) {
				return;
			}

			this._pSkinList.push(pSkin);
		}


		freeSubset(sName: string): boolean {
			debug.error("Метод freeSubset не реализован");
			return false;
		}

		destroy(): void {
			this._pSubMeshes = null;
			this._pBuffer.destroy(/*this*/);
		}

		getSubset(sName: string): IMeshSubset;
		getSubset(n: uint): IMeshSubset;
		getSubset(n: any): IMeshSubset {
			if (isInt(arguments[0])) {
				return this._pSubMeshes[arguments[0]] || null;
			}
			else {
				for (var i = 0; i < this.getLength(); ++ i) {
					if (this._pSubMeshes[i].getName() == <string>arguments[0]) {
						return this._pSubMeshes[i];
					}
				}
			}

			return null;
		}

		setSkin(pSkin: ISkin): void {
			for (var i = 0; i < this.getLength(); ++ i) {
				this._pSubMeshes[i].setSkin(pSkin);
			}
		}

		createSkin(): ISkin {
			var pSkin: ISkin = createSkin(this);
			return pSkin;
		}

		clone(iCloneOptions: int): IMesh {
			var pClone: IMesh = null;
			var pRenderData: IRenderData;
			var pSubMesh: IMeshSubset;

			if (iCloneOptions & EMeshCloneOptions.SHARED_GEOMETRY) {
				pClone = this.getEngine().createMesh(this.getName(), this.getOptions(), this.getData());
				
				for (var i = 0; i < this.getLength(); ++ i) {
					pRenderData = this._pSubMeshes[i].getData();
					pRenderData.addRef();
					pClone.appendSubset(this._pSubMeshes[i].getName(), pRenderData);
					pClone.getSubset(i).getMaterial().name = this._pSubMeshes[i].getMaterial().name;
				}
				//trace('created clone', pClone);
			}
			else {
				//TODO: clone mesh data.
			}

			if (iCloneOptions & EMeshCloneOptions.GEOMETRY_ONLY) {
				return pClone;
			}
			else {
				//TODO: clone mesh shading
			}

			return pClone;
		}

		createAndShowSubBoundingBox(): void {
			for (var i = 0; i < this.getLength(); i++) {
				var pSubMesh: IMeshSubset = this.getSubset(i);
				if (pSubMesh.createBoundingBox()) {
					if (!pSubMesh.showBoundingBox()) {
						logger.error("could not show sub bounding box");
					}
				}
				else {
					logger.error("could not create sub bounding box.");
				}
				//console.log("SubMesh" + i);
			}
		}

		createAndShowSubBoundingSphere(): void {
			for (var i = 0; i < this.getLength(); i ++) {
				var pSubMesh: IMeshSubset = this.getSubset(i);
				pSubMesh.createBoundingSphere();
				pSubMesh.showBoundingSphere();
				//console.log("SubMesh" + i);
			}
		}

		createBoundingBox(): boolean {
			var pVertexData: IVertexData;
			var pSubMesh: IMeshSubset;
			var pNewBoundingBox: IRect3d;
			var pTempBoundingBox: IRect3d;
			var i: int;

			pNewBoundingBox = new geometry.Rect3d();
			pTempBoundingBox = new geometry.Rect3d();

			pSubMesh = this.getSubset(0);
			pVertexData = pSubMesh.getData()._getData(DeclUsages.POSITION);
			
			if(isNull(pVertexData)) {
				return false;
			}

			if(geometry.computeBoundingBox(pVertexData, pNewBoundingBox)== false)
				return false;

			if (pSubMesh.isSkinned()) {
				pNewBoundingBox.transform(pSubMesh.getSkin().getBindMatrix());    
				pNewBoundingBox.transform(pSubMesh.getSkin().getBoneOffsetMatrix(pSubMesh.getSkin().getSkeleton().getRoot().getBoneName()));    
			}

			for (i = 1; i < this.getLength(); i++) {

				pSubMesh = this.getSubset(i);
				pVertexData = pSubMesh.getData()._getData(DeclUsages.POSITION);
				//trace(pSubMesh.name);
				
				if(!pVertexData) {
					return false;
				}
				
				if(geometry.computeBoundingBox(pVertexData, pTempBoundingBox) == false) {
					return false;
				}

				//trace('>>> before box >>');
				if (pSubMesh.isSkinned()) {
					//trace('calc skinned box');
					pTempBoundingBox.transform(pSubMesh.getSkin().getBindMatrix());     
					pTempBoundingBox.transform(pSubMesh.getSkin().getBoneOffsetMatrix(pSubMesh.getSkin().getSkeleton().getRoot().getBoneName())); 
				}
		   // trace('<<< after box <<');

				pNewBoundingBox.x0 = Math.min(pNewBoundingBox.x0, pTempBoundingBox.x0);
				pNewBoundingBox.y0 = Math.min(pNewBoundingBox.y0, pTempBoundingBox.y0);
				pNewBoundingBox.z0 = Math.min(pNewBoundingBox.z0, pTempBoundingBox.z0);

				pNewBoundingBox.x1 = Math.max(pNewBoundingBox.x1, pTempBoundingBox.x1);
				pNewBoundingBox.y1 = Math.max(pNewBoundingBox.y1, pTempBoundingBox.y1);
				pNewBoundingBox.z1 = Math.max(pNewBoundingBox.z1, pTempBoundingBox.z1);
			}

			this._pBoundingBox = pNewBoundingBox;
			return true;
		}

		deleteBoundingBox(): boolean {
			this._pBoundingBox = null;
			return true;
		}

		showBoundingBox(): boolean {
			var pSubMesh: IMeshSubset;
			var pMaterial: IMaterial;
			var iData: int;
			var pPoints: float[], pIndexes: uint[];

			if(isNull(this._pBoundingBox)) {
				if (!this.createBoundingBox()) {
					return false;
				}
			}

			pPoints = new Array();
			pIndexes = new Array();

			geometry.computeDataForCascadeBoundingBox(this._pBoundingBox, pPoints, pIndexes, 0.1);

			pSubMesh = this.getSubset(".BoundingBox");
			
			if(!pSubMesh) {
				pSubMesh = this.createSubset(".BoundingBox", EPrimitiveTypes.LINELIST, EHardwareBufferFlags.STATIC);
				
				if(isNull(pSubMesh)) {
					debug.error("could not create bounding box subset...");
					return false;
				}

				iData = pSubMesh.getData().allocateData([VE.float3(DeclUsages.POSITION)], new Float32Array(pPoints));

				pSubMesh.getData().allocateIndex([VE.float(DeclUsages.INDEX0)], new Float32Array(pIndexes));

				pSubMesh.getData().index(iData, DeclUsages.INDEX0);

				pMaterial = pSubMesh.getMaterial();
				pMaterial.emissive = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.diffuse = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.ambient = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.specular = new Color(1.0, 1.0, 1.0, 1.0);

				pSubMesh.getEffect().addComponent("akra.system.mesh_texture");
				pSubMesh.setShadow(false);
			}
			else {
				pSubMesh.getData()._getData(DeclUsages.POSITION).setData(new Float32Array(pPoints), DeclUsages.POSITION);
			}

			pSubMesh.getData().setRenderable(pSubMesh.getData().getIndexSet(), true);
			return true;
		}

		hideBoundingBox(): boolean {
			var pSubMesh: IMeshSubset = this.getSubset(".BoundingBox");
			
			if(!pSubMesh) {
				return false;
			}

			//TODO: hide bounding box!!
			pSubMesh.getData().setRenderable(pSubMesh.getData().getIndexSet(), false);
			return true;
		}

		isBoundingBoxVisible(): boolean {
			var pSubMesh: IMeshSubset = this.getSubset(".BoundingBox");
			
			if(!pSubMesh) {
				return false;
			}

			return pSubMesh.getData().isRenderable(pSubMesh.getData().getIndexSet());
		}

		createBoundingSphere(): boolean {
			var pVertexData: IVertexData;
			var pSubMesh: IMeshSubset;
			var pNewBoundingSphere: ISphere, 
				pTempBoundingSphere: ISphere;
			var i: int;

			pNewBoundingSphere = new geometry.Sphere();
			pTempBoundingSphere = new geometry.Sphere();


			pSubMesh = this.getSubset(0);
			pVertexData = pSubMesh.getData()._getData(DeclUsages.POSITION);
			
			if(!pVertexData) {
				return false;
			}


			if(geometry.computeBoundingSphere(pVertexData, pNewBoundingSphere) == false) {
				return false;
			}

			if (pSubMesh.isSkinned()) {
				pNewBoundingSphere.transform(pSubMesh.getSkin().getBindMatrix());    
				pNewBoundingSphere.transform(pSubMesh.getSkin().getBoneOffsetMatrix(pSubMesh.getSkin().getSkeleton().getRoot().getBoneName()));    
			}

			for (i = 1; i < this.getLength(); i++) {

				pSubMesh = this.getSubset(i);
				pVertexData = pSubMesh.getData()._getData(DeclUsages.POSITION);
				
				if(isNull(pVertexData))
					return false;

				if(geometry.computeBoundingSphere(pVertexData, pTempBoundingSphere) == false)
					return false;


				if (pSubMesh.isSkinned()) {
					pTempBoundingSphere.transform(pSubMesh.getSkin().getBindMatrix());    
					pTempBoundingSphere.transform(pSubMesh.getSkin().getBoneOffsetMatrix(pSubMesh.getSkin().getSkeleton().getRoot().getBoneName()));    
					// trace(pTempBoundingSphere.fRadius, '<<<');
				}


				geometry.computeGeneralizingSphere(pNewBoundingSphere, pTempBoundingSphere)
			}

			this._pBoundingSphere = pNewBoundingSphere;
			
			return true;
		}

		deleteBoundingSphere(): boolean {
			this._pBoundingSphere = null;
			return true;
		}

		showBoundingSphere(): boolean {
			var pSubMesh : IMeshSubset, pMaterial: IMaterial;
			var iData: int;
			var pPoints: float[], pIndexes: uint[];

			if(!this._pBoundingSphere) {
				if (!this.createBoundingSphere()) {
					return false;
				}
			}

			pPoints = new Array();
			pIndexes = new Array();

			geometry.computeDataForCascadeBoundingSphere(this._pBoundingSphere, pPoints, pIndexes);

			pSubMesh = this.getSubset(".BoundingSphere");
			
			if(!pSubMesh) {
				pSubMesh = this.createSubset(".BoundingSphere", EPrimitiveTypes.LINELIST, EHardwareBufferFlags.STATIC);
				
				if(isNull(pSubMesh))
					return false;

				iData = pSubMesh.getData().allocateData(
					[VE.float3(DeclUsages.POSITION)],
					new Float32Array(pPoints));

				pSubMesh.getData().allocateIndex([VE.float(DeclUsages.INDEX0)], new Float32Array(pIndexes));
				pSubMesh.getData().index(iData, DeclUsages.INDEX0);

				pMaterial = pSubMesh.getMaterial();
				pMaterial.emissive = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.diffuse  = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.ambient  = new Color(1.0, 1.0, 1.0, 1.0);
				pMaterial.specular = new Color(1.0, 1.0, 1.0, 1.0);

				pSubMesh.getEffect().addComponent("akra.system.mesh_texture");
				pSubMesh.setShadow(false);
			}
			else {
				pSubMesh.getData()._getData(DeclUsages.POSITION).setData(new Float32Array(pPoints), DeclUsages.POSITION);
			}

			pSubMesh.getData().setRenderable(pSubMesh.getData().getIndexSet(), true);

			return true;
		}

		hideBoundingSphere(): boolean {
			var pSubMesh: IMeshSubset;
			
			pSubMesh = this.getSubset(".BoundingSphere");
			
			if(!pSubMesh) {
				return false;
			}

			pSubMesh.getData().setRenderable(pSubMesh.getData().getIndexSet(), false);
			return true;
		}

		isBoundingSphereVisible(): boolean {
			var pSubMesh: IMeshSubset = this.getSubset(".BoundingSphere");
			
			if(!pSubMesh) {
				return false;
			}

			return pSubMesh.getData().isRenderable(pSubMesh.getData().getIndexSet());
		}

		toSceneModel(pParent: ISceneNode, sName: string = null): ISceneModel {
			if (isNull(pParent)) {
				return null;
			}

			var pSceneModel: ISceneModel = pParent.getScene().createModel(sName);
			
			if (!pSceneModel.create()) {
				return null;
			}

			pSceneModel.setMesh(this);
			pSceneModel.attachToParent(pParent);

			return pSceneModel;
		}

		update(): boolean {
			var isOk: boolean = false;

			for (var i: uint = 0; i < this._pSkinList.length; ++ i) {
				isOk = this._pSkinList[i].applyBoneMatrices() ? true : isOk;
			}

			if(isOk){
				for (var i: uint = 0; i < this.getLength(); ++ i) {
					if(this._pSubMeshes[i].isSkinned()){
						this._pSubMeshes[i]._calculateSkin();
					}
				}
			}

			return isOk;
		}

		_setShadow(bValue: boolean): void {
			this._bShadow = bValue;
		}

		static ShadowedSignal = ShadowedSignal;
	}

	export function createMesh(pEngine: IEngine, sName: string = null, eOptions: int = 0, pDataBuffer: IRenderDataCollection = null): IMesh {
		return new Mesh(pEngine, eOptions, sName, pDataBuffer);
	}
}
