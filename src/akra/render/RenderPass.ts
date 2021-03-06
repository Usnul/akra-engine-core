/// <reference path="../idl/IRenderPass.ts" />
/// <reference path="../guid.ts" />

module akra.render {
	final export class RenderPass implements IRenderPass {
		guid: uint = guid();

		private _pTechnique: IRenderTechnique = null;
		private _pRenderTarget: IRenderTarget = null;
		private _iPassNumber: uint = 0;
		private _pInput: IAFXPassInputBlend = null;
		private _isActive: boolean = true;

		constructor(pTechnique: IRenderTechnique, iPass: uint) {
			this._pTechnique = pTechnique;
			this._iPassNumber = iPass;
		}
		setForeign(sName: string, bValue: boolean): void;
		setForeign(sName: string, fValue: float): void;
		setForeign(sName: string, pValue: any): void {
			this._pInput.setForeign(sName, pValue);
		}

		setTexture(sName: string, pTexture: ITexture): void {
			this._pInput.setTexture(sName, pTexture);
		}

		setUniform(sName: string, pValue: any): void {
			this._pInput.setUniform(sName, pValue);
		}

		setStruct(sName: string, pValue: any): void {
			this._pInput.setStruct(sName, pValue);
		}

		setRenderState(eState: ERenderStates, eValue: ERenderStateValues): void {
			this._pInput.setRenderState(eState, eValue);
		}

		setSamplerTexture(sName: string, sTexture: string): void;
		setSamplerTexture(sName: string, pTexture: ITexture): void;
		setSamplerTexture(sName: string, pTexture: any): void {
			this._pInput.setSamplerTexture(sName, pTexture);
		}

		//  setSamplerState(sName: string, pState: IAFXSamplerState): void {
		// 	this._pInput.setSamplerState(sName, pState);
		// }

		getRenderTarget(): IRenderTarget {
			return this._pRenderTarget;
		}

		setRenderTarget(pTarget: IRenderTarget): void {
			this._pRenderTarget = pTarget;
		}

		getPassInput(): IAFXPassInputBlend {
			return this._pInput;
		}

		setPassInput(pInput: IAFXPassInputBlend, isNeedRelocate: boolean): void {
			//if (isNeedRelocate) {
			//	pInput._copyFrom(pInput);
			//}

			if (!isNull(this._pInput)) {
				this._pInput._release();
			}

			this._pInput = pInput;
		}

		blend(sComponentName: string, iPass: uint): boolean {
			return this._pTechnique.addComponent(sComponentName, this._iPassNumber, iPass);
		}

		activate(): void {
			this._isActive = true;
		}

		deactivate(): void {
			this._isActive = false;
		}

		isActive(): boolean {
			return this._isActive;
		}

		private relocateOldInput(pNewInput: IAFXPassInputBlend): void {
			//TODO: copy old uniforms to new
		}
	}
}

