
/// <reference path="ITexture.ts" />

module akra {
	export interface IAFXSamplerState {
		textureName: string;
		texture: ITexture;
	
		wrap_s: ETextureWrapModes;
		wrap_t: ETextureWrapModes;
	
		mag_filter: ETextureFilters;
		min_filter: ETextureFilters;
	}

	/** @deprecated Use IMap<IAFXSamplerState> instead. */
	export interface IAFXSamplerStateMap {
		[index: string]: IAFXSamplerState;
		//[index: uint]: IAFXSamplerState;
	}

	/** @deprecated Use IMap<IAFXSamplerState[]> instead. */
	export interface IAFXSamplerStateListMap {
		[index: string]: IAFXSamplerState[];
		//[index: uint]: IAFXSamplerState[];
	}
}
