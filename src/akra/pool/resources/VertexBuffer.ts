/// <reference path="../../idl/IVertexBuffer.ts" />

/// <reference path="../../data/VertexData.ts" />
/// <reference path="../../data/VertexDeclaration.ts" />
/// <reference path="../../bf/bf.ts" />

/// <reference path="HardwareBuffer.ts" />
/// <reference path="MemoryBuffer.ts" />

module akra.pool.resources {
	import VertexDeclaration = data.VertexDeclaration;

	interface IBufferHole {
		start: uint;
		end: uint;
	}

	export class VertexBuffer extends HardwareBuffer implements IVertexBuffer {
		protected _pVertexDataArray: IVertexData[] = [];
		protected _iDataCounter: uint = 0;

		getType(): EVertexBufferTypes {
			return EVertexBufferTypes.UNKNOWN;
		}

		getLength(): uint {
			return this._pVertexDataArray.length;
		}

		constructor(/*pManager: IResourcePoolManager*/) {
			super(/*pManager*/);
		}

		// create(iByteSize: uint, iFlags?: uint, pData?: Uint8Array): boolean;
		create(iByteSize: uint, iFlags?: uint, pData?: ArrayBufferView): boolean {
			// create(iByteSize: uint, iFlags?: uint, pData?: any): boolean {
			super.create(0, iFlags || 0);

			if (bf.testAny(iFlags, EHardwareBufferFlags.BACKUP_COPY)) {
				this._pBackupCopy = new MemoryBuffer();
				this._pBackupCopy.create(iByteSize);
				this._pBackupCopy.writeData(pData, 0, iByteSize);
			}

			return true;
		}

		destroy(): void {
			super.destroy();

			this._pBackupCopy.destroy();
			this.freeVertexData();

			this._iDataCounter = 0;
		}

		getVertexData(i: uint): IVertexData;
		getVertexData(iOffset: uint, iCount: uint, pElements: IVertexElement[]): IVertexData;
		getVertexData(iOffset: uint, iCount: uint, pDecl: IVertexDeclaration): IVertexData;
		getVertexData(iOffset: uint, iCount?: uint, pData?: any): IVertexData {
			if (arguments.length < 2) {
				return this._pVertexDataArray[<uint>arguments[0]];
			}

			var pDecl: IVertexDeclaration = VertexDeclaration.normalize(pData);
			var pVertexData: IVertexData = new data.VertexData(this, this._iDataCounter++, iOffset, iCount, pDecl);

			this._pVertexDataArray.push(pVertexData);
			this.notifyAltered();

			return pVertexData;
		}


		getEmptyVertexData(iCount: uint, pElements: IVertexElement[], ppVertexDataIn?: IVertexData): IVertexData;
		getEmptyVertexData(iCount: uint, pDecl: IVertexDeclaration, ppVertexDataIn?: IVertexData): IVertexData;
		getEmptyVertexData(iCount: uint, pSize: uint, ppVertexDataIn?: IVertexData): IVertexData;
		getEmptyVertexData(iCount: uint, pDeclData: any, ppVertexDataIn?: IVertexData): IVertexData {
			var pDecl: IVertexDeclaration = null;
			var pHole: IBufferHole[] = [];
			var i: int;
			var pVertexData: IVertexData;
			var iTemp: int;
			var iStride: int = 0;
			var iAligStart: int;
			var iNewSize: int = 0;

			while (true) {

				pHole[0] = { start: 0, end: this.getByteLength() };

				for (var k: uint = 0; k < this._pVertexDataArray.length; ++k) {
					pVertexData = this._pVertexDataArray[k];

					for (i = 0; i < pHole.length; i++) {
						//Полностью попадает внутрь
						if (pVertexData.getByteOffset() > pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() < pHole[i].end) {
							iTemp = pHole[i].end;
							pHole[i].end = pVertexData.getByteOffset();
							pHole.splice(i + 1, 0, { start: pVertexData.getByteOffset() + pVertexData.getByteLength(), end: iTemp });
							i--;
						}
						else if (pVertexData.getByteOffset() == pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() < pHole[i].end) {
							pHole[i].start = pVertexData.getByteOffset() + pVertexData.getByteLength();
						}
						else if (pVertexData.getByteOffset() > pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() == pHole[i].end) {

						}
						else if (pVertexData.getByteOffset() == pHole[i].start &&
							pVertexData.getByteLength() == (pHole[i].end - pHole[i].start)) {
							pHole.splice(i, 1);
							i--;
						}
						//Перекрывает снизу
						else if (pVertexData.getByteOffset() < pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() > pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() < pHole[i].end) {
							pHole[i].start = pVertexData.getByteOffset() + pVertexData.getByteLength();
						}
						else if (pVertexData.getByteOffset() < pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() > pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() == pHole[i].end) {
							pHole.splice(i, 1);
							i--;
						}
						//Перекрывается сверху
						else if (pVertexData.getByteOffset() + pVertexData.getByteLength() > pHole[i].end &&
							pVertexData.getByteOffset() > pHole[i].start && pVertexData.getByteOffset() < pHole[i].end) {
							pHole[i].end = pVertexData.getByteOffset();
						}
						else if (pVertexData.getByteOffset() + pVertexData.getByteLength() > pHole[i].end &&
							pVertexData.getByteOffset() == pHole[i].start && pVertexData.getByteOffset() < pHole[i].end) {
							pHole.splice(i, 1);
							i--;
						}
						//полнстью перекрывает
						else if (pVertexData.getByteOffset() < pHole[i].start &&
							pVertexData.getByteOffset() + pVertexData.getByteLength() > pHole[i].end) {
							i--;
						}
					}
				}


				pHole.sort((a: IBufferHole, b: IBufferHole): number => ((a.end - a.start) - (b.end - b.start)));


				if (!isInt(pDeclData)) {
					pDecl = VertexDeclaration.normalize(pDeclData);
					iStride = pDecl.stride;
				}
				else {
					iStride = pDeclData;
				}
				// console.log(arguments[0], arguments[1].toString());
				// console.log("Buffer size >", this.byteLength, iCount * iStride)

				for (i = 0; i < pHole.length; i++) {
					iAligStart = this.isAligned() ?
					math.alignUp(pHole[i].start, math.nok(iStride, 4)) :
					math.alignUp(pHole[i].start, iStride);

					if ((pHole[i].end - iAligStart) >= iCount * iStride) {
						if (arguments.length == 2) {
							pVertexData = new data.VertexData(this, this._iDataCounter++, iAligStart, iCount, pDeclData);
							this._pVertexDataArray.push(pVertexData);

							this.notifyAltered();
							return pVertexData;
						}
						else if (arguments.length == 3) {
							((<any>ppVertexDataIn).constructor).call(ppVertexDataIn, this, ppVertexDataIn.getID(), iAligStart, iCount, pDeclData);
							this._pVertexDataArray.push(ppVertexDataIn);

							this.notifyAltered();
							return ppVertexDataIn;
						}

						return null;
					}
				}

				iNewSize = math.max(this.getByteLength() * 2, this.getByteLength() + iCount * iStride);

				if (this.resize(iNewSize) == false) {
					debug.warn("cannot resize buffer from " +
						this.getByteLength() + " bytes to " + iNewSize + " bytes ");
					break;
				}
			}

			return null;
		}


		freeVertexData(): boolean;
		freeVertexData(pVertexData?: IVertexData): boolean {
			if (arguments.length == 0) {
				for (var i: uint = 0; i < this._pVertexDataArray.length; i++) {
					this._pVertexDataArray[Number(i)].destroy();
				}

				this._pVertexDataArray = null;
			}
			else {
				for (var i: uint = 0; i < this._pVertexDataArray.length; i++) {
					if (this._pVertexDataArray[i] == pVertexData) {
						pVertexData.destroy();

						this._pVertexDataArray.splice(i, 1);
						this.notifyAltered();
						return true;
					}
				}

				return false;
			}

			this.notifyAltered();
			return true;
		}

		allocateData(pElements: IVertexElementInterface[], pData: ArrayBufferView): IVertexData;
		allocateData(pDecl: IVertexDeclaration, pData: ArrayBufferView): IVertexData;
		allocateData(pDeclData: any, pData: ArrayBufferView): IVertexData {
			var pDecl: IVertexDeclaration = VertexDeclaration.normalize(pDeclData);

			var pVertexData: IVertexData;
			var iCount: uint = pData.byteLength / pDecl.stride;

			debug.assert(iCount === math.floor(iCount), 'Data size should be a multiple of the vertex declaration.');

			pVertexData = this.getEmptyVertexData(iCount, pDecl);

			debug.assert(!isNull(pVertexData), "Could not allocate vertex data!");

			pVertexData.setData(pData, 0, pDecl.stride);

			return pVertexData;
		}

		static isVBO(pBuffer: IVertexBuffer): boolean {
			return pBuffer.getType() === EVertexBufferTypes.VBO;
		}

		static isTBO(pBuffer: IVertexBuffer): boolean {
			return pBuffer.getType() === EVertexBufferTypes.TBO;
		}
	}
}
