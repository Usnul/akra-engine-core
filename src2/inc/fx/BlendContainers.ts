#ifndef AFXVARIABLEBLENDCONTAINER
#define AFXVARIABLEBLENDCONTAINER

#include "IAFXInstruction.ts"

module akra.fx {
	export class VariableBlendContainer {
		protected _pVarListMap: IAFXVariableDeclListMap = null;
		protected _pVarKeys: string[] = null;

		protected _pVarBlendTypeMap: IAFXVariableTypeMap = null;

		inline get keys(): string[] {
			return this._pVarKeys;
		}

		inline getVarList(sKey: string): IAFXVariableDeclInstruction[] {
			return this._pVarListMap[sKey];
		}

		inline getBlendType(sKey: string): IAFXVariableTypeInstruction {
			return this._pVarBlendTypeMap[sKey];
		}

		constructor() {
			this._pVarListMap = <IAFXVariableDeclListMap>{};
			this._pVarKeys = [];

			this._pVarBlendTypeMap = <IAFXVariableTypeMap>{};
		}

		addVariable(pVariable: IAFXVariableDeclInstruction, eBlendMode: EAFXBlendMode): bool {
			var sName: string = pVariable.getRealName();

			if(!isDef(this._pVarListMap[sName])){
				this._pVarListMap[sName] = [pVariable];
				this._pVarKeys.push(sName);

				this._pVarBlendTypeMap[sName] = pVariable.getType();
				
				return true;
			}

			var pBlendType: IAFXVariableTypeInstruction = this._pVarBlendTypeMap[sName].blend(pVariable.getType(), eBlendMode);

			if(pBlendType === this._pVarBlendTypeMap[sName]){
				return true;
			}

			if(isNull(pBlendType)){
				ERROR("Could not blend type for variable '" + sName + "'");
				return false;
			}

			this._pVarListMap[sName].push(pVariable);
			this._pVarBlendTypeMap[sName] = pBlendType;

			return true;
		}

		hasVariableWithName(sName: string): bool {
			if(!isDefAndNotNull(this._pVarBlendTypeMap[sName])){
				this._pVarBlendTypeMap[sName] = null;
				return false;
			}

			return true;
		}

		inline hasVariable(pVar: IAFXVariableDeclInstruction): bool {
			return this.hasVariableWithName(pVar.getRealName());
		}

		inline getVariableByName(sName: string): IAFXVariableDeclInstruction {
			return this.hasVariableWithName(sName) ? this._pVarListMap[sName][0] : null;
		}

		inline getDeclCodeForVar(sName: string): string {
			var pType: IAFXVariableTypeInstruction = this.getBlendType(sName);
			var sCode: string = pType.toFinalCode() + " ";
			var pVar: IAFXVariableDeclInstruction = this.getVariableByName(sName);
			
			sCode += pVar.getRealName();
			
			if(pVar.getType().isNotBaseArray()){
				var iLength: uint = pVar.getType().getLength();
				if(webgl.isANGLE && iLength === 1 && pVar.getType().isComplex()){
					sCode += "[" + 2 + "]";
				}
				else {
					sCode += "[" + iLength + "]";
				}
			}

			return sCode;
		}
	}


	export class ComplexTypeBlendContainer {
		private _pTypeListMap: IAFXTypeMap = null;
		private _pTypeKeys: string[] = null;

		inline get keys(): string[]{
			return this._pTypeKeys;
		}

		inline get types(): IAFXTypeMap {
			return this._pTypeListMap;
		}

		constructor() {
			this._pTypeListMap = <IAFXTypeMap>{};
			this._pTypeKeys = [];
		}

		addComplexType(pComplexType: IAFXTypeInstruction): bool {
			var pFieldList: IAFXVariableDeclInstruction[] = (<ComplexTypeInstruction>pComplexType)._getFieldDeclList();
			for(var i: uint = 0; i < pFieldList.length; i++){
				if(pFieldList[i].getType().isComplex()){
					if(!this.addComplexType(pFieldList[i].getType().getBaseType())){
						return false;
					}
				}
			}

			var sName: string = pComplexType.getRealName();

			if(!isDef(this._pTypeListMap[sName])){
				this._pTypeListMap[sName] = pComplexType;
				this._pTypeKeys.push(sName);

				return true;
			}

			var pBlendType: IAFXTypeInstruction = this._pTypeListMap[sName].blend(pComplexType, EAFXBlendMode.k_TypeDecl);
			if(isNull(pBlendType)){
				ERROR("Could not blend type declaration '" + sName + "'");
				return false;
			}

			this._pTypeListMap[sName]= pBlendType;

			return true;
		}

		addFromVarConatiner(pContainer: VariableBlendContainer): bool {
			if(isNull(pContainer)){
				return true;
			}

			var pKeys: string[] = pContainer.keys;

			for(var i: uint = 0; i < pKeys.length; i++){
				var pType: IAFXTypeInstruction = pContainer.getBlendType(pKeys[i]).getBaseType();

				if(pType.isComplex()){
					if(!this.addComplexType(pType)){
						return false;
					}
				}
			}

			return true;
		}
	}

	export class ExtSystemDataContainer {
		protected _pExtSystemMacrosList: IAFXSimpleInstruction[] = null;
		protected _pExtSystemTypeList: IAFXTypeDeclInstruction[] = null;
		protected _pExtSystemFunctionList: IAFXFunctionDeclInstruction[] = null;

		inline get macroses(): IAFXSimpleInstruction[] {
			return this._pExtSystemMacrosList;
		}

		inline get types(): IAFXTypeDeclInstruction[] {
			return this._pExtSystemTypeList;
		}

		inline get functions(): IAFXFunctionDeclInstruction[] {
			return this._pExtSystemFunctionList;
		}

		constructor(){
			this._pExtSystemMacrosList = [];
			this._pExtSystemTypeList = [];
			this._pExtSystemFunctionList = [];
		}

		addFromFunction(pFunction: IAFXFunctionDeclInstruction): void {
			var pTypes = pFunction._getExtSystemTypeList();
			var pMacroses = pFunction._getExtSystemMacrosList();
			var pFunctions = pFunction._getExtSystemFunctionList();

			if(!isNull(pTypes)){
				for(var j: uint = 0; j < pTypes.length; j++){
					if(this._pExtSystemTypeList.indexOf(pTypes[j]) === -1){
						this._pExtSystemTypeList.push(pTypes[j]);
					}
				}
			}

			if(!isNull(pMacroses)){
				for(var j: uint = 0; j < pMacroses.length; j++){
					if(this._pExtSystemMacrosList.indexOf(pMacroses[j]) === -1){
						this._pExtSystemMacrosList.push(pMacroses[j]);
					}
				}
			}

			if(!isNull(pFunctions)){
				for(var j: uint = 0; j < pFunctions.length; j++){
					if(this._pExtSystemFunctionList.indexOf(pFunctions[j]) === -1){
						this._pExtSystemFunctionList.push(pFunctions[j]);
					}
				}
			}
		}
	}


	export interface IDataFlowMap {
		[index: string]: IDataFlow;
	}

	export interface IAFXVaribaleListMap{
		[index: string]: IAFXVariableDeclInstruction[];
	}

	export class AttributeBlendContainer extends VariableBlendContainer {
		private _pSlotBySemanticMap: IntMap = null;
		private _pFlowsBySemanticMap: IDataFlowMap = null;

		private _pFlowBySlots: util.ObjectArray = null;
		private _pHashBySlots: util.ObjectArray = null;
		private _pTypesBySlots: util.ObjectArray = null;
		
		private _pVBByBufferSlots: util.ObjectArray = null;
		private _pHashByBufferSlots: util.ObjectArray = null;
		private _pBufferSlotBySlots: util.ObjectArray = null;

		// private _pOffsetBySemanticMap: IAFXVariableDeclMap = null;
		// private _pOffsetSemantickeys: string[] = null; 
		private _pOffsetVarsBySemanticMap: IAFXVaribaleListMap = null; 
		private _pOffsetDefaultMap: IntMap = null;
		// private _pSlotByOffsetsMap: IntMap = null;
		// private _pOffsetKeys: string[] = null;

		protected _sHash: string = "";

		inline get semantics(): string[] {
			return this.keys;
		}

		inline get totalSlots(): uint {
			return this._pFlowBySlots.length;
		}

		inline get totalBufferSlots(): uint {
			return this._pVBByBufferSlots.length;
		}

		constructor() {
			super();
			
			this._pSlotBySemanticMap = <IntMap>{};
			this._pFlowsBySemanticMap = <IDataFlowMap>{};

			this._pFlowBySlots = new util.ObjectArray();
			this._pHashBySlots = new util.ObjectArray();

			this._pTypesBySlots = new util.ObjectArray();

			this._pVBByBufferSlots = new util.ObjectArray();
			this._pHashByBufferSlots = new util.ObjectArray();
			this._pBufferSlotBySlots = new util.ObjectArray();

			var pSemantics: string[] = this.semantics;

			for(var i: uint = 0; i < pSemantics.length; i++){
				var sSemantic: string = pSemantics[i];
				this._pSlotBySemanticMap[sSemantic] = -1;
				this._pFlowsBySemanticMap[sSemantic] = null;
			}
		}

		inline getOffsetVarsBySemantic(sName: string): IAFXVariableDeclInstruction[] {
			return this._pOffsetVarsBySemanticMap[sName];
		} 

		inline getOffsetDefault(sName: string): uint {
			return this._pOffsetDefaultMap[sName];
		}

		inline getSlotBySemantic(sSemantic: string): uint {
			return this._pSlotBySemanticMap[sSemantic];
		}

		inline getBufferSlotBySemantic(sSemantic: string): uint {
			return this._pBufferSlotBySlots.value(this.getSlotBySemantic(sSemantic));
			// return this._pBufferSlotBySlots.value(this._pSlotBySemanticMap[sSemantic]);
		}

		inline getAttributeList(sSemantic: string): IAFXVariableDeclInstruction[] {
			return this.getVarList(sSemantic);
		}

		inline getFlowBySemantic(sSemantic: string): IDataFlow {
			return this._pFlowsBySemanticMap[sSemantic];
		}

		inline getFlowBySlot(iSlot: uint): IDataFlow {
			return this._pFlowBySlots.value(iSlot);
		}

		inline getTypeBySlot(iSlot: int): IAFXTypeInstruction {
			return this._pTypesBySlots.value(iSlot);
		}

		inline getType(sSemantic: string): IAFXVariableTypeInstruction {
			return this.getBlendType(sSemantic);
		}

		inline addAttribute(pVariable: IAFXVariableDeclInstruction): bool {
			return this.addVariable(pVariable, EAFXBlendMode.k_Attribute);
		}

		inline hasAttrWithSemantic(sSemantic: string): bool {
			return this.hasVariableWithName(sSemantic);
		}

		inline getAttribute(sSemantic: string): IAFXVariableDeclInstruction {
			return this.getVariableByName(sSemantic);
		}

		inline hasTexcoord(iSlot: uint): bool {
			return this.hasAttrWithSemantic(DeclUsages.TEXCOORD + iSlot.toString());
		}

		inline getTexcoordVar(iSlot: uint): IAFXVariableDeclInstruction {
			return this.getVariableByName(DeclUsages.TEXCOORD + iSlot.toString());
		}

		clear(): void {
			var pSemantics: string[] = this.semantics;

			for(var i: uint = 0; i < pSemantics.length; i++){
				var sSemantic: string = pSemantics[i];
				this._pSlotBySemanticMap[sSemantic] = -1;
				this._pFlowsBySemanticMap[sSemantic] = null;
			}

			this._pFlowBySlots.clear(false);
			this._pHashBySlots.clear(false);

			this._pVBByBufferSlots.clear(false);
			this._pHashByBufferSlots.clear(false);
			this._pBufferSlotBySlots.clear(false);

			this._sHash = "";
		}

		generateOffsetMap(): void {		
			this._pOffsetVarsBySemanticMap = <IAFXVaribaleListMap>{};
			this._pOffsetDefaultMap = <IntMap>{};
			
			var pSemantics: string[] = this.semantics;

			for(var i: uint = 0; i < pSemantics.length; i++){
				var sSemantic: string = pSemantics[i];
				var pAttr: IAFXVariableDeclInstruction = this.getAttribute(sSemantic);

				if(pAttr.isPointer()){
					this._pOffsetVarsBySemanticMap[sSemantic] = [];
					if(pAttr.getType().isComplex()){
						var pAttrSubDecls: IAFXVariableDeclInstruction[] = pAttr.getSubVarDecls();

						for(var j: uint = 0; j < pAttrSubDecls.length; j++){
							var pSubDecl: IAFXVariableDeclInstruction = pAttrSubDecls[j];

							if(pSubDecl.getName() === "offset") {
								var sOffsetName: string = pSubDecl.getRealName();

								this._pOffsetVarsBySemanticMap[sSemantic].push(pSubDecl)
								this._pOffsetDefaultMap[sOffsetName] = pSubDecl.getType().getPadding();
							}
						}
					}
					else {
						var pOffsetVar: IAFXVariableDeclInstruction = pAttr.getType()._getAttrOffset();
						var sOffsetName: string = pOffsetVar.getRealName();

						this._pOffsetVarsBySemanticMap[sSemantic].push(pOffsetVar);
						this._pOffsetDefaultMap[sOffsetName] = 0;
					}
				}
				else{
					this._pOffsetVarsBySemanticMap[sSemantic] = null;
				}

			}
			// this._pSlotByOffsetsMap = <IntMap>{};
			// this._pOffsetDefault = <IntMap>{};

			// var pSemantics: string[] = this.semantics;

			// for(var i: uint = 0; i < pSemantics.length; i++){
			// 	var sSemantic: string = pSemantics[i];
			// 	var pAttr: IAFXVariableDeclInstruction = this.getAttribute(sSemantic);
			// 	var iSlot: uint = this.getSlotBySemantic(sSemantic);

			// 	if(iSlot === -1){
			// 		continue;
			// 	}

			// 	if(pAttr.isPointer()){
			// 		if(pAttr.getType().isComplex()){
			// 			var pAttrSubDecls: IAFXVariableDeclInstruction[] = pAttr.getSubVarDecls();

			// 			for(var j: uint = 0; j < pAttrSubDecls.length; j++){
			// 				var pSubDecl: IAFXVariableDeclInstruction = pAttrSubDecls[j];

			// 				if(pSubDecl.getName() === "offset") {
			// 					var sOffsetName: string = pSubDecl.getRealName();

			// 					this._pSlotByOffsetsMap[sOffsetName] = iSlot;
			// 					this._pOffsetDefault[sOffsetName] = pSubDecl.getType().getPadding();
			// 				}
			// 			}
			// 		}
			// 		else {
			// 			var pOffsetVar: IAFXVariableDeclInstruction = pAttr.getType()._getAttrOffset();
			// 			var sOffsetName: string = pOffsetVar.getRealName();

			// 			this._pSlotByOffsetsMap[sOffsetName] = iSlot;
			// 			this._pOffsetDefault[sOffsetName] = 0;
			// 		}
					
			// 	}
			// }

			// this._pOffsetKeys = Object.keys(this._pSlotByOffsetsMap);
		}


		initFromBufferMap(pMap: util.BufferMap): bool {
			this.clear();

			if(isNull(pMap)){
				WARNING("Yoy don`t set any buffermap for render");
				return false;
			}

			var pFlows: IDataFlow[] = pMap.flows;
			var pSemanticList: string[] = this.semantics;

			for(var i: uint = 0; i < pSemanticList.length; i++) {
				var sSemantic: string = pSemanticList[i];
				var pFindFlow: IDataFlow = null;
				if(this.getType(sSemantic).isComplex()){
					pFindFlow = pMap.findFlow(sSemantic);
				}
				else {
					pFindFlow = pMap.getFlow(sSemantic);
				}

				this._pFlowsBySemanticMap[sSemantic] = pFindFlow;

				if(!isNull(pFindFlow)){

					var iBufferSlot: int = -1;

					if (pFindFlow.type === EDataFlowTypes.MAPPABLE) {
						if(!this.getType(sSemantic).isPointer()) {
							WARNING("You try to put pointer data into non-pointer attribute with semantic '" + sSemantic + "'");
							return false;
						}

						var iSlot: int = this._pFlowBySlots.indexOf(pFindFlow);					


						if (iSlot !== -1) {
							this._pHashBySlots.value(iSlot) += this.getType(sSemantic).getGuid().toString() + "*";
							this._pSlotBySemanticMap[sSemantic] = iSlot;

							iBufferSlot = this._pBufferSlotBySlots.value(iSlot);
							this._pHashByBufferSlots.value(iBufferSlot) += iSlot.toString() + "$";
							continue;
						}

						iBufferSlot = this._pVBByBufferSlots.indexOf(pFindFlow.data.buffer);
						iSlot = this._pFlowBySlots.length;

						if(iBufferSlot !== -1){
							this._pHashByBufferSlots.value(iBufferSlot) += iSlot.toString() + "$";
						}
						else {
							iBufferSlot = this._pVBByBufferSlots.length;
							this._pVBByBufferSlots.push(pFindFlow.data.buffer);
							this._pHashByBufferSlots.push(this._pFlowBySlots.length.toString() + "$");
						}
					}
					else if(this.getType(sSemantic).isStrictPointer()) {
						WARNING("You try to put non-pointer data into pointer attribute with semantic '" + sSemantic + "'");
						return false;
					}
					
					//new slot
					if(pFindFlow.type === EDataFlowTypes.MAPPABLE){
						this._pTypesBySlots.push(Effect.getSystemType("ptr"));
					}
					else {
						this._pTypesBySlots.push(this.getType(sSemantic).getBaseType());
					}
					
					this._pSlotBySemanticMap[sSemantic] = this._pFlowBySlots.length;
					this._pFlowBySlots.push(pFindFlow);
					this._pHashBySlots.push(this.getType(sSemantic).getGuid().toString() + "*");

					this._pBufferSlotBySlots.push(iBufferSlot);
				}
				else {
					this._pSlotBySemanticMap[sSemantic] = -1;
				}
			}

			this._sHash = "";
			for(var i: uint = 0; i < this._pHashBySlots.length; i++) {
				this._sHash += this._pHashBySlots.value(i) + "*";
			}

			for(var i: uint = 0; i < this._pHashByBufferSlots.length; i++) {
				this._sHash += this._pHashByBufferSlots.value(i) + "$";
			}
		}

		inline getHash(): string {
			return this._sHash;
		}	
	}
}

#endif