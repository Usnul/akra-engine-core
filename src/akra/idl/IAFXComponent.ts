
/// <reference path="IResourcePoolItem.ts" />
/// <reference path="IAFXInstruction.ts" />


module akra {
	export enum EPassTypes {
		UNDEF,
		DEFAULT,
		POSTEFFECT
	};

	export interface IAFXComponent extends IResourcePoolItem {
		getTechnique(): IAFXTechniqueInstruction;
		setTechnique(pTechnique: IAFXTechniqueInstruction): void;
	
		isPostEffect(): boolean;
	
		getName(): string;
		getTotalPasses(): uint;
		getHash(iShift: int, iPass: uint): string;
	
	}

	export interface IAFXComponentMap {
		[index: uint]: IAFXComponent;
		[index: string]: IAFXComponent;
	}
}
