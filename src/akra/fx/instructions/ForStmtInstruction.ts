/// <reference path="../../idl/EEffectErrors.ts" />
/// <reference path="StmtInstruction.ts" />

module akra.fx.instructions {

	/**
	 * Represent for(forInit forCond ForStep) stmt
	 * for ExprInstruction or VarDeclInstruction ExprInstruction ExprInstruction StmtInstruction
	 */
	export class ForStmtInstruction extends StmtInstruction {
		constructor() {
			super();
			this._pInstructionList = [null, null, null, null];
			this._eInstructionType = EAFXInstructionTypes.k_ForStmtInstruction;
		}

		_toFinalCode(): string {
			var sCode: string = "for(";

			sCode += this._getInstructions()[0]._toFinalCode() + ";";
			sCode += this._getInstructions()[1]._toFinalCode() + ";";
			sCode += this._getInstructions()[2]._toFinalCode() + ")";
			sCode += this._getInstructions()[3]._toFinalCode();

			return sCode;
		}

		_check(eStage: ECheckStage, pInfo: any = null): boolean {
			var pInstructionList: IAFXInstruction[] = this._getInstructions();

			if (this._nInstructions !== 4) {
				this._setError(EEffectErrors.BAD_FOR_STEP_EMPTY);
				return false;
			}

			if (isNull(pInstructionList[0])) {
				this._setError(EEffectErrors.BAD_FOR_INIT_EMPTY_ITERATOR);
				return false;
			}

			if (pInstructionList[0]._getInstructionType() !== EAFXInstructionTypes.k_VariableDeclInstruction) {
				this._setError(EEffectErrors.BAD_FOR_INIT_EXPR);
				return false;
			}

			if (isNull(pInstructionList[1])) {
				this._setError(EEffectErrors.BAD_FOR_COND_EMPTY);
				return false;
			}

			if (pInstructionList[1]._getInstructionType() !== EAFXInstructionTypes.k_RelationalExprInstruction) {
				this._setError(EEffectErrors.BAD_FOR_COND_RELATION);
				return false;
			}

			if (pInstructionList[2]._getInstructionType() === EAFXInstructionTypes.k_UnaryExprInstruction ||
				pInstructionList[2]._getInstructionType() === EAFXInstructionTypes.k_AssignmentExprInstruction ||
				pInstructionList[2]._getInstructionType() === EAFXInstructionTypes.k_PostfixArithmeticInstruction) {

				var sOperator: string = pInstructionList[2]._getOperator();
				if (sOperator !== "++" && sOperator !== "--" &&
					sOperator !== "+=" && sOperator !== "-=") {
					this._setError(EEffectErrors.BAD_FOR_STEP_OPERATOR, { operator: sOperator });
					return false;
				}
			}
			else {
				this._setError(EEffectErrors.BAD_FOR_STEP_EXPRESSION);
				return false;
			}

			return true;
		}

		_addUsedData(pUsedDataCollector: IAFXTypeUseInfoMap,
			eUsedMode: EVarUsedMode = EVarUsedMode.k_Undefined): void {
			var pForInit: IAFXVariableDeclInstruction = <IAFXVariableDeclInstruction>this._getInstructions()[0];
			var pForCondition: IAFXExprInstruction = <IAFXExprInstruction>this._getInstructions()[1];
			var pForStep: IAFXExprInstruction = <IAFXExprInstruction>this._getInstructions()[2];
			var pForStmt: IAFXStmtInstruction = <IAFXStmtInstruction>this._getInstructions()[3];

			var pIteratorType: IAFXVariableTypeInstruction = pForInit._getType();

			pUsedDataCollector[pIteratorType._getInstructionID()] = <IAFXTypeUseInfoContainer>{
				type: pIteratorType,
				isRead: false,
				isWrite: true,
				numRead: 0,
				numWrite: 1,
				numUsed: 1
			};

			pForCondition._addUsedData(pUsedDataCollector, eUsedMode);
			pForStep._addUsedData(pUsedDataCollector, eUsedMode);
			pForStmt._addUsedData(pUsedDataCollector, eUsedMode);
		}
	}
}

