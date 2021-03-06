﻿/// <reference path="../idl/IMap.ts" />

/// <reference path="../idl/parser/IParser.ts" />
/// <reference path="../idl/parser/IItem.ts" />

/// <reference path="../common.ts" />
/// <reference path="symbols.ts" />

module akra.parser {
	final export class Item implements IItem {
		private _pRule: IRule;
		private _iPos: uint;
		private _iIndex: uint;
		private _pState: IState;

		private _pExpected: IMap<boolean>;
		private _isNewExpected: boolean;
		private _iLength: uint;

		getRule(): IRule {
			return this._pRule;
		}

		setRule(pRule: IRule): void {
			this._pRule = pRule;
		}

		getPosition(): uint {
			return this._iPos;
		}

		setPosition(iPos: uint): void {
			this._iPos = iPos;
		}

		getState(): IState {
			return this._pState;
		}

		setState(pState: IState): void {
			this._pState = pState;
		}

		getIndex(): uint {
			return this._iIndex;
		}

		setIndex(iIndex: uint): void {
			this._iIndex = iIndex;
		}

		getIsNewExpected(): boolean {
			return this._isNewExpected;
		}

		setIsNewExpected(_isNewExpected: boolean) {
			this._isNewExpected = _isNewExpected;
		}

		getExpectedSymbols(): IMap<boolean> {
			return this._pExpected;
		}

		getLength(): uint {
			return this._iLength;
		}

		constructor(pRule: IRule, iPos: uint, pExpected?: IMap<boolean>) {
			this._pRule = pRule;
			this._iPos = iPos;
			this._iIndex = 0;
			this._pState = null;

			this._isNewExpected = true;
			this._iLength = 0;
			this._pExpected = <IMap<boolean>>{};

			if (arguments.length === 3) {
				var pKeys = Object.getOwnPropertyNames(<IMap<boolean>>arguments[2]);

				for (var i: int = 0; i < pKeys.length; i++) {
					this.addExpected(pKeys[i]);
				}
			}
		}

		isEqual(pItem: IItem, eType: EParserType = EParserType.k_LR0): boolean {
			if (eType === EParserType.k_LR0) {
				return (this._pRule === pItem.getRule() && this._iPos === pItem.getPosition());
			}
			else if (eType === EParserType.k_LR1) {
				if (!(this._pRule === pItem.getRule() && this._iPos === pItem.getPosition() && this._iLength === (<IItem>pItem).getLength())) {
					return false;
				}
				var i: string = "";
				for (i in this._pExpected) {
					if (!(<IItem>pItem).isExpected(i)) {
						return false;
					}
				}
				return true;
			}
			else {
				//We never must be here, for LALR(1) we work with LR0 items. This 'else'-stmt onlu for closure-compliler.
				return false;
			}
		}

		isParentItem(pItem: IItem): boolean {
			return (this._pRule === pItem.getRule() && this._iPos === pItem.getPosition() + 1);
		}

		isChildItem(pItem: IItem): boolean {
			return (this._pRule === pItem.getRule() && this._iPos === pItem.getPosition() - 1);
		}

		mark(): string {
			var pRight: string[] = this._pRule.right;
			if (this._iPos === pRight.length) {
				return END_POSITION;
			}
			return pRight[this._iPos];
		}

		end(): string {
			return this._pRule.right[this._pRule.right.length - 1] || T_EMPTY;
		}

		nextMarked(): string {
			return this._pRule.right[this._iPos + 1] || END_POSITION;
		}

		isExpected(sSymbol: string): boolean {
			return !!(this._pExpected[sSymbol]);
		}

		addExpected(sSymbol: string): boolean {
			if (this._pExpected[sSymbol]) {
				return false;
			}
			this._pExpected[sSymbol] = true;
			this._isNewExpected = true;
			this._iLength++;
			return true;
		}

		toString(): string {
			var sMsg: string = this._pRule.left + " -> ";
			var sExpected: string = "";
			var pRight: string[] = this._pRule.right;

			for (var k = 0; k < pRight.length; k++) {
				if (k === this._iPos) {
					sMsg += ". ";
				}
				sMsg += pRight[k] + " ";
			}

			if (this._iPos === pRight.length) {
				sMsg += ". ";
			}

			if (isDef(this._pExpected)) {
				sExpected = ", ";
				var pKeys = Object.getOwnPropertyNames(this._pExpected);

				for (var l: int = 0; l < pKeys.length; ++l) {
					sExpected += pKeys[l] + "/";
				}

				if (sExpected !== ", ") {
					sMsg += sExpected;
				}
			}

			sMsg = sMsg.slice(0, sMsg.length - 1);
			return sMsg;
		}
	}
}
