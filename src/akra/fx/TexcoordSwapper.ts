/// <reference path="../idl/IAFXAttributeBlendContainer.ts" />
/// <reference path="../pool/resources/SurfaceMaterial.ts" />

module akra.fx {

	import SurfaceMaterial = pool.resources.SurfaceMaterial;

	export class TexcoordSwapper {
		protected _pTmpToTex: string[] = null;
		protected _pTexToTmp: string[] = null;
		protected _pTexcoords: uint[] = null;

		protected _sTmpToTexCode: string = "";
		protected _sTexToTmpCode: string = "";

		protected _iMaxTexcoords: uint = 0;

		constructor() {
			this._iMaxTexcoords = SurfaceMaterial.MAX_TEXTURES_PER_SURFACE;
			this._pTmpToTex = new Array<string>(this._iMaxTexcoords);
			this._pTexToTmp = new Array<string>(this._iMaxTexcoords);
			this._pTexcoords = new Array<uint>(this._iMaxTexcoords);
		}

		getTmpDeclCode(): string {
			return this._sTexToTmpCode;
		}

		getTecoordSwapCode(): string {
			return this._sTmpToTexCode;
		}

		clear(): void {
			for (var i: uint = 0; i < this._iMaxTexcoords; i++) {
				this._pTmpToTex[i] = "";
				this._pTexToTmp[i] = "";
				this._pTexcoords[i] = 0;
			}

			this._sTmpToTexCode = "";
			this._sTexToTmpCode = "";
		}

		generateSwapCode(pMaterial: ISurfaceMaterial, pAttrConatiner: IAFXAttributeBlendContainer): void {
			this.clear();

			if (isNull(pMaterial)) {
				return;
			}
			//TODO: do it faster in one for
			var pTexcoords: uint[] = this._pTexcoords;

			for (var i: uint = 0; i < this._iMaxTexcoords; i++) {
				var iTexcoord: uint = pMaterial.texcoord(i);

				if (iTexcoord !== i && pAttrConatiner.hasTexcoord(i)) {
					var pAttr = pAttrConatiner.getTexcoordVar(i);

					this._pTexToTmp[i] = pAttr._getType()._getBaseType()._getRealName() + " " +
					"T" + i.toString() + "=" + pAttr._getRealName() + ";";

					this._sTexToTmpCode += this._pTexToTmp[i] + "\n";
				}

				if (!pAttrConatiner.hasTexcoord(iTexcoord)) {
					pTexcoords[iTexcoord] = 0;
				}
				else {
					pTexcoords[iTexcoord] = iTexcoord;
				}
			}

			for (var i: uint = 0; i < this._iMaxTexcoords; i++) {
				if (pTexcoords[i] !== i && pAttrConatiner.hasTexcoord(i)) {
					var pAttr = pAttrConatiner.getTexcoordVar(i);

					if (this._pTexToTmp[pTexcoords[i]] !== "") {
						this._pTmpToTex[i] = pAttr._getRealName() + "=" + this._pTexToTmp[pTexcoords[i]] + ";";
					}
					else {
						this._pTmpToTex[i] = pAttr._getRealName() + "=" + pAttrConatiner.getTexcoordVar(pTexcoords[i])._getRealName() + ";";
					}

					this._sTmpToTexCode += this._pTmpToTex[i] + "\n";
				}
			}
		}
	}
}
