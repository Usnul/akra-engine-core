/// <reference path="../idl/ITerrainSection.ts" />

/// <reference path="../scene/SceneObject.ts" />
/// <reference path="../data/RenderData.ts" />
/// <reference path="../render/RenderableObject.ts" />

/// <reference path="Terrain.ts" />

module akra.terrain {
	import VE = data.VertexElement;
	import Vec2 = math.Vec2;
	import Vec3 = math.Vec3;
	import Vec4 = math.Vec4;

	export class TerrainSection extends scene.SceneObject implements ITerrainSection {
		protected _pTerrainSystem: ITerrain = null;

		protected _iVertexID: uint = 0;
		//Ее коорлинаты на карте высот
		protected _iHeightMapX: uint = 0;
		protected _iHeightMapY: uint = 0;
		//номер сектора по иксу и по игрику
		protected _iSectorX: uint = 0;
		protected _iSectorY: uint = 0;
		protected _iSectorIndex: uint = 0;
		//Ращмеры сетки вершин
		protected _iXVerts: uint = 0;
		protected _iYVerts: uint = 0;
		//Положение сетора в мире
		protected _pWorldRect: IRect3d = new geometry.Rect3d();
		private _pRenderableObject: IRenderableObject = null;
		private _pVertexDescription: IVertexElementInterface[] = null;

		constructor(pScene: IScene3d, eType: EEntityTypes = EEntityTypes.TERRAIN_SECTION) {
			super(pScene, eType);
		}

		getSectorX(): float {
			return this._iSectorX;
		}

		getSectorY(): float{
			return this._iSectorY;
		}

		getTerrainSystem(): ITerrain{
			return this._pTerrainSystem;
		}

		getSectionIndex(): uint {
			return this._iSectorIndex;
		}

		getHeightX(): float {
			return math.abs(this._pWorldRect.x1 - this._pWorldRect.x0);
		}

		getHeightY(): float {
			return math.abs(this._pWorldRect.y1 - this._pWorldRect.y0);
		}

		getVertexDescription(): IVertexElementInterface[] {
			return this._pVertexDescription;
		}

		getTotalRenderable(): uint {
			return !isNull(this._pRenderableObject) ? 1 : 0;
		}

		getRenderable(i?: uint): IRenderableObject {
			return this._pRenderableObject;
		}


		_internalCreate(pParentSystem: ITerrain,
			iSectorX: uint, iSectorY: uint,
			iHeightMapX: uint, iHeightMapY: uint,
			iXVerts: uint, iYVerts: uint,
			pWorldRect: IRect2d): boolean {

			var bResult: boolean = false;

			this._pTerrainSystem = pParentSystem;
			this._iXVerts = iXVerts;
			this._iYVerts = iYVerts;
			this._iSectorX = iSectorX;
			this._iSectorY = iSectorY;
			this._iSectorIndex = (this._iSectorY * this._pTerrainSystem.getSectorCountX() + this._iSectorX);
			this._pWorldRect.x0 = pWorldRect.x0;
			this._pWorldRect.x1 = pWorldRect.x1;
			this._pWorldRect.y0 = pWorldRect.y0;
			//??
			this._pWorldRect.y1 = pWorldRect.y1;
			this._iHeightMapX = iHeightMapX;
			this._iHeightMapY = iHeightMapY;

			if (this.getTerrainSystem()._useVertexNormal()) {
				this._pVertexDescription = [VE.float3(data.Usages.POSITION), VE.float3(data.Usages.NORMAL), VE.float2(data.Usages.TEXCOORD)];
			}
			else {
				this._pVertexDescription = [VE.float3(data.Usages.POSITION), VE.float2(data.Usages.TEXCOORD)];
			}

			bResult = this._createRenderDataForVertexAndIndex();
			bResult = bResult && this._buildVertexBuffer();
			bResult = bResult && this._buildIndexBuffer();

			// set the scene object bounds data
			this.accessLocalBounds().set(this._pWorldRect.x0,
				this._pWorldRect.x1,
				this._pWorldRect.y0,
				this._pWorldRect.y1,
				this._pWorldRect.z0,
				this._pWorldRect.z1);

			if (bResult) {
				this.attachToParent(this._pTerrainSystem);
				this.setInheritance(ENodeInheritance.ALL);

				return true;
			}
			else {
				return false;
			}			
		}

		_createRenderable(): void {
			if (isNull(this._pRenderableObject)) {
				this._pRenderableObject = new render.RenderableObject();
				this._pRenderableObject._setup(this.getScene().getManager().getEngine().getRenderer());
			}
		}

		protected _createRenderDataForVertexAndIndex(): boolean {
			var pRenderable: IRenderableObject = this.getRenderable();

			if (isNull(pRenderable)) {
				return true;
			}

			debug.assert(isNull(pRenderable.getData()), "У терраин сектиона уже созданы данные");

			pRenderable._setRenderData(this.getTerrainSystem().getDataFactory().getEmptyRenderData(EPrimitiveTypes.TRIANGLESTRIP, 0));

			if (isNull(pRenderable.getData())) {
				return false;
			}

			return true;
		}

		protected _buildVertexBuffer(): boolean {
			this._pWorldRect.z0 = MAX_FLOAT64;
			this._pWorldRect.z1 = MIN_FLOAT64;

			if (!isNull(this.getRenderable())) {
				var nElementSize: uint = 0;
				if (this.getTerrainSystem()._useVertexNormal()) {
					nElementSize = (3/*кординаты вершин*/ + 3/*нормаль*/ + 2/*текстурные координаты*/);
				}
				else {
					nElementSize = (3/*кординаты вершин*/ + 2/*текстурные координаты*/);
				}

				var pVerts: float[] = new Array(this._iXVerts * this._iYVerts * nElementSize);
				var v3fNormal: IVec3 = new Vec3();

				//размер ячейки сектора
				var v2fCellSize: IVec2 = new Vec2();
				v2fCellSize.set(this.getHeightX() / (this._iXVerts - 1),
					//размер сектора/количество ячеек в секторе
					this.getHeightY() / (this._iYVerts - 1));

				//Координаты вершина в секторе
				var v2fVert: IVec2 = new Vec2();
				v2fVert.set(0.0, 0.0);

				for (var y: uint = 0; y < this._iYVerts; ++y) {

					v2fVert.set(this._pWorldRect.x0, y * v2fCellSize.y + this._pWorldRect.y0);

					for (var x: uint = 0; x < this._iXVerts; ++x) {

						var fHeight: float = this.getTerrainSystem().readWorldHeight(this._iHeightMapX + x, this._iHeightMapY + y);

						pVerts[((y * this._iXVerts) + x) * nElementSize + 0] = v2fVert.x;
						pVerts[((y * this._iXVerts) + x) * nElementSize + 1] = v2fVert.y;
						pVerts[((y * this._iXVerts) + x) * nElementSize + 2] = fHeight;

						if (this.getTerrainSystem()._useVertexNormal()) {
							this.getTerrainSystem().readWorldNormal(v3fNormal, this._iHeightMapX + x, this._iHeightMapY + y);

							pVerts[((y * this._iXVerts) + x) * nElementSize + 3] = v3fNormal.x;
							pVerts[((y * this._iXVerts) + x) * nElementSize + 4] = v3fNormal.y;
							pVerts[((y * this._iXVerts) + x) * nElementSize + 5] = v3fNormal.z;

							pVerts[((y * this._iXVerts) + x) * nElementSize + 6] = (this._iSectorX + x / (this._iXVerts - 1)) / this.getTerrainSystem().getSectorCountX();
							pVerts[((y * this._iXVerts) + x) * nElementSize + 7] = (this._iSectorY + y / (this._iYVerts - 1)) / this.getTerrainSystem().getSectorCountY();
						}
						else {
							pVerts[((y * this._iXVerts) + x) * nElementSize + 3] = (this._iSectorX + x / (this._iXVerts - 1)) / this.getTerrainSystem().getSectorCountX();
							pVerts[((y * this._iXVerts) + x) * nElementSize + 4] = (this._iSectorY + y / (this._iYVerts - 1)) / this.getTerrainSystem().getSectorCountY();
						}

						this._pWorldRect.z0 = math.min(this._pWorldRect.z0, fHeight);
						this._pWorldRect.z1 = math.max(this._pWorldRect.z1, fHeight);

						v2fVert.x += v2fCellSize.x;
					}
				}

				this._iVertexID = this.getRenderable().getData().allocateData(this.getVertexDescription(), new Float32Array(pVerts));
			}
			else {
				for (var y: uint = 0; y < this._iYVerts; ++y) {
					for (var x: uint = 0; x < this._iXVerts; ++x) {
						var fHeight: float = this.getTerrainSystem().readWorldHeight(this._iHeightMapX + x, this._iHeightMapY + y);

						this._pWorldRect.z0 = math.min(this._pWorldRect.z0, fHeight);
						this._pWorldRect.z1 = math.max(this._pWorldRect.z1, fHeight);
					}
				}
			}

			return true;
		}

		protected _buildIndexBuffer(): boolean {
			if (!isNull(this.getRenderable())) {
				var pIndexList: Float32Array = new Float32Array(TerrainSection.getCountIndexForStripGrid(this._iXVerts, this._iYVerts));

				TerrainSection.createSingleStripGrid(pIndexList,
					this._iXVerts, /*width of grid*/
					this._iYVerts, /*height of grid*/
					1, /*horz vertex count per cell*/
					1, /*vert vertex count per cell*/
					this._iYVerts, /*horz vertex count in vbuffer*/
					0);

				this.getRenderable().getData().allocateIndex([VE.float(data.Usages.INDEX0)], pIndexList);
				this.getRenderable().getData().index(this._iVertexID, data.Usages.INDEX0);
			}
			return true;
		}

		protected static createSingleStripGrid(pIndexValues: Float32Array, iXVerts: uint, iYVerts: uint, iXStep: uint, iYStep: uint, iSride: uint, iFlags: uint): uint {
			//TRIANGLESTRIP
			var iTotalStrips: uint = iYVerts - 1;
			var iTotalIndexesPerStrip: uint = iXVerts << 1;

			// the total number of indices is equal
			// to the number of strips times the
			// indices used per strip plus one
			// degenerate triangle between each strip

			//общее количество идексов равно количесву линий умноженному на колчесвто идексов в линии + вырожденный треуголник между полосами

			var iTotalIndexes: uint = (iTotalStrips * iTotalIndexesPerStrip) + (iTotalStrips << 1) - 2;

			if (pIndexValues.length < iTotalIndexes) {
				return 0;
			}

			var iIndex: uint = 0;
			var iStartVert: uint = 0;
			var iLineStep: uint = iYStep * iSride;

			for (var j: uint = 0; j < iTotalStrips; ++j) {
				var k: uint = 0;
				var iVert: uint = iStartVert;
				// create a strip for this row
				for (k = 0; k < iXVerts; ++k) {
					pIndexValues[iIndex++] = iVert;
					pIndexValues[iIndex++] = iVert + iLineStep;
					iVert += iXStep;
				}
				iStartVert += iLineStep;

				if (j + 1 < iTotalStrips) {
					// add a degenerate to attach to
					// the next row
					pIndexValues[iIndex++] = (iVert - iXStep) + iLineStep;
					pIndexValues[iIndex++] = iStartVert;
				}
			}

			// return
			return iTotalIndexes;
		}

		protected static getCountIndexForStripGrid(iXVerts: uint, iYVerts: uint): uint {
			//TRIANGLESTRIP
			var iTotalStrips: uint = iYVerts - 1;
			var iTotalIndexesPerStrip: uint = iXVerts << 1;
			var iTotalIndexes: uint = (iTotalStrips * iTotalIndexesPerStrip) + (iTotalStrips << 1) - 2;
			return iTotalIndexes;
		}

	}
}